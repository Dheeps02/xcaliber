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
        if matches!(buf.first(), Some(0xFF | 0xFE | 0xFD | 0xFC)) {
            return Ok(Self {
                counter: 0,
                payload: buf.to_vec(),
            });
        }
        if buf.len() < 4 {
            return Err(crate::xcp::error::XcpError::FrameTooShort(buf.len()));
        }

        if let Some(packet) = decode_with_header(buf, Endian::Little, HeaderOrder::LenCtr) {
            return Ok(packet);
        }
        if let Some(packet) = decode_with_header(buf, Endian::Big, HeaderOrder::LenCtr) {
            return Ok(packet);
        }
        if let Some(packet) = decode_with_header(buf, Endian::Little, HeaderOrder::CtrLen) {
            return Ok(packet);
        }
        if let Some(packet) = decode_with_header(buf, Endian::Big, HeaderOrder::CtrLen) {
            return Ok(packet);
        }

        Err(crate::xcp::error::XcpError::FrameTooShort(buf.len()))
    }
}

#[derive(Clone, Copy)]
enum Endian {
    Little,
    Big,
}

#[derive(Clone, Copy)]
enum HeaderOrder {
    LenCtr,
    CtrLen,
}

fn read_u16(bytes: [u8; 2], endian: Endian) -> u16 {
    match endian {
        Endian::Little => u16::from_le_bytes(bytes),
        Endian::Big => u16::from_be_bytes(bytes),
    }
}

fn decode_with_header(buf: &[u8], endian: Endian, order: HeaderOrder) -> Option<XcpPacket> {
    let first = read_u16([buf[0], buf[1]], endian);
    let second = read_u16([buf[2], buf[3]], endian);
    let (len, counter) = match order {
        HeaderOrder::LenCtr => (first as usize, second),
        HeaderOrder::CtrLen => (second as usize, first),
    };

    if len == 0 || buf.len() < 4 + len {
        return None;
    }
    let payload = &buf[4..4 + len];
    if !matches!(
        payload.first(),
        Some(0xFF | 0xFE | 0xFD | 0xFC | 0x00..=0xFB)
    ) {
        return None;
    }
    Some(XcpPacket {
        counter,
        payload: payload.to_vec(),
    })
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

    #[test]
    fn decode_big_endian_header() {
        let decoded = XcpPacket::decode(&[0x00, 0x02, 0x00, 0x07, 0xFF, 0x00]).unwrap();
        assert_eq!(decoded, XcpPacket::new(7, vec![0xFF, 0x00]));
    }

    #[test]
    fn decode_counter_then_length_header() {
        let decoded = XcpPacket::decode(&[0x07, 0x00, 0x02, 0x00, 0xFF, 0x00]).unwrap();
        assert_eq!(decoded, XcpPacket::new(7, vec![0xFF, 0x00]));
    }

    #[test]
    fn decode_raw_payload_without_transport_header() {
        let decoded = XcpPacket::decode(&[0xFF, 0x00]).unwrap();
        assert_eq!(decoded, XcpPacket::new(0, vec![0xFF, 0x00]));
    }
}
