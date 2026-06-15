# ZenScope

A modern, open-source XCP client for automotive ECU calibration and measurement. Built with Rust, Electron, and React.

> **XCP** (Universal Measurement and Calibration Protocol) is an ASAM standard used to read, write, and stream data from automotive ECUs during development and calibration.

---

## Features

- **Connect over UDP or TCP** — XCP-on-Ethernet with configurable transport settings
- **Full command support** — CONNECT, GET_STATUS, GET_ID, SET_MTA, UPLOAD, DOWNLOAD, and raw hex
- **Custom commands** — define your own `USER_CMD` packets via TOML config with named fields
- **DAQ measurement** — configure DAQ lists, ODTs, and entries; stream live values from the ECU
- **Live sparkline plots** — per-signal mini charts updating in real time
- **Packet trace** — full TX/RX log with hex view, decoded fields, and filtering
- **Real-time updates** — SSE-based live push (no polling)
- **Save/Load DAQ configs** — export and import `.daq` files for reusable measurement setups
- **Configurable events** — define XCP event channels via TOML or the Settings UI
- **10+ themes** — Nord, Catppuccin, Gruvbox, Everforest, OLED, and more
- **SQLite packet history** — every packet persisted; survives restarts

## Architecture

```
Electron Process
├── zenscope (Rust binary)
│   └── Axum :8080         HTTP + SSE server
│       ├── /api/*         REST endpoints (commands, DAQ, config)
│       └── /events        Server-Sent Events (live packet + DTO push)
└── BrowserWindow
    └── React frontend (Vite + Tailwind + Zustand)
```

Electron spawns the Rust backend as a sidecar process. The Axum server runs independently — no separate backend to manage. A Python mock slave is included for development and testing without real hardware.

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (2024 edition)
- [Node.js](https://nodejs.org/) (v18+)

### Development

```bash
# Install root and frontend dependencies
npm install
cd frontend && npm install && cd ..

# Run in development mode (hot-reload frontend + Rust backend + Electron)
npm run dev
```

### Build

```bash
npm run build
```

### Mock Slave (for testing without hardware)

```bash
python mock_slave.py
```

Simulates a full XCP slave on `127.0.0.1:5555` with 8 test variables (engine RPM, coolant temp, throttle position, etc.) and complete DAQ support at 10 Hz.

## Configuration

Settings live in `config.toml` (next to the executable, or in the working directory):

```toml
[connection]
server_ip = "127.0.0.1"
server_port = 5555
protocol = "udp"        # "udp" | "tcp"
timeout_ms = 1000

[server]
listen_port = 8080

# XCP event channels shown in the DAQ dropdown
[[events]]
id = 1
name = "1 ms"

[[events]]
id = 2
name = "10 ms"

# Custom USER_CMD definitions
[[custom_commands]]
code = 0xF1
name = "Read Sensor"
fields = [
  { name = "sensor_id", offset = 1, size = 2, type = "u16" },
]
```

All connection settings are also editable from the in-app Settings panel.

## REST API

The HTTP server at `:8080` is fully usable outside the GUI — scripts, CLI tools, or other frontends can drive it:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/connect` | Open transport + XCP CONNECT |
| POST | `/api/disconnect` | XCP DISCONNECT + close |
| GET | `/api/status` | Connection state + slave info |
| POST | `/api/command/raw` | Send arbitrary bytes |
| GET | `/api/packets?since=N` | Packet history (paginated) |
| GET | `/api/daq/status` | DAQ state + list config |
| POST | `/api/daq/start` | Start DAQ streaming |
| GET | `/events` | SSE stream (live packets + DTOs) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| Backend | Rust, Axum, tokio, rusqlite |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand |
| Protocol | XCP on Ethernet (UDP/TCP), ASAM standard |

## License

[MIT](LICENSE)
