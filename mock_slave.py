#!/usr/bin/env python3
"""
XCP-on-Ethernet mock slave (UDP).

Supports all XCP commands implemented in zenscope, including full DAQ with
50 simulated test variables grouped by category.

  ── Powertrain ────────────────────────────────────────────────────
  addr    name                      type  range
  0x1000  engine_rpm                f32   0–8000 RPM
  0x1008  throttle_pos              f32   0–100 %
  0x1014  engine_load               f32   20–95 %
  0x1018  intake_manifold_pressure  f32   40–100 kPa
  0x101C  injection_timing          f32   10–35 °BTDC
  0x1020  ignition_advance          f32   8–40 °
  0x1024  torque_demand             f32   0–400 Nm
  0x1028  torque_actual             f32   0–380 Nm
  0x100C  vehicle_speed             f32   0–120 km/h
  0x102C  gear_position             u8    0–6

  ── Thermal ───────────────────────────────────────────────────────
  0x1004  coolant_temp              f32   80–105 °C
  0x1100  oil_temp                  f32   85–115 °C
  0x1104  exhaust_temp              f32   400–850 °C
  0x1108  intake_air_temp           f32   20–45 °C
  0x110C  trans_fluid_temp          f32   70–100 °C
  0x1110  fuel_temp                 f32   15–35 °C

  ── Electrical ────────────────────────────────────────────────────
  0x1010  battery_voltage           f32   12.0–14.4 V
  0x1200  alternator_voltage        f32   13.8–14.5 V
  0x1204  battery_current           f32   -20–80 A
  0x1208  starter_current           f32   0–250 A
  0x120C  fuel_pump_duty            f32   40–100 %
  0x1210  fan_duty                  f32   0–100 %

  ── Sensors ───────────────────────────────────────────────────────
  0x1300  lambda_sensor_1           f32   0.85–1.15
  0x1304  lambda_sensor_2           f32   0.85–1.15
  0x1308  map_sensor                f32   40–100 kPa
  0x130C  maf_sensor                f32   2–40 g/s
  0x1310  oil_pressure              f32   2.5–6.5 bar
  0x1314  fuel_pressure             f32   3.5–4.5 bar
  0x1318  brake_pressure_front      f32   0–120 bar
  0x131C  brake_pressure_rear       f32   0–80 bar

  ── Chassis ───────────────────────────────────────────────────────
  0x1400  wheel_speed_fl            f32   0–130 km/h
  0x1404  wheel_speed_fr            f32   0–130 km/h
  0x1408  wheel_speed_rl            f32   0–130 km/h
  0x140C  wheel_speed_rr            f32   0–130 km/h
  0x1410  steering_angle            f32   -540–540 °
  0x1414  lateral_accel             f32   -2.0–2.0 g
  0x1418  longitudinal_accel        f32   -1.5–1.5 g
  0x141C  yaw_rate                  f32   -45–45 °/s
  0x1420  traction_control_slip     f32   0–15 %

  ── Fuel System ───────────────────────────────────────────────────
  0x1500  fuel_level                f32   20–100 %
  0x1504  fuel_flow_rate            f32   2–80 ml/min
  0x1508  injector_duty_cyl1        f32   15–85 %
  0x150C  injector_duty_cyl2        f32   15–85 %

  ── Counters ──────────────────────────────────────────────────────
  0x2000  counter_u8                u8    0–255
  0x2001  counter_u16               u16   0–65535
  0x2003  counter_u32               u32   0–2^32
  0x2100  engine_runtime            u32   seconds
  0x2104  total_distance            u32   metres
  0x2108  fuel_consumed             u32   ml
  0x210C  injection_count           u32   count

DAQ DTOs are sent at 10 Hz once START_STOP_SYNCH(start) is received.

Usage:
  python mock_slave.py [--host HOST] [--port PORT]
"""

import argparse
import math
import random
import socket
import struct
import threading
import time

# ── XCP PIDs / error codes ────────────────────────────────────────────

PID_POSITIVE    = 0xFF
PID_ERROR       = 0xFE
ERR_CMD_UNKNOWN = 0x20
ERR_OUT_OF_RANGE = 0x22

# ── XCP command codes ─────────────────────────────────────────────────

CMD_CONNECT             = 0xFF
CMD_DISCONNECT          = 0xFE
CMD_GET_STATUS          = 0xFD
CMD_GET_COMM            = 0xFB
CMD_GET_ID              = 0xFA
CMD_SET_MTA             = 0xF6
CMD_UPLOAD              = 0xF5
CMD_DOWNLOAD            = 0xF0
CMD_FREE_DAQ            = 0xD6
CMD_ALLOC_DAQ           = 0xD5
CMD_ALLOC_ODT           = 0xD4
CMD_ALLOC_ODT_ENTRY     = 0xD3
CMD_SET_DAQ_LIST_MODE   = 0xE0
CMD_START_STOP_DAQ_LIST = 0xDE
CMD_START_STOP_SYNCH    = 0xDD
CMD_SET_DAQ_PTR         = 0xE2
CMD_WRITE_DAQ           = 0xE1

# Event channel rate definitions (Hz). Clients assign DAQ lists to channels
# via SET_DAQ_LIST_MODE; the send loop fires each channel at its own rate.
EVENT_CHANNELS = {
    0: 1000.0,  # 1 kHz  — high-speed counters / fast sensors
    1: 100.0,   # 100 Hz — counters, fast diagnostics
    2: 10.0,    # 10 Hz  — standard ECU signals
    3: 1.0,     # 1 Hz   — slow/background data
}

CMD_NAMES = {
    CMD_CONNECT:             "CONNECT",
    CMD_DISCONNECT:          "DISCONNECT",
    CMD_GET_STATUS:          "GET_STATUS",
    CMD_GET_COMM:            "GET_COMM_MODE_INFO",
    CMD_GET_ID:              "GET_ID",
    CMD_SET_MTA:             "SET_MTA",
    CMD_UPLOAD:              "UPLOAD",
    CMD_DOWNLOAD:            "DOWNLOAD",
    CMD_FREE_DAQ:            "FREE_DAQ",
    CMD_ALLOC_DAQ:           "ALLOC_DAQ",
    CMD_ALLOC_ODT:           "ALLOC_ODT",
    CMD_ALLOC_ODT_ENTRY:     "ALLOC_ODT_ENTRY",
    CMD_SET_DAQ_PTR:         "SET_DAQ_PTR",
    CMD_WRITE_DAQ:           "WRITE_DAQ",
    CMD_SET_DAQ_LIST_MODE:   "SET_DAQ_LIST_MODE",
    CMD_START_STOP_DAQ_LIST: "START_STOP_DAQ_LIST",
    CMD_START_STOP_SYNCH:    "START_STOP_SYNCH",
}

# ── Framing ───────────────────────────────────────────────────────────

def encode_packet(counter: int, payload: bytes) -> bytes:
    return struct.pack("<HH", len(payload), counter) + payload

def decode_packet(data: bytes):
    if len(data) < 4:
        return None, None
    length, counter = struct.unpack_from("<HH", data)
    return counter, data[4:4 + length]

# ── Simulated memory / test variables ────────────────────────────────

_T0 = time.time()

def read_mem(addr: int, size: int) -> bytes:
    t = time.time() - _T0

    # ── Powertrain ──────────────────────────────────────────────────────
    if addr == 0x1000:  # engine_rpm  (sine, 0.5 Hz, 0–8000)
        return struct.pack('<f', 4000 + 4000 * math.sin(t * 0.5))

    if addr == 0x1008:  # throttle_pos  (triangle, 0.2 Hz, 0–100 %)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', tri * 100.0)

    if addr == 0x1014:  # engine_load  (blended throttle + rpm, 20–95 %)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        rpm_norm = 0.5 + 0.5 * math.sin(t * 0.5)
        return struct.pack('<f', 20.0 + 75.0 * (0.6 * tri + 0.4 * rpm_norm))

    if addr == 0x1018:  # intake_manifold_pressure  (40–100 kPa, tracks throttle)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 40.0 + 60.0 * tri)

    if addr == 0x101C:  # injection_timing  (10–35 °BTDC, scales with rpm)
        rpm_norm = 0.5 + 0.5 * math.sin(t * 0.5)
        return struct.pack('<f', 10.0 + 25.0 * rpm_norm)

    if addr == 0x1020:  # ignition_advance  (8–40 °, scales with rpm + noise)
        rpm_norm = 0.5 + 0.5 * math.sin(t * 0.5)
        return struct.pack('<f', 8.0 + 32.0 * rpm_norm + random.uniform(-1.0, 1.0))

    if addr == 0x1024:  # torque_demand  (0–400 Nm, follows throttle)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', tri * 400.0)

    if addr == 0x1028:  # torque_actual  (0–380 Nm, lagged + noise)
        p = ((t - 0.4) * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', tri * 380.0 + random.uniform(-5.0, 5.0))

    if addr == 0x100C:  # vehicle_speed  (sine, 0.25 Hz, 0–120 km/h)
        return struct.pack('<f', 60.0 + 60.0 * math.sin(t * 0.25))

    if addr == 0x102C:  # gear_position  (u8, derived from speed)
        speed = 60.0 + 60.0 * math.sin(t * 0.25)
        gear = (0 if speed < 5   else
                1 if speed < 20  else
                2 if speed < 40  else
                3 if speed < 65  else
                4 if speed < 90  else
                5 if speed < 110 else 6)
        return struct.pack('B', gear)

    # ── Thermal ─────────────────────────────────────────────────────────
    if addr == 0x1004:  # coolant_temp  (sine, ~10 s period, 80–105 °C)
        return struct.pack('<f', 92.5 + 12.5 * math.sin(t * 0.6))

    if addr == 0x1100:  # oil_temp  (85–115 °C, ~12 s period)
        return struct.pack('<f', 100.0 + 15.0 * math.sin(t * 0.5))

    if addr == 0x1104:  # exhaust_temp  (400–850 °C, tracks rpm)
        rpm_norm = 0.5 + 0.5 * math.sin(t * 0.5)
        return struct.pack('<f', 625.0 + 225.0 * rpm_norm + random.uniform(-10.0, 10.0))

    if addr == 0x1108:  # intake_air_temp  (20–45 °C, ~15 s period)
        return struct.pack('<f', 32.5 + 12.5 * math.sin(t * 0.4))

    if addr == 0x110C:  # trans_fluid_temp  (70–100 °C, ~14 s period)
        return struct.pack('<f', 85.0 + 15.0 * math.sin(t * 0.45))

    if addr == 0x1110:  # fuel_temp  (15–35 °C, ~18 s period)
        return struct.pack('<f', 25.0 + 10.0 * math.sin(t * 0.35))

    # ── Electrical ──────────────────────────────────────────────────────
    if addr == 0x1010:  # battery_voltage  (12.0–14.4 V, ~12 s period + noise)
        return struct.pack('<f', 13.2 + 1.2 * math.sin(t * 0.5) + random.uniform(-0.05, 0.05))

    if addr == 0x1200:  # alternator_voltage  (13.8–14.5 V, ~10 s period + noise)
        return struct.pack('<f', 14.15 + 0.35 * math.sin(t * 0.6) + random.uniform(-0.03, 0.03))

    if addr == 0x1204:  # battery_current  (-20–80 A, tracks rpm)
        rpm_norm = 0.5 + 0.5 * math.sin(t * 0.5)
        return struct.pack('<f', -10.0 + 90.0 * rpm_norm + random.uniform(-3.0, 3.0))

    if addr == 0x1208:  # starter_current  (brief crank pulse every 30 s)
        phase = t % 30.0
        val = 200.0 * math.exp(-phase * 8.0) if phase < 1.0 else 0.0
        return struct.pack('<f', val)

    if addr == 0x120C:  # fuel_pump_duty  (40–100 %, tracks load)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 40.0 + 60.0 * tri)

    if addr == 0x1210:  # fan_duty  (0–100 %, kicks in above 90 °C, tracks coolant)
        ct = 92.5 + 12.5 * math.sin(t * 0.6)
        duty = max(0.0, min(100.0, (ct - 90.0) / 15.0 * 100.0))
        return struct.pack('<f', duty)

    # ── Sensors ─────────────────────────────────────────────────────────
    if addr == 0x1300:  # lambda_sensor_1  (dithers around stoich 1.0)
        return struct.pack('<f', 1.0 + 0.08 * math.sin(t * 2.5) + random.uniform(-0.015, 0.015))

    if addr == 0x1304:  # lambda_sensor_2  (slight phase offset)
        return struct.pack('<f', 1.0 + 0.08 * math.sin(t * 2.5 + 0.6) + random.uniform(-0.015, 0.015))

    if addr == 0x1308:  # map_sensor  (40–100 kPa, same wave as IMP)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 40.0 + 60.0 * tri)

    if addr == 0x130C:  # maf_sensor  (2–40 g/s, tracks throttle)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 2.0 + 38.0 * tri + random.uniform(-0.5, 0.5))

    if addr == 0x1310:  # oil_pressure  (2.5–6.5 bar, tracks rpm)
        rpm_norm = 0.5 + 0.5 * math.sin(t * 0.5)
        return struct.pack('<f', 2.5 + 4.0 * rpm_norm + random.uniform(-0.1, 0.1))

    if addr == 0x1314:  # fuel_pressure  (3.5–4.5 bar, ~8 s period + noise)
        return struct.pack('<f', 4.0 + 0.5 * math.sin(t * 0.8) + random.uniform(-0.04, 0.04))

    if addr == 0x1318:  # brake_pressure_front  (0–120 bar, occasional presses)
        bp = max(0.0, 60.0 * math.sin(t * 0.15))
        return struct.pack('<f', bp)

    if addr == 0x131C:  # brake_pressure_rear  (0–80 bar)
        bp = max(0.0, 40.0 * math.sin(t * 0.15))
        return struct.pack('<f', bp)

    # ── Chassis ─────────────────────────────────────────────────────────
    if addr in (0x1400, 0x1404, 0x1408, 0x140C):  # wheel speeds fl/fr/rl/rr
        base = 60.0 + 60.0 * math.sin(t * 0.25)
        offsets = {0x1400: 0.0, 0x1404: 0.2, 0x1408: 0.4, 0x140C: 0.6}
        noise = random.uniform(-0.8, 0.8)
        return struct.pack('<f', max(0.0, base + offsets[addr] * math.sin(t * 1.1) + noise))

    if addr == 0x1410:  # steering_angle  (-180–180 °, slow sine)
        return struct.pack('<f', 180.0 * math.sin(t * 0.07))

    if addr == 0x1414:  # lateral_accel  (-2.0–2.0 g)
        return struct.pack('<f', 1.2 * math.sin(t * 0.18) + random.uniform(-0.04, 0.04))

    if addr == 0x1418:  # longitudinal_accel  (-1.5–1.5 g)
        return struct.pack('<f', 0.8 * math.sin(t * 0.25) + random.uniform(-0.04, 0.04))

    if addr == 0x141C:  # yaw_rate  (-45–45 °/s)
        return struct.pack('<f', 30.0 * math.sin(t * 0.18) + random.uniform(-0.8, 0.8))

    if addr == 0x1420:  # traction_control_slip  (0–15 %, mostly near 0)
        raw = 4.0 * math.sin(t * 0.4) + random.uniform(-0.5, 0.5)
        return struct.pack('<f', max(0.0, min(15.0, raw)))

    # ── Fuel System ─────────────────────────────────────────────────────
    if addr == 0x1500:  # fuel_level  (sawtooth 100→20 % over 60 s, then resets)
        return struct.pack('<f', 100.0 - (t % 60.0) / 60.0 * 80.0)

    if addr == 0x1504:  # fuel_flow_rate  (2–80 ml/min, tracks throttle)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 2.0 + 78.0 * tri + random.uniform(-1.0, 1.0))

    if addr == 0x1508:  # injector_duty_cyl1  (15–85 %)
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 15.0 + 70.0 * tri + random.uniform(-1.5, 1.5))

    if addr == 0x150C:  # injector_duty_cyl2  (15–85 %, slight phase offset)
        p = ((t + 0.12) * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', 15.0 + 70.0 * tri + random.uniform(-1.5, 1.5))

    # ── Counters ─────────────────────────────────────────────────────────
    if addr == 0x2000:  # counter_u8  (wraps at 255, 10/s)
        return struct.pack('B', int(t * 10) & 0xFF)

    if addr == 0x2001:  # counter_u16  (wraps, 100/s)
        return struct.pack('<H', int(t * 100) & 0xFFFF)

    if addr == 0x2003:  # counter_u32  (wraps, 1000/s)
        return struct.pack('<I', int(t * 1000) & 0xFFFFFFFF)

    if addr == 0x2100:  # engine_runtime  (seconds since start)
        return struct.pack('<I', int(t) & 0xFFFFFFFF)

    if addr == 0x2104:  # total_distance  (metres, ~60 km/h avg)
        return struct.pack('<I', int(t * 60000.0 / 3600.0) & 0xFFFFFFFF)

    if addr == 0x2108:  # fuel_consumed  (ml, ~8 L/100 km at avg speed)
        return struct.pack('<I', int(t * 1.33) & 0xFFFFFFFF)

    if addr == 0x210C:  # injection_count  (4-cyl, ~133 injections/s at avg rpm)
        return struct.pack('<I', int(t * 133) & 0xFFFFFFFF)

    # fallback: pattern bytes
    return bytes((addr + i) & 0xFF for i in range(size))

# ── Shared TX counter (GIL makes simple int ops atomic in CPython) ───

_tx_ctr = 0

def _send(sock, addr, payload: bytes):
    global _tx_ctr
    pkt = encode_packet(_tx_ctr, payload)
    _tx_ctr = (_tx_ctr + 1) & 0xFFFF
    try:
        sock.sendto(pkt, addr)
    except OSError:
        pass

# ── DAQ state ─────────────────────────────────────────────────────────
#
# _daq_lists: list of { odts: [ { entries: [ {addr, size} ] } ], event_channel }
# _daq_ptr:   [list_num, odt_num, entry_num]  — SET_DAQ_PTR write cursor
# _daq_running: bool
# _daq_selected: set of list indices prepared for START_STOP_SYNCH
# _master_addr / _sock_ref: where to send DTOs

_lock        = threading.Lock()
_daq_lists   = []
_daq_ptr     = [0, 0, 0]
_daq_running = False
_daq_selected = set()
_daq_thread  = None
_master_addr = None
_sock_ref    = None

# MTA state
_mta_addr = 0
_mta_ext  = 0

# ── DAQ DTO send loop ─────────────────────────────────────────────────

def _daq_send_loop():
    """Send DTOs at their event-channel rate. Snapshots channel→pids map on entry."""
    with _lock:
        # channel_id -> [(pid, entries)]
        ch_map: dict[int, list] = {}
        pid = 0
        for lst in _daq_lists:
            ch = lst['event_channel']
            for odt in lst['odts']:
                entries = list(odt['entries'])
                if entries:
                    ch_map.setdefault(ch, []).append((pid, entries))
                pid += 1

    if not ch_map:
        return

    last_sent = {ch: time.monotonic() for ch in ch_map}

    while True:
        with _lock:
            if not _daq_running:
                break
            addr = _master_addr
            sock = _sock_ref

        if addr and sock:
            now = time.monotonic()
            for ch, pid_list in ch_map.items():
                period = 1.0 / EVENT_CHANNELS.get(ch, 10.0)
                if now - last_sent[ch] >= period:
                    last_sent[ch] = now
                    for pid, entries in pid_list:
                        payload = bytearray([pid])
                        for e in entries:
                            payload += read_mem(e['addr'], e['size'])
                        _send(sock, addr, bytes(payload))

        time.sleep(0.001)  # 1 ms poll granularity

# ── Command handlers ──────────────────────────────────────────────────

def handle_connect(_payload):
    # resource: CAL_PAG(0x01) | DAQ(0x04) = 0x05
    # layout: [PID, resource, comm_mode_basic, reserved, max_cto, dto_lo, dto_hi, proto_ver]
    return bytes([PID_POSITIVE, 0x05, 0x00, 0x00, 0xFF, 0xFF, 0x05, 0x01])

def handle_disconnect(_payload):
    global _daq_running, _daq_thread
    with _lock:
        _daq_running = False
    if _daq_thread and _daq_thread.is_alive():
        _daq_thread.join(timeout=0.3)
    return bytes([PID_POSITIVE])

def handle_get_status(_payload):
    with _lock:
        running = _daq_running
    ss = 0x04 if running else 0x00
    return bytes([PID_POSITIVE, ss, 0x00, 0x00, 0x00, 0x00])

def handle_get_comm_mode_info(_payload):
    return bytes([PID_POSITIVE, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01])

def handle_get_id(payload):
    if len(payload) < 2:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    id_type = payload[1]
    names   = {0: b"MockSlave", 1: b"mock_slave.a2l", 2: b"mock_slave.a2l"}
    name    = names.get(id_type, b"Unknown")
    return bytes([PID_POSITIVE, 0x00, 0x00, 0x00]) + struct.pack("<I", len(name))

def handle_set_mta(payload):
    global _mta_addr, _mta_ext
    if len(payload) < 8:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    _mta_ext  = payload[3]
    _mta_addr = struct.unpack_from("<I", payload, 4)[0]
    return bytes([PID_POSITIVE])

def handle_upload(payload):
    if len(payload) < 2:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    size = payload[1]
    return bytes([PID_POSITIVE]) + read_mem(_mta_addr, size)

def handle_download(_payload):
    return bytes([PID_POSITIVE])

# ── DAQ handlers ──────────────────────────────────────────────────────

def handle_free_daq(_payload):
    global _daq_running, _daq_thread
    with _lock:
        _daq_running = False
        _daq_lists.clear()
        _daq_selected.clear()
        _daq_ptr[:] = [0, 0, 0]
    if _daq_thread and _daq_thread.is_alive():
        _daq_thread.join(timeout=0.3)
    return bytes([PID_POSITIVE])

def handle_alloc_daq(payload):
    # [0xD5, 0x00, count_lo, count_hi]
    if len(payload) < 4:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    count = struct.unpack_from("<H", payload, 2)[0]
    with _lock:
        _daq_lists.clear()
        _daq_selected.clear()
        for _ in range(count):
            _daq_lists.append({'odts': [], 'event_channel': 0})
    return bytes([PID_POSITIVE])

def handle_alloc_odt(payload):
    # [0xD4, 0x00, list_lo, list_hi, odt_count]
    if len(payload) < 5:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    list_num  = struct.unpack_from("<H", payload, 2)[0]
    odt_count = payload[4]
    with _lock:
        if list_num >= len(_daq_lists):
            return bytes([PID_ERROR, ERR_OUT_OF_RANGE])
        _daq_lists[list_num]['odts'] = [{'entries': []} for _ in range(odt_count)]
    return bytes([PID_POSITIVE])

def handle_alloc_odt_entry(payload):
    # [0xD3, 0x00, list_lo, list_hi, odt_num, entry_count]
    if len(payload) < 6:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    list_num    = struct.unpack_from("<H", payload, 2)[0]
    odt_num     = payload[4]
    entry_count = payload[5]
    with _lock:
        if list_num >= len(_daq_lists):
            return bytes([PID_ERROR, ERR_OUT_OF_RANGE])
        odts = _daq_lists[list_num]['odts']
        if odt_num >= len(odts):
            return bytes([PID_ERROR, ERR_OUT_OF_RANGE])
        odts[odt_num]['entries'] = [{'addr': 0, 'size': 4} for _ in range(entry_count)]
    return bytes([PID_POSITIVE])

def handle_set_daq_ptr(payload):
    # [0xE2, 0x00, list_lo, list_hi, odt_num, entry_num]
    if len(payload) < 6:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    with _lock:
        _daq_ptr[0] = struct.unpack_from("<H", payload, 2)[0]
        _daq_ptr[1] = payload[4]
        _daq_ptr[2] = payload[5]
    return bytes([PID_POSITIVE])

def handle_write_daq(payload):
    # [0xE1, bit_offset, size, addr_ext, addr_lo, addr_hi, addr_hh, addr_hhh]
    if len(payload) < 8:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    size = payload[2]
    addr = struct.unpack_from("<I", payload, 4)[0]
    with _lock:
        li, oi, ei = _daq_ptr
        try:
            _daq_lists[li]['odts'][oi]['entries'][ei] = {'addr': addr, 'size': size}
        except IndexError:
            return bytes([PID_ERROR, ERR_OUT_OF_RANGE])
    return bytes([PID_POSITIVE])

def handle_set_daq_list_mode(payload):
    # [0xE0, mode, list_lo, list_hi, event_lo, event_hi, prescaler, priority]
    if len(payload) < 8:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    list_num = struct.unpack_from("<H", payload, 2)[0]
    event_ch = struct.unpack_from("<H", payload, 4)[0]
    with _lock:
        if list_num < len(_daq_lists):
            _daq_lists[list_num]['event_channel'] = event_ch
    return bytes([PID_POSITIVE])

def handle_start_stop_daq_list(payload):
    # [0xDE, mode, list_lo, list_hi]
    # mode 0x03 = PREPARE_START (select for START_STOP_SYNCH)
    # mode 0x00 = STOP
    if len(payload) < 4:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    mode     = payload[1]
    list_num = struct.unpack_from("<H", payload, 2)[0]
    with _lock:
        if mode == 0x03:
            _daq_selected.add(list_num)
        elif mode == 0x00:
            _daq_selected.discard(list_num)
        first_pid = sum(len(_daq_lists[i]['odts']) for i in range(list_num)
                        if i < len(_daq_lists))
    return bytes([PID_POSITIVE, first_pid & 0xFF])

def handle_start_stop_synch(payload):
    # [0xDD, mode]  0x01=start selected, 0x00=stop all, 0x02=stop selected
    global _daq_running, _daq_thread
    if len(payload) < 2:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    mode = payload[1]
    if mode == 0x01:
        with _lock:
            _daq_running = True
        _daq_thread = threading.Thread(target=_daq_send_loop, daemon=True)
        _daq_thread.start()
    else:
        with _lock:
            _daq_running = False
    return bytes([PID_POSITIVE])

# ── Dispatch table ────────────────────────────────────────────────────

HANDLERS = {
    CMD_CONNECT:             handle_connect,
    CMD_DISCONNECT:          handle_disconnect,
    CMD_GET_STATUS:          handle_get_status,
    CMD_GET_COMM:            handle_get_comm_mode_info,
    CMD_GET_ID:              handle_get_id,
    CMD_SET_MTA:             handle_set_mta,
    CMD_UPLOAD:              handle_upload,
    CMD_DOWNLOAD:            handle_download,
    CMD_FREE_DAQ:            handle_free_daq,
    CMD_ALLOC_DAQ:           handle_alloc_daq,
    CMD_ALLOC_ODT:           handle_alloc_odt,
    CMD_ALLOC_ODT_ENTRY:     handle_alloc_odt_entry,
    CMD_SET_DAQ_PTR:         handle_set_daq_ptr,
    CMD_WRITE_DAQ:           handle_write_daq,
    CMD_SET_DAQ_LIST_MODE:   handle_set_daq_list_mode,
    CMD_START_STOP_DAQ_LIST: handle_start_stop_daq_list,
    CMD_START_STOP_SYNCH:    handle_start_stop_synch,
}

# ── Server ────────────────────────────────────────────────────────────

def serve(host: str, port: int) -> None:
    global _master_addr, _sock_ref

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    with _lock:
        _sock_ref = sock

    print(f"XCP mock slave listening on {host}:{port}  (Ctrl-C to stop)\n")
    print("Variables (50 total):")
    print("  Powertrain:")
    print("    0x1000  engine_rpm                f32  0–8000 RPM")
    print("    0x1008  throttle_pos              f32  0–100 %")
    print("    0x1014  engine_load               f32  20–95 %")
    print("    0x1018  intake_manifold_pressure  f32  40–100 kPa")
    print("    0x101C  injection_timing          f32  10–35 °BTDC")
    print("    0x1020  ignition_advance          f32  8–40 °")
    print("    0x1024  torque_demand             f32  0–400 Nm")
    print("    0x1028  torque_actual             f32  0–380 Nm")
    print("    0x100C  vehicle_speed             f32  0–120 km/h")
    print("    0x102C  gear_position             u8   0–6")
    print("  Thermal:")
    print("    0x1004  coolant_temp              f32  80–105 °C")
    print("    0x1100  oil_temp                  f32  85–115 °C")
    print("    0x1104  exhaust_temp              f32  400–850 °C")
    print("    0x1108  intake_air_temp           f32  20–45 °C")
    print("    0x110C  trans_fluid_temp          f32  70–100 °C")
    print("    0x1110  fuel_temp                 f32  15–35 °C")
    print("  Electrical:")
    print("    0x1010  battery_voltage           f32  12.0–14.4 V")
    print("    0x1200  alternator_voltage        f32  13.8–14.5 V")
    print("    0x1204  battery_current           f32  -20–80 A")
    print("    0x1208  starter_current           f32  0 A (idle)")
    print("    0x120C  fuel_pump_duty            f32  40–100 %")
    print("    0x1210  fan_duty                  f32  0–100 %")
    print("  Sensors:")
    print("    0x1300  lambda_sensor_1           f32  0.85–1.15")
    print("    0x1304  lambda_sensor_2           f32  0.85–1.15")
    print("    0x1308  map_sensor                f32  40–100 kPa")
    print("    0x130C  maf_sensor                f32  2–40 g/s")
    print("    0x1310  oil_pressure              f32  2.5–6.5 bar")
    print("    0x1314  fuel_pressure             f32  3.5–4.5 bar")
    print("    0x1318  brake_pressure_front      f32  0–120 bar")
    print("    0x131C  brake_pressure_rear       f32  0–80 bar")
    print("  Chassis:")
    print("    0x1400  wheel_speed_fl            f32  0–130 km/h")
    print("    0x1404  wheel_speed_fr            f32  0–130 km/h")
    print("    0x1408  wheel_speed_rl            f32  0–130 km/h")
    print("    0x140C  wheel_speed_rr            f32  0–130 km/h")
    print("    0x1410  steering_angle            f32  -180–180 °")
    print("    0x1414  lateral_accel             f32  -2.0–2.0 g")
    print("    0x1418  longitudinal_accel        f32  -1.5–1.5 g")
    print("    0x141C  yaw_rate                  f32  -45–45 °/s")
    print("    0x1420  traction_control_slip     f32  0–15 %")
    print("  Fuel System:")
    print("    0x1500  fuel_level                f32  20–100 %")
    print("    0x1504  fuel_flow_rate            f32  2–80 ml/min")
    print("    0x1508  injector_duty_cyl1        f32  15–85 %")
    print("    0x150C  injector_duty_cyl2        f32  15–85 %")
    print("  Counters:")
    print("    0x2000  counter_u8                u8   0–255")
    print("    0x2001  counter_u16               u16  0–65535")
    print("    0x2003  counter_u32               u32  0–2^32")
    print("    0x2100  engine_runtime            u32  seconds")
    print("    0x2104  total_distance            u32  metres")
    print("    0x2108  fuel_consumed             u32  ml")
    print("    0x210C  injection_count           u32  count")
    print()

    while True:
        try:
            data, addr = sock.recvfrom(4096)
        except KeyboardInterrupt:
            break

        req_ctr, payload = decode_packet(data)
        if payload is None or len(payload) == 0:
            continue

        with _lock:
            _master_addr = addr

        cmd     = payload[0]
        name    = CMD_NAMES.get(cmd, f"0x{cmd:02X}")
        handler = HANDLERS.get(cmd, lambda p: bytes([PID_ERROR, ERR_CMD_UNKNOWN]))
        resp    = handler(payload)
        _send(sock, addr, resp)

        status = "OK " if resp[0] == PID_POSITIVE else "ERR"
        print(f"[{addr[0]}:{addr[1]}] ctr={req_ctr:04X}  {name:<24}  → {status}")

    with _lock:
        _daq_running = False
        _sock_ref = None
    sock.close()
    print("Mock slave stopped.")

# ── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="XCP mock slave (UDP)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=5555)
    args = p.parse_args()
    serve(args.host, args.port)
