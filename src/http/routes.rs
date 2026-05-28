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

fn log_tx(state: &AppState, cmd: &XcpCommand) -> PacketEntry {
    let payload = cmd.encode();
    let entry = PacketEntry {
        id: 0,
        direction: "tx".into(),
        counter: 0,
        timestamp_ms: now_ms(),
        hex: bytes_to_hex(&payload),
        pid: format!("{:02X}", payload[0]),
        decoded: json!({ "command": cmd.name() }),
    };
    let id = state.insert_packet(&entry);
    let entry = PacketEntry { id, ..entry };
    broadcast_packet(state, "packet_tx", &entry);
    entry
}

fn log_rx_ok(state: &AppState, resp: &XcpResponse) -> PacketEntry {
    let entry = PacketEntry {
        id: 0,
        direction: "rx".into(),
        counter: 0,
        timestamp_ms: now_ms(),
        hex: String::new(),
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
        hex: String::new(),
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
    log_tx(state, &cmd);

    let response = {
        let mut guard = state.session.lock().await;
        let session = guard.as_mut().ok_or(crate::xcp::error::XcpError::NotConnected)?;
        session.execute(&cmd).await
    };

    match &response {
        Ok(resp) => { log_rx_ok(state, resp); }
        Err(e)   => { log_rx_err(state, e); }
    }

    response
}

// ── routes ───────────────────────────────────────────────────────

pub async fn connect(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let cfg = state.config.connection.clone();
    let transport: Box<dyn crate::xcp::transport::XcpTransport> = match cfg.protocol.as_str() {
        "tcp" => match TcpTransport::connect(&cfg.server_ip, cfg.server_port).await {
            Ok(t) => Box::new(t),
            Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
        },
        _ => match UdpTransport::connect(&cfg.server_ip, cfg.server_port).await {
            Ok(t) => Box::new(t),
            Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
        },
    };

    // Log TX before sending
    log_tx(&state, &XcpCommand::Connect { mode: 0 });

    let mut session = XcpSession::new(transport, cfg.timeout_ms);
    match session.connect().await {
        Ok(info) => {
            let info = info.clone();

            // Log RX with the connect response
            let rx_entry = PacketEntry {
                id: 0,
                direction: "rx".into(),
                counter: 0,
                timestamp_ms: now_ms(),
                hex: String::new(),
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
    log_tx(&state, &XcpCommand::Disconnect);

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
pub struct PacketsQuery { pub since: Option<i64> }

pub async fn get_packets(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PacketsQuery>,
) -> impl IntoResponse {
    Json(json!({ "packets": state.query_packets(q.since, 500) }))
}

pub async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::to_value(&state.config).unwrap())
}
