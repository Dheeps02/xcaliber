#!/usr/bin/env python3
"""
XCP-on-Ethernet mock slave (UDP).

Supports all XCP commands implemented in xcp-client, including full DAQ with
simulated test variables that change over time.

Test variables (use these addresses when building DAQ lists):
  addr    name               type  range
  0x1000  engine_rpm         f32   0–8000 RPM       (sine, 0.5 Hz)
  0x1004  coolant_temp       f32   80–105 °C        (sine, 0.08 Hz)
  0x1008  throttle_pos       f32   0–100 %          (triangle, 0.2 Hz)
  0x100C  vehicle_speed      f32   0–120 km/h       (sine, 0.25 Hz)
  0x1010  battery_voltage    f32   12.0–14.4 V      (sine + noise)
  0x2000  counter_u8         u8    0–255            (wrapping, 10/s)
  0x2001  counter_u16        u16   0–65535          (wrapping, 100/s)
  0x2003  counter_u32        u32   0–2^32           (wrapping, 1000/s)

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
    if addr == 0x1000:
        return struct.pack('<f', 4000 + 4000 * math.sin(t * 0.5))
    if addr == 0x1004:
        return struct.pack('<f', 92.5 + 12.5 * math.sin(t * 0.08))
    if addr == 0x1008:
        p = (t * 0.2) % 1.0
        tri = p * 2 if p < 0.5 else 2.0 - p * 2
        return struct.pack('<f', tri * 100.0)
    if addr == 0x100C:
        return struct.pack('<f', 60 + 60 * math.sin(t * 0.25))
    if addr == 0x1010:
        return struct.pack('<f', 13.2 + 1.2 * math.sin(t * 0.04) + random.uniform(-0.05, 0.05))
    if addr == 0x2000:
        return struct.pack('B', int(t * 10) & 0xFF)
    if addr == 0x2001:
        return struct.pack('<H', int(t * 100) & 0xFFFF)
    if addr == 0x2003:
        return struct.pack('<I', int(t * 1000) & 0xFFFFFFFF)
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
    """Send DTOs at 10 Hz. Snapshots the PID→entries map on entry."""
    with _lock:
        pid_map = {}
        pid = 0
        for lst in _daq_lists:
            for odt in lst['odts']:
                entries = list(odt['entries'])
                if entries:
                    pid_map[pid] = entries
                pid += 1

    if not pid_map:
        return

    while True:
        with _lock:
            if not _daq_running:
                break
            addr = _master_addr
            sock = _sock_ref

        if addr and sock:
            for p in sorted(pid_map):
                payload = bytearray([p])
                for e in pid_map[p]:
                    payload += read_mem(e['addr'], e['size'])
                _send(sock, addr, bytes(payload))

        time.sleep(0.1)

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
        # first_pid = sum of ODT counts for all earlier lists
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
    print("Test variables:")
    print("  0x1000  engine_rpm        f32  0–8000 RPM")
    print("  0x1004  coolant_temp      f32  80–105 °C")
    print("  0x1008  throttle_pos      f32  0–100 %")
    print("  0x100C  vehicle_speed     f32  0–120 km/h")
    print("  0x1010  battery_voltage   f32  12–14.4 V")
    print("  0x2000  counter_u8        u8   0–255")
    print("  0x2001  counter_u16       u16  0–65535")
    print("  0x2003  counter_u32       u32  0–2^32")
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
