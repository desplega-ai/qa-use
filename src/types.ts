export enum DBStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
}

export interface AuditBase {
  organization_id?: string;
  created_at: string; // datetime
  created_by: string;
  updated_at?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
  status: DBStatus;
}

export interface Block {
  id: number;

  name: string;
  description?: string;
  end_goal?: string;

  group?: string;
  is_group_check?: boolean;

  should_skip?: boolean;
  should_fail?: boolean;

  set_variable_name?: string;
  use_variable_name?: string;

  is_async: boolean;

  code: string; // Playwright code representing the block

  locator: unknown;
  action?: unknown;

  fixed: boolean;
  skipped: boolean;

  is_flaky: boolean;

  should_fix_with_ai: boolean;
  should_try_deterministic: boolean;

  logs?: string[];
  last_error?: string;

  reasoning?: string;

  confidence?: ConfidenceLevel;
  confidence_reasoning?: string;

  original_task?: string;

  aaa_phase?: 'arrange' | 'act' | 'assert';

  compute_semantic_diff?: boolean;

  pre_screenshot_path?: string;
  post_screenshot_path?: string;
}

export type Prio = 'low' | 'medium' | 'high' | 'urgent';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

// --- Assumed shared types (adjust if you already have these elsewhere) ---
export type Ref = string; // refine if you have a structured Ref
export type AnyDict = Record<string, any>;

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

export type IssueType =
  | 'bug'
  | 'usability'
  | 'performance'
  | 'security'
  | 'security_vulnerability'
  | 'observation'
  | 'other';

export type Severity = 'low' | 'medium' | 'high' | 'critical' | 'minor' | 'major' | 'blocker';

export interface IssueReport {
  title: string;
  description: string;
  issue_type?: IssueType; // default: 'observation'
  severity?: Severity; // default: 'low'
  url?: string | null;
  help?: string | null;
  recommendations?: string[] | null;
  tags?: string[]; // default: []
}

export interface TestCreatorDoneIntent extends DoneIntent {
  explanation: string;
  issues: IssueReport[]; // default: []
  success_criteria: string;
  is_positive: boolean;
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
  return Object.hasOwn(intent, 'status');
};

export const isTestCreatorDoneIntent = (intent: DoneIntent): intent is TestCreatorDoneIntent => {
  return (
    'issues' in intent &&
    'success_criteria' in intent &&
    'is_positive' in intent &&
    'explanation' in intent
  );
};

export const isUserInputIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is UserInputIntent => {
  return Object.hasOwn(intent, 'question');
};

export const isNextTaskIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is NextTaskIntent => {
  return Object.hasOwn(intent, 'next_task');
};

export const isClarificationIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is ClarificationIntent => {
  return Object.hasOwn(intent, 'type') && (intent as AnyDict).type !== undefined;
};

export const isActionIntent = <TDone extends DoneIntent = DoneIntent>(
  intent: Intent<TDone>['intent']
): intent is ActionIntent => {
  return Object.hasOwn(intent, 'type') && (intent as AnyDict).type !== undefined;
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
  test: unknown;
  ctxs: unknown[];
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

export interface TestAgentV2Session extends AuditBase {
  id: string;
  source?: string;
  data: TestAgentV2Data;
}
