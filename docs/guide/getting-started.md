# Getting Started

## Download

Pre-built binaries are published on [GitHub Releases](https://github.com/Dheeps02/xcaliber/releases) for Linux (AppImage), Windows (NSIS installer), and macOS (universal DMG).

## First Run

1. Launch ZenScope. The bundled Rust backend starts automatically as a sidecar process — there's nothing separate to run.
2. Open **Settings** and point the connection at your ECU (UDP or TCP, IP + port).
3. Hit **Connect**. ZenScope sends an XCP `CONNECT` and shows the slave info once it responds.
4. Browse memory, send commands, or jump into the **DAQ** tab to start streaming live values.

## No ECU? Use the mock slave

A Python mock slave is included for trying the whole workflow without real hardware:

```bash
python mock_slave.py
```

This simulates a full XCP slave on `127.0.0.1:5555` with 8 test variables (engine RPM, coolant temp, throttle position, etc.) and complete DAQ support at 10 Hz. Point ZenScope's connection settings at `127.0.0.1:5555` (UDP) and connect.
