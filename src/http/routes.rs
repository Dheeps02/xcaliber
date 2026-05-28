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

/// Execute a command, store both TX and RX in DB, push both over SSE.
async fn run_cmd(
    state: &AppState,
    cmd: XcpCommand,
) -> Result<XcpResponse, crate::xcp::error::XcpError> {
    let tx_payload = cmd.encode();
    let tx_hex = bytes_to_hex(&tx_payload);
    let tx_pid = format!("{:02X}", tx_payload[0]);
    let cmd_name = cmd.name();

    let response = {
        let mut session_guard = state.session.lock().await;
        let session = session_guard.as_mut().ok_or(crate::xcp::error::XcpError::NotConnected)?;
        session.execute(&cmd).await
    };

    let tx_entry = PacketEntry {
        id: 0,
        direction: "tx".into(),
        counter: 0,
        timestamp_ms: now_ms(),
        hex: tx_hex,
        pid: tx_pid,
        decoded: json!({ "command": cmd_name }),
    };
    state.insert_packet(&tx_entry);
    let _ = state.tx.send(serde_json::to_string(&json!({
        "event": "packet_tx",
        "data": tx_entry,
    })).unwrap());

    match &response {
        Ok(resp) => {
            let rx_entry = PacketEntry {
                id: 0,
                direction: "rx".into(),
                counter: 0,
                timestamp_ms: now_ms(),
                hex: String::new(),
                pid: if matches!(resp, XcpResponse::Error(_)) { "FE".into() } else { "FF".into() },
                decoded: serde_json::to_value(resp).unwrap_or(serde_json::Value::Null),
            };
            state.insert_packet(&rx_entry);
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "packet_rx",
                "data": rx_entry,
            })).unwrap());
        }
        Err(e) => {
            let err_entry = PacketEntry {
                id: 0,
                direction: "rx".into(),
                counter: 0,
                timestamp_ms: now_ms(),
                hex: String::new(),
                pid: "FE".into(),
                decoded: json!({ "error": e.to_string() }),
            };
            state.insert_packet(&err_entry);
        }
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

    let mut session = XcpSession::new(transport, cfg.timeout_ms);
    match session.connect().await {
        Ok(info) => {
            let info = info.clone();
            *state.session.lock().await = Some(session);
            let _ = state.tx.send(serde_json::to_string(&json!({
                "event": "state_changed",
                "data": { "state": "connected", "slave": info },
            })).unwrap());
            Json(json!({ "ok": true, "slave": info })).into_response()
        }
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn disconnect(State(state): State<Arc<AppState>>) -> impl IntoResponse {
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
        Some(s) => Json(json!({
            "connected": true,
            "slave": s.slave_info,
        })),
        None => Json(json!({ "connected": false })),
    }
}

pub async fn cmd_get_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetStatus).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn cmd_get_comm_mode_info(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::GetCommModeInfo).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
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
    match run_cmd(&state, XcpCommand::GetId { id_type: body.id_type }).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[derive(Deserialize)]
pub struct RawBody {
    pub bytes: Vec<u8>,
}

pub async fn cmd_raw(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RawBody>,
) -> impl IntoResponse {
    match run_cmd(&state, XcpCommand::Raw { bytes: body.bytes }).await {
        Ok(r) => Json(json!({ "ok": true, "response": r })).into_response(),
        Err(e) => (axum::http::StatusCode::BAD_GATEWAY, Json(json!({ "error": e.to_string() }))).into_response(),
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
    let packets = state.query_packets(q.since, 500);
    Json(json!({ "packets": packets }))
}

pub async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::to_value(&state.config).unwrap())
}
