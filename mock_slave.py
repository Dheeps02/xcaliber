#!/usr/bin/env python3
"""
XCP-on-Ethernet mock slave (UDP).

Listens on 127.0.0.1:5555 by default and responds to the standard XCP
commands used by xcp-client:

  CONNECT      (0xFF) → positive response with hard-coded slave info
  DISCONNECT   (0xFE) → positive response
  GET_STATUS   (0xFD) → positive response with zeroed status fields
  GET_COMM_MODE_INFO (0xFB) → positive response
  GET_ID       (0xFA) → positive response (length only; no follow-up UPLOAD)
  SET_MTA      (0xF6) → positive response (stores MTA for UPLOAD)
  UPLOAD       (0xF5) → returns <size> bytes of dummy data starting at MTA
  Any unknown  → ERR_CMD_UNKNOWN (0xFE, 0x20)

XCP-on-Ethernet framing (4-byte header):
  [LEN_LO, LEN_HI, CTR_LO, CTR_HI, ...payload]

Usage:
  python mock_slave.py [--host HOST] [--port PORT]
"""

import argparse
import socket
import struct
import threading


# ── XCP constants ────────────────────────────────────────────────────────────

PID_POSITIVE    = 0xFF
PID_ERROR       = 0xFE
ERR_CMD_UNKNOWN = 0x20

CMD_CONNECT    = 0xFF
CMD_DISCONNECT = 0xFE
CMD_GET_STATUS = 0xFD
CMD_GET_COMM   = 0xFB
CMD_GET_ID     = 0xFA
CMD_SET_MTA    = 0xF6
CMD_UPLOAD     = 0xF5


def encode_packet(counter: int, payload: bytes) -> bytes:
    length = len(payload)
    return struct.pack("<HH", length, counter) + payload


def decode_packet(data: bytes):
    if len(data) < 4:
        return None, None
    length, counter = struct.unpack_from("<HH", data)
    payload = data[4:4 + length]
    return counter, payload


# ── Command handlers ─────────────────────────────────────────────────────────

def handle_connect(_payload: bytes) -> bytes:
    # resource=0x01 (CAL_PAG), comm_mode_basic=0x00,
    # max_cto=0xFF, max_dto=0x05FF, proto_ver=0x01, transport_ver=0x01
    return bytes([
        PID_POSITIVE,
        0x01,        # resource
        0x00,        # comm_mode_basic
        0xFF,        # max_cto
        0xFF, 0x05,  # max_dto LE → 1535
        0x01,        # XCP protocol layer version
        0x01,        # XCP transport layer version
    ])


def handle_disconnect(_payload: bytes) -> bytes:
    return bytes([PID_POSITIVE])


def handle_get_status(_payload: bytes) -> bytes:
    # status=0, protection=0, session_cfg_id=0, timestamp=0
    return bytes([PID_POSITIVE, 0x00, 0x00, 0x00, 0x00, 0x00])


def handle_get_comm_mode_info(_payload: bytes) -> bytes:
    # comm_mode_optional=0, max_bs=0, min_st=0, queue_size=0, xcp_driver_ver=1
    return bytes([PID_POSITIVE, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01])


def handle_get_id(payload: bytes) -> bytes:
    if len(payload) < 2:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    id_type = payload[1]
    names = {0: b"MockSlave", 1: b"mock_slave.a2l", 2: b"mock_slave.a2l"}
    name = names.get(id_type, b"Unknown")
    # Response: PID, mode=0 (not compressed), reserved, reserved, length LE
    return bytes([PID_POSITIVE, 0x00, 0x00, 0x00]) + struct.pack("<I", len(name))


# MTA state shared across handlers
_mta_addr = 0
_mta_ext  = 0


def handle_set_mta(payload: bytes) -> bytes:
    global _mta_addr, _mta_ext
    if len(payload) < 8:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    # [SET_MTA, 0, 0, addr_ext, addr_lo, addr_hi, addr_hh, addr_hhh]
    _mta_ext  = payload[3]
    _mta_addr = struct.unpack_from("<I", payload, 4)[0]
    return bytes([PID_POSITIVE])


def handle_upload(payload: bytes) -> bytes:
    if len(payload) < 2:
        return bytes([PID_ERROR, ERR_CMD_UNKNOWN])
    size = payload[1]
    # Return <size> dummy bytes (addr & 0xFF pattern)
    data = bytes((_mta_addr + i) & 0xFF for i in range(size))
    return bytes([PID_POSITIVE]) + data


def handle_unknown(_payload: bytes) -> bytes:
    return bytes([PID_ERROR, ERR_CMD_UNKNOWN])


HANDLERS = {
    CMD_CONNECT:    handle_connect,
    CMD_DISCONNECT: handle_disconnect,
    CMD_GET_STATUS: handle_get_status,
    CMD_GET_COMM:   handle_get_comm_mode_info,
    CMD_GET_ID:     handle_get_id,
    CMD_SET_MTA:    handle_set_mta,
    CMD_UPLOAD:     handle_upload,
}


# ── Server ───────────────────────────────────────────────────────────────────

def serve(host: str, port: int) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    print(f"XCP mock slave listening on {host}:{port}  (Ctrl-C to stop)")

    ctr = 0
    while True:
        try:
            data, addr = sock.recvfrom(4096)
        except KeyboardInterrupt:
            break

        req_ctr, payload = decode_packet(data)
        if payload is None or len(payload) == 0:
            continue

        cmd = payload[0]
        name = {
            CMD_CONNECT:    "CONNECT",
            CMD_DISCONNECT: "DISCONNECT",
            CMD_GET_STATUS: "GET_STATUS",
            CMD_GET_COMM:   "GET_COMM_MODE_INFO",
            CMD_GET_ID:     "GET_ID",
            CMD_SET_MTA:    "SET_MTA",
            CMD_UPLOAD:     "UPLOAD",
        }.get(cmd, f"0x{cmd:02X}")

        handler  = HANDLERS.get(cmd, handle_unknown)
        response = handler(payload)
        pkt      = encode_packet(ctr, response)
        ctr      = (ctr + 1) & 0xFFFF

        status = "OK" if response[0] == PID_POSITIVE else "ERR"
        print(
            f"[{addr[0]}:{addr[1]}] ctr={req_ctr:04X}  "
            f"{name:<20}  → {status} ({len(response)} bytes)"
        )
        sock.sendto(pkt, addr)

    sock.close()
    print("Mock slave stopped.")


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="XCP mock slave (UDP)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=5555)
    args = p.parse_args()
    serve(args.host, args.port)
