use serde::Serialize;

/// All XCP commands we support, encoded to payload bytes.
#[derive(Debug, Clone, PartialEq)]
pub enum XcpCommand {
    Connect   { mode: u8 },
    Disconnect,
    GetStatus,
    GetCommModeInfo,
    GetId     { id_type: u8 },
    SetMta    { addr_ext: u8, addr: u32, big_endian: bool },
    Upload    { size: u8 },
    Download  { data: Vec<u8> },
    Raw       { bytes: Vec<u8> },

    // ── DAQ ────────────────────────────────────────────────────────
    FreeDaq,
    AllocDaq         { count: u16 },
    AllocOdt         { daq_list_num: u16, odt_count: u8 },
    AllocOdtEntry    { daq_list_num: u16, odt_num: u8, entry_count: u8 },
    SetDaqPtr        { daq_list_num: u16, odt_num: u8, odt_entry_num: u8 },
    WriteDaq         { bit_offset: u8, size: u8, addr_ext: u8, addr: u32 },
    SetDaqListMode   { mode: u8, daq_list_num: u16, event_channel: u16, prescaler: u8, priority: u8 },
    StartStopDaqList { mode: u8, daq_list_num: u16 },
    StartStopSynch   { mode: u8 },
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
            Self::SetMta { addr_ext, addr, big_endian } => {
                let a = if *big_endian { addr.to_be_bytes() } else { addr.to_le_bytes() };
                vec![0xF6, 0x00, 0x00, *addr_ext, a[0], a[1], a[2], a[3]]
            }
            Self::Upload { size }        => vec![0xF5, *size],
            Self::Download { data }      => {
                let mut out = vec![0xF0, data.len() as u8];
                out.extend_from_slice(data);
                out
            }
            Self::Raw { bytes }          => bytes.clone(),

            Self::FreeDaq => vec![0xD6],
            Self::AllocDaq { count } => {
                let c = count.to_le_bytes();
                vec![0xD5, 0x00, c[0], c[1]]
            }
            Self::AllocOdt { daq_list_num, odt_count } => {
                let d = daq_list_num.to_le_bytes();
                vec![0xD4, 0x00, d[0], d[1], *odt_count]
            }
            Self::AllocOdtEntry { daq_list_num, odt_num, entry_count } => {
                let d = daq_list_num.to_le_bytes();
                vec![0xD3, 0x00, d[0], d[1], *odt_num, *entry_count]
            }
            Self::SetDaqPtr { daq_list_num, odt_num, odt_entry_num } => {
                let d = daq_list_num.to_le_bytes();
                vec![0xE2, 0x00, d[0], d[1], *odt_num, *odt_entry_num]
            }
            Self::WriteDaq { bit_offset, size, addr_ext, addr } => {
                let a = addr.to_le_bytes();
                vec![0xE1, *bit_offset, *size, *addr_ext, a[0], a[1], a[2], a[3]]
            }
            Self::SetDaqListMode { mode, daq_list_num, event_channel, prescaler, priority } => {
                let d = daq_list_num.to_le_bytes();
                let e = event_channel.to_le_bytes();
                vec![0xE0, *mode, d[0], d[1], e[0], e[1], *prescaler, *priority]
            }
            Self::StartStopDaqList { mode, daq_list_num } => {
                let d = daq_list_num.to_le_bytes();
                vec![0xDE, *mode, d[0], d[1]]
            }
            Self::StartStopSynch { mode } => vec![0xDD, *mode],
        }
    }

    pub fn pid(&self) -> u8 {
        self.encode()[0]
    }

    pub fn name(&self) -> &'static str {
        match self {
            Self::Connect { .. }           => "CONNECT",
            Self::Disconnect               => "DISCONNECT",
            Self::GetStatus                => "GET_STATUS",
            Self::GetCommModeInfo          => "GET_COMM_MODE_INFO",
            Self::GetId { .. }             => "GET_ID",
            Self::SetMta { .. }             => "SET_MTA",
            Self::Upload { .. }            => "UPLOAD",
            Self::Download { .. }          => "DOWNLOAD",
            Self::Raw { .. }               => "RAW",
            Self::FreeDaq                  => "FREE_DAQ",
            Self::AllocDaq { .. }          => "ALLOC_DAQ",
            Self::AllocOdt { .. }          => "ALLOC_ODT",
            Self::AllocOdtEntry { .. }     => "ALLOC_ODT_ENTRY",
            Self::SetDaqPtr { .. }         => "SET_DAQ_PTR",
            Self::WriteDaq { .. }          => "WRITE_DAQ",
            Self::SetDaqListMode { .. }    => "SET_DAQ_LIST_MODE",
            Self::StartStopDaqList { .. }  => "START_STOP_DAQ_LIST",
            Self::StartStopSynch { .. }    => "START_STOP_SYNCH",
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
        let bytes = XcpCommand::SetMta { addr_ext: 0, addr: 0x0000_1234, big_endian: false }.encode();
        assert_eq!(bytes[0], 0xF6);
        assert_eq!(&bytes[4..8], &0x0000_1234u32.to_le_bytes());
    }

    #[test]
    fn set_mta_encode_be() {
        let bytes = XcpCommand::SetMta { addr_ext: 0, addr: 0x0000_1234, big_endian: true }.encode();
        assert_eq!(bytes[0], 0xF6);
        assert_eq!(&bytes[4..8], &0x0000_1234u32.to_be_bytes());
    }

    #[test]
    fn upload_encode() {
        assert_eq!(XcpCommand::Upload { size: 8 }.encode(), vec![0xF5, 0x08]);
    }

    #[test]
    fn alloc_daq_encode() {
        let bytes = XcpCommand::AllocDaq { count: 3 }.encode();
        assert_eq!(bytes, vec![0xD5, 0x00, 0x03, 0x00]);
    }

    #[test]
    fn write_daq_encode() {
        let bytes = XcpCommand::WriteDaq {
            bit_offset: 0xFF, size: 4, addr_ext: 0, addr: 0x8000_4000,
        }.encode();
        assert_eq!(bytes[0], 0xE1);
        assert_eq!(bytes[1], 0xFF);
        assert_eq!(bytes[2], 4);
        assert_eq!(&bytes[4..8], &0x8000_4000u32.to_le_bytes());
    }

    #[test]
    fn start_stop_synch_encode() {
        assert_eq!(XcpCommand::StartStopSynch { mode: 0x01 }.encode(), vec![0xDD, 0x01]);
    }
}
