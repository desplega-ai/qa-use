import Yoga from 'yoga-layout-prebuilt';
import readline from 'readline';
import chalk from 'chalk';
import { SessionService } from '../services/SessionService.js';
import type { TestAgentV2Session } from '../types/session.js';

interface LogEntry {
  timestamp: string;
  type: 'status' | 'task' | 'info' | 'error' | 'success';
  message: string;
  details?: string;
}

interface UserInputRequest {
  question?: string | undefined;
  isActive: boolean;
  resolve?: (response: string) => void | undefined;
}

export class SessionMonitorUI {
  private readonly sessionService: SessionService;
  private readonly sessionId: string;
  private readonly terminalWidth: number;
  private readonly terminalHeight: number;

  private logs: LogEntry[] = [];
  private currentInputText = '';
  private isRunning = false;
  private lastHistoryLength = 0;
  private lastStatus = '';
  private pollInterval: NodeJS.Timeout | null = null;
  private shouldExit = false;

  private readonly root: Yoga.YogaNode;
  private readonly headerContainer: Yoga.YogaNode;
  private readonly logContainer: Yoga.YogaNode;
  private readonly footerContainer: Yoga.YogaNode;

  constructor(sessionService: SessionService, sessionId: string) {
    this.sessionService = sessionService;
    this.sessionId = sessionId;

    // Get terminal dimensions
    this.terminalWidth = process.stdout.columns || 80;
    this.terminalHeight = process.stdout.rows || 24;

    // Create Yoga layout tree
    this.root = Yoga.Node.create();
    this.root.setWidth(this.terminalWidth);
    this.root.setHeight(this.terminalHeight);
    this.root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);

    // Header container (session info)
    this.headerContainer = Yoga.Node.create();
    this.headerContainer.setHeight(3);
    this.headerContainer.setWidth('100%');
    this.root.insertChild(this.headerContainer, 0);

    // Log container (scrollable area)
    this.logContainer = Yoga.Node.create();
    this.logContainer.setFlexGrow(1);
    this.logContainer.setWidth('100%');
    this.root.insertChild(this.logContainer, 1);

    // Footer container (instructions)
    this.footerContainer = Yoga.Node.create();
    this.footerContainer.setHeight(2);
    this.footerContainer.setWidth('100%');
    this.root.insertChild(this.footerContainer, 2);
  }

  private calculateLayout(): void {
    this.root.calculateLayout(this.terminalWidth, this.terminalHeight, Yoga.DIRECTION_LTR);
  }

  private addLog(type: LogEntry['type'], message: string, details?: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.logs.push({
      timestamp,
      type,
      message,
      ...(details && { details }),
    });

    // Keep only recent logs to prevent memory issues
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }

    this.render();
  }

  private render(): void {
    if (!this.isRunning) return;

    this.calculateLayout();

    // Clear screen and move to top
    process.stdout.write('\x1B[2J\x1B[H');

    // Render header
    this.renderHeader();

    // Render logs
    this.renderLogs();

    // Render footer
    this.renderFooter();

    // Show cursor
    process.stdout.write('\x1B[?25h');
  }

  private renderHeader(): void {
    const layout = this.headerContainer.getComputedLayout();
    console.log(chalk.blue('🎯 QA Session Monitor'));
    console.log(chalk.gray(`Session: ${this.sessionId.slice(0, 8)}... | Press Ctrl+C to stop`));
    console.log(chalk.gray('─'.repeat(this.terminalWidth - 1)));
  }

  private renderLogs(): void {
    const layout = this.logContainer.getComputedLayout();
    const availableHeight = Math.floor(layout.height) - 2;

    // Show most recent logs that fit in the available space
    const visibleLogs = this.logs.slice(-Math.max(1, availableHeight));

    visibleLogs.forEach((log) => {
      const timeStr = chalk.dim(`[${log.timestamp}]`);

      let typeIcon = '';
      let messageColor = chalk.white;

      switch (log.type) {
        case 'status':
          typeIcon = '📊';
          messageColor = chalk.cyan;
          break;
        case 'task':
          typeIcon = '📋';
          messageColor = chalk.blue;
          break;
        case 'info':
          typeIcon = 'ℹ️';
          messageColor = chalk.gray;
          break;
        case 'error':
          typeIcon = '❌';
          messageColor = chalk.red;
          break;
        case 'success':
          typeIcon = '✅';
          messageColor = chalk.green;
          break;
      }

      console.log(`${timeStr} ${typeIcon} ${messageColor(log.message)}`);

      if (log.details) {
        const detailsFormatted = log.details
          .split('\n')
          .map((line) => `    ${chalk.dim(line)}`)
          .join('\n');
        console.log(detailsFormatted);
      }
    });
  }

  private renderFooter(): void {
    console.log(chalk.gray('─'.repeat(this.terminalWidth - 1)));
    console.log(chalk.dim('Press Escape to return to main menu'));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.isRunning = true;
      this.shouldExit = false;

      // Show cursor at start
      process.stdout.write('\x1B[?25h');

      this.addLog('info', 'Starting session monitoring...');
      this.addLog('info', `Session ID: ${this.sessionId}`);
      this.addLog('info', 'Press Escape to return to main menu');

      const POLL_INTERVAL = 3000; // 3 seconds

      // Simple escape key detection without raw mode
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const escapeHandler = (str: string, key: any) => {
        if (key && key.name === 'escape') {
          this.shouldExit = true;
          this.addLog('info', 'Returning to main menu...');
          setTimeout(() => {
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
            this.cleanup(resolve);
          }, 100);
        }
        if (key && key.ctrl && key.name === 'c') {
          this.shouldExit = true;
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
          }
          this.cleanup(resolve);
        }
      };

      process.stdin.on('keypress', escapeHandler);

      this.pollInterval = setInterval(async () => {
        if (this.shouldExit) {
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
          }
          return;
        }

        try {
          const session = await this.sessionService.getSession(this.sessionId);
          const status = session.data.status;

          // Only log status changes, not every poll
          if (status !== this.lastStatus) {
            this.addLog('status', `Status: ${this.lastStatus || 'unknown'} → ${status}`);
            this.lastStatus = status;
          }

          // Handle user input needed with inquirer
          if (status === 'need_user_input') {
            // Temporarily restore terminal for inquirer
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(false);
            }
            process.stdin.off('keypress', escapeHandler);

            const { input } = await import('@inquirer/prompts');

            this.addLog('info', 'Session needs user input!');

            if (session.data.pending_user_input?.question) {
              this.addLog('info', `Question: ${session.data.pending_user_input.question}`);
            }

            try {
              const userResponse = await input({
                message: 'Your response:',
                validate: (input) => input.trim().length > 0 || 'Response cannot be empty',
              });

              await this.sessionService.sendUserResponse(this.sessionId, userResponse);
              this.addLog('success', 'Response sent successfully');
            } catch (error) {
              this.addLog(
                'error',
                `Failed to send response: ${error instanceof Error ? error.message : error}`
              );
            }

            // Restore keypress handling
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(true);
            }
            process.stdin.on('keypress', escapeHandler);
          }

          // Log new history items
          if (session.data.history && session.data.history.length > this.lastHistoryLength) {
            const newItems = session.data.history.slice(this.lastHistoryLength);
            newItems.forEach((item: any, index: number) => {
              this.addLog('task', `Task ${this.lastHistoryLength + index + 1}: ${item.task}`);

              if (item.status === 'completed') {
                this.addLog('success', `Completed in ${item.elapsed_ms || 0}ms`);
              } else if (item.status === 'failed') {
                this.addLog('error', `Failed: ${item.error || 'Unknown error'}`);
              } else {
                this.addLog('info', `Status: ${item.status}`);
              }
            });
            this.lastHistoryLength = session.data.history.length;
          }

          // Check if session is closed
          if (status === 'closed') {
            this.addLog('success', 'Session completed!');

            if (session.data.last_done) {
              this.addLog('info', `Final Status: ${session.data.last_done.status}`);
              this.addLog('info', `Message: ${session.data.last_done.message}`);
            }

            this.addLog('info', 'Press Escape to return to main menu');
          }
        } catch (error) {
          this.addLog(
            'error',
            `Failed to fetch session: ${error instanceof Error ? error.message : error}`
          );
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
          }
          this.cleanup(resolve);
        }
      }, POLL_INTERVAL);

      // Handle cleanup on exit signals
      const cleanup = () => {
        this.shouldExit = true;
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
        this.cleanup(resolve);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    });
  }

  private cleanup(resolve?: () => void): void {
    this.isRunning = false;
    this.shouldExit = true;

    // Clean up polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Remove all keypress listeners
    try {
      process.stdin.removeAllListeners('keypress');
    } catch (e) {
      // Ignore cleanup errors
    }

    // Reset terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    // Show cursor
    process.stdout.write('\x1B[?25h');

    // Clear screen
    process.stdout.write('\x1B[2J\x1B[H');

    // Clean up Yoga nodes safely
    try {
      this.footerContainer.free();
      this.logContainer.free();
      this.headerContainer.free();
      this.root.free();
    } catch (e) {
      // Ignore cleanup errors
    }

    // Remove signal listeners
    try {
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
    } catch (e) {
      // Ignore cleanup errors
    }

    // Resolve promise if provided
    if (resolve) {
      resolve();
    }
  }

  stop(): void {
    this.cleanup();
  }
}
