# DAQ & Live Plots

The DAQ (Data Acquisition) view configures and runs XCP measurement lists against a connected ECU.

## Configuring a DAQ list

- Add measurement entries by memory address, size, and type
- Group entries into ODTs (Object Descriptor Tables) under XCP events configured in the in-app **Settings** panel
- Save the full list as a `.daq` file and reload it later — no need to rebuild a measurement setup from scratch each session

## Live plots

Once DAQ is running, each signal gets a sparkline plot updating in real time as new values stream in over SSE (Server-Sent Events) — no polling.

## Persistence

Every received value is written to SQLite as it arrives, so a DAQ session's history survives an app restart.
