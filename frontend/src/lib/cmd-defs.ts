import type { CmdDef } from './types';

export const CMD_DEFS: Record<string, CmdDef> = {

  // ── Basic ─────────────────────────────────────────────────────────

  'connect': {
    pid: 'FF',
    prefill: { 0: 'FF', 1: '00' },
    directAction: 'connect',
    fields: [
      { label: 'pid', tip: 'CONNECT (0xFF) — establish XCP session with the slave' },
      {
        label: 'mode',
        tip: '0x00 = normal mode, 0x01 = user-defined mode',
        options: [
          { val: '00', label: 'Normal' },
          { val: '01', label: 'UserDef' },
        ],
      },
    ],
  },

  'disconnect': {
    pid: 'FE',
    prefill: { 0: 'FE' },
    directAction: 'disconnect',
    fields: [
      { label: 'pid', tip: 'DISCONNECT (0xFE) — terminate XCP session with the slave' },
    ],
  },

  'upload': {
    pid: 'F5',
    prefill: { 0: 'F5' },
    fields: [
      { label: 'pid',  tip: 'UPLOAD (0xF5) — read size bytes from the current MTA' },
      { label: 'size', tip: 'Number of bytes to read (≤ max_dto − 1)' },
    ],
  },

  'download': {
    pid: 'F0',
    prefill: { 0: 'F0' },
    fields: [
      { label: 'pid',    tip: 'DOWNLOAD (0xF0) — write data bytes to the current MTA' },
      { label: 'length', tip: 'Number of data elements to write' },
      { label: 'align',  tip: 'Alignment filler — 1 byte for WORD, 3 for DWORD; 0x00 for no alignment' },
      { label: 'data[0]', tip: 'Data byte 0' },
      { label: 'data[1]', tip: 'Data byte 1' },
      { label: 'data[2]', tip: 'Data byte 2' },
      { label: 'data[3]', tip: 'Data byte 3' },
      { label: 'data[4]', tip: 'Data byte 4 — add more bytes with + for larger writes' },
    ],
  },

  'short-download': {
    pid: 'ED',
    prefill: { 0: 'ED', 3: '00' },
    fields: [
      { label: 'pid',     tip: 'SHORT_DOWNLOAD (0xED) — write data directly to a specified address without prior SET_MTA' },
      { label: 'length',  tip: 'Number of data bytes (1–5 fit in this 8-byte frame; add more with +)' },
      { label: 'addr_ext', tip: 'Address extension' },
      { label: 'rsvd',    tip: 'Reserved — set to 0x00' },
      { label: 'addr[0]', tip: 'Address byte 0 (LSB)' },
      { label: 'addr[1]', tip: 'Address byte 1' },
      { label: 'addr[2]', tip: 'Address byte 2' },
      { label: 'addr[3]', tip: 'Address byte 3 (MSB)' },
    ],
  },

  // ── Session ───────────────────────────────────────────────────────

  'get-status': {
    pid: 'FD',
    prefill: { 0: 'FD' },
    fields: [
      { label: 'pid', tip: 'GET_STATUS (0xFD) — returns session status, resource protection status, and session config ID' },
    ],
  },

  'sync': {
    pid: 'FC',
    prefill: { 0: 'FC' },
    fields: [
      { label: 'pid', tip: 'SYNC (0xFC) — re-synchronize command transfer after a timeout occurred' },
    ],
  },

  'get-comm-mode-info': {
    pid: 'FB',
    prefill: { 0: 'FB' },
    fields: [
      { label: 'pid', tip: 'GET_COMM_MODE_INFO (0xFB) — reads slave communication mode info block (interleaved, block, queue size)' },
    ],
  },

  'get-id': {
    pid: 'FA',
    prefill: { 0: 'FA', 1: '00' },
    fields: [
      { label: 'pid', tip: 'GET_ID (0xFA)' },
      {
        label: 'type',
        tip: 'Identification type: 0=ASCII text, 1=Filename, 2=ASAP2 file, 3=CAN ID list, 4=Symlink to ASAP2',
        options: [
          { val: '00', label: 'ASCII text' },
          { val: '01', label: 'Filename' },
          { val: '02', label: 'ASAP2 file' },
          { val: '03', label: 'CAN ID list' },
          { val: '04', label: 'ASAP2 symlink' },
        ],
      },
    ],
  },

  'set-request': {
    pid: 'F9',
    prefill: { 0: 'F9' },
    fields: [
      { label: 'pid', tip: 'SET_REQUEST (0xF9) — request to save or clear calibration / DAQ configuration' },
      {
        label: 'mode',
        tip: 'Bit0=store_cal, Bit1=store_daq_no_resume, Bit2=store_daq_resume, Bit3=clear_daq_req',
        options: [
          { val: '01', label: 'Store CAL' },
          { val: '02', label: 'Store DAQ' },
          { val: '04', label: 'Store DAQ+Resume' },
          { val: '08', label: 'Clear DAQ' },
        ],
      },
      { label: 'cfg_id_lo', tip: 'Session config ID low byte' },
      { label: 'cfg_id_hi', tip: 'Session config ID high byte' },
    ],
  },

  'get-seed': {
    pid: 'F8',
    prefill: { 0: 'F8', 1: '00' },
    fields: [
      { label: 'pid', tip: 'GET_SEED (0xF8) — first step in seed-and-key resource unlock sequence' },
      {
        label: 'mode',
        tip: '0x00 = first part of seed request, 0x01 = remaining parts',
        options: [
          { val: '00', label: 'First part' },
          { val: '01', label: 'Remaining' },
        ],
      },
      {
        label: 'resource',
        tip: 'Resource to unlock: 0x01=CAL/PAG, 0x04=DAQ, 0x08=STIM, 0x10=PGM',
        options: [
          { val: '01', label: 'CAL/PAG' },
          { val: '04', label: 'DAQ' },
          { val: '08', label: 'STIM' },
          { val: '10', label: 'PGM' },
        ],
      },
    ],
  },

  'unlock': {
    pid: 'F7',
    prefill: { 0: 'F7' },
    fields: [
      { label: 'pid',    tip: 'UNLOCK (0xF7) — send computed key to unlock a protected resource' },
      { label: 'length', tip: 'Total key length in bytes (1–6 for this frame)' },
      { label: 'key[0]', tip: 'Key byte 0' },
      { label: 'key[1]', tip: 'Key byte 1' },
      { label: 'key[2]', tip: 'Key byte 2' },
      { label: 'key[3]', tip: 'Key byte 3' },
      { label: 'key[4]', tip: 'Key byte 4' },
      { label: 'key[5]', tip: 'Key byte 5' },
    ],
  },

  'short-upload': {
    pid: 'F4',
    prefill: { 0: 'F4', 2: '00' },
    fields: [
      { label: 'pid',      tip: 'SHORT_UPLOAD (0xF4) — read memory without a prior SET_MTA' },
      { label: 'size',     tip: 'Number of bytes to read (≤ max_dto − 1)' },
      { label: 'rsvd',    tip: 'Reserved — set to 0x00' },
      { label: 'addr_ext', tip: 'Address extension' },
      { label: 'addr[0]', tip: 'Address byte 0 (LSB)' },
      { label: 'addr[1]', tip: 'Address byte 1' },
      { label: 'addr[2]', tip: 'Address byte 2' },
      { label: 'addr[3]', tip: 'Address byte 3 (MSB)' },
    ],
  },

  'build-checksum': {
    pid: 'F3',
    prefill: { 0: 'F3', 1: '00', 2: '00', 3: '00' },
    fields: [
      { label: 'pid',       tip: 'BUILD_CHECKSUM (0xF3) — compute checksum over block starting at MTA' },
      { label: 'rsvd0',    tip: 'Reserved — set to 0x00' },
      { label: 'rsvd1',    tip: 'Reserved — set to 0x00' },
      { label: 'rsvd2',    tip: 'Reserved — set to 0x00' },
      { label: 'bsize[0]', tip: 'Block size byte 0 (LSB)' },
      { label: 'bsize[1]', tip: 'Block size byte 1' },
      { label: 'bsize[2]', tip: 'Block size byte 2' },
      { label: 'bsize[3]', tip: 'Block size byte 3 (MSB)' },
    ],
  },

  // ── Cal / Pag ─────────────────────────────────────────────────────

  'set-cal-page': {
    pid: 'EB',
    prefill: { 0: 'EB' },
    fields: [
      { label: 'pid', tip: 'SET_CAL_PAGE (0xEB) — select the active calibration page for a segment' },
      {
        label: 'mode',
        tip: 'Access mode: Bit0=ECU, Bit1=XCP, Bit7=all_segments',
        options: [
          { val: '01', label: 'ECU' },
          { val: '02', label: 'XCP' },
          { val: '03', label: 'ECU+XCP' },
          { val: '80', label: 'All segs' },
        ],
      },
      { label: 'seg_num',  tip: 'Logical segment number' },
      { label: 'page_num', tip: 'Page number to activate' },
    ],
  },

  'get-cal-page': {
    pid: 'EA',
    prefill: { 0: 'EA' },
    fields: [
      { label: 'pid', tip: 'GET_CAL_PAGE (0xEA) — read the currently active calibration page for a segment' },
      {
        label: 'mode',
        tip: 'Access mode: 0x01=ECU, 0x02=XCP',
        options: [
          { val: '01', label: 'ECU' },
          { val: '02', label: 'XCP' },
        ],
      },
      { label: 'seg_num', tip: 'Logical segment number' },
    ],
  },

  'get-pag-processor-info': {
    pid: 'E9',
    prefill: { 0: 'E9' },
    fields: [
      { label: 'pid', tip: 'GET_PAG_PROCESSOR_INFO (0xE9) — returns the number of segments and paging processor properties' },
    ],
  },

  'get-segment-info': {
    pid: 'E8',
    prefill: { 0: 'E8', 3: '00' },
    fields: [
      { label: 'pid', tip: 'GET_SEGMENT_INFO (0xE8) — returns properties of a specific memory segment' },
      {
        label: 'mode',
        tip: 'Info type: 0=basic, 1=standard, 2=address, 3=attribute',
        options: [
          { val: '00', label: 'Basic' },
          { val: '01', label: 'Standard' },
          { val: '02', label: 'Address' },
          { val: '03', label: 'Attribute' },
        ],
      },
      { label: 'seg_num',  tip: 'Segment number' },
      { label: 'rsvd',    tip: 'Reserved — set to 0x00' },
      { label: 'page_num', tip: 'Page number (used for mode 3 attribute queries)' },
    ],
  },

  'get-page-info': {
    pid: 'E7',
    prefill: { 0: 'E7', 1: '00' },
    fields: [
      { label: 'pid',      tip: 'GET_PAGE_INFO (0xE7) — returns properties and initial segment for a calibration page' },
      { label: 'rsvd',    tip: 'Reserved — set to 0x00' },
      { label: 'seg_num',  tip: 'Segment number' },
      { label: 'page_num', tip: 'Page number' },
    ],
  },

  'set-segment-mode': {
    pid: 'E6',
    prefill: { 0: 'E6' },
    fields: [
      { label: 'pid',     tip: 'SET_SEGMENT_MODE (0xE6) — enable or disable freeze mode for a segment' },
      { label: 'mode',    tip: 'Bit0=freeze — when set, calibration data is frozen (write-protected) on this segment' },
      { label: 'seg_num', tip: 'Segment number' },
    ],
  },

  'get-segment-mode': {
    pid: 'E5',
    prefill: { 0: 'E5', 1: '00' },
    fields: [
      { label: 'pid',     tip: 'GET_SEGMENT_MODE (0xE5) — returns the current freeze mode status for a segment' },
      { label: 'rsvd',   tip: 'Reserved — set to 0x00' },
      { label: 'seg_num', tip: 'Segment number' },
    ],
  },

  'copy-cal-page': {
    pid: 'E4',
    prefill: { 0: 'E4' },
    fields: [
      { label: 'pid',      tip: 'COPY_CAL_PAGE (0xE4) — copy calibration data from one page to another' },
      { label: 'src_seg',  tip: 'Source segment number' },
      { label: 'src_page', tip: 'Source page number' },
      { label: 'dst_seg',  tip: 'Destination segment number' },
      { label: 'dst_page', tip: 'Destination page number' },
    ],
  },

  // ── DAQ ───────────────────────────────────────────────────────────

  'free-daq': {
    pid: 'D6',
    prefill: { 0: 'D6' },
    fields: [
      { label: 'pid', tip: 'FREE_DAQ (0xD6) — release all dynamically allocated DAQ lists' },
    ],
  },

  'alloc-daq': {
    pid: 'D5',
    prefill: { 0: 'D5', 1: '00' },
    fields: [
      { label: 'pid',       tip: 'ALLOC_DAQ (0xD5) — dynamically allocate a number of DAQ lists' },
      { label: 'rsvd',     tip: 'Reserved — set to 0x00' },
      { label: 'count_lo', tip: 'Number of DAQ lists to allocate (low byte)' },
      { label: 'count_hi', tip: 'Number of DAQ lists to allocate (high byte)' },
    ],
  },

  'alloc-odt': {
    pid: 'D4',
    prefill: { 0: 'D4', 1: '00' },
    fields: [
      { label: 'pid',    tip: 'ALLOC_ODT (0xD4) — allocate ODTs within a specific DAQ list' },
      { label: 'rsvd',  tip: 'Reserved — set to 0x00' },
      { label: 'daq_lo', tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi', tip: 'DAQ list number (high byte)' },
      { label: 'count',  tip: 'Number of ODTs to allocate' },
    ],
  },

  'alloc-odt-entry': {
    pid: 'D3',
    prefill: { 0: 'D3', 1: '00' },
    fields: [
      { label: 'pid',     tip: 'ALLOC_ODT_ENTRY (0xD3) — allocate entries within a specific ODT' },
      { label: 'rsvd',   tip: 'Reserved — set to 0x00' },
      { label: 'daq_lo',  tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi',  tip: 'DAQ list number (high byte)' },
      { label: 'odt_num', tip: 'ODT number within the DAQ list' },
      { label: 'count',   tip: 'Number of ODT entries to allocate' },
    ],
  },

  'clear-daq-list': {
    pid: 'E3',
    prefill: { 0: 'E3', 1: '00' },
    fields: [
      { label: 'pid',    tip: 'CLEAR_DAQ_LIST (0xE3) — remove all ODT entries from a DAQ list' },
      { label: 'rsvd',  tip: 'Reserved — set to 0x00' },
      { label: 'daq_lo', tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi', tip: 'DAQ list number (high byte)' },
    ],
  },

  'set-daq-ptr': {
    pid: 'E2',
    prefill: { 0: 'E2', 1: '00' },
    fields: [
      { label: 'pid',     tip: 'SET_DAQ_PTR (0xE2) — set the DAQ pointer for subsequent WRITE_DAQ commands' },
      { label: 'rsvd',   tip: 'Reserved — set to 0x00' },
      { label: 'daq_lo',  tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi',  tip: 'DAQ list number (high byte)' },
      { label: 'odt_num', tip: 'ODT number within the DAQ list' },
      { label: 'entry',   tip: 'ODT entry number within the ODT' },
    ],
  },

  'write-daq': {
    pid: 'E1',
    prefill: { 0: 'E1' },
    fields: [
      { label: 'pid',       tip: 'WRITE_DAQ (0xE1) — write one element descriptor to the ODT at the current DAQ pointer' },
      { label: 'bit_off',   tip: 'Bit offset within element (0xFF = whole element, no bit mask)' },
      { label: 'elem_size', tip: 'Size of DAQ element in bytes: 1, 2, or 4' },
      { label: 'addr_ext',  tip: 'Address extension of the DAQ element' },
      { label: 'addr[0]',   tip: 'Element address byte 0 (LSB)' },
      { label: 'addr[1]',   tip: 'Element address byte 1' },
      { label: 'addr[2]',   tip: 'Element address byte 2' },
      { label: 'addr[3]',   tip: 'Element address byte 3 (MSB)' },
    ],
  },

  'set-daq-list-mode': {
    pid: 'E0',
    prefill: { 0: 'E0' },
    fields: [
      { label: 'pid',       tip: 'SET_DAQ_LIST_MODE (0xE0) — configure the mode for a DAQ list' },
      { label: 'mode',      tip: 'Bit0=alternating, Bit1=direction(1=STIM), Bit4=timestamp, Bit6=no_pid, Bit7=running' },
      { label: 'daq_lo',    tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi',    tip: 'DAQ list number (high byte)' },
      { label: 'event_lo',  tip: 'Event channel number (low byte)' },
      { label: 'event_hi',  tip: 'Event channel number (high byte)' },
      { label: 'prescaler', tip: 'Transmission rate prescaler — 1 means every event occurrence' },
      { label: 'priority',  tip: 'DAQ list priority: 0=lowest, 0xFF=highest' },
    ],
  },

  'get-daq-list-mode': {
    pid: 'DF',
    prefill: { 0: 'DF', 1: '00' },
    fields: [
      { label: 'pid',    tip: 'GET_DAQ_LIST_MODE (0xDF) — query the current mode settings for a DAQ list' },
      { label: 'rsvd',  tip: 'Reserved — set to 0x00' },
      { label: 'daq_lo', tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi', tip: 'DAQ list number (high byte)' },
    ],
  },

  'start-stop-daq-list': {
    pid: 'DE',
    prefill: { 0: 'DE' },
    fields: [
      { label: 'pid',    tip: 'START_STOP_DAQ_LIST (0xDE) — start, stop, or select a single DAQ list' },
      {
        label: 'mode',
        tip: '0x00=stop, 0x01=start, 0x02=select (for later START_STOP_SYNCH)',
        options: [
          { val: '00', label: 'Stop' },
          { val: '01', label: 'Start' },
          { val: '02', label: 'Select' },
        ],
      },
      { label: 'daq_lo', tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi', tip: 'DAQ list number (high byte)' },
    ],
  },

  'start-stop-synch': {
    pid: 'DD',
    prefill: { 0: 'DD' },
    fields: [
      { label: 'pid', tip: 'START_STOP_SYNCH (0xDD) — simultaneously start or stop all previously selected DAQ lists' },
      {
        label: 'mode',
        tip: '0x00=stop_all, 0x01=start_selected, 0x02=stop_selected',
        options: [
          { val: '00', label: 'Stop all' },
          { val: '01', label: 'Start selected' },
          { val: '02', label: 'Stop selected' },
        ],
      },
    ],
  },

  'get-daq-clock': {
    pid: 'DC',
    prefill: { 0: 'DC' },
    fields: [
      { label: 'pid', tip: 'GET_DAQ_CLOCK (0xDC) — read the current DAQ clock value from the slave' },
    ],
  },

  'read-daq': {
    pid: 'DB',
    prefill: { 0: 'DB' },
    fields: [
      { label: 'pid', tip: 'READ_DAQ (0xDB) — read back one ODT entry at the current DAQ pointer position' },
    ],
  },

  'get-daq-processor-info': {
    pid: 'DA',
    prefill: { 0: 'DA' },
    fields: [
      { label: 'pid', tip: 'GET_DAQ_PROCESSOR_INFO (0xDA) — returns general DAQ processor capabilities and properties' },
    ],
  },

  'get-daq-resolution-info': {
    pid: 'D9',
    prefill: { 0: 'D9' },
    fields: [
      { label: 'pid', tip: 'GET_DAQ_RESOLUTION_INFO (0xD9) — returns DAQ clock resolution, timestamp unit, and granularity' },
    ],
  },

  'get-daq-list-info': {
    pid: 'D8',
    prefill: { 0: 'D8', 1: '00' },
    fields: [
      { label: 'pid',    tip: 'GET_DAQ_LIST_INFO (0xD8) — returns properties and ODT count for a specific DAQ list' },
      { label: 'rsvd',  tip: 'Reserved — set to 0x00' },
      { label: 'daq_lo', tip: 'DAQ list number (low byte)' },
      { label: 'daq_hi', tip: 'DAQ list number (high byte)' },
    ],
  },

  'get-daq-event-info': {
    pid: 'D7',
    prefill: { 0: 'D7', 1: '00' },
    fields: [
      { label: 'pid',      tip: 'GET_DAQ_EVENT_INFO (0xD7) — returns properties of a DAQ event channel' },
      { label: 'rsvd',    tip: 'Reserved — set to 0x00' },
      { label: 'event_lo', tip: 'Event channel number (low byte)' },
      { label: 'event_hi', tip: 'Event channel number (high byte)' },
    ],
  },

  // ── PGM ───────────────────────────────────────────────────────────

  'program-start': {
    pid: 'D2',
    prefill: { 0: 'D2' },
    fields: [
      { label: 'pid', tip: 'PROGRAM_START (0xD2) — prepare the slave for a programming sequence; must be called first' },
    ],
  },

  'program-clear': {
    pid: 'D1',
    prefill: { 0: 'D1', 2: '00', 3: '00' },
    fields: [
      { label: 'pid',       tip: 'PROGRAM_CLEAR (0xD1) — erase a memory region before programming' },
      {
        label: 'mode',
        tip: '0x00=absolute_access (clear_range = byte count), 0x01=functional_access (sector index)',
        options: [
          { val: '00', label: 'Absolute' },
          { val: '01', label: 'Functional' },
        ],
      },
      { label: 'rsvd0',     tip: 'Reserved — set to 0x00' },
      { label: 'rsvd1',     tip: 'Reserved — set to 0x00' },
      { label: 'range[0]',  tip: 'Clear range byte 0 (LSB)' },
      { label: 'range[1]',  tip: 'Clear range byte 1' },
      { label: 'range[2]',  tip: 'Clear range byte 2' },
      { label: 'range[3]',  tip: 'Clear range byte 3 (MSB)' },
    ],
  },

  'program-reset': {
    pid: 'CF',
    prefill: { 0: 'CF' },
    fields: [
      { label: 'pid', tip: 'PROGRAM_RESET (0xCF) — reset the slave to end the programming sequence' },
    ],
  },

  'get-pgm-processor-info': {
    pid: 'CE',
    prefill: { 0: 'CE' },
    fields: [
      { label: 'pid', tip: 'GET_PGM_PROCESSOR_INFO (0xCE) — returns programming processor capabilities and max sector count' },
    ],
  },

  'get-sector-info': {
    pid: 'CD',
    prefill: { 0: 'CD' },
    fields: [
      { label: 'pid', tip: 'GET_SECTOR_INFO (0xCD) — returns address or length information for a flash sector' },
      {
        label: 'mode',
        tip: '0x00=get_address, 0x01=get_length',
        options: [
          { val: '00', label: 'Get address' },
          { val: '01', label: 'Get length' },
        ],
      },
      { label: 'sector', tip: 'Sector number' },
    ],
  },

  'program-prepare': {
    pid: 'CC',
    prefill: { 0: 'CC', 1: '00' },
    fields: [
      { label: 'pid',     tip: 'PROGRAM_PREPARE (0xCC) — prepare for compressed or interleaved programming mode' },
      { label: 'rsvd',   tip: 'Reserved — set to 0x00' },
      { label: 'code_lo', tip: 'Code size in bytes (low byte)' },
      { label: 'code_hi', tip: 'Code size in bytes (high byte)' },
    ],
  },

};

export const CMD_CATEGORIES = [
  {
    name: 'Connection',
    commands: [
      { id: 'connect',    label: 'CONNECT',    pid: '0xFF' },
      { id: 'disconnect', label: 'DISCONNECT', pid: '0xFE' },
    ],
  },
  {
    name: 'Read',
    commands: [
      { id: 'upload',       label: 'UPLOAD',       pid: '0xF5' },
      { id: 'short-upload', label: 'SHORT_UPLOAD', pid: '0xF4' },
    ],
  },
  {
    name: 'Write',
    commands: [
      { id: 'download',       label: 'DOWNLOAD',       pid: '0xF0' },
      { id: 'short-download', label: 'SHORT_DOWNLOAD', pid: '0xED' },
    ],
  },
  {
    name: 'Session',
    commands: [
      { id: 'get-status',         label: 'GET_STATUS',         pid: '0xFD' },
      { id: 'sync',               label: 'SYNC',               pid: '0xFC' },
      { id: 'get-comm-mode-info', label: 'GET_COMM_MODE_INFO', pid: '0xFB' },
      { id: 'get-id',             label: 'GET_ID',             pid: '0xFA' },
      { id: 'set-request',        label: 'SET_REQUEST',        pid: '0xF9' },
      { id: 'get-seed',           label: 'GET_SEED',           pid: '0xF8' },
      { id: 'unlock',             label: 'UNLOCK',             pid: '0xF7' },
      { id: 'build-checksum',     label: 'BUILD_CHECKSUM',     pid: '0xF3' },
    ],
  },
  {
    name: 'Cal / Pag',
    commands: [
      { id: 'set-cal-page',           label: 'SET_CAL_PAGE',           pid: '0xEB' },
      { id: 'get-cal-page',           label: 'GET_CAL_PAGE',           pid: '0xEA' },
      { id: 'get-pag-processor-info', label: 'GET_PAG_PROCESSOR_INFO', pid: '0xE9' },
      { id: 'get-segment-info',       label: 'GET_SEGMENT_INFO',       pid: '0xE8' },
      { id: 'get-page-info',          label: 'GET_PAGE_INFO',          pid: '0xE7' },
      { id: 'set-segment-mode',       label: 'SET_SEGMENT_MODE',       pid: '0xE6' },
      { id: 'get-segment-mode',       label: 'GET_SEGMENT_MODE',       pid: '0xE5' },
      { id: 'copy-cal-page',          label: 'COPY_CAL_PAGE',          pid: '0xE4' },
    ],
  },
  {
    name: 'DAQ',
    commands: [
      { id: 'free-daq',                label: 'FREE_DAQ',                pid: '0xD6' },
      { id: 'alloc-daq',               label: 'ALLOC_DAQ',               pid: '0xD5' },
      { id: 'alloc-odt',               label: 'ALLOC_ODT',               pid: '0xD4' },
      { id: 'alloc-odt-entry',         label: 'ALLOC_ODT_ENTRY',         pid: '0xD3' },
      { id: 'clear-daq-list',          label: 'CLEAR_DAQ_LIST',          pid: '0xE3' },
      { id: 'set-daq-ptr',             label: 'SET_DAQ_PTR',             pid: '0xE2' },
      { id: 'write-daq',               label: 'WRITE_DAQ',               pid: '0xE1' },
      { id: 'set-daq-list-mode',       label: 'SET_DAQ_LIST_MODE',       pid: '0xE0' },
      { id: 'get-daq-list-mode',       label: 'GET_DAQ_LIST_MODE',       pid: '0xDF' },
      { id: 'start-stop-daq-list',     label: 'START_STOP_DAQ_LIST',     pid: '0xDE' },
      { id: 'start-stop-synch',        label: 'START_STOP_SYNCH',        pid: '0xDD' },
      { id: 'get-daq-clock',           label: 'GET_DAQ_CLOCK',           pid: '0xDC' },
      { id: 'read-daq',                label: 'READ_DAQ',                pid: '0xDB' },
      { id: 'get-daq-processor-info',  label: 'GET_DAQ_PROCESSOR_INFO',  pid: '0xDA' },
      { id: 'get-daq-resolution-info', label: 'GET_DAQ_RESOLUTION_INFO', pid: '0xD9' },
      { id: 'get-daq-list-info',       label: 'GET_DAQ_LIST_INFO',       pid: '0xD8' },
      { id: 'get-daq-event-info',      label: 'GET_DAQ_EVENT_INFO',      pid: '0xD7' },
    ],
  },
  {
    name: 'PGM',
    commands: [
      { id: 'program-start',          label: 'PROGRAM_START',          pid: '0xD2' },
      { id: 'program-clear',          label: 'PROGRAM_CLEAR',          pid: '0xD1' },
      { id: 'program-reset',          label: 'PROGRAM_RESET',          pid: '0xCF' },
      { id: 'get-pgm-processor-info', label: 'GET_PGM_PROCESSOR_INFO', pid: '0xCE' },
      { id: 'get-sector-info',        label: 'GET_SECTOR_INFO',        pid: '0xCD' },
      { id: 'program-prepare',        label: 'PROGRAM_PREPARE',        pid: '0xCC' },
    ],
  },
];
