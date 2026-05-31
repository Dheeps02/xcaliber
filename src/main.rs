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
                let (cfg, config_path) = config::Config::load_with_path("config.toml")
                    .expect("failed to load config.toml");
                let state = Arc::new(http::state::AppState::new(cfg, config_path));

                let router = Router::new()
                    .route("/events", get(http::sse::sse_handler))
                    .route("/api/connect",    axum::routing::post(http::routes::connect))
                    .route("/api/disconnect", axum::routing::post(http::routes::disconnect))
                    .route("/api/status",     get(http::routes::status))
                    .route("/api/command/get-status",        axum::routing::post(http::routes::cmd_get_status))
                    .route("/api/command/get-comm-mode-info",axum::routing::post(http::routes::cmd_get_comm_mode_info))
                    .route("/api/command/get-id",            axum::routing::post(http::routes::cmd_get_id))
                    .route("/api/command/raw",               axum::routing::post(http::routes::cmd_raw))
                    .route("/api/command/set-mta",          axum::routing::post(http::routes::cmd_set_mta))
                    .route("/api/command/upload",            axum::routing::post(http::routes::cmd_upload))
                    .route("/api/command/download",          axum::routing::post(http::routes::cmd_download))
                    .route("/api/command/user",              axum::routing::post(http::routes::cmd_user))
                    .route("/api/packets",    get(http::routes::get_packets))
                    .route("/api/config",     get(http::routes::get_config).post(http::routes::update_config))
                    .route("/api/network-interfaces", get(http::routes::get_network_interfaces))
                    // ── DAQ ───────────────────────────────────────
                    .route("/api/daq/status",  get(http::routes::daq_get_status))
                    .route("/api/daq/lists",   get(http::routes::daq_get_lists).post(http::routes::daq_add_list))
                    .route("/api/daq/lists/:id/delete",  axum::routing::post(http::routes::daq_delete_list))
                    .route("/api/daq/lists/:id/odts",    axum::routing::post(http::routes::daq_add_odt))
                    .route("/api/daq/lists/:id/odts/:odt_id/entries",
                        axum::routing::post(http::routes::daq_add_entry))
                    .route("/api/daq/lists/:id/odts/:odt_id/entries/:idx/delete",
                        axum::routing::post(http::routes::daq_delete_entry))
                    .route("/api/daq/lists/:id/event",   axum::routing::post(http::routes::daq_set_event))
                    .route("/api/daq/configure", axum::routing::post(http::routes::daq_configure))
                    .route("/api/daq/start",     axum::routing::post(http::routes::daq_start))
                    .route("/api/daq/stop",      axum::routing::post(http::routes::daq_stop))
                    .route("/api/daq/free",      axum::routing::post(http::routes::daq_free))
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
