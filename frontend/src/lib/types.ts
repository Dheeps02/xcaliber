export interface ConnectResponse {
  resource: number;
  cal_pag: boolean;
  daq: boolean;
  stim: boolean;
  pgm: boolean;
  comm_mode_basic: number;
  max_cto: number;
  max_dto: number;
  proto_layer_version: number;
  transport_layer_version: number;
  proto_version: string;
}

export interface PacketEntry {
  id: number;
  direction: 'tx' | 'rx';
  counter: number;
  timestamp_ms: number;
  hex: string;
  pid: string;
  decoded: Record<string, unknown>;
}

export interface FieldOption {
  val: string;
  label: string;
}

export interface FieldDef {
  label: string;
  tip: string;
  options?: FieldOption[];
}

export interface CmdDef {
  pid: string;
  prefill?: Record<number, string>;
  fields: FieldDef[];
  isUserCmd?: boolean;
  userCmdName?: string;
  directAction?: 'connect' | 'disconnect';
  group?: string;
}

export interface CustomFieldDef {
  name: string;
  offset: number;
  size: number;
  type: string;
}

export interface CustomCommandConfig {
  code: number;
  name: string;
  group?: string;
  fields?: CustomFieldDef[];
}

export interface AppConfig {
  connection: {
    server_ip: string;
    server_port: number;
    protocol: string;
    timeout_ms: number;
    bind_ip?: string;
  };
  server: {
    listen_port: number;
  };
  custom_commands?: CustomCommandConfig[];
}

export interface NetworkInterface {
  name: string;
  ips: string[];
}

// ── DAQ types ─────────────────────────────────────────────────────

export type DaqEntryType = 'u8' | 'u16' | 'u32' | 'i8' | 'i16' | 'i32' | 'f32' | 'f64';

export interface DaqEntry {
  name: string;
  addr: number;
  addr_ext: number;
  size: number;
  type_name: DaqEntryType;
}

export interface DaqOdt {
  id: number;
  entries: DaqEntry[];
}

export interface DaqList {
  id: number;
  event_channel: number;
  odts: DaqOdt[];
}

export type DaqStatus = 'idle' | 'configured' | 'running';

export interface DaqLiveValue {
  listId: number;
  odtId: number;
  entryName: string;
  addr: number;
  typeName: DaqEntryType;
  value: number | null;
  history: number[];
}

export interface DaqDtoEvent {
  list_id: number;
  odt_id: number;
  timestamp_ms: number;
  values: Record<string, number>;
}
