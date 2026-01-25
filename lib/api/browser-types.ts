/**
 * Type definitions for the Browser API (/browsers/v1/)
 */

// ==========================================
// Session Types
// ==========================================

export type BrowserSessionStatus = 'starting' | 'active' | 'closing' | 'closed' | 'failed';

export type ViewportType = 'desktop' | 'mobile' | 'tablet';

export interface CreateBrowserSessionOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number; // Session timeout in seconds (60-3600)
  ws_url?: string; // WebSocket URL for remote/tunneled browser
  record_blocks?: boolean; // Enable block recording for test generation
  after_test_id?: string; // Run a test before session becomes interactive
  vars?: Record<string, string>; // Variable overrides for after_test_id test
}

export interface BrowserSession {
  id: string;
  status: BrowserSessionStatus;
  created_at: string;
  updated_at?: string;
  current_url?: string;
  viewport?: ViewportType;
  headless?: boolean;
  timeout?: number;
  // Additional fields from API documentation
  app_url?: string; // Frontend URL to view session visualization
  last_action_at?: string; // Timestamp of last action
  error_message?: string; // Error if session failed
  recording_url?: string; // Video recording URL (after close)
  har_url?: string; // HAR file URL (after close)
  storage_state_url?: string; // Browser storage state URL (after close)
}

// ==========================================
// Action Types
// ==========================================

export type BrowserActionType =
  | 'goto'
  | 'back'
  | 'forward'
  | 'reload'
  | 'click'
  | 'fill'
  | 'type'
  | 'press'
  | 'hover'
  | 'scroll'
  | 'scroll_into_view'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'set_checked'
  | 'wait'
  | 'wait_for_selector'
  | 'wait_for_load'
  | 'snapshot'
  | 'screenshot';

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export interface GotoAction {
  type: 'goto';
  url: string;
}

export interface BackAction {
  type: 'back';
}

export interface ForwardAction {
  type: 'forward';
}

export interface ReloadAction {
  type: 'reload';
}

export interface ClickAction {
  type: 'click';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
}

export interface FillAction {
  type: 'fill';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
  value: string;
}

export interface TypeAction {
  type: 'type';
  ref: string;
  text: string;
}

export interface PressAction {
  type: 'press';
  key: string;
}

export interface HoverAction {
  type: 'hover';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
}

export interface ScrollAction {
  type: 'scroll';
  direction: ScrollDirection;
  amount?: number; // pixels, default 500
}

export interface SelectAction {
  type: 'select';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
  value: string;
}

export interface CheckAction {
  type: 'check';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
}

export interface UncheckAction {
  type: 'uncheck';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
}

export interface SetCheckedAction {
  type: 'set_checked';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
  checked: boolean;
}

export interface ScrollIntoViewAction {
  type: 'scroll_into_view';
  ref?: string;
  text?: string; // AI-based semantic element selection (alternative to ref)
}

export interface WaitAction {
  type: 'wait';
  duration_ms: number;
}

export interface WaitForSelectorAction {
  type: 'wait_for_selector';
  selector: string;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
}

export interface WaitForLoadAction {
  type: 'wait_for_load';
  state?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface SnapshotAction {
  type: 'snapshot';
  interactive?: boolean;
  compact?: boolean;
  max_depth?: number;
  scope?: string;
}

export interface SnapshotOptions {
  interactive?: boolean; // Only include interactive elements
  compact?: boolean; // Remove empty structural elements
  max_depth?: number; // Limit tree depth (1-20)
  scope?: string; // CSS selector to scope snapshot
}

export interface ScreenshotAction {
  type: 'screenshot';
}

export type BrowserAction =
  | GotoAction
  | BackAction
  | ForwardAction
  | ReloadAction
  | ClickAction
  | FillAction
  | TypeAction
  | PressAction
  | HoverAction
  | ScrollAction
  | ScrollIntoViewAction
  | SelectAction
  | CheckAction
  | UncheckAction
  | SetCheckedAction
  | WaitAction
  | WaitForSelectorAction
  | WaitForLoadAction
  | SnapshotAction
  | ScreenshotAction;

// ==========================================
// API Response Types
// ==========================================

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
  // Tracking fields
  action_id?: string; // Unique action identifier
  url_before?: string; // URL before action executed
  url_after?: string; // URL after action executed
}

export interface SnapshotFilterStats {
  original_lines: number;
  filtered_lines: number;
  reduction_percent: number;
}

export interface SnapshotResult {
  snapshot: string;
  url?: string;
  filter_stats?: SnapshotFilterStats;
}

export interface UrlResult {
  url: string;
}

export interface BlocksResult {
  blocks: unknown[]; // ExtendedStep[] - typed in BrowserApiClient
}

// ==========================================
// WebSocket Event Types
// ==========================================

export type WebSocketEventType =
  | 'action_started'
  | 'action_completed'
  | 'status_changed'
  | 'error'
  | 'closed';

export interface WebSocketEvent {
  type: WebSocketEventType;
  data?: unknown;
  timestamp?: string;
}

export interface ActionStartedEvent extends WebSocketEvent {
  type: 'action_started';
  data: {
    action_type: BrowserActionType;
    action_id?: string;
  };
}

export interface ActionCompletedEvent extends WebSocketEvent {
  type: 'action_completed';
  data: {
    action_id?: string;
    success: boolean;
    error?: string;
    result?: unknown;
  };
}

export interface StatusChangedEvent extends WebSocketEvent {
  type: 'status_changed';
  data: {
    status: BrowserSessionStatus;
  };
}

export interface ErrorEvent extends WebSocketEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

export interface ClosedEvent extends WebSocketEvent {
  type: 'closed';
  data?: {
    reason?: string;
  };
}

// ==========================================
// Client Messages (WebSocket)
// ==========================================

export interface PingMessage {
  type: 'ping';
}

export interface ActionMessage {
  type: 'action';
  data: BrowserAction;
}

export interface GetStatusMessage {
  type: 'get_status';
}

export type ClientMessage = PingMessage | ActionMessage | GetStatusMessage;

// ==========================================
// Console Logs
// ==========================================

export type ConsoleLogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

export interface ConsoleLogEntry {
  level: ConsoleLogLevel;
  text: string;
  timestamp: string;
  url?: string;
}

export interface ConsoleLogsResult {
  logs: ConsoleLogEntry[];
  total: number;
}

export interface ConsoleLogsOptions {
  level?: ConsoleLogLevel;
  limit?: number;
}

// ==========================================
// Network Logs
// ==========================================

export interface NetworkLogEntry {
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  request_headers?: Record<string, string>;
  response_headers?: Record<string, string>;
  timestamp: string;
}

export interface NetworkLogsResult {
  requests: NetworkLogEntry[];
  total: number;
}

export interface NetworkLogsOptions {
  status?: string; // e.g., "4xx,5xx"
  url_pattern?: string; // e.g., "*api*"
  limit?: number;
}

// ==========================================
// Test Generation
// ==========================================

export interface GenerateTestOptions {
  name: string;
  app_config?: string;
  variables?: Record<string, string>;
}

export interface GenerateTestResult {
  yaml: string;
  test_definition: Record<string, unknown>;
  block_count: number;
}
