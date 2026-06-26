# Packet Trace

The Trace view is a live, scrolling log of every XCP packet sent to and received from the slave — raw bytes and decoded fields side by side.

## The table

Each row is one packet. Three columns:

| Column | What it shows |
|--------|---------------|
| **Command** | Decoded command name (or raw PID if unknown), direction icon, and a running packet counter `#N` |
| **Time** | Timestamp in milliseconds from session start |
| **Hex** | Raw packet bytes, colored by direction and status |

Rows are tinted by direction and status — try switching themes with the dropdown above.

### TX

<PacketRow type="tx" />

### RX

<PacketRow type="rx" />
<PacketRow type="err" />

### Timeout

<PacketRow type="timeout" />

## Expanding a row

Click any row to expand it. The panel shows the decoded payload — field names on the left, values on the right in monospace. Numbers appear as both hex and decimal: `0x1F (31)`.

For TX packets the panel shows every field except the command name (already visible in the row). For RX responses it shows all decoded fields. If the backend couldn't decode the payload, the panel shows "no field data" alongside the raw PID.

<PacketExpandRow type="tx" />
<PacketExpandRow type="rx" />

## Packet types

### TX

<PacketRow type="tx" />

### RX

<PacketRow type="rx" />

### ERR

<PacketRow type="err" />

### Timeout

<PacketRow type="timeout" />

## Filtering

### Direction filter

The **All / TX / RX** segment control at the top-left filters the table to one direction. Useful when you want to isolate what was sent or what came back without the noise of the other side.

<DirectionFilter />

### Column search

The **Command** and **Hex** column headers each have a searchable filter. Try it — type `DAQ` in Command, or `FF` in Hex:

<ColumnSearch />

Both columns are also sortable.

## Auto-scroll

The <AutoScrollToggle /> toggle locks the table to the latest packet as new ones arrive. Disable it to scroll back through the log freely — it won't snap back until you re-enable it.

## Clearing the trace

The <BroomButton /> button clears the current view. It does not delete the packet history from SQLite — the trace repopulates from the database on the next load.

## History

All packets are written to SQLite as they arrive. The trace repopulates on reconnect, so you can scroll back through a previous session's traffic at any time without the slave being connected.

## Debugging with Trace

The decoded expand panel makes Trace the first place to look when something isn't working:

- A **Timeout** immediately after `CONNECT` usually means the slave isn't reachable — wrong IP, port, or protocol
- A **Negative Response** expands to show the XCP error code in the `error_code` field
- Filtering to **TX** and scanning the Hex column is the fastest way to confirm a specific command was sent with the right payload
- Filtering **Command** by a keyword (e.g. `DAQ`) isolates just the DAQ-related exchange from a busy session
