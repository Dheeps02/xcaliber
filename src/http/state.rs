use std::sync::Mutex;
use tokio::sync::{broadcast, Mutex as AsyncMutex};
use rusqlite::Connection;
use serde::Serialize;
use crate::{config::Config, session::XcpSession};

pub struct AppState {
    pub config: Config,
    /// XCP session — None when disconnected.
    pub session: AsyncMutex<Option<XcpSession>>,
    /// SQLite for packet history — every TX/RX is INSERTed immediately.
    pub db: Mutex<Connection>,
    /// Live SSE push channel.
    pub tx: broadcast::Sender<String>,
}

/// A packet log entry (mirrors the DB row).
#[derive(Debug, Clone, Serialize)]
pub struct PacketEntry {
    pub id: i64,
    pub direction: String, // "tx" | "rx"
    pub counter: u16,
    pub timestamp_ms: i64,
    pub hex: String,
    pub pid: String,
    pub decoded: serde_json::Value,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let db = Connection::open_in_memory().expect("sqlite open failed");
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS packets (
               id           INTEGER PRIMARY KEY AUTOINCREMENT,
               direction    TEXT    NOT NULL,
               counter      INTEGER NOT NULL,
               timestamp_ms INTEGER NOT NULL,
               hex          TEXT    NOT NULL,
               pid          TEXT    NOT NULL,
               decoded      TEXT    NOT NULL
             );",
        ).expect("schema init failed");

        let (tx, _) = broadcast::channel(1024);
        Self {
            config,
            session: AsyncMutex::new(None),
            db: Mutex::new(db),
            tx,
        }
    }

    pub fn insert_packet(&self, entry: &PacketEntry) -> i64 {
        let db = self.db.lock().unwrap();
        db.execute(
            "INSERT INTO packets (direction, counter, timestamp_ms, hex, pid, decoded)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                entry.direction,
                entry.counter,
                entry.timestamp_ms,
                entry.hex,
                entry.pid,
                entry.decoded.to_string(),
            ],
        ).ok();
        db.last_insert_rowid()
    }

    pub fn query_packets(&self, since_id: Option<i64>, limit: usize) -> Vec<PacketEntry> {
        let db = self.db.lock().unwrap();
        let since = since_id.unwrap_or(0);
        let mut stmt = db.prepare(
            "SELECT id, direction, counter, timestamp_ms, hex, pid, decoded
             FROM packets WHERE id > ?1 ORDER BY id ASC LIMIT ?2"
        ).unwrap();
        stmt.query_map(rusqlite::params![since, limit as i64], |row| {
            let decoded_str: String = row.get(6)?;
            Ok(PacketEntry {
                id: row.get(0)?,
                direction: row.get(1)?,
                counter: row.get::<_, i64>(2)? as u16,
                timestamp_ms: row.get(3)?,
                hex: row.get(4)?,
                pid: row.get(5)?,
                decoded: serde_json::from_str(&decoded_str).unwrap_or(serde_json::Value::Null),
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }
}
