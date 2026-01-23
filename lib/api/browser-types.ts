/**
 * Type definitions for the Browser API (/browsers/v1/)
 */

// ==========================================
// Session Types
// ==========================================

export type BrowserSessionStatus = 'starting' | 'active' | 'closing' | 'closed';

export type ViewportType = 'desktop' | 'mobile' | 'tablet';

export interface CreateBrowserSessionOptions {
  headless?: boolean;
  viewport?: ViewportType;
  timeout?: number; // Session timeout in seconds (60-3600)
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
}

export interface SnapshotResult {
  snapshot: string;
  url?: string;
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
