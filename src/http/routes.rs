use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    http::state::{AppState, DaqEntryDef, DaqListDef, DaqOdtDef, DaqStatus, PacketEntry},
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
        // ── DAQ commands ──────────────────────────────────────────
        XcpCommand::FreeDaq =>
            json!({ "command": "FREE_DAQ" }),
        XcpCommand::AllocDaq { count } =>
            json!({ "command": "ALLOC_DAQ", "count": count }),
        XcpCommand::AllocOdt { daq_list_num, odt_count } =>
            json!({ "command": "ALLOC_ODT", "daq_list_num": daq_list_num, "odt_count": odt_count }),
        XcpCommand::AllocOdtEntry { daq_list_num, odt_num, entry_count } =>
            json!({ "command": "ALLOC_ODT_ENTRY", "daq_list_num": daq_list_num, "odt_num": odt_num, "entry_count": entry_count }),
        XcpCommand::SetDaqPtr { daq_list_num, odt_num, odt_entry_num } =>
            json!({ "command": "SET_DAQ_PTR", "daq_list_num": daq_list_num, "odt_num": odt_num, "odt_entry_num": odt_entry_num }),
        XcpCommand::WriteDaq { bit_offset, size, addr_ext, addr } =>
            json!({ "command": "WRITE_DAQ", "bit_offset": bit_offset, "size": size, "addr_ext": addr_ext, "addr": addr }),
        XcpCommand::SetDaqListMode { mode, daq_list_num, event_channel, .. } =>
            json!({ "command": "SET_DAQ_LIST_MODE", "mode": mode, "daq_list_num": daq_list_num, "event_channel": event_channel }),
        XcpCommand::StartStopDaqList { mode, daq_list_num } =>
            json!({ "command": "START_STOP_DAQ_LIST", "mode": mode, "daq_list_num": daq_list_num }),
        XcpCommand::StartStopSynch { mode } =>
            json!({ "command": "START_STOP_SYNCH", "mode": mode }),
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

    log_tx(&state, &XcpCommand::Connect { mode: 0 }, 0);

    let mut session = XcpSession::new(transport, cfg.timeout_ms);
    match session.connect().await {
        Ok(info) => {
            let info = info.clone();
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

// ── DAQ routes ────────────────────────────────────────────────────

pub async fn daq_get_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let status = state.daq_status.lock().unwrap().clone();
    let lists  = state.daq_lists.lock().unwrap().clone();
    Json(json!({ "state": status, "lists": lists }))
}

pub async fn daq_get_lists(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let lists = state.daq_lists.lock().unwrap().clone();
    Json(json!({ "lists": lists }))
}

#[derive(Deserialize)]
pub struct AddListBody { pub event_channel: u16 }

pub async fn daq_add_list(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AddListBody>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let id = lists.iter().map(|l| l.id).max().map(|m| m + 1).unwrap_or(0);
    let list = DaqListDef { id, event_channel: body.event_channel, odts: vec![DaqOdtDef { id: 0, entries: vec![] }] };
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
        return (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "list not found" }))).into_response();
    };
    let odt_id = list.odts.iter().map(|o| o.id).max().map(|m| m + 1).unwrap_or(0);
    list.odts.push(DaqOdtDef { id: odt_id, entries: vec![] });
    Json(json!({ "odt_id": odt_id })).into_response()
}

pub async fn daq_add_entry(
    State(state): State<Arc<AppState>>,
    Path((list_id, odt_id)): Path<(u32, u32)>,
    Json(entry): Json<DaqEntryDef>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let Some(list) = lists.iter_mut().find(|l| l.id == list_id) else {
        return (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "list not found" }))).into_response();
    };
    let Some(odt) = list.odts.iter_mut().find(|o| o.id == odt_id) else {
        return (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "odt not found" }))).into_response();
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
        return (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "list not found" }))).into_response();
    };
    let Some(odt) = list.odts.iter_mut().find(|o| o.id == odt_id) else {
        return (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "odt not found" }))).into_response();
    };
    if entry_idx < odt.entries.len() {
        odt.entries.remove(entry_idx);
    }
    Json(json!({ "ok": true })).into_response()
}

#[derive(Deserialize)]
pub struct SetEventBody { pub event_channel: u16 }

pub async fn daq_set_event(
    State(state): State<Arc<AppState>>,
    Path(list_id): Path<u32>,
    Json(body): Json<SetEventBody>,
) -> impl IntoResponse {
    let mut lists = state.daq_lists.lock().unwrap();
    let Some(list) = lists.iter_mut().find(|l| l.id == list_id) else {
        return (axum::http::StatusCode::NOT_FOUND, Json(json!({ "error": "list not found" }))).into_response();
    };
    list.event_channel = body.event_channel;
    Json(json!({ "ok": true })).into_response()
}

async fn daq_configure_inner(state: &Arc<AppState>) -> Result<(), crate::xcp::error::XcpError> {
    let lists = state.daq_lists.lock().unwrap().clone();

    run_cmd(state, XcpCommand::FreeDaq).await?;
    run_cmd(state, XcpCommand::AllocDaq { count: lists.len() as u16 }).await?;

    for list in &lists {
        run_cmd(state, XcpCommand::AllocOdt {
            daq_list_num: list.id as u16,
            odt_count: list.odts.len() as u8,
        }).await?;
    }

    for list in &lists {
        for odt in &list.odts {
            run_cmd(state, XcpCommand::AllocOdtEntry {
                daq_list_num: list.id as u16,
                odt_num: odt.id as u8,
                entry_count: odt.entries.len() as u8,
            }).await?;
        }
    }

    for list in &lists {
        for odt in &list.odts {
            for (ei, entry) in odt.entries.iter().enumerate() {
                run_cmd(state, XcpCommand::SetDaqPtr {
                    daq_list_num: list.id as u16,
                    odt_num: odt.id as u8,
                    odt_entry_num: ei as u8,
                }).await?;
                run_cmd(state, XcpCommand::WriteDaq {
                    bit_offset: 0xFF,
                    size: entry.size,
                    addr_ext: entry.addr_ext,
                    addr: entry.addr,
                }).await?;
            }
        }
    }

    for list in &lists {
        run_cmd(state, XcpCommand::SetDaqListMode {
            mode: 0x10,
            daq_list_num: list.id as u16,
            event_channel: list.event_channel,
            prescaler: 1,
            priority: 0,
        }).await?;
    }

    // SELECT each list for synchronized start
    for list in &lists {
        run_cmd(state, XcpCommand::StartStopDaqList {
            mode: 0x03,
            daq_list_num: list.id as u16,
        }).await?;
    }

    Ok(())
}

pub async fn daq_configure(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match daq_configure_inner(&state).await {
        Ok(()) => {
            *state.daq_status.lock().unwrap() = DaqStatus::Configured;
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "daq_state_changed", "data": { "state": "configured" }
            })).unwrap());
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn daq_start(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::StartStopSynch { mode: 0x01 }).await {
        Ok(_) => {
            *state.daq_status.lock().unwrap() = DaqStatus::Running;
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "daq_state_changed", "data": { "state": "running" }
            })).unwrap());
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn daq_stop(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::StartStopSynch { mode: 0x00 }).await {
        Ok(_) => {
            *state.daq_status.lock().unwrap() = DaqStatus::Configured;
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "daq_state_changed", "data": { "state": "configured" }
            })).unwrap());
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn daq_free(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::FreeDaq).await {
        Ok(_) => {
            *state.daq_status.lock().unwrap() = DaqStatus::Idle;
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "daq_state_changed", "data": { "state": "idle" }
            })).unwrap());
            Json(json!({ "ok": true })).into_response()
        }
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}
