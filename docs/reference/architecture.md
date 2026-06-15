# Architecture

```mermaid
flowchart TB
    subgraph Electron["Electron Process"]
        direction TB
        subgraph Backend["ZenScope (Rust binary)"]
            Axum["Axum Server :8080<br/>HTTP + SSE"]
            API["/api/* REST endpoints"]
            Events["/events SSE stream"]
            Axum --> API
            Axum --> Events
        end
        Frontend["React Frontend<br/>Vite + Tailwind + Zustand"]
    end

    Slave["XCP Slave<br/>(ECU or mock)"]

    Frontend -->|HTTP / SSE| Axum
    Axum -->|UDP / TCP| Slave
    Slave -->|UDP / TCP| Axum
```

Electron spawns the Rust backend as a sidecar process. The Axum server runs independently — there's no separate backend to manage. A Python mock slave is included for development and testing without real hardware.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron |
| Backend | Rust, Axum, tokio, rusqlite |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand |
| Protocol | XCP on Ethernet (UDP/TCP), ASAM standard |
