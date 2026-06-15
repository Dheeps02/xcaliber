# REST API

The HTTP server at `:8080` is fully usable outside the GUI — scripts, CLI tools, or other frontends can drive it directly.

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
