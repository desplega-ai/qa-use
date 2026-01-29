/**
 * Auto-generated TypeScript types for Test CLI definitions
 *
 * DO NOT EDIT MANUALLY - Generated from API schema
 * Run 'pnpm generate:types' to regenerate
 *
 * Source: https://api.desplega.ai/vibe-qa/cli/schema
 * Generated: 2026-01-29T17:34:44.085Z
 */

export type Name = string;
export type Id = string | null;
export type AppConfig = string | null;
export type Tags = string[];
export type Description = string | null;
export type DependsOn = string | null;
export type Type = 'simple';
export type Action =
  | 'goto'
  | 'fill'
  | 'click'
  | 'hover'
  | 'scroll'
  | 'select_option'
  | 'wait'
  | 'wait_for_timeout'
  | 'to_contain_text'
  | 'to_have_text'
  | 'to_be_visible'
  | 'to_have_url';
export type Target = string | null;
export type Value = string | null;
export type Url = string | null;
export type Timeout = number | null;
export type AaaPhase = ('arrange' | 'act' | 'assert') | null;
export type Type1 = 'extended';
/**
 * Action to perform
 */
export type Action1 =
  | (
      | 'click'
      | 'click_download'
      | 'dblclick'
      | 'tap'
      | 'hover'
      | 'press'
      | 'fill'
      | 'type'
      | 'check'
      | 'uncheck'
      | 'set_checked'
      | 'select_option'
      | 'select_text'
      | 'scroll'
      | 'scroll_into_view_if_needed'
      | 'drag_and_drop'
      | 'relative_drag_and_drop'
      | 'blur'
      | 'highlight'
      | 'wheel'
      | 'goto'
      | 'wait_for_selector'
      | 'wait_for_timeout'
      | 'wait_for_load_state'
      | 'evaluate'
      | 'evaluate_handle'
      | 'set_input_files'
      | 'handle_file_chooser'
      | 'ai_action'
      | 'ai_assertion'
      | 'extract_from_file'
      | 'get_last_email'
      | 'reply_to_email'
      | 'mfa_totp'
      | 'new_task_variable'
      | 'get_task_variable'
      | 'get_task_variables'
      | 'set_task_variable'
      | 'variable_json_path'
      | 'extract_structured_data'
      | 'extract_from_page'
      | 'ai_validate_variable'
      | 'parse_request'
      | 'perform_request'
      | 'wait'
      | 'to_be_visible'
      | 'not_to_be_visible'
      | 'to_be_hidden'
      | 'not_to_be_hidden'
      | 'to_be_enabled'
      | 'not_to_be_enabled'
      | 'to_be_disabled'
      | 'not_to_be_disabled'
      | 'to_be_editable'
      | 'not_to_be_editable'
      | 'to_be_focused'
      | 'to_be_checked'
      | 'not_to_be_checked'
      | 'to_be_unchecked'
      | 'to_be_empty'
      | 'not_to_be_empty'
      | 'to_have_url'
      | 'to_contain_text'
      | 'not_to_contain_text'
      | 'text_content'
      | 'to_have_text'
      | 'not_to_have_text'
      | 'to_have_value'
      | 'not_to_have_value'
      | 'to_have_values'
      | 'not_to_have_values'
      | 'go_back'
      | 'go_forward'
      | 'reload'
    )
  | null;
/**
 * Optional value for the action, can be a string, int, or a free-form dictionary
 */
export type Value1 = number | string | AnyDict | null;
export type Text = string;
export type HasText = string;
export type Regex = string;
export type Files = string[];
export type Name1 = string;
export type Exact = boolean;
export type Button = string;
export type Disabled = boolean;
export type X = number;
export type Y = number;
export type DeltaX = number;
export type DeltaY = number;
export type Force = boolean;
export type WaitNewPage = boolean;
export type Key = string;
export type Delay = number;
export type Value2 = string;
export type Index = number;
export type Label = string;
export type Url1 = string;
export type FilePaths = string[];
export type FileName = string;
export type Email = string;
export type Subject = string;
export type ReplyBody = string;
export type EmailId = string;
export type Input = string;
export type Timeout1 = number;
export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle';
export type VariableName = string | string[];
export type VariableType = string;
export type Length = number;
export type CustomValue = number | string;
export type VariableValidation = string;
export type ExtractionTask = string;
export type ExtractionVariableTargetName = string;
export type ExtractionType = 'text' | 'attribute' | 'property' | 'inner_html' | 'inner_text';
export type AttributeName = string;
export type TargetLocator = string;
export type JsonPath = string;
export type RequestMethod = string;
export type RequestUrl = string;
export type RequestBody = string;
export type RequestExpectedStatus = number;
export type ValueStrategy = string;
export type ValueSemanticText = string;
export type ValueVariableName = string;
/**
 * Set to true when the value could be potentially a variable that the user can set
 */
export type ValueCanBeVariable = boolean;
/**
 * Timeout for the action in milliseconds
 */
export type Timeout2 = number | null;
/**
 * List of allowed AI actions for this action. If not set, all AI actions are allowed.
 */
export type AllowedAiActions =
  | (
      | 'write_file'
      | 'replace_file_str'
      | 'read_file'
      | 'wait'
      | 'go_to_url'
      | 'go_back'
      | 'click_element_by_index'
      | 'input_text'
      | 'upload_file'
      | 'extract_structured_data'
      | 'scroll'
      | 'send_keys'
      | 'scroll_to_text'
      | 'get_dropdown_options'
      | 'select_dropdown_option'
      | 'read_sheet_contents'
      | 'read_cell_contents'
      | 'update_cell_contents'
      | 'clear_cell_contents'
      | 'select_cell_or_range'
      | 'fallback_input_into_single_selected_cell'
      | 'drag_and_drop_element'
      | 'get_last_email'
      | 'reply_to_email'
      | 'container_scroll'
    )[]
  | null;
/**
 * Maximum number of steps to perform for this action. If not set, defaults to 3.
 */
export type MaxSteps = number | null;
/**
 * If true, the action will be performed in max mode, i.e. the AI will try to perform as many steps as possible to achieve the action. Use with caution as this can lead to long execution times.
 */
export type MaxMode = boolean;
/**
 * If true, the action will be performed using the ultra model, which has higher capabilities but also higher cost.
 */
export type UltraMode = boolean;
/**
 * Strategy for resolving the action value. 'ai_based' uses AI to generate the value at runtime based on value_semantic_text.
 */
export type ValueStrategy1 = ValueStrategy2 | string | null;
/**
 * Strategies for resolving action values
 *
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "ValueStrategy".
 */
export type ValueStrategy2 = 'static' | 'ai_based';
/**
 * Semantic description for AI-based value resolution (e.g., 'tomorrow\'s date in YYYY-MM-DD format'). Required when value_strategy is 'ai_based'.
 */
export type ValueSemanticText1 = string | null;
/**
 * Optional variable name to store the resolved AI value. If not set, an auto-generated name will be used.
 */
export type ValueVariableName1 = string | null;
/**
 * Method to call on page or Locator object
 */
export type Method = string | null;
/**
 * Arguments to pass to the method
 */
export type Args = (number | string)[] | null;
/**
 * Set to true when the args could be potentially a variable that the user can set
 */
export type ArgsCanBeVariable = boolean;
/**
 * Set to true when the kwargs could be potentially a variable that the user can set
 */
export type KwargsCanBeVariable = boolean;
/**
 * If set, access this attribute instead of calling method. E.g. `mouse`
 */
export type Attribute = string | null;
/**
 * Human-readable of the locator step, used for debugging and display purposes. E.g. Sign-in button locator, First row in the orders table, etc.
 */
export type HumanName = string | null;
/**
 * Ordered list of method calls or attribute accesses to resolve the element
 */
export type Chain = LocatorStep[];
/**
 * Optional text associated with the locator, e.g. innerText of the element
 */
export type Text1 = string | null;
/**
 * The strategy used to generate the selector for the block
 */
export type StrategyUsed = SelectorStrategy | string | null;
/**
 * Strategies for generating selectors
 *
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "SelectorStrategy".
 */
export type SelectorStrategy =
  | 'aria'
  | 'test_id'
  | 'semantic'
  | 'stable_class'
  | 'text'
  | 'css'
  | 'xpath'
  | 'placeholder'
  | 'label'
  | 'id'
  | 'parent_based'
  | 'nth_match'
  | 'playwright_internal'
  | 'fallback'
  | 'ai_based';
export type Name2 = string | null;
export type Description1 = string | null;
export type AaaPhase1 = ('arrange' | 'act' | 'assert') | null;
export type ShouldSkip = boolean;
export type Steps = (SimpleStep | ExtendedStep)[];
export type Severity = ('low' | 'medium' | 'high' | 'critical') | null;
export type Priority = ('low' | 'medium' | 'high' | 'urgent') | null;
export type SuccessCriteria = string | null;
export type IsPositive = boolean | null;
export type VersionHash = string | null;

/**
 * Schema for qa-use test definition files
 */
export interface TestDefinition {
  name: Name;
  id?: Id;
  app_config?: AppConfig;
  tags?: Tags;
  description?: Description;
  variables?: Variables;
  depends_on?: DependsOn;
  steps: Steps;
  severity?: Severity;
  priority?: Priority;
  success_criteria?: SuccessCriteria;
  is_positive?: IsPositive;
  version_hash?: VersionHash;
  [k: string]: unknown;
}
export interface Variables {
  [k: string]: string;
}
/**
 * Simplified step format - human-readable, auto-resolved locators.
 *
 * This is the default format for YAML/JSON test files.
 *
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "SimpleStep".
 */
export interface SimpleStep {
  type?: Type;
  action: Action;
  target?: Target;
  value?: Value;
  url?: Url;
  timeout?: Timeout;
  aaa_phase?: AaaPhase;
  [k: string]: unknown;
}
/**
 * Full Block model - precise control over locators and actions.
 *
 * Use this for advanced scenarios requiring explicit locator chains.
 *
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "ExtendedStep".
 */
export interface ExtendedStep {
  type: Type1;
  action: ActionInstruction;
  locator?: LocatorInstruction | null;
  name?: Name2;
  description?: Description1;
  aaa_phase?: AaaPhase1;
  should_skip?: ShouldSkip;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "ActionInstruction".
 */
export interface ActionInstruction {
  action: Action1;
  value?: Value1;
  value_can_be_variable?: ValueCanBeVariable;
  timeout?: Timeout2;
  allowed_ai_actions?: AllowedAiActions;
  max_steps?: MaxSteps;
  max_mode?: MaxMode;
  ultra_mode?: UltraMode;
  value_strategy?: ValueStrategy1;
  value_semantic_text?: ValueSemanticText1;
  value_variable_name?: ValueVariableName1;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "AnyDict".
 */
export interface AnyDict {
  text?: Text;
  has_text?: HasText;
  _regex?: Regex;
  files?: Files;
  name?: Name1;
  exact?: Exact;
  button?: Button;
  disabled?: Disabled;
  x?: X;
  y?: Y;
  delta_x?: DeltaX;
  delta_y?: DeltaY;
  force?: Force;
  wait_new_page?: WaitNewPage;
  key?: Key;
  delay?: Delay;
  value?: Value2;
  index?: Index;
  label?: Label;
  url?: Url1;
  file_paths?: FilePaths;
  file_name?: FileName;
  email?: Email;
  subject?: Subject;
  reply_body?: ReplyBody;
  email_id?: EmailId;
  input?: Input;
  timeout?: Timeout1;
  wait_until?: WaitUntil;
  variable_name?: VariableName;
  variable_type?: VariableType;
  length?: Length;
  custom_value?: CustomValue;
  variable_validation?: VariableValidation;
  extraction_task?: ExtractionTask;
  extraction_variable_target_name?: ExtractionVariableTargetName;
  extraction_type?: ExtractionType;
  attribute_name?: AttributeName;
  target_locator?: TargetLocator;
  json_path?: JsonPath;
  request_method?: RequestMethod;
  request_url?: RequestUrl;
  request_headers?: RequestHeaders;
  request_body?: RequestBody;
  request_expected_status?: RequestExpectedStatus;
  value_strategy?: ValueStrategy;
  value_semantic_text?: ValueSemanticText;
  value_variable_name?: ValueVariableName;
  [k: string]: unknown;
}
export interface RequestHeaders {
  [k: string]: string;
}
/**
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "LocatorInstruction".
 */
export interface LocatorInstruction {
  chain?: Chain;
  text?: Text1;
  strategy_used?: StrategyUsed;
  [k: string]: unknown;
}
/**
 * This interface was referenced by `TestDefinition`'s JSON-Schema
 * via the `definition` "LocatorStep".
 */
export interface LocatorStep {
  method?: Method;
  args?: Args;
  args_can_be_variable?: ArgsCanBeVariable;
  /**
   * Keyword arguments to pass to the method, optional free-form dictionary
   */
  kwargs?: AnyDict | null;
  kwargs_can_be_variable?: KwargsCanBeVariable;
  attribute?: Attribute;
  human_name?: HumanName;
  [k: string]: unknown;
}
