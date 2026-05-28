use async_trait::async_trait;
use std::net::SocketAddr;
use tokio::{net::UdpSocket, time};
use crate::xcp::{error::XcpError, packet::XcpPacket};
use super::XcpTransport;

pub struct UdpTransport {
    socket: UdpSocket,
    remote: SocketAddr,
}

impl UdpTransport {
    pub async fn connect(ip: &str, port: u16) -> Result<Self, XcpError> {
        let remote: SocketAddr = format!("{ip}:{port}")
            .parse()
            .map_err(|e: std::net::AddrParseError| XcpError::Transport(e.to_string()))?;
        let local: SocketAddr = "0.0.0.0:0".parse().unwrap();
        let socket = UdpSocket::bind(local)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        socket.connect(remote)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        Ok(Self { socket, remote })
    }
}

#[async_trait]
impl XcpTransport for UdpTransport {
    async fn send(&self, packet: &XcpPacket) -> Result<(), XcpError> {
        self.socket
            .send(&packet.encode())
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        Ok(())
    }

    async fn recv(&self, timeout_ms: u64) -> Result<XcpPacket, XcpError> {
        let mut buf = vec![0u8; 2048];
        let deadline = time::Duration::from_millis(timeout_ms);
        let n = time::timeout(deadline, self.socket.recv(&mut buf))
            .await
            .map_err(|_| XcpError::Timeout)?
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        XcpPacket::decode(&buf[..n])
    }

    async fn close(&self) {
        // UdpSocket closes on drop
    }
}
