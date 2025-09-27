// TypeScript types for QA-Use session management
// Based on /Users/taras/Documents/code/cope/be/api/vibe_qa.py

export type SessionMode = 'fast' | 'normal' | 'max';

export type SessionSource = 'generate' | 'discovery' | 'vibe-qa';

export type SessionStatus = 'active' | 'deleted';

export interface BaseAuditSchema {
  organization_id?: string;
  created_at: string; // ISO datetime string
  created_by: string;
  updated_at?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
  status: SessionStatus;
}

export interface NewSessionRequest {
  url: string;
  task: string;
  dep_id?: string | undefined;
  ws_url?: string | undefined;
  mode?: SessionMode | undefined;
}

export interface NewSessionResponse {
  message: string;
  data: {
    agent_id: string;
    app_config_id: string;
  };
}

// --- Shared types ---
export type Ref = string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDict = Record<string, any>;

export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type UserFlowPriority = 'low' | 'medium' | 'high';
export type Prio = UserFlowPriority;

export interface Block {
  id: number;
  // Add other block properties as needed
  [key: string]: any;
}

export interface Test {
  id: string;
  // Add other test properties as needed
  [key: string]: any;
}

export interface TestContext {
  id: string;
  // Add other context properties as needed
  [key: string]: any;
}

export interface AuditBase {
  created_at: string;
  created_by: string;
  updated_at?: string;
  updated_by?: string;
  [key: string]: any;
}

// --- Base + intent models ---
export interface BaseIntent {
  reasoning: string;
  tasks_pending: boolean;
  confidence: ConfidenceLevel;
}

export interface DoneIntent extends BaseIntent {
  status: 'success' | 'failure';
  message: string;
}

export interface NextTaskIntent extends BaseIntent {
  next_task: string;
}

export interface UserInputIntent extends BaseIntent {
  question: string;
  priority: Prio;
}

export interface UserInputResponse {
  response: string;
}

export interface ClarificationIntent extends BaseIntent {
  refs: Ref[]; // default []
  highlighted_refs: Ref[]; // default []
  type: 'screenshot' | 'expand_text';
}

export interface ActionIntent extends BaseIntent {
  refs: Ref[]; // default []
  type:
    | 'click'
    | 'click_download'
    | 'type'
    | 'fill'
    | 'wait'
    | 'press'
    | 'goto'
    | 'scroll'
    | 'hover'
    | 'select'
    | 'check'
    | 'uncheck';
  args?: number | string | AnyDict | null;
}

// --- General timing/status wrapper used by Intent & HistoryItem ---
export type GeneralStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface General {
  started_at?: string; // ISO datetime
  start_url?: string;
  ended_at?: string; // ISO datetime
  end_url?: string;
  elapsed_ms?: number;
  status: GeneralStatus; // default "pending"
  error?: string;
}

// --- Generic wrappers using DoneIntent constraint ---
export interface Intent<TDone extends DoneIntent = DoneIntent> extends General {
  intent: ActionIntent | ClarificationIntent | NextTaskIntent | UserInputIntent | TDone;
}

export const isDoneIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is TDone => {
  // eslint-disable-next-line no-prototype-builtins
  return intent.hasOwnProperty('status');
};

export const isUserInputIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is UserInputIntent => {
  // eslint-disable-next-line no-prototype-builtins
  return intent.hasOwnProperty('question');
};

export const isNextTaskIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is NextTaskIntent => {
  // eslint-disable-next-line no-prototype-builtins
  return intent.hasOwnProperty('next_task');
};

export const isClarificationIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is ClarificationIntent => {
  return (
    // eslint-disable-next-line no-prototype-builtins
    intent.hasOwnProperty('type') && (intent as AnyDict).type !== undefined
  );
};

export const isActionIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is ActionIntent => {
  return (
    // eslint-disable-next-line no-prototype-builtins
    intent.hasOwnProperty('type') && (intent as AnyDict).type !== undefined
  );
};

// ExpandedRef
export interface ExpandedRef {
  ref: string;
  description?: string;
  text: string;
}

// History item
export interface HistoryItem<TDone extends DoneIntent = DoneIntent> extends General {
  id: string;
  task: string;
  task_added_at?: string; // ISO datetime
  intents: Intent<TDone>[]; // default []
  block_ids: number[]; // default []
  expanded_refs: ExpandedRef[]; // default []
}

// CustomDoneIntent
export interface CustomDoneIntent extends DoneIntent {
  issues: string[]; // default []
  human_question?: string;
  explanation: string;
}

// --- Incoming events to the agent (from client) ---
export type TestAgentV2IncomingEventType =
  | 'next_task'
  | 'response'
  | 'close'
  | 'pause'
  | 'run'
  | 'set_model_name'
  | 'set_persona_id'
  | 'set_app_config_id'
  | 'set_test_dependency'
  | 'toggle_autopilot'
  | 'change_name'
  | 'save_test';

export interface TestAgentV2IncomingEvent {
  type: TestAgentV2IncomingEventType;
  message?: string;
  id?: string;
}

// --- Streamed/status events from the agent ---
export type TestAgentV2Status =
  | 'pending'
  | 'idle'
  | 'running'
  | 'paused'
  | 'pending'
  | 'need_user_input'
  | 'closed';

export interface TestAgentV2HistoryEvent<TDone extends DoneIntent = DoneIntent> {
  history: HistoryItem<TDone>;
}

export interface TestAgentV2BlockEvent {
  block: Block;
}

export interface TestAgentV2StatusEvent {
  status: TestAgentV2Status;
}

export interface TestAgentV2FullHistoryEvent<TDone extends DoneIntent = DoneIntent> {
  history: HistoryItem<TDone>[];
}

export interface TestAgentV2ConfigEvent {
  name: string;
  agent_id: string;
  model_name: string;
  liveview_url: string;
  page_url?: string | null;
  autopilot: boolean;
  app_config_id?: string | null;
  persona_id?: string | null;
  organization_id?: string | null;
  group_key?: string | null;
  test_dependency_ids: string[]; // default []
}

export interface TestAgentV2UserInputEvent {
  question: string;
  priority: Prio;
}

export interface TestAgentV2TestEvent {
  test: Test;
  ctxs: TestContext[];
}

export interface TestAgentV2NotifyEvent {
  message: string;
  level: 'info' | 'warning' | 'error';
}

export type TestAgentV2EventType =
  | 'config'
  | 'history'
  | 'block'
  | 'status'
  | 'full_history'
  | 'user_input'
  | 'test'
  | 'notify';

export type TestAgentV2EventData<TDone extends DoneIntent = DoneIntent> =
  | TestAgentV2ConfigEvent
  | TestAgentV2HistoryEvent<TDone>
  | TestAgentV2BlockEvent
  | TestAgentV2StatusEvent
  | TestAgentV2FullHistoryEvent<TDone>
  | TestAgentV2UserInputEvent
  | TestAgentV2TestEvent
  | TestAgentV2NotifyEvent;

export interface TestAgentV2Event<TDone extends DoneIntent = DoneIntent> {
  ts: string; // ISO datetime
  type: TestAgentV2EventType;
  data: TestAgentV2EventData<TDone>;
}

export interface TestAgentV2Data {
  agent_id: string;

  liveview_url: string;
  recording_path?: string | null;
  page_url?: string | null;

  autopilot: boolean;
  model_name: string;

  organization_id?: string | null;
  group_key?: string | null;

  app_config_id?: string | null;
  persona_id?: string | null;

  test_id: string;
  dependency_test_ids: string[];
  blocks: Block[];

  history: HistoryItem<DoneIntent>[];

  last_done?: DoneIntent | null;
  pending_user_input?: UserInputIntent | null;

  status: TestAgentV2Status;
}

export interface TestAgentV2Session extends BaseAuditSchema {
  id: string;
  source?: SessionSource;
  data: TestAgentV2Data;
}

export interface AppConfig extends BaseAuditSchema {
  id: string;
  base_url: string;
  name: string;
}

export interface SessionListResponse {
  sessions: TestAgentV2Session[];
}

export type SessionDetailResponse = TestAgentV2Session;

export interface SuccessResponse<T = any> {
  message: string;
  data?: T;
  timestamp?: string;
}

// Event types for API communication
export interface EventCreateSchema {
  group_key: string;
  event_type: string;
  event_data: AnyDict;
}

export interface UserResponseEvent {
  type: 'response';
  message: string;
}
