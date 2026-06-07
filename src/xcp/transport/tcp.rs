use super::XcpTransport;
use crate::xcp::{error::XcpError, packet::XcpPacket};
use async_trait::async_trait;
use bytes::BytesMut;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    net::tcp::{OwnedReadHalf, OwnedWriteHalf},
    sync::Mutex,
    time,
};

pub struct TcpTransport {
    write: Mutex<OwnedWriteHalf>,
    read: Mutex<OwnedReadHalf>,
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
            socket
                .bind(local)
                .map_err(|e| XcpError::Transport(e.to_string()))?;
        }
        let stream: TcpStream = socket
            .connect(remote)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        let (r, w) = stream.into_split();
        Ok(Self {
            write: Mutex::new(w),
            read: Mutex::new(r),
        })
    }
}

#[async_trait]
impl XcpTransport for TcpTransport {
    async fn send(&self, packet: &XcpPacket) -> Result<(), XcpError> {
        self.write
            .lock()
            .await
            .write_all(&packet.encode())
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))
    }

    async fn recv(&self, timeout_ms: u64) -> Result<XcpPacket, XcpError> {
        let deadline = time::Duration::from_millis(timeout_ms);
        let mut r = self.read.lock().await;
        let mut header = [0u8; 4];
        time::timeout(deadline, r.read_exact(&mut header))
            .await
            .map_err(|_| XcpError::Timeout)?
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        let len = u16::from_le_bytes([header[0], header[1]]) as usize;
        let mut payload = vec![0u8; len];
        r.read_exact(&mut payload)
            .await
            .map_err(|e| XcpError::Transport(e.to_string()))?;
        let mut buf = BytesMut::with_capacity(4 + len);
        buf.extend_from_slice(&header);
        buf.extend_from_slice(&payload);
        XcpPacket::decode(&buf)
    }

    async fn close(&self) {
        let _ = self.write.lock().await.shutdown().await;
    }
}
