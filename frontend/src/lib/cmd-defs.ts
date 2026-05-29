import type { CmdDef } from './types';

export const CMD_DEFS: Record<string, CmdDef> = {
  'get-comm-mode-info': {
    pid: 'FB',
    fields: [
      {
        label: 'pid',
        tip: 'GET_COMM_MODE_INFO (0xFB) — reads slave communication mode info block',
      },
    ],
  },
  'get-id-ascii': {
    pid: 'FA',
    prefill: { 0: 'FA', 1: '00' },
    fields: [
      { label: 'pid', tip: 'GET_ID command (0xFA)' },
      {
        label: 'type',
        tip: 'Identification type (byte 1)',
        options: [
          { val: '00', label: 'ASCII text' },
          { val: '01', label: 'Filename' },
          { val: '02', label: 'ASAP2 file' },
          { val: '03', label: 'CAN ID list' },
        ],
      },
    ],
  },
  'get-id-file': {
    pid: 'FA',
    prefill: { 0: 'FA', 1: '01' },
    fields: [
      { label: 'pid', tip: 'GET_ID command (0xFA)' },
      {
        label: 'type',
        tip: 'Identification type (byte 1)',
        options: [
          { val: '00', label: 'ASCII text' },
          { val: '01', label: 'Filename' },
          { val: '02', label: 'ASAP2 file' },
          { val: '03', label: 'CAN ID list' },
        ],
      },
    ],
  },
};

export const CMD_CATEGORIES = [
  {
    name: 'Session',
    commands: [
      { id: 'get-comm-mode-info', label: 'GET_COMM_MODE_INFO', pid: '0xFB' },
    ],
  },
  {
    name: 'Identification',
    commands: [
      { id: 'get-id-ascii', label: 'GET_ID (ASCII)', pid: '0xFA' },
      { id: 'get-id-file', label: 'GET_ID (Filename)', pid: '0xFA' },
    ],
  },
];
