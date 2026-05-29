use async_trait::async_trait;
use bytes::BytesMut;
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpStream, sync::Mutex, time};
use crate::xcp::{error::XcpError, packet::XcpPacket};
use super::XcpTransport;

pub struct TcpTransport {
    stream: Mutex<TcpStream>,
}

impl TcpTransport {
    pub async fn connect(ip: &str, port: u16, bind_ip: Option<&str>) -> Result<Self, XcpError> {
        use tokio::net::TcpSocket;
        let remote: std::net::SocketAddr = format!("{ip}:{port}")
            .parse()
            .map_err(|e: std::net::AddrParseError| XcpError::Transport(e.to_string()))?;
        let socket = TcpSocket::new_v4().map_err(|e| XcpError::Transport(e.to_string()))?;
        if let Some(bind) = bind_ip.filter(|s| !s.is_empty()) {
            let local: std::net::SocketAddr = format!("{bind}:0")
                .parse()
                .map_err(|e: std::net::AddrParseError| XcpError::Transport(e.to_string()))?;
            socket.bind(local).map_err(|e| XcpError::Transport(e.to_string()))?;
        }
        let stream = socket.connect(remote)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        Ok(Self { stream: Mutex::new(stream) })
    }
}

#[async_trait]
impl XcpTransport for TcpTransport {
    async fn send(&self, packet: &XcpPacket) -> Result<(), XcpError> {
        let mut s = self.stream.lock().await;
        s.write_all(&packet.encode())
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        Ok(())
    }

    async fn recv(&self, timeout_ms: u64) -> Result<XcpPacket, XcpError> {
        let mut s = self.stream.lock().await;
        let deadline = time::Duration::from_millis(timeout_ms);
        // Read 4-byte header first, then payload
        let mut header = [0u8; 4];
        time::timeout(deadline, s.read_exact(&mut header))
            .await
            .map_err(|_| XcpError::Timeout)?
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        let len = u16::from_le_bytes([header[0], header[1]]) as usize;
        let mut payload = vec![0u8; len];
        s.read_exact(&mut payload)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        let mut buf = BytesMut::with_capacity(4 + len);
        buf.extend_from_slice(&header);
        buf.extend_from_slice(&payload);
        XcpPacket::decode(&buf)
    }

    async fn close(&self) {
        let _ = self.stream.lock().await.shutdown().await;
    }
}
