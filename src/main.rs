mod config;
mod http;
mod session;
mod xcp;

use std::sync::Arc;
use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;

#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                let cfg = config::Config::load("config.toml")
                    .expect("failed to load config.toml");
                let state = Arc::new(http::state::AppState::new(cfg));

                let router = Router::new()
                    .route("/events", get(http::sse::sse_handler))
                    .route("/api/connect",    axum::routing::post(http::routes::connect))
                    .route("/api/disconnect", axum::routing::post(http::routes::disconnect))
                    .route("/api/status",     get(http::routes::status))
                    .route("/api/command/get-status",        axum::routing::post(http::routes::cmd_get_status))
                    .route("/api/command/get-comm-mode-info",axum::routing::post(http::routes::cmd_get_comm_mode_info))
                    .route("/api/command/get-id",            axum::routing::post(http::routes::cmd_get_id))
                    .route("/api/command/raw",               axum::routing::post(http::routes::cmd_raw))
                    .route("/api/packets",    get(http::routes::get_packets))
                    .route("/api/config",     get(http::routes::get_config))
                    .layer(CorsLayer::permissive())
                    .with_state(state);

                let port = 8080u16;
                let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
                    .await
                    .expect("failed to bind port 8080");

                axum::serve(listener, router)
                    .await
                    .expect("server error");
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
