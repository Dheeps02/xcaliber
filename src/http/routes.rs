use axum::{extract::State, response::IntoResponse, Json};
use std::sync::Arc;
use serde_json::json;
use crate::http::state::AppState;

pub async fn connect(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"ok": true}))
}

pub async fn disconnect(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"ok": true}))
}

pub async fn status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let connected = state.session.lock().unwrap().connected;
    Json(json!({"connected": connected}))
}

pub async fn cmd_get_status(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"ok": true}))
}

pub async fn cmd_get_comm_mode_info(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"ok": true}))
}

pub async fn cmd_get_id(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"ok": true}))
}

pub async fn cmd_raw(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"ok": true}))
}

pub async fn get_packets(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({"packets": []}))
}

pub async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::to_value(&state.config).unwrap())
}
