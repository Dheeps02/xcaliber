use std::sync::{
    Arc,
    atomic::{AtomicU16, Ordering},
};
use tokio::{sync::broadcast, time};
use crate::xcp::{
    command::XcpCommand,
    error::XcpError,
    packet::XcpPacket,
    response::XcpResponse,
    transport::XcpTransport,
};

const BROADCAST_CAP: usize = 1024;
const POLL_MS: u64 = 50;

/// Wraps a `Box<dyn XcpTransport>` with a background receive loop that
/// broadcasts every incoming packet. Callers subscribe to the broadcast
/// channel and filter by PID rather than calling `recv()` directly. This
/// allows concurrent command-response exchange and DAQ DTO collection.
pub struct DispatchedTransport {
    inner:        Arc<dyn XcpTransport>,
    broadcast_tx: broadcast::Sender<Arc<XcpPacket>>,
    task:         tokio::task::JoinHandle<()>,
    counter:      AtomicU16,
    timeout_ms:   u64,
}

impl DispatchedTransport {
    pub fn new(inner: Arc<dyn XcpTransport>, timeout_ms: u64) -> Self {
        let (tx, _) = broadcast::channel(BROADCAST_CAP);
        let tx2    = tx.clone();
        let inner2 = Arc::clone(&inner);

        let task = tokio::spawn(async move {
            loop {
                match inner2.recv(POLL_MS).await {
                    Ok(pkt)                  => { let _ = tx2.send(Arc::new(pkt)); }
                    Err(XcpError::Timeout)   => {}   // nothing arrived
                    Err(_)                   => break, // transport closed
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

    /// Subscribe to all incoming packets (both response PIDs ≥ 0xFC and DTO PIDs < 0xFC).
    pub fn subscribe(&self) -> broadcast::Receiver<Arc<XcpPacket>> {
        self.broadcast_tx.subscribe()
    }

    /// Send a command and wait for the matching XCP response (PID ≥ 0xFC).
    /// DTO packets (< 0xFC) received while waiting are silently skipped.
    pub async fn execute(&self, cmd: &XcpCommand) -> Result<XcpResponse, XcpError> {
        let cmd_pid = cmd.encode()[0];
        // Subscribe before sending to avoid a race where the response arrives
        // before we start listening.
        let mut sub = self.broadcast_tx.subscribe();
        let ctr    = self.counter.fetch_add(1, Ordering::Relaxed);
        let packet = XcpPacket::new(ctr, cmd.encode());
        self.inner.send(&packet).await?;

        time::timeout(time::Duration::from_millis(self.timeout_ms), async {
            loop {
                let pkt = sub.recv().await.map_err(|e| match e {
                    broadcast::error::RecvError::Closed  =>
                        XcpError::Transport("dispatch channel closed".into()),
                    broadcast::error::RecvError::Lagged(_) =>
                        XcpError::Transport("dispatch receiver lagged".into()),
                })?;
                if pkt.payload.first().copied().unwrap_or(0) >= 0xFC {
                    return XcpResponse::decode(&pkt.payload, Some(cmd_pid));
                }
                // Skip DAQ DTOs; keep waiting for a command response.
            }
        })
        .await
        .map_err(|_| XcpError::Timeout)?
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
