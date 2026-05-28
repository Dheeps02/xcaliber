use async_trait::async_trait;
use crate::xcp::{error::XcpError, packet::XcpPacket};

pub mod udp;
pub mod tcp;

#[async_trait]
pub trait XcpTransport: Send + Sync {
    async fn send(&self, packet: &XcpPacket) -> Result<(), XcpError>;
    async fn recv(&self, timeout_ms: u64) -> Result<XcpPacket, XcpError>;
    async fn close(&self);
}
