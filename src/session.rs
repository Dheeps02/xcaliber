use std::sync::atomic::{AtomicU16, Ordering};
use crate::xcp::{
    command::XcpCommand,
    error::XcpError,
    packet::XcpPacket,
    response::{ConnectResponse, XcpResponse},
    transport::XcpTransport,
};

/// State of an XCP session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionState {
    Disconnected,
    Connected,
}

pub struct XcpSession {
    transport: Box<dyn XcpTransport>,
    counter: AtomicU16,
    pub state: SessionState,
    pub slave_info: Option<ConnectResponse>,
    timeout_ms: u64,
}

impl XcpSession {
    pub fn new(transport: Box<dyn XcpTransport>, timeout_ms: u64) -> Self {
        Self {
            transport,
            counter: AtomicU16::new(0),
            state: SessionState::Disconnected,
            slave_info: None,
            timeout_ms,
        }
    }

    /// Send a command and return the decoded response.
    pub async fn execute(&self, cmd: &XcpCommand) -> Result<XcpResponse, XcpError> {
        let ctr = self.counter.fetch_add(1, Ordering::Relaxed);
        let payload = cmd.encode();
        let pid = payload[0];
        let packet = XcpPacket::new(ctr, payload);

        self.transport.send(&packet).await?;
        let resp_pkt = self.transport.recv(self.timeout_ms).await?;
        XcpResponse::decode(&resp_pkt.payload, Some(pid))
    }

    /// CONNECT handshake — updates session state and slave_info.
    pub async fn connect(&mut self) -> Result<&ConnectResponse, XcpError> {
        let resp = self.execute(&XcpCommand::Connect { mode: 0 }).await?;
        match resp {
            XcpResponse::Connect(info) => {
                self.slave_info = Some(info);
                self.state = SessionState::Connected;
                Ok(self.slave_info.as_ref().unwrap())
            }
            XcpResponse::Error(e) => Err(XcpError::ErrorResponse(
                crate::xcp::error::XcpErrorCode::from_byte(e.code),
            )),
            _ => Err(XcpError::UnexpectedPid(0)),
        }
    }

    /// DISCONNECT — resets session state.
    pub async fn disconnect(&mut self) -> Result<(), XcpError> {
        let _ = self.execute(&XcpCommand::Disconnect).await;
        self.transport.close().await;
        self.state = SessionState::Disconnected;
        self.slave_info = None;
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.state == SessionState::Connected
    }
}
