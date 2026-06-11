use async_trait::async_trait;
use std::net::SocketAddr;
use tokio::{net::UdpSocket, time};

use super::XcpTransport;
use crate::debug_log::log as debug_log;
use crate::xcp::{error::XcpError, packet::XcpPacket};

pub struct UdpTransport {
    socket: UdpSocket,
}

impl UdpTransport {
    pub async fn connect(
        ip: &str,
        port: u16,
        bind_ip: Option<&str>,
        source_port: Option<u16>,
    ) -> Result<Self, XcpError> {
        let remote: SocketAddr = format!("{ip}:{port}")
            .parse()
            .map_err(|e: std::net::AddrParseError| XcpError::Transport(e.to_string()))?;
        let local_host = bind_ip.filter(|s| !s.is_empty()).unwrap_or("0.0.0.0");

        let socket = match Self::bind_and_connect(local_host, source_port.unwrap_or(0), remote).await {
            Ok(socket) => socket,
            Err(e) if source_port.is_some() => {
                debug_log(format!(
                    "UdpTransport::connect: bind to {local_host}:{} failed ({e}), retrying with an ephemeral port",
                    source_port.unwrap()
                ));
                Self::bind_and_connect(local_host, 0, remote).await?
            }
            Err(e) => return Err(e),
        };

        // A fixed source port equal to the slave's port can resolve to the same
        // local address as `remote` on a loopback connection (both ends become
        // e.g. 127.0.0.1:5555), so the slave's replies loop back to its own
        // socket instead of reaching us. Fall back to an ephemeral port.
        let socket = if source_port.is_some() && socket.local_addr().ok() == Some(remote) {
            debug_log(format!(
                "UdpTransport::connect: local address {remote} collides with the slave's address, retrying with an ephemeral port"
            ));
            Self::bind_and_connect(local_host, 0, remote).await?
        } else {
            socket
        };

        debug_log(format!(
            "UdpTransport::connect: bound {} -> {}",
            socket
                .local_addr()
                .map(|a| a.to_string())
                .unwrap_or_else(|_| "?".into()),
            remote
        ));

        Ok(Self { socket })
    }

    async fn bind_and_connect(
        local_host: &str,
        local_port: u16,
        remote: SocketAddr,
    ) -> Result<UdpSocket, XcpError> {
        let local: SocketAddr = format!("{local_host}:{local_port}")
            .parse()
            .map_err(|e: std::net::AddrParseError| XcpError::Transport(e.to_string()))?;
        let socket = UdpSocket::bind(local)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        socket
            .connect(remote)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        Ok(socket)
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
        let n = time::timeout(
            time::Duration::from_millis(timeout_ms),
            self.socket.recv(&mut buf),
        )
        .await
        .map_err(|_| XcpError::Timeout)?
        .map_err(|e| XcpError::Transport(e.to_string()))?;
        XcpPacket::decode(&buf[..n])
    }

    async fn close(&self) {
        // UdpSocket closes on drop
    }
}
