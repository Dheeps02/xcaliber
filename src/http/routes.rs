use axum::{
    Json,
    extract::{Path, Query, State},
    response::IntoResponse,
};
use serde::Deserialize;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{collections::HashMap, sync::Arc};

use crate::{
    debug_log::log as debug_log,
    http::state::{AppState, DaqEntryDef, DaqListDef, DaqOdtDef, DaqStatus, PacketEntry},
    session::XcpSession,
    xcp::{
        command::XcpCommand,
        response::XcpResponse,
        transport::ethernet::{EthernetConfig, EthernetTransport},
        transport::udp::UdpTransport,
    },
};

// ── helpers ──────────────────────────────────────────────────────

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn broadcast_packet(state: &AppState, event: &str, entry: &PacketEntry) {
    let _ = state
        .tx
        .send(serde_json::to_string(&json!({ "event": event, "data": entry })).unwrap_or_default());
}

/// Translate an XcpError into a short, user-readable string.
fn user_error(e: &crate::xcp::error::XcpError) -> String {
    use crate::xcp::error::XcpError;
    match e {
        XcpError::NotConnected => "Not connected to XCP slave".into(),
        XcpError::Timeout => "Timed out — no response from XCP slave".into(),
        XcpError::ErrorResponse(code) => format!("XCP slave returned {}", code.name()),
        XcpError::Transport(msg) => {
            let cause = if let Some(i) = msg.rfind(" (os error ") {
                &msg[..i]
            } else {
                msg.as_str()
            };
            format!("Transport error — {cause}")
        }
        XcpError::FrameTooShort(n) => format!("Malformed response — frame too short ({n} bytes)"),
        XcpError::UnexpectedPid(p) => format!("Unexpected response from slave — PID 0x{p:02X}"),
    }
}

/// Format a connection error with the target address.
fn connect_error(ip: &str, port: u16, e: &crate::xcp::error::XcpError) -> String {
    use crate::xcp::error::XcpError;
    let cause = match e {
        XcpError::Transport(msg) => {
            let c = if let Some(i) = msg.rfind(" (os error ") {
                &msg[..i]
            } else {
                msg.as_str()
            };
            c.to_string()
        }
        XcpError::Timeout => "timed out".into(),
        other => other.to_string(),
    };
    format!("Cannot connect to XCP slave at {ip}:{port} — {cause}")
}

fn log_tx(state: &AppState, cmd: &XcpCommand, ctr: u16) -> PacketEntry {
    let payload = cmd.encode();
    let decoded = match cmd {
        XcpCommand::Connect { mode } => json!({ "command": "CONNECT", "mode": mode }),
        XcpCommand::Disconnect => json!({ "command": "DISCONNECT" }),
        XcpCommand::GetStatus => json!({ "command": "GET_STATUS" }),
        XcpCommand::GetCommModeInfo => json!({ "command": "GET_COMM_MODE_INFO" }),
        XcpCommand::GetId { id_type } => json!({ "command": "GET_ID", "id_type": id_type }),
        XcpCommand::SetMta {
            addr_ext,
            addr,
            big_endian,
        } => {
            json!({ "command": "SET_MTA", "addr_ext": addr_ext, "addr": addr, "big_endian": big_endian })
        }
        XcpCommand::Upload { size } => json!({ "command": "UPLOAD", "size": size }),
        XcpCommand::Download { data } => json!({ "command": "DOWNLOAD", "length": data.len() }),
        XcpCommand::Raw { bytes } => {
            let name = match bytes.first().copied() {
                Some(0xFF) => "CONNECT",
                Some(0xFE) => "DISCONNECT",
                Some(0xFD) => "GET_STATUS",
                Some(0xFC) => "SYNC",
                Some(0xFB) => "GET_COMM_MODE_INFO",
                Some(0xFA) => "GET_ID",
                Some(0xF9) => "SET_REQUEST",
                Some(0xF8) => "GET_SEED",
                Some(0xF7) => "UNLOCK",
                Some(0xF6) => "SET_MTA",
                Some(0xF5) => "UPLOAD",
                Some(0xF4) => "SHORT_UPLOAD",
                Some(0xF3) => "BUILD_CHECKSUM",
                Some(0xF2) => "TRANSPORT_LAYER_CMD",
                Some(0xF1) => "USER_CMD",
                Some(0xF0) => "DOWNLOAD",
                Some(0xEF) => "DOWNLOAD_NEXT",
                Some(0xEE) => "DOWNLOAD_MAX",
                Some(0xED) => "SHORT_DOWNLOAD",
                Some(0xEC) => "TIME_CORRELATION",
                Some(0xEB) => "SET_CAL_PAGE",
                Some(0xEA) => "GET_CAL_PAGE",
                Some(0xE9) => "GET_PAG_PROCESSOR_INFO",
                Some(0xE8) => "GET_SEGMENT_INFO",
                Some(0xE7) => "GET_PAGE_INFO",
                Some(0xE6) => "SET_SEGMENT_MODE",
                Some(0xE5) => "GET_SEGMENT_MODE",
                Some(0xE4) => "COPY_CAL_PAGE",
                Some(0xE3) => "CLEAR_DAQ_LIST",
                Some(0xE2) => "SET_DAQ_PTR",
                Some(0xE1) => "WRITE_DAQ",
                Some(0xE0) => "SET_DAQ_LIST_MODE",
                Some(0xDF) => "GET_DAQ_LIST_MODE",
                Some(0xDE) => "START_STOP_DAQ_LIST",
                Some(0xDD) => "START_STOP_SYNCH",
                Some(0xDC) => "GET_DAQ_CLOCK",
                Some(0xDB) => "READ_DAQ",
                Some(0xDA) => "GET_DAQ_PROCESSOR_INFO",
                Some(0xD9) => "GET_DAQ_RESOLUTION_INFO",
                Some(0xD8) => "GET_DAQ_LIST_INFO",
                Some(0xD7) => "GET_DAQ_EVENT_INFO",
                Some(0xD6) => "FREE_DAQ",
                Some(0xD5) => "ALLOC_DAQ",
                Some(0xD4) => "ALLOC_ODT",
                Some(0xD3) => "ALLOC_ODT_ENTRY",
                Some(0xD2) => "PROGRAM_START",
                Some(0xD1) => "PROGRAM_CLEAR",
                Some(0xD0) => "PROGRAM",
                Some(0xCF) => "PROGRAM_RESET",
                Some(0xCE) => "GET_PGM_PROCESSOR_INFO",
                Some(0xCD) => "GET_SECTOR_INFO",
                Some(0xCC) => "PROGRAM_PREPARE",
                Some(0xCB) => "PROGRAM_FORMAT",
                Some(0xCA) => "PROGRAM_NEXT",
                Some(0xC9) => "PROGRAM_MAX",
                Some(0xC8) => "PROGRAM_VERIFY",
                _ => "RAW",
            };
            json!({ "command": name })
        }
        // ── DAQ commands ──────────────────────────────────────────
        XcpCommand::FreeDaq => json!({ "command": "FREE_DAQ" }),
        XcpCommand::AllocDaq { count } => json!({ "command": "ALLOC_DAQ", "count": count }),
        XcpCommand::AllocOdt {
            daq_list_num,
            odt_count,
        } => {
            json!({ "command": "ALLOC_ODT", "daq_list_num": daq_list_num, "odt_count": odt_count })
        }
        XcpCommand::AllocOdtEntry {
            daq_list_num,
            odt_num,
            entry_count,
        } => {
            json!({ "command": "ALLOC_ODT_ENTRY", "daq_list_num": daq_list_num, "odt_num": odt_num, "entry_count": entry_count })
        }
        XcpCommand::SetDaqPtr {
            daq_list_num,
            odt_num,
            odt_entry_num,
        } => {
            json!({ "command": "SET_DAQ_PTR", "daq_list_num": daq_list_num, "odt_num": odt_num, "odt_entry_num": odt_entry_num })
        }
        XcpCommand::WriteDaq {
            bit_offset,
            size,
            addr_ext,
            addr,
        } => {
            json!({ "command": "WRITE_DAQ", "bit_offset": bit_offset, "size": size, "addr_ext": addr_ext, "addr": addr })
        }
        XcpCommand::SetDaqListMode {
            mode,
            daq_list_num,
            event_channel,
            ..
        } => {
            json!({ "command": "SET_DAQ_LIST_MODE", "mode": mode, "daq_list_num": daq_list_num, "event_channel": event_channel })
        }
        XcpCommand::StartStopDaqList { mode, daq_list_num } => {
            json!({ "command": "START_STOP_DAQ_LIST", "mode": mode, "daq_list_num": daq_list_num })
        }
        XcpCommand::StartStopSynch { mode } => {
            json!({ "command": "START_STOP_SYNCH", "mode": mode })
        }
    };
    let entry = PacketEntry {
        id: 0,
        direction: "tx".into(),
        counter: ctr,
        timestamp_ms: now_ms(),
        hex: bytes_to_hex(&payload),
        pid: format!("{:02X}", payload[0]),
        decoded,
    };
    let id = state.insert_packet(&entry);
    let entry = PacketEntry { id, ..entry };
    broadcast_packet(state, "packet_tx", &entry);
    entry
}

fn log_rx_ok(state: &AppState, resp: &XcpResponse, ctr: u16) -> PacketEntry {
    let entry = PacketEntry {
        id: 0,
        direction: "rx".into(),
        counter: ctr,
        timestamp_ms: now_ms(),
        hex: bytes_to_hex(&resp.encode()),
        pid: if matches!(resp, XcpResponse::Error(_)) {
            "FE".into()
        } else {
            "FF".into()
        },
        decoded: serde_json::to_value(resp).unwrap_or(serde_json::Value::Null),
    };
    let id = state.insert_packet(&entry);
    let entry = PacketEntry { id, ..entry };
    broadcast_packet(state, "packet_rx", &entry);
    entry
}

fn log_rx_err(state: &AppState, e: &crate::xcp::error::XcpError) {
    let pid = if matches!(e, crate::xcp::error::XcpError::Timeout) {
        "TO"
    } else {
        "ERR"
    };
    let entry = PacketEntry {
        id: 0,
        direction: "rx".into(),
        counter: 0,
        timestamp_ms: now_ms(),
        hex: String::new(),
        pid: pid.into(),
        decoded: json!({ "error": e.to_string() }),
    };
    let id = state.insert_packet(&entry);
    broadcast_packet(state, "packet_rx", &PacketEntry { id, ..entry });
}

/// Execute a command, store both TX and RX in DB, push both over SSE.
async fn run_cmd(
    state: &AppState,
    cmd: XcpCommand,
) -> Result<XcpResponse, crate::xcp::error::XcpError> {
    let ctr = {
        let guard = state.session.lock().await;
        guard.as_ref().map(|s| s.peek_next_ctr()).unwrap_or(0)
    };
    log_tx(state, &cmd, ctr);

    let response = {
        let mut guard = state.session.lock().await;
        let session = guard
            .as_mut()
            .ok_or(crate::xcp::error::XcpError::NotConnected)?;
        session.execute_packet(&cmd).await
    };

    match &response {
        Ok((resp, pkt)) => {
            log_rx_ok(state, resp, pkt.counter);
        }
        Err(e) => {
            log_rx_err(state, e);
        }
    }

    response.map(|(resp, _)| resp)
}

// ── routes ───────────────────────────────────────────────────────

pub async fn connect(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let cfg = state.config.lock().unwrap().connection.clone();
    debug_log(format!(
        "http connect: handler entry server={}:{} bind_ip={:?} source_port={:?} timeout_ms={}",
        cfg.server_ip, cfg.server_port, cfg.bind_ip, cfg.source_port, cfg.timeout_ms
    ));
    let (transport, iface_info): (Box<dyn crate::xcp::transport::XcpTransport>, String) =
        if cfg.protocol == "ethernet" {
            match EthernetTransport::connect(EthernetConfig {
                server_ip: cfg.server_ip.clone(),
                server_port: cfg.server_port,
                bind_ip: cfg.bind_ip.clone(),
                source_port: cfg.source_port,
                src_mac: cfg.src_mac.clone(),
                dst_mac: cfg.dst_mac.clone().unwrap_or_default(),
                vlan_id: cfg.vlan_id,
            })
            .await
            {
                Ok(t) => {
                    let info = t.iface_info().to_string();
                    debug_log(format!("http connect: transport opened on {info}"));
                    (Box::new(t), info)
                }
                Err(e) => {
                    debug_log(format!("http connect: EthernetTransport::connect failed: {e}"));
                    return Json(
                        json!({ "ok": false, "error": connect_error(&cfg.server_ip, cfg.server_port, &e) }),
                    )
                    .into_response();
                }
            }
        } else {
            match UdpTransport::connect(
                &cfg.server_ip,
                cfg.server_port,
                cfg.bind_ip.as_deref(),
                cfg.source_port,
            )
            .await
            {
                Ok(t) => {
                    let info = format!("UDP {}:{}", cfg.server_ip, cfg.server_port);
                    debug_log(format!("http connect: transport opened ({info})"));
                    (Box::new(t), info)
                }
                Err(e) => {
                    debug_log(format!("http connect: UdpTransport::connect failed: {e}"));
                    return Json(
                        json!({ "ok": false, "error": connect_error(&cfg.server_ip, cfg.server_port, &e) }),
                    )
                    .into_response();
                }
            }
        };

    log_tx(&state, &XcpCommand::Connect { mode: 0 }, 0);

    let mut session = XcpSession::new(transport, cfg.timeout_ms);
    debug_log("http connect: awaiting execute_packet(Connect)".to_string());
    let exec_result = session
        .execute_packet(&XcpCommand::Connect { mode: 0 })
        .await;
    debug_log(format!(
        "http connect: execute_packet returned {}",
        match &exec_result {
            Ok((resp, _)) => format!("Ok({resp:?})"),
            Err(e) => format!("Err({e})"),
        }
    ));
    match exec_result {
        Ok((XcpResponse::Connect(info), pkt)) => {
            let info = info.clone();
            let connect_resp = XcpResponse::Connect(info.clone());
            log_rx_ok(&state, &connect_resp, pkt.counter);
            session.slave_info = Some(info.clone());
            session.state = crate::session::SessionState::Connected;

            *state.session.lock().await = Some(session);
            let _ = state.tx.send(
                serde_json::to_string(&json!({
                    "event": "state_changed",
                    "data": { "state": "connected", "slave": info },
                }))
                .unwrap_or_default(),
            );

            let state2 = Arc::clone(&state);
            let monitor = tokio::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                    let result = {
                        let mut guard = state2.session.lock().await;
                        match guard.as_mut() {
                            None => break, // manually disconnected
                            Some(session) => {
                                let r = session.execute(&XcpCommand::GetStatus).await;
                                session.undo_ctr_increment();
                                r
                            }
                        }
                    };
                    if result.is_err() {
                        *state2.session.lock().await = None;
                        let _ = state2.tx.send(
                            serde_json::to_string(&json!({
                                "event": "state_changed",
                                "data": { "state": "disconnected" },
                            }))
                            .unwrap_or_default(),
                        );
                        break;
                    }
                }
            });
            *state.monitor_task.lock().unwrap() = Some(monitor);

            debug_log("http connect: returning ok:true (Connected)".to_string());
            Json(json!({ "ok": true, "slave": info })).into_response()
        }
        Ok((XcpResponse::Error(e), pkt)) => {
            let resp = XcpResponse::Error(e.clone());
            log_rx_ok(&state, &resp, pkt.counter);
            let err = crate::xcp::error::XcpError::ErrorResponse(
                crate::xcp::error::XcpErrorCode::from_byte(e.code),
            );
            let msg = connect_error(&cfg.server_ip, cfg.server_port, &err);
            debug_log(format!("http connect: returning ok:false (XCP error response): {msg}"));
            Json(json!({ "ok": false, "error": format!("{msg} (interface: {iface_info})") }))
                .into_response()
        }
        Ok((resp, pkt)) => {
            log_rx_ok(&state, &resp, pkt.counter);
            let err = crate::xcp::error::XcpError::UnexpectedPid(
                resp.encode().first().copied().unwrap_or(0),
            );
            let msg = connect_error(&cfg.server_ip, cfg.server_port, &err);
            debug_log(format!("http connect: returning ok:false (unexpected pid): {msg}"));
            Json(json!({ "ok": false, "error": format!("{msg} (interface: {iface_info})") }))
                .into_response()
        }
        Err(e) => {
            log_rx_err(&state, &e);
            let msg = connect_error(&cfg.server_ip, cfg.server_port, &e);
            debug_log(format!("http connect: returning ok:false (transport error): {msg}"));
            Json(json!({ "ok": false, "error": format!("{msg} (interface: {iface_info})") }))
                .into_response()
        }
    }
}

pub async fn disconnect(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    if let Some(task) = state.monitor_task.lock().unwrap().take() {
        task.abort();
    }

    let ctr = {
        let guard = state.session.lock().await;
        guard.as_ref().map(|s| s.peek_next_ctr()).unwrap_or(0)
    };
    log_tx(&state, &XcpCommand::Disconnect, ctr);

    let session = state.session.lock().await.take();
    if let Some(mut session) = session {
        match session.disconnect().await {
            Ok((resp, pkt)) => {
                log_rx_ok(&state, &resp, pkt.counter);
            }
            Err(e) => log_rx_err(&state, &e),
        }
    }
    let _ = state.tx.send(
        serde_json::to_string(&json!({
            "event": "state_changed",
            "data": { "state": "disconnected" },
        }))
        .unwrap_or_default(),
    );
    Json(json!({ "ok": true }))
}

pub async fn status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let guard = state.session.lock().await;
    match guard.as_ref() {
        Some(s) => Json(json!({ "connected": true,  "slave": s.slave_info })),
        None => Json(json!({ "connected": false })),
    }
}

pub async fn cmd_get_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetStatus).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

pub async fn cmd_get_comm_mode_info(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetCommModeInfo).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

#[derive(Deserialize)]
pub struct GetIdBody {
    pub id_type: u8,
}

pub async fn cmd_get_id(
    State(state): State<Arc<AppState>>,
    Json(body): Json<GetIdBody>,
) -> impl IntoResponse {
    match run_cmd(
        &state,
        XcpCommand::GetId {
            id_type: body.id_type,
        },
    )
    .await
    {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

#[derive(Deserialize)]
pub struct RawBody {
    pub bytes: Vec<u8>,
}

// Inspect a raw command/response pair and emit a daq_state_changed SSE event
// if the command affects DAQ run state. Called after every raw XCP send so that
// manual commands and sequence steps both keep the DAQ tab in sync.
fn maybe_emit_daq_event(state: &AppState, cmd: u8, mode: u8, resp_bytes: &[u8]) {
    if resp_bytes.first() != Some(&0xFF) {
        return; // negative response — no state change
    }
    let new_status = match cmd {
        0xD6 => Some(DaqStatus::Idle), // FREE_DAQ
        0xDD => match mode {
            // START_STOP_SYNCH
            0x01 => Some(DaqStatus::Running),
            0x00 | 0x02 => Some(DaqStatus::Configured),
            _ => None,
        },
        _ => None,
    };
    if let Some(status) = new_status {
        let state_str = match &status {
            DaqStatus::Idle => "idle",
            DaqStatus::Configured => "configured",
            DaqStatus::Running => "running",
        };
        *state.daq_status.lock().unwrap() = status;
        let _ = state.tx.send(
            serde_json::to_string(&json!({
                "event": "daq_state_changed",
                "data": { "state": state_str }
            }))
            .unwrap_or_default(),
        );
    }
}

pub async fn cmd_raw(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RawBody>,
) -> impl IntoResponse {
    let cmd = body.bytes.first().copied().unwrap_or(0);
    let mode = body.bytes.get(1).copied().unwrap_or(0);
    match run_cmd(&state, XcpCommand::Raw { bytes: body.bytes }).await {
        Ok(r) => {
            maybe_emit_daq_event(&state, cmd, mode, &r.encode());
            Json(json!({ "ok": true, "response": r })).into_response()
        }
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

#[derive(Deserialize)]
pub struct SetMtaBody {
    pub addr_ext: u8,
    pub addr: u32,
}

pub async fn cmd_set_mta(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SetMtaBody>,
) -> impl IntoResponse {
    let big_endian = state.config.lock().unwrap().endian == "big";
    match run_cmd(
        &state,
        XcpCommand::SetMta {
            addr_ext: body.addr_ext,
            addr: body.addr,
            big_endian,
        },
    )
    .await
    {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UploadBody {
    pub size: u8,
}

pub async fn cmd_upload(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UploadBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::Upload { size: body.size }).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UserCmdBody {
    pub name: String,
    pub sub_cmd: u8,
    pub data: Vec<u8>,
}

pub async fn cmd_user(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UserCmdBody>,
) -> impl IntoResponse {
    let mut bytes = vec![0xF1u8, body.sub_cmd];
    bytes.extend_from_slice(&body.data);

    let ctr = {
        let guard = state.session.lock().await;
        guard.as_ref().map(|s| s.peek_next_ctr()).unwrap_or(0)
    };

    let entry = PacketEntry {
        id: 0,
        direction: "tx".into(),
        counter: ctr,
        timestamp_ms: now_ms(),
        hex: bytes_to_hex(&bytes),
        pid: "F1".into(),
        decoded: json!({ "command": body.name }),
    };
    let id = state.insert_packet(&entry);
    let entry = PacketEntry { id, ..entry };
    broadcast_packet(&state, "packet_tx", &entry);

    let response = {
        let mut guard = state.session.lock().await;
        match guard.as_mut() {
            None => {
                let e = crate::xcp::error::XcpError::NotConnected;
                log_rx_err(&state, &e);
                return Json(json!({ "ok": false, "error": user_error(&e) })).into_response();
            }
            Some(session) => session.execute_packet(&XcpCommand::Raw { bytes }).await,
        }
    };

    match &response {
        Ok((resp, pkt)) => {
            log_rx_ok(&state, resp, pkt.counter);
            Json(json!({ "ok": true, "response": resp })).into_response()
        }
        Err(e) => {
            log_rx_err(&state, e);
            Json(json!({ "ok": false, "error": user_error(e) })).into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct PacketsQuery {
    pub since: Option<i64>,
}

pub async fn get_packets(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PacketsQuery>,
) -> impl IntoResponse {
    Json(json!({ "packets": state.query_packets(q.since, 500) }))
}

pub async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::to_value(&*state.config.lock().unwrap()).unwrap_or_default())
}

#[derive(Deserialize)]
pub struct UpdateConfigBody {
    pub server_ip: String,
    pub server_port: u16,
    pub protocol: String,
    pub timeout_ms: u64,
    pub listen_port: u16,
    pub bind_ip: Option<String>,
    pub source_port: Option<u16>,
    pub src_mac: Option<String>,
    pub dst_mac: Option<String>,
    pub vlan_id: Option<u16>,
    pub events: Option<Vec<crate::config::EventDef>>,
    pub endian: Option<String>,
}

pub async fn update_config(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UpdateConfigBody>,
) -> impl IntoResponse {
    if body.protocol != "udp" && body.protocol != "ethernet" {
        return Json(json!({ "ok": false, "error": "protocol must be \"udp\" or \"ethernet\"" }))
            .into_response();
    }
    if body.server_ip.parse::<std::net::IpAddr>().is_err() {
        return Json(json!({ "ok": false, "error": "server_ip is not a valid IP address" }))
            .into_response();
    }
    if let Some(ref ip) = body.bind_ip {
        if !ip.is_empty() && ip.parse::<std::net::IpAddr>().is_err() {
            return Json(json!({ "ok": false, "error": "bind_ip is not a valid IP address" }))
                .into_response();
        }
    }
    if body.timeout_ms == 0 {
        return Json(json!({ "ok": false, "error": "timeout_ms must be greater than 0" }))
            .into_response();
    }
    if let Some(port) = body.source_port {
        if port == 0 {
            return Json(json!({ "ok": false, "error": "source_port must be greater than 0" }))
                .into_response();
        }
    }
    if let Some(vlan_id) = body.vlan_id {
        if !(1..=4094).contains(&vlan_id) {
            return Json(json!({ "ok": false, "error": "vlan_id must be between 1 and 4094" }))
                .into_response();
        }
    }
    if body.protocol == "ethernet" {
        if body.bind_ip.as_deref().unwrap_or("").is_empty() {
            return Json(json!({ "ok": false, "error": "Raw Ethernet requires a selected source interface IP" })).into_response();
        }
        if body.dst_mac.as_deref().unwrap_or("").is_empty() {
            return Json(
                json!({ "ok": false, "error": "Raw Ethernet requires a destination MAC address" }),
            )
            .into_response();
        }
    }
    for (field, mac) in [("src_mac", &body.src_mac), ("dst_mac", &body.dst_mac)] {
        if let Some(mac) = mac.as_deref().filter(|s| !s.is_empty()) {
            if !is_valid_mac(mac) {
                return Json(
                    json!({ "ok": false, "error": format!("{field} must use XX:XX:XX:XX:XX:XX") }),
                )
                .into_response();
            }
        }
    }
    if let Some(ref events) = body.events {
        if events.iter().any(|e| e.name.trim().is_empty()) {
            return Json(json!({ "ok": false, "error": "event names must not be empty" }))
                .into_response();
        }
    }
    if let Some(ref endian) = body.endian {
        if endian != "little" && endian != "big" {
            return Json(json!({ "ok": false, "error": "endian must be \"little\" or \"big\"" }))
                .into_response();
        }
    }

    let result = {
        let mut cfg = state.config.lock().unwrap();
        cfg.connection.server_ip = body.server_ip;
        cfg.connection.server_port = body.server_port;
        cfg.connection.protocol = body.protocol;
        cfg.connection.timeout_ms = body.timeout_ms;
        cfg.connection.bind_ip = body.bind_ip.filter(|s| !s.is_empty());
        cfg.connection.source_port = body.source_port;
        cfg.connection.src_mac = body.src_mac.filter(|s| !s.is_empty());
        cfg.connection.dst_mac = body.dst_mac.filter(|s| !s.is_empty());
        cfg.connection.vlan_id = body.vlan_id;
        cfg.server.listen_port = body.listen_port;
        if let Some(events) = body.events {
            cfg.events = events;
        }
        if let Some(endian) = body.endian {
            cfg.endian = endian;
        }
        cfg.save(&state.config_path)
    };
    match result {
        Ok(()) => Json(json!({ "ok": true })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": e.to_string() })).into_response(),
    }
}

fn is_valid_mac(mac: &str) -> bool {
    let parts: Vec<&str> = mac.split(':').collect();
    parts.len() == 6
        && parts
            .iter()
            .all(|part| part.len() == 2 && part.as_bytes().iter().all(|b| b.is_ascii_hexdigit()))
}

/// Expand a numeric value into the minimum number of bytes (1/2/4/8) required
/// to hold it, respecting byte order.
fn value_to_bytes(val: u64, big_endian: bool) -> Vec<u8> {
    let size: usize = if val <= 0xFF {
        1
    } else if val <= 0xFFFF {
        2
    } else if val <= 0xFFFF_FFFF {
        4
    } else {
        8
    };
    if size == 1 {
        return vec![val as u8];
    }
    let raw = val.to_le_bytes();
    let slice = &raw[..size];
    if big_endian {
        slice.iter().rev().cloned().collect()
    } else {
        slice.to_vec()
    }
}

/// Parse a list of string tokens into bytes.
///
/// Rules:
/// - `0x…` prefix → hex value, expanded to min bytes, endian applied
/// - All ASCII digits → decimal value, expanded to min bytes, endian applied
/// - Otherwise → raw hex byte (1 byte, no endian needed)
fn parse_tokens(tokens: &[String], big_endian: bool) -> Result<Vec<u8>, String> {
    let mut result = Vec::new();
    for token in tokens {
        let t = token.trim();
        if t.is_empty() {
            continue;
        }
        if let Some(hex_str) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) {
            let val =
                u64::from_str_radix(hex_str, 16).map_err(|_| format!("Invalid hex value: {t}"))?;
            result.extend_from_slice(&value_to_bytes(val, big_endian));
        } else if t.chars().all(|c| c.is_ascii_digit()) {
            let val = t
                .parse::<u64>()
                .map_err(|_| format!("Invalid decimal value: {t}"))?;
            result.extend_from_slice(&value_to_bytes(val, big_endian));
        } else {
            let val = u8::from_str_radix(t, 16).map_err(|_| format!("Invalid byte: {t}"))?;
            result.push(val);
        }
    }
    Ok(result)
}

#[derive(Deserialize)]
pub struct DownloadBody {
    pub tokens: Vec<String>,
}

pub async fn cmd_download(
    State(state): State<Arc<AppState>>,
    Json(body): Json<DownloadBody>,
) -> impl IntoResponse {
    let big_endian = state.config.lock().unwrap().endian == "big";
    let data = match parse_tokens(&body.tokens, big_endian) {
        Ok(b) if b.is_empty() => {
            return Json(json!({ "ok": false, "error": "No bytes to write" })).into_response();
        }
        Ok(b) => b,
        Err(e) => return Json(json!({ "ok": false, "error": e })).into_response(),
    };
    match run_cmd(&state, XcpCommand::Download { data }).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

pub async fn get_network_interfaces() -> impl IntoResponse {
    use network_interface::{Addr, NetworkInterface, NetworkInterfaceConfig};
    let ifaces = NetworkInterface::show().unwrap_or_default();
    let result: Vec<serde_json::Value> = ifaces
        .into_iter()
        .filter_map(|iface| {
            let ipv4: Vec<String> = iface
                .addr
                .iter()
                .filter_map(|a| {
                    if let Addr::V4(v4) = a {
                        Some(v4.ip.to_string())
                    } else {
                        None
                    }
                })
                .collect();
            if ipv4.is_empty() {
                return None;
            }
            Some(json!({ "name": iface.name, "ips": ipv4 }))
        })
        .collect();
    Json(json!({ "interfaces": result }))
}

// ── DAQ routes ────────────────────────────────────────────────────

/// Parse a fixed-endian XCP DAQ measurement value to f64.
fn parse_daq_value(bytes: &[u8], type_name: &str) -> f64 {
    match type_name {
        "u8" => bytes.first().copied().unwrap_or(0) as f64,
        "i8" => bytes.first().copied().unwrap_or(0) as i8 as f64,
        "u16" if bytes.len() >= 2 => u16::from_le_bytes([bytes[0], bytes[1]]) as f64,
        "i16" if bytes.len() >= 2 => i16::from_le_bytes([bytes[0], bytes[1]]) as f64,
        "u32" if bytes.len() >= 4 => {
            u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64
        }
        "i32" if bytes.len() >= 4 => {
            i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64
        }
        "f32" if bytes.len() >= 4 => {
            f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f64
        }
        "f64" if bytes.len() >= 8 => f64::from_le_bytes(bytes[..8].try_into().unwrap()),
        _ => 0.0,
    }
}

/// Build a PID → (list_id, odt_id, entries) map from the current daq_lists.
/// PIDs are assigned sequentially across all lists in order (absolute ODT numbering).
fn build_dto_map(lists: &[DaqListDef]) -> HashMap<u8, (u32, u32, Vec<DaqEntryDef>)> {
    let mut map = HashMap::new();
    let mut pid: u8 = 0;
    for list in lists {
        for odt in &list.odts {
            if !odt.entries.is_empty() {
                map.insert(pid, (list.id, odt.id, odt.entries.clone()));
            }
            pid = pid.wrapping_add(1);
        }
    }
    map
}

/// Background task: read all incoming broadcast packets, filter for DAQ DTOs
/// (PID < 0xFC), decode measurement values, and push `daq_dto` SSE events.
async fn daq_receive_task(
    state: Arc<AppState>,
    mut sub: tokio::sync::broadcast::Receiver<std::sync::Arc<crate::xcp::packet::XcpPacket>>,
) {
    loop {
        let pkt = match sub.recv().await {
            Ok(p) => p,
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
            Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
        };
        let pid = match pkt.payload.first().copied() {
            Some(p) if p < 0xFC => p,
            _ => continue,
        };

        let map = state.daq_dto_map.lock().unwrap();
        let Some((list_id, odt_id, entries)) = map.get(&pid) else {
            continue;
        };
        let (list_id, odt_id) = (*list_id, *odt_id);
        let entries = entries.clone();
        drop(map);

        let data = &pkt.payload[1..]; // skip PID byte
        let mut values = serde_json::Map::new();
        let mut offset = 0usize;
        for entry in &entries {
            let sz = entry.size as usize;
            if offset + sz > data.len() {
                break;
            }
            let v = parse_daq_value(&data[offset..offset + sz], &entry.type_name);
            values.insert(entry.name.clone(), serde_json::json!(v));
            offset += sz;
        }

        let event = json!({
            "event": "daq_dto",
            "data": {
                "list_id": list_id,
                "odt_id":  odt_id,
                "timestamp_ms": now_ms(),
                "values": values,
            }
        });
        let _ = state
            .tx
            .send(serde_json::to_string(&event).unwrap_or_default());
    }
}

pub async fn daq_get_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let status = state.daq_status.lock().unwrap().clone();
    let lists = state.daq_lists.lock().unwrap().clone();
    Json(json!({ "state": status, "lists": lists }))
}

pub async fn daq_get_lists(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let lists = state.daq_lists.lock().unwrap().clone();
    Json(json!({ "lists": lists }))
}

#[derive(Deserialize)]
pub struct AddListBody {
    pub event_channel: u16,
}

pub async fn daq_add_list(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AddListBody>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let id = lists.iter().map(|l| l.id).max().map(|m| m + 1).unwrap_or(0);
    let list = DaqListDef {
        id,
        name: None,
        event_channel: body.event_channel,
        odts: vec![DaqOdtDef {
            id: 0,
            name: None,
            entries: vec![],
        }],
    };
    lists.push(list.clone());
    Json(json!({ "list": list }))
}

pub async fn daq_delete_list(
    State(state): State<Arc<AppState>>,
    Path(list_id): Path<u32>,
) -> impl IntoResponse {
    state.daq_lists.lock().unwrap().retain(|l| l.id != list_id);
    Json(json!({ "ok": true }))
}

pub async fn daq_add_odt(
    State(state): State<Arc<AppState>>,
    Path(list_id): Path<u32>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let Some(list) = lists.iter_mut().find(|l| l.id == list_id) else {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": "list not found" })),
        )
            .into_response();
    };
    let odt_id = list
        .odts
        .iter()
        .map(|o| o.id)
        .max()
        .map(|m| m + 1)
        .unwrap_or(0);
    list.odts.push(DaqOdtDef {
        id: odt_id,
        name: None,
        entries: vec![],
    });
    Json(json!({ "odt_id": odt_id })).into_response()
}

pub async fn daq_add_entry(
    State(state): State<Arc<AppState>>,
    Path((list_id, odt_id)): Path<(u32, u32)>,
    Json(entry): Json<DaqEntryDef>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let Some(list) = lists.iter_mut().find(|l| l.id == list_id) else {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": "list not found" })),
        )
            .into_response();
    };
    let Some(odt) = list.odts.iter_mut().find(|o| o.id == odt_id) else {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": "odt not found" })),
        )
            .into_response();
    };
    odt.entries.push(entry);
    Json(json!({ "ok": true })).into_response()
}

pub async fn daq_delete_entry(
    State(state): State<Arc<AppState>>,
    Path((list_id, odt_id, entry_idx)): Path<(u32, u32, usize)>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let Some(list) = lists.iter_mut().find(|l| l.id == list_id) else {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": "list not found" })),
        )
            .into_response();
    };
    let Some(odt) = list.odts.iter_mut().find(|o| o.id == odt_id) else {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": "odt not found" })),
        )
            .into_response();
    };
    if entry_idx < odt.entries.len() {
        odt.entries.remove(entry_idx);
    }
    Json(json!({ "ok": true })).into_response()
}

#[derive(Deserialize)]
pub struct SetEventBody {
    pub event_channel: u16,
}

pub async fn daq_set_event(
    State(state): State<Arc<AppState>>,
    Path(list_id): Path<u32>,
    Json(body): Json<SetEventBody>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let Some(list) = lists.iter_mut().find(|l| l.id == list_id) else {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(json!({ "error": "list not found" })),
        )
            .into_response();
    };
    list.event_channel = body.event_channel;
    Json(json!({ "ok": true })).into_response()
}

#[derive(Deserialize)]
pub struct ReplaceListsBody {
    pub lists: Vec<DaqListDef>,
}

pub async fn daq_replace_lists(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ReplaceListsBody>,
) -> impl IntoResponse {
    *state.daq_lists.lock().unwrap() = body.lists;
    Json(json!({ "ok": true }))
}

async fn daq_configure_inner(state: &Arc<AppState>) -> Result<(), crate::xcp::error::XcpError> {
    let lists = state.daq_lists.lock().unwrap().clone();

    run_cmd(state, XcpCommand::FreeDaq).await?;
    run_cmd(
        state,
        XcpCommand::AllocDaq {
            count: lists.len() as u16,
        },
    )
    .await?;

    for list in &lists {
        run_cmd(
            state,
            XcpCommand::AllocOdt {
                daq_list_num: list.id as u16,
                odt_count: list.odts.len() as u8,
            },
        )
        .await?;
    }

    for list in &lists {
        for odt in &list.odts {
            run_cmd(
                state,
                XcpCommand::AllocOdtEntry {
                    daq_list_num: list.id as u16,
                    odt_num: odt.id as u8,
                    entry_count: odt.entries.len() as u8,
                },
            )
            .await?;
        }
    }

    for list in &lists {
        for odt in &list.odts {
            for (ei, entry) in odt.entries.iter().enumerate() {
                run_cmd(
                    state,
                    XcpCommand::SetDaqPtr {
                        daq_list_num: list.id as u16,
                        odt_num: odt.id as u8,
                        odt_entry_num: ei as u8,
                    },
                )
                .await?;
                run_cmd(
                    state,
                    XcpCommand::WriteDaq {
                        bit_offset: 0xFF,
                        size: entry.size,
                        addr_ext: entry.addr_ext,
                        addr: entry.addr,
                    },
                )
                .await?;
            }
        }
    }

    for list in &lists {
        run_cmd(
            state,
            XcpCommand::SetDaqListMode {
                mode: 0x10,
                daq_list_num: list.id as u16,
                event_channel: list.event_channel,
                prescaler: 1,
                priority: 0,
            },
        )
        .await?;
    }

    // SELECT each list for synchronized start
    for list in &lists {
        run_cmd(
            state,
            XcpCommand::StartStopDaqList {
                mode: 0x03,
                daq_list_num: list.id as u16,
            },
        )
        .await?;
    }

    Ok(())
}

pub async fn daq_configure(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match daq_configure_inner(&state).await {
        Ok(()) => {
            let lists = state.daq_lists.lock().unwrap().clone();
            *state.daq_dto_map.lock().unwrap() = build_dto_map(&lists);
            *state.daq_status.lock().unwrap() = DaqStatus::Configured;
            let _ = state.tx.send(
                serde_json::to_string(&json!({
                    "event": "daq_state_changed", "data": { "state": "configured" }
                }))
                .unwrap_or_default(),
            );
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

pub async fn daq_start(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::StartStopSynch { mode: 0x01 }).await {
        Ok(_) => {
            let sub = {
                let guard = state.session.lock().await;
                guard.as_ref().map(|s| s.subscribe())
            };
            if let Some(sub) = sub {
                let task = tokio::spawn(daq_receive_task(Arc::clone(&state), sub));
                *state.daq_task.lock().unwrap() = Some(task);
            }
            *state.daq_status.lock().unwrap() = DaqStatus::Running;
            let _ = state.tx.send(
                serde_json::to_string(&json!({
                    "event": "daq_state_changed", "data": { "state": "running" }
                }))
                .unwrap_or_default(),
            );
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

pub async fn daq_stop(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::StartStopSynch { mode: 0x00 }).await {
        Ok(_) => {
            if let Some(task) = state.daq_task.lock().unwrap().take() {
                task.abort();
            }
            *state.daq_status.lock().unwrap() = DaqStatus::Configured;
            let _ = state.tx.send(
                serde_json::to_string(&json!({
                    "event": "daq_state_changed", "data": { "state": "configured" }
                }))
                .unwrap_or_default(),
            );
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

pub async fn daq_free(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::FreeDaq).await {
        Ok(_) => {
            if let Some(task) = state.daq_task.lock().unwrap().take() {
                task.abort();
            }
            state.daq_dto_map.lock().unwrap().clear();
            *state.daq_status.lock().unwrap() = DaqStatus::Idle;
            let _ = state.tx.send(
                serde_json::to_string(&json!({
                    "event": "daq_state_changed", "data": { "state": "idle" }
                }))
                .unwrap_or_default(),
            );
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => Json(json!({ "ok": false, "error": user_error(&e) })).into_response(),
    }
}

// ── Sequence ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SeqStepBody {
    pub id: String,
    pub bytes: Vec<u8>,
    pub resp: String,
    pub disabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeqRunBody {
    pub abort_on_error: bool,
    pub step_delay_ms: Option<u64>,
    pub steps: Vec<SeqStepBody>,
}

fn check_resp(resp: &[u8], mode: &str) -> bool {
    match mode {
        "pos" => resp.first() == Some(&0xFF),
        "neg" => resp.first() == Some(&0xFE),
        _ => true,
    }
}

pub async fn seq_run(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SeqRunBody>,
) -> impl IntoResponse {
    let delay_ms = body.step_delay_ms.unwrap_or(0);
    let total = body
        .steps
        .iter()
        .filter(|s| s.disabled != Some(true))
        .count();
    let mut done = 0usize;
    let mut final_status = "done";

    for step in &body.steps {
        if step.disabled == Some(true) {
            let _ = state.tx.send(
                serde_json::to_string(&json!({
                    "event": "seq_step_done",
                    "data": { "stepId": step.id, "outcome": "skipped" }
                }))
                .unwrap_or_default(),
            );
            continue;
        }

        let bytes = step.bytes.clone();
        if bytes.is_empty() {
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "seq_step_done",
                "data": { "stepId": step.id, "outcome": "error", "errorMsg": "Step has no bytes" }
            })).unwrap_or_default());
            if body.abort_on_error {
                final_status = "aborted";
                break;
            }
            continue;
        }

        let cmd = bytes.first().copied().unwrap_or(0);
        let mode = bytes.get(1).copied().unwrap_or(0);
        let tx_hex = bytes_to_hex(&bytes);
        match run_cmd(&state, XcpCommand::Raw { bytes }).await {
            Err(e) => {
                let _ = state.tx.send(
                    serde_json::to_string(&json!({
                        "event": "seq_step_done",
                        "data": {
                            "stepId": step.id,
                            "outcome": "error",
                            "txHex": tx_hex,
                            "errorMsg": user_error(&e),
                        }
                    }))
                    .unwrap_or_default(),
                );
                if body.abort_on_error {
                    final_status = "aborted";
                    break;
                }
            }
            Ok(resp) => {
                done += 1;
                let rx_bytes = resp.encode();
                maybe_emit_daq_event(&state, cmd, mode, &rx_bytes);
                let rx_hex = bytes_to_hex(&rx_bytes);
                let passed = check_resp(&rx_bytes, &step.resp);
                let outcome = if passed { "pass" } else { "fail" };
                let _ = state.tx.send(
                    serde_json::to_string(&json!({
                        "event": "seq_step_done",
                        "data": {
                            "stepId": step.id,
                            "outcome": outcome,
                            "txHex": tx_hex,
                            "rxHex": rx_hex,
                        }
                    }))
                    .unwrap_or_default(),
                );
                if !passed && body.abort_on_error {
                    final_status = "aborted";
                    break;
                }
            }
        }

        if delay_ms > 0 {
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }
    }

    let _ = state.tx.send(
        serde_json::to_string(&json!({
            "event": "seq_run_finished",
            "data": { "status": final_status, "stepsTotal": total, "stepsDone": done }
        }))
        .unwrap_or_default(),
    );

    Json(json!({ "ok": true }))
}
