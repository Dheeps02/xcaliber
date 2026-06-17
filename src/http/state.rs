use crate::{config::Config, session::XcpSession};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex};
use tokio::sync::{Mutex as AsyncMutex, broadcast};

// ── DAQ data model ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaqEntryDef {
    pub name: String,
    pub addr: u32,
    pub addr_ext: u8,
    pub size: u8,
    pub type_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaqOdtDef {
    pub id: u32,
    #[serde(default)]
    pub name: Option<String>,
    pub entries: Vec<DaqEntryDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaqListDef {
    pub id: u32,
    #[serde(default)]
    pub name: Option<String>,
    pub event_channel: u16,
    pub odts: Vec<DaqOdtDef>,
    /// START_STOP_DAQ_LIST mode last applied to this list (0x00 STOP,
    /// 0x01 START, 0x03 SELECT/prepare for synchronized start).
    #[serde(default = "default_run_mode")]
    pub run_mode: u8,
    /// SET_DAQ_LIST_MODE mode bitfield (alternating ODTs, direction,
    /// timestamp, PID off, resume).
    #[serde(default = "default_daq_list_mode")]
    pub daq_list_mode: u8,
    /// SET_DAQ_LIST_MODE transmission rate prescaler.
    #[serde(default = "default_prescaler")]
    pub prescaler: u8,
}

pub(crate) fn default_run_mode() -> u8 {
    0x03
}

pub(crate) fn default_daq_list_mode() -> u8 {
    0x10
}

pub(crate) fn default_prescaler() -> u8 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DaqStatus {
    Idle,
    Configured,
    Running,
}

// ── AppState ──────────────────────────────────────────────────────

pub struct AppState {
    pub config: Mutex<Config>,
    /// XCP session — None when disconnected.
    pub session: AsyncMutex<Option<XcpSession>>,
    /// SQLite for packet history + settings — persisted to disk.
    pub db: Mutex<Connection>,
    /// Live SSE push channel.
    pub tx: broadcast::Sender<String>,
    /// DAQ configuration state.
    pub daq_status: Mutex<DaqStatus>,
    pub daq_lists: Mutex<Vec<DaqListDef>>,
    /// PID → (list_id, odt_id, entries) map, built at configure time.
    pub daq_dto_map: Mutex<HashMap<u8, (u32, u32, Vec<DaqEntryDef>)>>,
    /// (daq_list_num, odt_num, odt_entry_num) cursor set by the last raw
    /// SET_DAQ_PTR, consumed by the next raw WRITE_DAQ.
    pub daq_ptr: Mutex<Option<(u16, u8, u8)>>,
    /// Handle to the running DTO receive task (Some while DAQ is running).
    pub daq_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    /// Handle to the slave drop monitor task — aborted on manual disconnect.
    pub monitor_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
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
    pub fn new(config: Config, db: Connection) -> Self {
        db.execute_batch(
            "CREATE TABLE IF NOT EXISTS packets (
               id           INTEGER PRIMARY KEY AUTOINCREMENT,
               direction    TEXT    NOT NULL,
               counter      INTEGER NOT NULL,
               timestamp_ms INTEGER NOT NULL,
               hex          TEXT    NOT NULL,
               pid          TEXT    NOT NULL,
               decoded      TEXT    NOT NULL
             );
             CREATE TABLE IF NOT EXISTS settings (
               id          INTEGER PRIMARY KEY CHECK (id = 1),
               config_json TEXT    NOT NULL
             );",
        )
        .expect("schema init failed");

        let (tx, _) = broadcast::channel(1024);
        Self {
            config: Mutex::new(config),
            session: AsyncMutex::new(None),
            db: Mutex::new(db),
            tx,
            daq_status: Mutex::new(DaqStatus::Idle),
            daq_lists: Mutex::new(Vec::new()),
            daq_dto_map: Mutex::new(HashMap::new()),
            daq_ptr: Mutex::new(None),
            daq_task: Mutex::new(None),
            monitor_task: Mutex::new(None),
        }
    }

    pub fn save_config(&self) {
        let json = serde_json::to_string(&*self.config.lock().unwrap()).unwrap_or_default();
        let db = self.db.lock().unwrap();
        let _ = db.execute(
            "INSERT OR REPLACE INTO settings (id, config_json) VALUES (1, ?1)",
            rusqlite::params![json],
        );
    }

    pub fn insert_packet(&self, entry: &PacketEntry) -> i64 {
        let db = self.db.lock().unwrap();
        match db.execute(
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
        ) {
            Ok(_) => {}
            Err(e) => eprintln!("[db] insert_packet failed: {e}"),
        }
        db.last_insert_rowid()
    }

    pub fn query_packets(&self, since_id: Option<i64>, limit: usize) -> Vec<PacketEntry> {
        let db = self.db.lock().unwrap();
        let since = since_id.unwrap_or(0);
        let mut stmt = db
            .prepare(
                "SELECT id, direction, counter, timestamp_ms, hex, pid, decoded
             FROM packets WHERE id > ?1 ORDER BY id ASC LIMIT ?2",
            )
            .unwrap();
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
