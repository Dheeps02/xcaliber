# Packet Trace

The Trace view is a full TX/RX log of every XCP packet sent and received.

## What you get per packet

- Raw hex bytes
- Decoded fields (PID, command/response codes, payload breakdown)
- Direction (TX/RX) and timestamp

## Filtering

Filter the trace by command type or direction to isolate the exchange you care about — useful when debugging a specific DAQ event or command response.

## History

Like DAQ data, packet history is persisted to SQLite and survives restarts — scroll back through a previous session's traffic at any time.
