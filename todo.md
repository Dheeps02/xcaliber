# ZenScope — Feature Backlog / TODOs

## TCP over raw Ethernet transport

Currently the only supported inner protocol for raw Ethernet frames is UDP.
TCP requires a stateful implementation at the raw frame level:

- TCP handshake (SYN, SYN-ACK, ACK) before XCP traffic
- Sequence number and ACK number tracking
- Retransmit logic
- Connection teardown (FIN/RST)
- Add `"tcp"` back to the protocol dropdown in Settings once implemented

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
