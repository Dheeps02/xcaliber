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
    source_port?: number;
    src_mac?: string;
    dst_mac?: string;
    vlan_id?: number;
  };
  server: {
    listen_port: number;
  };
  custom_commands?: CustomCommandConfig[];
  events: EventDef[];
  user_cmds?: UserCmdDef[];
  endian?: string;
}

// ── USER_CMD (0xF1) types ─────────────────────────────────────────

export interface MatchCondition {
  reqByteOffset: number;
  op: '==' | '!=' | '<' | '>' | '<=' | '>=';
  value: number;
}

export interface UserCmdResponseByte {
  offset: number;
  label: string;
}

export interface UserCmdResponseVariant {
  id: string;
  name: string;
  conditions: MatchCondition[];
  bytes: UserCmdResponseByte[];
}

export interface UserCmdRequestByte {
  label: string;
  tip: string;
  default: string;
  options: { val: string; label: string }[];
}

export interface UserCmdDef {
  id: string;
  name: string;
  group?: string;
  requestBytes: UserCmdRequestByte[];
  responseVariants: UserCmdResponseVariant[];
}

export interface UserCmdFileFormat {
  version: 1;
  commands: UserCmdDef[];
}

export interface EventDef {
  id: number;
  name: string;
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
  name?: string;
  entries: DaqEntry[];
}

export interface DaqList {
  id: number;
  name?: string;
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
  history: { value: number; ts: number }[];
}

export interface A2lVariable {
  name: string;
  addr: number;
  type?: DaqEntryType;
}

export interface DaqDtoEvent {
  list_id: number;
  odt_id: number;
  timestamp_ms: number;
  values: Record<string, number>;
}

// ── Sequence ──────────────────────────────────────────────────────

export type SeqStepResp = 'neg' | 'either' | 'pos';

export interface SeqStep {
  id: string;
  cmdKey: string;
  bytes: string[];
  resp: SeqStepResp;
  disabled?: boolean;
}

export interface Sequence {
  id: string;
  name: string;
  abortOnError: boolean;
  stepDelayMs: number;
  steps: SeqStep[];
}

export type SeqRunStatus = 'idle' | 'running' | 'done' | 'aborted';
export type SeqStepOutcome = 'pending' | 'pass' | 'fail' | 'skipped' | 'error';

export interface SeqStepResult {
  stepId: string;
  outcome: SeqStepOutcome;
  txHex?: string;
  rxHex?: string;
  errorMsg?: string;
}

export interface SeqRunResult {
  status: SeqRunStatus;
  stepResults: SeqStepResult[];
}

export interface SeqFile {
  version: 1;
  sequences: Sequence[];
}
