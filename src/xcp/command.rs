use serde::Serialize;

/// All XCP commands we support, encoded to payload bytes.
#[derive(Debug, Clone, PartialEq)]
pub enum XcpCommand {
    Connect   { mode: u8 },
    Disconnect,
    GetStatus,
    GetCommModeInfo,
    GetId     { id_type: u8 },
    SetMta    { addr_ext: u8, addr: u32 },
    Upload    { size: u8 },
    Download  { data: Vec<u8> },
    Raw       { bytes: Vec<u8> },
}

impl XcpCommand {
    /// Encode to XCP payload bytes (no framing header).
    pub fn encode(&self) -> Vec<u8> {
        match self {
            Self::Connect { mode }       => vec![0xFF, *mode],
            Self::Disconnect             => vec![0xFE],
            Self::GetStatus              => vec![0xFD],
            Self::GetCommModeInfo        => vec![0xFB],
            Self::GetId { id_type }      => vec![0xFA, *id_type],
            Self::SetMta { addr_ext, addr } => {
                let a = addr.to_le_bytes();
                vec![0xF6, 0x00, 0x00, *addr_ext, a[0], a[1], a[2], a[3]]
            }
            Self::Upload { size }        => vec![0xF5, *size],
            Self::Download { data }      => {
                let mut out = vec![0xF0, data.len() as u8];
                out.extend_from_slice(data);
                out
            }
            Self::Raw { bytes }          => bytes.clone(),
        }
    }

    pub fn pid(&self) -> u8 {
        self.encode()[0]
    }

    pub fn name(&self) -> &'static str {
        match self {
            Self::Connect { .. }        => "CONNECT",
            Self::Disconnect            => "DISCONNECT",
            Self::GetStatus             => "GET_STATUS",
            Self::GetCommModeInfo       => "GET_COMM_MODE_INFO",
            Self::GetId { .. }          => "GET_ID",
            Self::SetMta { .. }         => "SET_MTA",
            Self::Upload { .. }         => "UPLOAD",
            Self::Download { .. }       => "DOWNLOAD",
            Self::Raw { .. }            => "RAW",
        }
    }
}

/// Serialisable summary of a sent command (stored in DB + SSE).
#[derive(Debug, Serialize)]
pub struct CommandInfo {
    pub name: &'static str,
    pub pid: u8,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connect_encode() {
        assert_eq!(XcpCommand::Connect { mode: 0 }.encode(), vec![0xFF, 0x00]);
    }

    #[test]
    fn set_mta_encode() {
        let bytes = XcpCommand::SetMta { addr_ext: 0, addr: 0x0000_1234 }.encode();
        assert_eq!(bytes[0], 0xF6);
        assert_eq!(&bytes[4..8], &0x0000_1234u32.to_le_bytes());
    }

    #[test]
    fn upload_encode() {
        assert_eq!(XcpCommand::Upload { size: 8 }.encode(), vec![0xF5, 0x08]);
    }
}
