use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub connection: ConnectionConfig,
    pub server: ServerConfig,
    #[serde(default)]
    pub custom_commands: Vec<CustomCommand>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionConfig {
    pub server_ip: String,
    pub server_port: u16,
    pub protocol: String,
    pub timeout_ms: u64,
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
        let candidates = [
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join(path))),
            Some(Path::new(path).to_path_buf()),
        ];
        for candidate in candidates.into_iter().flatten() {
            if candidate.exists() {
                let text = std::fs::read_to_string(&candidate)?;
                return Ok(toml::from_str(&text)?);
            }
        }
        Ok(Self::default())
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
            },
            server: ServerConfig { listen_port: 8080 },
            custom_commands: vec![],
        }
    }
}
