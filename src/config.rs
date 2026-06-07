use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EventDef {
    pub id: u16,
    pub name: String,
}

fn default_events() -> Vec<EventDef> {
    vec![
        EventDef {
            id: 1,
            name: "1 ms".into(),
        },
        EventDef {
            id: 2,
            name: "10 ms".into(),
        },
        EventDef {
            id: 3,
            name: "100 ms".into(),
        },
        EventDef {
            id: 4,
            name: "1 s".into(),
        },
        EventDef {
            id: 5,
            name: "10 s".into(),
        },
    ]
}

fn default_endian() -> String {
    "little".into()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub connection: ConnectionConfig,
    pub server: ServerConfig,
    #[serde(default)]
    pub custom_commands: Vec<CustomCommand>,
    #[serde(default = "default_events")]
    pub events: Vec<EventDef>,
    #[serde(default = "default_endian")]
    pub endian: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionConfig {
    pub server_ip: String,
    pub server_port: u16,
    pub protocol: String,
    pub timeout_ms: u64,
    #[serde(default)]
    pub bind_ip: Option<String>,
    #[serde(default)]
    pub source_port: Option<u16>,
    #[serde(default)]
    pub src_mac: Option<String>,
    #[serde(default)]
    pub dst_mac: Option<String>,
    #[serde(default)]
    pub vlan_id: Option<u16>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub listen_port: u16,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CustomCommand {
    pub code: u8,
    pub name: String,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub fields: Vec<FieldDef>,
    #[serde(default)]
    pub variants: Vec<CommandVariant>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FieldDef {
    pub name: String,
    pub offset: u8,
    pub size: u8,
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(default)]
    pub options: Vec<FieldOption>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FieldOption {
    pub value: u64,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CommandVariant {
    pub name: String,
    pub match_byte: MatchByte,
    #[serde(default)]
    pub fields: Vec<FieldDef>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MatchByte {
    pub offset: u8,
    pub value: u8,
}

impl Config {
    pub fn load(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self::load_with_path(path)?.0)
    }

    /// Returns (config, resolved_path). Resolved path is the file that was loaded,
    /// or `path` itself as a fallback (for use with `save`).
    pub fn load_with_path(path: &str) -> Result<(Self, String), Box<dyn std::error::Error>> {
        let candidates = [
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join(path))),
            Some(Path::new(path).to_path_buf()),
        ];
        for candidate in candidates.into_iter().flatten() {
            if candidate.exists() {
                let text = std::fs::read_to_string(&candidate)?;
                let resolved = candidate.to_string_lossy().into_owned();
                return Ok((toml::from_str(&text)?, resolved));
            }
        }
        Ok((Self::default(), path.to_owned()))
    }

    pub fn save(&self, path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let text = toml::to_string_pretty(self)?;
        std::fs::write(path, text)?;
        Ok(())
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            connection: ConnectionConfig {
                server_ip: "127.0.0.1".into(),
                server_port: 5555,
                protocol: "udp".into(),
                timeout_ms: 1000,
                bind_ip: None,
                source_port: None,
                src_mac: None,
                dst_mac: None,
                vlan_id: None,
            },
            server: ServerConfig { listen_port: 8080 },
            custom_commands: vec![],
            events: default_events(),
            endian: default_endian(),
        }
    }
}
