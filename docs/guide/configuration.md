# Configuration

Settings live in `config.toml`, next to the executable or in the working directory.

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

All of these are also editable from the in-app **Settings** panel — editing `config.toml` directly is optional.

## Connection

| Key | Description |
|-----|-------------|
| `server_ip` | IP address of the XCP slave |
| `server_port` | Port the slave listens on |
| `protocol` | `udp` or `tcp` |
| `timeout_ms` | Response timeout in milliseconds |

## Events

Each `[[events]]` entry adds an XCP event channel to the DAQ configuration dropdown, identified by its XCP event `id`.

## Custom Commands

Each `[[custom_commands]]` entry defines a `USER_CMD` packet with a name, opcode, and named fields — sendable from the Commands tab without writing raw hex.
