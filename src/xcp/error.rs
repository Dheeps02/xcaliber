use thiserror::Error;

#[derive(Debug, Error, Clone)]
pub enum XcpError {
    #[error("frame too short: {0} bytes")]
    FrameTooShort(usize),

    #[error("XCP error response: {0:?}")]
    ErrorResponse(XcpErrorCode),

    #[error("unexpected response PID: 0x{0:02X}")]
    UnexpectedPid(u8),

    #[error("transport error: {0}")]
    Transport(String),

    #[error("not connected")]
    NotConnected,

    #[error("timeout")]
    Timeout,
}

/// XCP error codes from the ERR response (0xFE PID).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum XcpErrorCode {
    CmdSynch       = 0x00,
    CmdBusy         = 0x10,
    DaqActive       = 0x11,
    PgmActive       = 0x12,
    CmdUnknown      = 0x20,
    CmdSyntax       = 0x21,
    OutOfRange      = 0x22,
    WriteProtected  = 0x23,
    AccessDenied    = 0x24,
    AccessLocked    = 0x25,
    PageNotValid    = 0x26,
    ModeNotValid    = 0x27,
    SegmentNotValid = 0x28,
    Sequence        = 0x29,
    DaqConfig       = 0x2A,
    MemoryOverflow  = 0x30,
    Generic         = 0x31,
    Verify          = 0x32,
    Unknown(u8),
}

impl XcpErrorCode {
    pub fn from_byte(b: u8) -> Self {
        match b {
            0x00 => Self::CmdSynch,
            0x10 => Self::CmdBusy,
            0x11 => Self::DaqActive,
            0x12 => Self::PgmActive,
            0x20 => Self::CmdUnknown,
            0x21 => Self::CmdSyntax,
            0x22 => Self::OutOfRange,
            0x23 => Self::WriteProtected,
            0x24 => Self::AccessDenied,
            0x25 => Self::AccessLocked,
            0x26 => Self::PageNotValid,
            0x27 => Self::ModeNotValid,
            0x28 => Self::SegmentNotValid,
            0x29 => Self::Sequence,
            0x2A => Self::DaqConfig,
            0x30 => Self::MemoryOverflow,
            0x31 => Self::Generic,
            0x32 => Self::Verify,
            other => Self::Unknown(other),
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Self::CmdSynch       => "ERR_CMD_SYNCH",
            Self::CmdBusy         => "ERR_CMD_BUSY",
            Self::DaqActive       => "ERR_DAQ_ACTIVE",
            Self::PgmActive       => "ERR_PGM_ACTIVE",
            Self::CmdUnknown      => "ERR_CMD_UNKNOWN",
            Self::CmdSyntax       => "ERR_CMD_SYNTAX",
            Self::OutOfRange      => "ERR_OUT_OF_RANGE",
            Self::WriteProtected  => "ERR_WRITE_PROTECTED",
            Self::AccessDenied    => "ERR_ACCESS_DENIED",
            Self::AccessLocked    => "ERR_ACCESS_LOCKED",
            Self::PageNotValid    => "ERR_PAGE_NOT_VALID",
            Self::ModeNotValid    => "ERR_MODE_NOT_VALID",
            Self::SegmentNotValid => "ERR_SEGMENT_NOT_VALID",
            Self::Sequence        => "ERR_SEQUENCE",
            Self::DaqConfig       => "ERR_DAQ_CONFIG",
            Self::MemoryOverflow  => "ERR_MEMORY_OVERFLOW",
            Self::Generic         => "ERR_GENERIC",
            Self::Verify          => "ERR_VERIFY",
            Self::Unknown(_)      => "ERR_UNKNOWN",
        }
    }
}
