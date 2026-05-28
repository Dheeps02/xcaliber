/// XCP-on-Ethernet packet framing.
///
/// Wire format (4-byte header + payload):
///   [LEN_LO, LEN_HI, CTR_LO, CTR_HI, payload...]
///
/// LEN is the payload length only (not including the header).
/// CTR is a per-connection counter incremented with each CTO/DTO.

#[derive(Debug, Clone, PartialEq)]
pub struct XcpPacket {
    pub counter: u16,
    pub payload: Vec<u8>,
}

impl XcpPacket {
    pub fn new(counter: u16, payload: Vec<u8>) -> Self {
        Self { counter, payload }
    }

    /// Encode to wire bytes (4-byte header + payload).
    pub fn encode(&self) -> Vec<u8> {
        let len = self.payload.len() as u16;
        let mut out = Vec::with_capacity(4 + self.payload.len());
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&self.counter.to_le_bytes());
        out.extend_from_slice(&self.payload);
        out
    }

    /// Decode from a flat byte slice (header + payload).
    pub fn decode(buf: &[u8]) -> Result<Self, crate::xcp::error::XcpError> {
        if buf.len() < 4 {
            return Err(crate::xcp::error::XcpError::FrameTooShort(buf.len()));
        }
        let len = u16::from_le_bytes([buf[0], buf[1]]) as usize;
        let counter = u16::from_le_bytes([buf[2], buf[3]]);
        if buf.len() < 4 + len {
            return Err(crate::xcp::error::XcpError::FrameTooShort(buf.len()));
        }
        Ok(Self { counter, payload: buf[4..4 + len].to_vec() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let pkt = XcpPacket::new(7, vec![0xFF, 0x00]);
        let encoded = pkt.encode();
        let decoded = XcpPacket::decode(&encoded).unwrap();
        assert_eq!(decoded, pkt);
    }

    #[test]
    fn decode_too_short() {
        assert!(XcpPacket::decode(&[0x02, 0x00]).is_err());
    }
}
