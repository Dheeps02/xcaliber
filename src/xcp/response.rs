use crate::xcp::error::{XcpError, XcpErrorCode};
use serde::Serialize;

/// Decoded XCP response.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum XcpResponse {
    Connect(ConnectResponse),
    Disconnect,
    GetStatus(GetStatusResponse),
    GetCommModeInfo(GetCommModeInfoResponse),
    GetId(GetIdResponse),
    SetMta,
    Upload(UploadResponse),
    Download,
    BuildChecksum(BuildChecksumResponse),
    Error(ErrorResponse),
    /// Raw positive response with unknown payload.
    PositiveRaw {
        payload: Vec<u8>,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectResponse {
    pub resource: u8,
    pub comm_mode_basic: u8,
    pub max_cto: u8,
    pub max_dto: u16,
    pub protocol_version: u8,
    pub transport_version: u8,
    /// Derived from resource byte.
    pub cal_pag: bool,
    pub daq: bool,
    pub stim: bool,
    pub pgm: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GetStatusResponse {
    pub session_status: u8,
    pub resource_protection: u8,
    pub session_config_id: u16,
    pub daq_running: bool,
    pub resume: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GetCommModeInfoResponse {
    pub comm_mode_optional: u8,
    pub max_bs: u8,
    pub min_st: u8,
    pub queue_size: u8,
    pub driver_version: u8,
    pub interleaved: bool,
    pub master_block: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GetIdResponse {
    pub id_type: u8,
    pub length: u32,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadResponse {
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BuildChecksumResponse {
    pub checksum_type: u8,
    pub checksum: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorResponse {
    pub code: u8,
    pub name: String,
}

impl XcpResponse {
    /// Decode a raw payload.
    ///
    /// `last_cmd_pid` is used to disambiguate which positive response this is.
    pub fn decode(payload: &[u8], last_cmd_pid: Option<u8>) -> Result<Self, XcpError> {
        if payload.is_empty() {
            return Err(XcpError::FrameTooShort(0));
        }
        match payload[0] {
            0xFF => Self::decode_positive(payload, last_cmd_pid),
            0xFE => {
                let code = payload.get(1).copied().unwrap_or(0xFF);
                let ec = XcpErrorCode::from_byte(code);
                Ok(Self::Error(ErrorResponse {
                    code,
                    name: ec.name().to_string(),
                }))
            }
            pid => Err(XcpError::UnexpectedPid(pid)),
        }
    }

    fn decode_positive(payload: &[u8], last_cmd_pid: Option<u8>) -> Result<Self, XcpError> {
        match last_cmd_pid {
            Some(0xFF) => {
                // CONNECT response: FF resource comm_mode_basic reserved max_cto max_dto(2) proto transport
                if payload.len() < 8 {
                    return Err(XcpError::FrameTooShort(payload.len()));
                }
                let resource = payload[1];
                let max_dto = u16::from_le_bytes([payload[5], payload[6]]);
                Ok(Self::Connect(ConnectResponse {
                    resource,
                    comm_mode_basic: payload[2],
                    max_cto: payload[4],
                    max_dto,
                    protocol_version: payload[7],
                    transport_version: payload[7], // same byte on XCP 1.0
                    cal_pag: resource & 0x01 != 0,
                    daq: resource & 0x04 != 0,
                    stim: resource & 0x08 != 0,
                    pgm: resource & 0x10 != 0,
                }))
            }
            Some(0xFE) => Ok(Self::Disconnect),
            Some(0xFD) => {
                if payload.len() < 6 {
                    return Err(XcpError::FrameTooShort(payload.len()));
                }
                let ss = payload[1];
                Ok(Self::GetStatus(GetStatusResponse {
                    session_status: ss,
                    resource_protection: payload[2],
                    session_config_id: u16::from_le_bytes([payload[4], payload[5]]),
                    daq_running: ss & 0x04 != 0,
                    resume: ss & 0x80 != 0,
                }))
            }
            Some(0xFB) => {
                if payload.len() < 8 {
                    return Err(XcpError::FrameTooShort(payload.len()));
                }
                let cm = payload[2];
                Ok(Self::GetCommModeInfo(GetCommModeInfoResponse {
                    comm_mode_optional: cm,
                    max_bs: payload[4],
                    min_st: payload[5],
                    queue_size: payload[6],
                    driver_version: payload[7],
                    interleaved: cm & 0x02 != 0,
                    master_block: cm & 0x01 != 0,
                }))
            }
            Some(0xFA) => {
                if payload.len() < 8 {
                    return Err(XcpError::FrameTooShort(payload.len()));
                }
                let length = u32::from_le_bytes([payload[4], payload[5], payload[6], payload[7]]);
                Ok(Self::GetId(GetIdResponse {
                    id_type: payload[1],
                    length,
                    value: None, // filled in after UPLOAD
                }))
            }
            Some(0xF6) => Ok(Self::SetMta),
            Some(0xF5) => Ok(Self::Upload(UploadResponse {
                data: payload[1..].to_vec(),
            })),
            Some(0xF4) => {
                // SHORT_UPLOAD — same response layout as UPLOAD
                Ok(Self::Upload(UploadResponse {
                    data: payload[1..].to_vec(),
                }))
            }
            Some(0xF3) => {
                if payload.len() < 8 {
                    return Err(XcpError::FrameTooShort(payload.len()));
                }
                let checksum_type = payload[1];
                let checksum = u32::from_le_bytes([payload[4], payload[5], payload[6], payload[7]]);
                Ok(Self::BuildChecksum(BuildChecksumResponse {
                    checksum_type,
                    checksum,
                }))
            }
            Some(0xF0) => Ok(Self::Download),
            _ => Ok(Self::PositiveRaw {
                payload: payload.to_vec(),
            }),
        }
    }

    /// Reconstruct the raw payload bytes for display in the packet trace.
    pub fn encode(&self) -> Vec<u8> {
        match self {
            Self::Connect(r) => {
                let [dto_lo, dto_hi] = r.max_dto.to_le_bytes();
                vec![
                    0xFF,
                    r.resource,
                    r.comm_mode_basic,
                    0x00,
                    r.max_cto,
                    dto_lo,
                    dto_hi,
                    r.protocol_version,
                ]
            }
            Self::Disconnect => vec![0xFF],
            Self::GetStatus(r) => {
                let [id_lo, id_hi] = r.session_config_id.to_le_bytes();
                vec![
                    0xFF,
                    r.session_status,
                    r.resource_protection,
                    0x00,
                    id_lo,
                    id_hi,
                ]
            }
            Self::GetCommModeInfo(r) => {
                vec![
                    0xFF,
                    0x00,
                    r.comm_mode_optional,
                    0x00,
                    r.max_bs,
                    r.min_st,
                    r.queue_size,
                    r.driver_version,
                ]
            }
            Self::GetId(r) => {
                let len = r.length.to_le_bytes();
                vec![0xFF, r.id_type, 0x00, 0x00, len[0], len[1], len[2], len[3]]
            }
            Self::SetMta => vec![0xFF],
            Self::Upload(r) => {
                let mut v = vec![0xFF];
                v.extend_from_slice(&r.data);
                v
            }
            Self::Download => vec![0xFF],
            Self::BuildChecksum(r) => {
                let cs = r.checksum.to_le_bytes();
                vec![
                    0xFF,
                    r.checksum_type,
                    0x00,
                    0x00,
                    cs[0],
                    cs[1],
                    cs[2],
                    cs[3],
                ]
            }
            Self::Error(e) => vec![0xFE, e.code],
            Self::PositiveRaw { payload } => payload.clone(),
        }
    }

    /// Short human-readable decoded summary for the trace.
    pub fn summary(&self) -> String {
        match self {
            Self::Connect(r) => format!(
                "+OK CONNECT — cal_pag={} daq={} max_cto={} max_dto={} proto={}.{}",
                r.cal_pag, r.daq, r.max_cto, r.max_dto, r.protocol_version, r.transport_version
            ),
            Self::Disconnect => "+OK DISCONNECT".into(),
            Self::GetStatus(r) => format!(
                "+OK GET_STATUS — daq_running={} resume={} session_id={}",
                r.daq_running, r.resume, r.session_config_id
            ),
            Self::GetCommModeInfo(r) => format!(
                "+OK GET_COMM_MODE_INFO — max_bs={} min_st={} driver_version={}",
                r.max_bs, r.min_st, r.driver_version
            ),
            Self::GetId(r) => format!(
                "+OK GET_ID — {} bytes{}",
                r.length,
                r.value
                    .as_ref()
                    .map(|v| format!(" \"{v}\""))
                    .unwrap_or_default()
            ),
            Self::SetMta => "+OK SET_MTA".into(),
            Self::Upload(r) => format!("+OK UPLOAD — {} bytes", r.data.len()),
            Self::Download => "+OK DOWNLOAD".into(),
            Self::BuildChecksum(r) => format!(
                "+OK BUILD_CHECKSUM — type=0x{:02X} checksum=0x{:08X}",
                r.checksum_type, r.checksum
            ),
            Self::Error(e) => format!("-ERR {} (0x{:02X})", e.name, e.code),
            Self::PositiveRaw { payload } => format!("+OK raw {} bytes", payload.len()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_connect_response() {
        // FF 01 00 00 FF FF 05 01 01
        let payload = vec![0xFF, 0x01, 0x00, 0x00, 0xFF, 0xFF, 0x05, 0x01, 0x01];
        let resp = XcpResponse::decode(&payload, Some(0xFF)).unwrap();
        let XcpResponse::Connect(r) = resp else {
            panic!("expected XcpResponse::Connect, got {resp:?}");
        };
        assert!(r.cal_pag);
        assert!(!r.daq);
        assert_eq!(r.max_cto, 255);
        assert_eq!(r.max_dto, 0x05FF);
    }

    #[test]
    fn decode_error_response() {
        let payload = vec![0xFE, 0x20];
        let resp = XcpResponse::decode(&payload, Some(0xFF)).unwrap();
        let XcpResponse::Error(e) = resp else {
            panic!("expected XcpResponse::Error, got {resp:?}");
        };
        assert_eq!(e.name, "ERR_CMD_UNKNOWN");
    }
}
