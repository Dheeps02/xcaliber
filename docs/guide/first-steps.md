# First Steps

Once ZenScope is running, the first thing you'll do is point it at an XCP slave and connect.

## Open Settings

Click the gear icon in the top-right to open the **Settings** panel.

## Connection

Fill in three fields:

| Field | What to enter |
|-------|---------------|
| **IP Address** | IP address of your XCP slave |
| **Port** | Port the slave listens on — commonly `5555` |
| **Protocol** | `UDP` for most setups; `TCP` if your slave requires it |

::: tip No hardware?
The [mock slave](./slave-setup) listens on `127.0.0.1:5555` over UDP — plug those values in and it works out of the box.
:::

## Connect

Hit **Connect**. ZenScope sends an XCP `CONNECT` request and waits for the slave's response.

If it succeeds, the status bar updates with the slave's info — resource protection flags, address granularity, max CTO/DTO sizes — and the rest of the interface unlocks.

### Common failure reasons

- **Timeout** — wrong IP or port, or the slave isn't running yet
- **Protocol mismatch** — slave expects TCP but you selected UDP, or vice versa
- **Raw Ethernet on Linux** — binary needs `CAP_NET_RAW`, see [Getting Started](./getting-started#linux)

## What's next

With a connection established:

- **DAQ** — configure measurement lists, set events and ODTs, watch live plots
- **Trace** — every XCP packet TX/RX decoded in real time
- **Commands** — send raw bytes or user-defined `USER_CMD` packets

For a full breakdown of every setting — XCP events, custom commands, server port — see [Settings Reference](../reference/settings).
