# Use Cases

## Live calibration during bench/dyno testing

Connect to an ECU over UDP or TCP, read and write memory locations directly, and watch values update in real time as you tune.

## Measurement logging

Configure a DAQ list once — events, ODTs, entries — save it as a `.daq` file, and reuse it across sessions. Every packet is persisted to SQLite, so history survives restarts.

## Exploring an unknown ECU

Use `GET_ID` and memory browsing to map out an ECU you don't have documentation for. The packet trace shows every byte sent and received, with hex and decoded views side by side.

## No hardware available

Run the included mock slave to exercise the full workflow — connect, DAQ, live plots, trace — without any ECU on hand. See [Getting Started](./getting-started).
