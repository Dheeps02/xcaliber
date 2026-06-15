mod config;
mod debug_log;
mod http;
mod session;
mod xcp;

use axum::{Router, routing::get};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

async fn run_server() {
    let (cfg, config_path) =
        config::Config::load_with_path("config.toml").expect("failed to load config.toml");
    let port = cfg.server.listen_port;
    let state = Arc::new(http::state::AppState::new(cfg, config_path));

    let router = Router::new()
        .route("/events", get(http::sse::sse_handler))
        .route("/api/connect", axum::routing::post(http::routes::connect))
        .route(
            "/api/disconnect",
            axum::routing::post(http::routes::disconnect),
        )
        .route("/api/status", get(http::routes::status))
        .route(
            "/api/command/get-status",
            axum::routing::post(http::routes::cmd_get_status),
        )
        .route(
            "/api/command/get-comm-mode-info",
            axum::routing::post(http::routes::cmd_get_comm_mode_info),
        )
        .route(
            "/api/command/get-id",
            axum::routing::post(http::routes::cmd_get_id),
        )
        .route(
            "/api/command/raw",
            axum::routing::post(http::routes::cmd_raw),
        )
        .route(
            "/api/command/set-mta",
            axum::routing::post(http::routes::cmd_set_mta),
        )
        .route(
            "/api/command/upload",
            axum::routing::post(http::routes::cmd_upload),
        )
        .route(
            "/api/command/download",
            axum::routing::post(http::routes::cmd_download),
        )
        .route(
            "/api/command/user",
            axum::routing::post(http::routes::cmd_user),
        )
        .route("/api/packets", get(http::routes::get_packets))
        .route(
            "/api/config",
            get(http::routes::get_config).post(http::routes::update_config),
        )
        .route(
            "/api/network-interfaces",
            get(http::routes::get_network_interfaces),
        )
        // ── DAQ ───────────────────────────────────────────────────
        .route("/api/daq/status", get(http::routes::daq_get_status))
        .route(
            "/api/daq/lists",
            get(http::routes::daq_get_lists).post(http::routes::daq_add_list),
        )
        .route(
            "/api/daq/lists/{id}/delete",
            axum::routing::post(http::routes::daq_delete_list),
        )
        .route(
            "/api/daq/lists/{id}/odts",
            axum::routing::post(http::routes::daq_add_odt),
        )
        .route(
            "/api/daq/lists/{id}/odts/{odt_id}/entries",
            axum::routing::post(http::routes::daq_add_entry),
        )
        .route(
            "/api/daq/lists/{id}/odts/{odt_id}/entries/{idx}/delete",
            axum::routing::post(http::routes::daq_delete_entry),
        )
        .route(
            "/api/daq/lists/{id}/event",
            axum::routing::post(http::routes::daq_set_event),
        )
        .route(
            "/api/daq/lists/{id}/run-mode",
            axum::routing::post(http::routes::daq_set_run_mode),
        )
        .route(
            "/api/daq/lists/replace",
            axum::routing::post(http::routes::daq_replace_lists),
        )
        .route(
            "/api/daq/configure",
            axum::routing::post(http::routes::daq_configure),
        )
        .route(
            "/api/daq/start",
            axum::routing::post(http::routes::daq_start),
        )
        .route("/api/daq/stop", axum::routing::post(http::routes::daq_stop))
        .route("/api/daq/free", axum::routing::post(http::routes::daq_free))
        // ── Sequence ──────────────────────────────────────────────
        .route(
            "/api/sequence/run",
            axum::routing::post(http::routes::seq_run),
        )
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = match tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await {
        Ok(l) => {
            eprintln!("[zenscope] Axum listening on 0.0.0.0:{port}");
            l
        }
        Err(e) => {
            eprintln!("[zenscope] ERROR: failed to bind port {port}: {e}");
            eprintln!("[zenscope] Is another process using port {port}?");
            return;
        }
    };

    axum::serve(listener, router).await.expect("server error");
}

/// Exits the process once stdin is closed. The Electron host keeps a pipe
/// open to our stdin for as long as it's alive; when it dies (gracefully or
/// killed), the OS closes that pipe and the read below returns EOF, so the
/// backend doesn't outlive the frontend.
fn watch_parent_stdin() {
    use std::io::Read;
    std::thread::spawn(|| {
        let mut buf = [0u8; 64];
        loop {
            match std::io::stdin().read(&mut buf) {
                Ok(0) | Err(_) => std::process::exit(0),
                Ok(_) => {}
            }
        }
    });
}

#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    watch_parent_stdin();
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime")
        .block_on(run_server());
}
