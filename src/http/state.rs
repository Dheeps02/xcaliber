use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use crate::config::Config;

#[derive(Debug)]
pub struct AppState {
    pub config: Config,
    pub session: Mutex<SessionState>,
    pub tx: broadcast::Sender<String>,
}

#[derive(Debug, Default)]
pub struct SessionState {
    pub connected: bool,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let (tx, _) = broadcast::channel(1024);
        Self {
            config,
            session: Mutex::new(SessionState::default()),
            tx,
        }
    }
}
