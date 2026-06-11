use crate::debug_log::log as debug_log;
use crate::xcp::{
    command::XcpCommand, error::XcpError, packet::XcpPacket, response::XcpResponse,
    transport::XcpTransport,
};
use std::sync::{
    Arc,
    atomic::{AtomicU16, Ordering},
};
use tokio::{sync::broadcast, time};

const BROADCAST_CAP: usize = 1024;
const POLL_MS: u64 = 50;

/// Wraps a `Box<dyn XcpTransport>` with a background receive loop that
/// broadcasts every incoming packet. Callers subscribe to the broadcast
/// channel and filter by PID rather than calling `recv()` directly. This
/// allows concurrent command-response exchange and DAQ DTO collection.
pub struct DispatchedTransport {
    inner: Arc<dyn XcpTransport>,
    broadcast_tx: broadcast::Sender<Arc<XcpPacket>>,
    task: tokio::task::JoinHandle<()>,
    counter: AtomicU16,
    timeout_ms: u64,
}

impl DispatchedTransport {
    pub fn new(inner: Arc<dyn XcpTransport>, timeout_ms: u64) -> Self {
        let (tx, _) = broadcast::channel(BROADCAST_CAP);
        let tx2 = tx.clone();
        let inner2 = Arc::clone(&inner);

        let task = tokio::spawn(async move {
            loop {
                match inner2.recv(POLL_MS).await {
                    Ok(pkt) => {
                        debug_log(format!(
                            "dispatch: recv pid=0x{:02X} len={} ctr={} -> broadcasting (subscribers={})",
                            pkt.payload.first().copied().unwrap_or(0),
                            pkt.payload.len(),
                            pkt.counter,
                            tx2.receiver_count()
                        ));
                        match tx2.send(Arc::new(pkt)) {
                            Ok(n) => debug_log(format!("dispatch: send delivered to {n} receiver(s)")),
                            Err(_) => debug_log("dispatch: send failed, no receivers".to_string()),
                        }
                    }
                    Err(XcpError::Timeout) => {} // nothing arrived
                    Err(e) => {
                        debug_log(format!("dispatch: recv loop ending, error: {e}"));
                        break; // transport closed
                    }
                }
            }
        });

        Self {
            inner,
            broadcast_tx: tx,
            task,
            counter: AtomicU16::new(0),
            timeout_ms,
        }
    }

    pub fn peek_ctr(&self) -> u16 {
        self.counter.load(Ordering::Relaxed)
    }

    /// Roll back the counter after a silent keepalive so user-visible ctrs stay contiguous.
    /// Safe to call only while the session mutex is held (no other execute can interleave).
    pub fn undo_ctr_increment(&self) {
        self.counter.fetch_sub(1, Ordering::Relaxed);
    }

    /// Subscribe to all incoming packets (both response PIDs ≥ 0xFC and DTO PIDs < 0xFC).
    pub fn subscribe(&self) -> broadcast::Receiver<Arc<XcpPacket>> {
        self.broadcast_tx.subscribe()
    }

    /// Send a command and wait for the matching XCP response (PID ≥ 0xFC).
    /// DTO packets (< 0xFC) received while waiting are silently skipped.
    pub async fn execute(&self, cmd: &XcpCommand) -> Result<XcpResponse, XcpError> {
        self.execute_packet(cmd).await.map(|(resp, _)| resp)
    }

    pub async fn execute_packet(
        &self,
        cmd: &XcpCommand,
    ) -> Result<(XcpResponse, Arc<XcpPacket>), XcpError> {
        let cmd_pid = cmd.encode()[0];
        // Subscribe before sending to avoid a race where the response arrives
        // before we start listening.
        let mut sub = self.broadcast_tx.subscribe();
        let ctr = self.counter.fetch_add(1, Ordering::Relaxed);
        let packet = XcpPacket::new(ctr, cmd.encode());
        debug_log(format!(
            "execute_packet: sending cmd_pid=0x{cmd_pid:02X} ctr={ctr} timeout_ms={}",
            self.timeout_ms
        ));
        self.inner.send(&packet).await?;

        debug_log(format!("execute_packet: entering wait loop for ctr={ctr}"));
        let result = time::timeout(time::Duration::from_millis(self.timeout_ms), async {
            loop {
                let pkt = match sub.recv().await {
                    Ok(p) => p,
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        debug_log(format!("execute_packet: subscriber lagged, missed {n} packets"));
                        continue; // missed some DTOs, keep waiting
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        debug_log("execute_packet: dispatch channel closed".to_string());
                        return Err(XcpError::Transport("dispatch channel closed".into()));
                    }
                };
                let pid = pkt.payload.first().copied().unwrap_or(0);
                debug_log(format!(
                    "execute_packet: received pid=0x{pid:02X} len={} ctr={} (waiting for cmd_pid=0x{cmd_pid:02X})",
                    pkt.payload.len(),
                    pkt.counter
                ));
                if pid >= 0xFC {
                    match XcpResponse::decode(&pkt.payload, Some(cmd_pid)) {
                        Ok(resp) => {
                            debug_log(format!("execute_packet: decoded response {resp:?}"));
                            return Ok((resp, pkt));
                        }
                        Err(e) => {
                            debug_log(format!(
                                "execute_packet: failed to decode response payload {:02X?}: {e}",
                                pkt.payload
                            ));
                            continue;
                        }
                    }
                }
                // Skip DAQ DTOs; keep waiting for a command response.
            }
        })
        .await
        .map_err(|_| XcpError::Timeout)?;

        match &result {
            Ok((resp, pkt)) => debug_log(format!(
                "execute_packet: returning Ok ctr={} resp={resp:?}",
                pkt.counter
            )),
            Err(e) => debug_log(format!("execute_packet: returning Err {e}")),
        }
        result
    }

    pub async fn close(&self) {
        self.inner.close().await;
        self.task.abort();
    }
}

impl Drop for DispatchedTransport {
    fn drop(&mut self) {
        self.task.abort();
    }
}
