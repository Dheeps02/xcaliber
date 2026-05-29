use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    http::state::{AppState, PacketEntry},
    session::XcpSession,
    xcp::{
        command::XcpCommand,
        response::XcpResponse,
        transport::{udp::UdpTransport, tcp::TcpTransport},
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
    bytes.iter().map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(" ")
}

fn broadcast_packet(state: &AppState, event: &str, entry: &PacketEntry) {
    let _ = state.tx.send(
        serde_json::to_string(&json!({ "event": event, "data": entry })).unwrap()
    );
}

fn log_tx(state: &AppState, cmd: &XcpCommand, ctr: u16) -> PacketEntry {
    let payload = cmd.encode();
    let decoded = match cmd {
        XcpCommand::Connect { mode } =>
            json!({ "command": "CONNECT", "mode": mode }),
        XcpCommand::Disconnect =>
            json!({ "command": "DISCONNECT" }),
        XcpCommand::GetStatus =>
            json!({ "command": "GET_STATUS" }),
        XcpCommand::GetCommModeInfo =>
            json!({ "command": "GET_COMM_MODE_INFO" }),
        XcpCommand::GetId { id_type } =>
            json!({ "command": "GET_ID", "id_type": id_type }),
        XcpCommand::SetMta { addr_ext, addr } =>
            json!({ "command": "SET_MTA", "addr_ext": addr_ext, "addr": addr }),
        XcpCommand::Upload { size } =>
            json!({ "command": "UPLOAD", "size": size }),
        XcpCommand::Download { data } =>
            json!({ "command": "DOWNLOAD", "length": data.len() }),
        XcpCommand::Raw { bytes } => {
            let name = match bytes.first().copied() {
                Some(0xFF) => "CONNECT",           Some(0xFE) => "DISCONNECT",
                Some(0xFD) => "GET_STATUS",        Some(0xFC) => "SYNC",
                Some(0xFB) => "GET_COMM_MODE_INFO",Some(0xFA) => "GET_ID",
                Some(0xF9) => "SET_REQUEST",       Some(0xF8) => "GET_SEED",
                Some(0xF7) => "UNLOCK",            Some(0xF6) => "SET_MTA",
                Some(0xF5) => "UPLOAD",            Some(0xF4) => "SHORT_UPLOAD",
                Some(0xF3) => "BUILD_CHECKSUM",    Some(0xF2) => "TRANSPORT_LAYER_CMD",
                Some(0xF1) => "USER_CMD",          Some(0xF0) => "DOWNLOAD",
                Some(0xEF) => "DOWNLOAD_NEXT",     Some(0xEE) => "DOWNLOAD_MAX",
                Some(0xED) => "SHORT_DOWNLOAD",    Some(0xEC) => "TIME_CORRELATION",
                Some(0xEB) => "SET_CAL_PAGE",      Some(0xEA) => "GET_CAL_PAGE",
                Some(0xE9) => "GET_PAG_PROCESSOR_INFO",
                Some(0xE8) => "GET_SEGMENT_INFO",  Some(0xE7) => "GET_PAGE_INFO",
                Some(0xE6) => "SET_SEGMENT_MODE",  Some(0xE5) => "GET_SEGMENT_MODE",
                Some(0xE4) => "COPY_CAL_PAGE",     Some(0xE3) => "CLEAR_DAQ_LIST",
                Some(0xE2) => "SET_DAQ_PTR",       Some(0xE1) => "WRITE_DAQ",
                Some(0xE0) => "SET_DAQ_LIST_MODE", Some(0xDF) => "GET_DAQ_LIST_MODE",
                Some(0xDE) => "START_STOP_DAQ_LIST",Some(0xDD) => "START_STOP_SYNCH",
                Some(0xDC) => "GET_DAQ_CLOCK",     Some(0xDB) => "READ_DAQ",
                Some(0xDA) => "GET_DAQ_PROCESSOR_INFO",
                Some(0xD9) => "GET_DAQ_RESOLUTION_INFO",
                Some(0xD8) => "GET_DAQ_LIST_INFO", Some(0xD7) => "GET_DAQ_EVENT_INFO",
                Some(0xD6) => "FREE_DAQ",          Some(0xD5) => "ALLOC_DAQ",
                Some(0xD4) => "ALLOC_ODT",         Some(0xD3) => "ALLOC_ODT_ENTRY",
                Some(0xD2) => "PROGRAM_START",     Some(0xD1) => "PROGRAM_CLEAR",
                Some(0xD0) => "PROGRAM",           Some(0xCF) => "PROGRAM_RESET",
                Some(0xCE) => "GET_PGM_PROCESSOR_INFO",
                Some(0xCD) => "GET_SECTOR_INFO",   Some(0xCC) => "PROGRAM_PREPARE",
                Some(0xCB) => "PROGRAM_FORMAT",    Some(0xCA) => "PROGRAM_NEXT",
                Some(0xC9) => "PROGRAM_MAX",       Some(0xC8) => "PROGRAM_VERIFY",
                _ => "RAW",
            };
            json!({ "command": name })
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
        pid: if matches!(resp, XcpResponse::Error(_)) { "FE".into() } else { "FF".into() },
        decoded: serde_json::to_value(resp).unwrap_or(serde_json::Value::Null),
    };
    let id = state.insert_packet(&entry);
    let entry = PacketEntry { id, ..entry };
    broadcast_packet(state, "packet_rx", &entry);
    entry
}

fn log_rx_err(state: &AppState, e: &crate::xcp::error::XcpError) {
    let entry = PacketEntry {
        id: 0,
        direction: "rx".into(),
        counter: 0,
        timestamp_ms: now_ms(),
        hex: bytes_to_hex(&[0xFE]),
        pid: "FE".into(),
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
        let session = guard.as_mut().ok_or(crate::xcp::error::XcpError::NotConnected)?;
        session.execute(&cmd).await
    };

    match &response {
        Ok(resp) => { log_rx_ok(state, resp, ctr); }
        Err(e)   => { log_rx_err(state, e); }
    }

    response
}

// ── routes ───────────────────────────────────────────────────────

pub async fn connect(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let cfg = state.config.lock().unwrap().connection.clone();
    let bind_ip = cfg.bind_ip.as_deref();
    let transport: Box<dyn crate::xcp::transport::XcpTransport> = match cfg.protocol.as_str() {
        "tcp" => match TcpTransport::connect(&cfg.server_ip, cfg.server_port, bind_ip).await {
            Ok(t) => Box::new(t),
            Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
        },
        _ => match UdpTransport::connect(&cfg.server_ip, cfg.server_port, bind_ip).await {
            Ok(t) => Box::new(t),
            Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
        },
    };

    // Log TX before sending (counter=0 for first packet in new session)
    log_tx(&state, &XcpCommand::Connect { mode: 0 }, 0);

    let mut session = XcpSession::new(transport, cfg.timeout_ms);
    match session.connect().await {
        Ok(info) => {
            let info = info.clone();

            // Log RX with the connect response (counter=0, same as TX)
            let connect_resp = XcpResponse::Connect(info.clone());
            let rx_entry = PacketEntry {
                id: 0,
                direction: "rx".into(),
                counter: 0,
                timestamp_ms: now_ms(),
                hex: bytes_to_hex(&connect_resp.encode()),
                pid: "FF".into(),
                decoded: serde_json::to_value(&info).unwrap_or(serde_json::Value::Null),
            };
            let rx_id = state.insert_packet(&rx_entry);
            broadcast_packet(&state, "packet_rx", &PacketEntry { id: rx_id, ..rx_entry });

            *state.session.lock().await = Some(session);
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "state_changed",
                "data": { "state": "connected", "slave": info },
            })).unwrap());
            Json(json!({ "ok": true, "slave": info })).into_response()
        }
        Err(e) => {
            log_rx_err(&state, &e);
            (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response()
        }
    }
}

pub async fn disconnect(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let ctr = {
        let guard = state.session.lock().await;
        guard.as_ref().map(|s| s.peek_next_ctr()).unwrap_or(0)
    };
    log_tx(&state, &XcpCommand::Disconnect, ctr);

    let session = state.session.lock().await.take();
    if let Some(mut session) = session {
        let _ = session.disconnect().await;
    }
    let _ = state.tx.send(serde_json::to_string(&json!({
        "event": "state_changed",
        "data": { "state": "disconnected" },
    })).unwrap());
    Json(json!({ "ok": true }))
}

pub async fn status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let guard = state.session.lock().await;
    match guard.as_ref() {
        Some(s) => Json(json!({ "connected": true,  "slave": s.slave_info })),
        None    => Json(json!({ "connected": false })),
    }
}

pub async fn cmd_get_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetStatus).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn cmd_get_comm_mode_info(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetCommModeInfo).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct GetIdBody { pub id_type: u8 }

pub async fn cmd_get_id(
    State(state): State<Arc<AppState>>,
    Json(body): Json<GetIdBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetId { id_type: body.id_type }).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct RawBody { pub bytes: Vec<u8> }

pub async fn cmd_raw(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RawBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::Raw { bytes: body.bytes }).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct SetMtaBody { pub addr_ext: u8, pub addr: u32 }

pub async fn cmd_set_mta(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SetMtaBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::SetMta { addr_ext: body.addr_ext, addr: body.addr }).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UploadBody { pub size: u8 }

pub async fn cmd_upload(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UploadBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::Upload { size: body.size }).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UserCmdBody { pub name: String, pub sub_cmd: u8, pub data: Vec<u8> }

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
                return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response();
            }
            Some(session) => session.execute(&XcpCommand::Raw { bytes }).await,
        }
    };

    match &response {
        Ok(resp) => {
            log_rx_ok(&state, resp, ctr);
            Json(json!({ "ok": true, "response": resp })).into_response()
        }
        Err(e) => {
            log_rx_err(&state, e);
            (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct PacketsQuery { pub since: Option<i64> }

pub async fn get_packets(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PacketsQuery>,
) -> impl IntoResponse {
    Json(json!({ "packets": state.query_packets(q.since, 500) }))
}

pub async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::to_value(&*state.config.lock().unwrap()).unwrap())
}

#[derive(Deserialize)]
pub struct UpdateConfigBody {
    pub server_ip: String,
    pub server_port: u16,
    pub protocol: String,
    pub timeout_ms: u64,
    pub listen_port: u16,
    pub bind_ip: Option<String>,
}

pub async fn update_config(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UpdateConfigBody>,
) -> impl IntoResponse {
    let result = {
        let mut cfg = state.config.lock().unwrap();
        cfg.connection.server_ip = body.server_ip;
        cfg.connection.server_port = body.server_port;
        cfg.connection.protocol = body.protocol;
        cfg.connection.timeout_ms = body.timeout_ms;
        cfg.connection.bind_ip = body.bind_ip.filter(|s| !s.is_empty());
        cfg.server.listen_port = body.listen_port;
        cfg.save(&state.config_path)
    };
    match result {
        Ok(()) => Json(json!({ "ok": true })).into_response(),
        Err(e) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct DownloadBody { pub data: Vec<u8> }

pub async fn cmd_download(
    State(state): State<Arc<AppState>>,
    Json(body): Json<DownloadBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::Download { data: body.data }).await {
        Ok(r)  => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn get_network_interfaces() -> impl IntoResponse {
    use network_interface::{NetworkInterface, NetworkInterfaceConfig, Addr};
    let ifaces = NetworkInterface::show().unwrap_or_default();
    let result: Vec<serde_json::Value> = ifaces
        .into_iter()
        .filter_map(|iface| {
            let ipv4: Vec<String> = iface.addr.iter().filter_map(|a| {
                if let Addr::V4(v4) = a { Some(v4.ip.to_string()) } else { None }
            }).collect();
            if ipv4.is_empty() { return None; }
            Some(json!({ "name": iface.name, "ips": ipv4 }))
        })
        .collect();
    Json(json!({ "interfaces": result }))
}
