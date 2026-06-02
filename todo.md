# XCaliber — Feature Backlog / TODOs

## Backend: Raw Ethernet transport + MAC address support

`src_mac` and `dst_mac` are now stored in the frontend config and sent to the
backend via `POST /api/config`, but the backend does not yet read or use them.

Work needed on the backend side:
- Parse `src_mac` / `dst_mac` from the config TOML and the `/api/config` POST body
- Add a Raw Ethernet transport implementation (raw socket, layer-2 frame construction)
- When `protocol = "ethernet"`, construct XCP frames inside an Ethernet II frame using
  the configured src/dst MACs instead of using a UDP/TCP socket
- Validate MAC address format (`XX:XX:XX:XX:XX:XX`) on both ingest and outgoing frames

## Multi-byte field support in response decoders

**Scope:** Both USER_CMD response variants and the general packet trace decoder.

Currently all decoded fields are assumed to be 1 byte wide. Many real-world
responses encode 16-bit or 32-bit values across consecutive bytes (e.g. a
16-bit address split into `addr_lo` + `addr_hi`). A `size` property on each
field definition would let the decoder read and display the combined value.

Things to handle when implementing:
- `size` on `ResponseByteDef` (USER_CMD variants)
- `size` on `CustomFieldDef` (generic trace decoder fields)
- Endianness — at minimum little-endian, ideally configurable per-field
- Display format — decimal, hex, both?
- Overlap/gap validation when fields don't cover the full response
