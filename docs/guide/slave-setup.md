# Slave Setup

## Mock slave

No hardware? No problem. ZenScope ships with a Python XCP slave that simulates a real ECU on your local machine — full DAQ, memory read/write, the works.

**Prerequisites:** Python 3 (no extra packages needed — stdlib only).

Run it from the repo root:

```bash
python mock_slave.py
```

It listens on `127.0.0.1:5555` (UDP) and exposes 50 simulated variables across four categories:

| Category | Examples |
|---|---|
| Powertrain | engine RPM, throttle position, torque, gear position |
| Thermal | coolant temp, exhaust temp, oil temp, intake air temp |
| Electrical | battery voltage, alternator voltage, fuel pump duty |
| Sensors | lambda sensors, MAP sensor, injector pulse width |

Once it's running, open ZenScope, go to **Settings**, and set the connection to `127.0.0.1:5555` (UDP). Hit **Connect** — you should see the slave info appear and all 50 variables ready to DAQ.

## Hardware ECU

Connect your ECU directly to the PC running ZenScope via an Ethernet cable. Most ECUs don't need a switch or router in between — a direct connection works fine.

You'll need:
- The ECU's IP address and XCP port (check your ECU documentation)
- The transport protocol your ECU uses (UDP or raw Ethernet — when in doubt, start with UDP)

Open **Settings** in ZenScope and fill in the IP, port, and protocol, then hit **Connect**.

<!-- screenshot: /media/settings-hardware-ecu.png — Settings panel with connection fields filled in -->

::: tip Stick to UDP unless you have a reason not to
Raw Ethernet transport is only needed when the ECU expects proper source/destination MAC addresses in the XCP request packets. If your ECU documentation doesn't specifically call this out, UDP will work and is simpler to configure.
:::

For a full breakdown of every connection setting, see [Configuration](./configuration).
