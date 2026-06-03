use std::sync::Arc;
use crate::xcp::{
    command::XcpCommand,
    error::XcpError,
    packet::XcpPacket,
    response::{ConnectResponse, XcpResponse},
    transport::{XcpTransport, dispatched::DispatchedTransport},
};

/// State of an XCP session.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionState {
    Disconnected,
    Connected,
}

pub struct XcpSession {
    transport: DispatchedTransport,
    pub state: SessionState,
    pub slave_info: Option<ConnectResponse>,
}

impl XcpSession {
    pub fn new(transport: Box<dyn XcpTransport>, timeout_ms: u64) -> Self {
        let inner: Arc<dyn XcpTransport> = Arc::from(transport);
        Self {
            transport: DispatchedTransport::new(inner, timeout_ms),
            state: SessionState::Disconnected,
            slave_info: None,
        }
    }

    pub fn peek_next_ctr(&self) -> u16 {
        self.transport.peek_ctr()
    }

    pub fn undo_ctr_increment(&self) {
        self.transport.undo_ctr_increment();
    }

    /// Send a command and wait for a response PID (≥ 0xFC), skipping DAQ DTOs.
    pub async fn execute(&self, cmd: &XcpCommand) -> Result<XcpResponse, XcpError> {
        self.transport.execute(cmd).await
    }

    /// Subscribe to the raw packet broadcast (PID-unfiltered).
    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<Arc<XcpPacket>> {
        self.transport.subscribe()
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
