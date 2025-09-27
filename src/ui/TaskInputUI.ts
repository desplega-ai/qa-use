import Yoga from 'yoga-layout-prebuilt';
import readline from 'readline';
import chalk from 'chalk';

interface TaskInputOptions {
  message: string;
  placeholder: string;
  validate?: (input: string) => boolean | string;
}

export class TaskInputUI {
  private readonly terminalWidth: number;
  private readonly terminalHeight: number;
  private readonly options: TaskInputOptions;

  private currentText = '';
  private isRunning = false;
  private cursorPosition = 0;

  private readonly root: Yoga.YogaNode;
  private readonly headerContainer: Yoga.YogaNode;
  private readonly contentContainer: Yoga.YogaNode;
  private readonly inputContainer: Yoga.YogaNode;
  private readonly footerContainer: Yoga.YogaNode;

  constructor(options: TaskInputOptions) {
    this.options = options;

    // Get terminal dimensions
    this.terminalWidth = process.stdout.columns || 80;
    this.terminalHeight = process.stdout.rows || 24;

    // Create Yoga layout tree
    this.root = Yoga.Node.create();
    this.root.setWidth(this.terminalWidth);
    this.root.setHeight(this.terminalHeight);
    this.root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);

    // Header container (title)
    this.headerContainer = Yoga.Node.create();
    this.headerContainer.setHeight(3);
    this.headerContainer.setWidth('100%');
    this.root.insertChild(this.headerContainer, 0);

    // Content container (message)
    this.contentContainer = Yoga.Node.create();
    this.contentContainer.setHeight(3);
    this.contentContainer.setWidth('100%');
    this.root.insertChild(this.contentContainer, 1);

    // Input container (expandable text area)
    this.inputContainer = Yoga.Node.create();
    this.inputContainer.setFlexGrow(1);
    this.inputContainer.setWidth('100%');
    this.root.insertChild(this.inputContainer, 2);

    // Footer container (instructions)
    this.footerContainer = Yoga.Node.create();
    this.footerContainer.setHeight(3);
    this.footerContainer.setWidth('100%');
    this.root.insertChild(this.footerContainer, 3);
  }

  private calculateLayout(): void {
    this.root.calculateLayout(this.terminalWidth, this.terminalHeight, Yoga.DIRECTION_LTR);
  }

  private render(): void {
    if (!this.isRunning) return;

    this.calculateLayout();

    // Clear screen and move to top
    process.stdout.write('\x1B[2J\x1B[H');

    // Render header
    this.renderHeader();

    // Render content
    this.renderContent();

    // Render input area
    this.renderInputArea();

    // Render footer
    this.renderFooter();
  }

  private renderHeader(): void {
    console.log(chalk.blue('🎯 QA Task Input'));
    console.log(chalk.gray('─'.repeat(this.terminalWidth - 1)));
    console.log();
  }

  private renderContent(): void {
    console.log(chalk.cyan(this.options.message));
    console.log();
    console.log();
  }

  private renderInputArea(): void {
    const layout = this.inputContainer.getComputedLayout();
    const availableHeight = Math.floor(layout.height) - 4; // Leave space for borders and footer

    // Input box border
    const inputBoxWidth = this.terminalWidth - 4;
    console.log(chalk.gray('┌' + '─'.repeat(inputBoxWidth - 2) + '┐'));

    // Split text into lines for display
    const lines = this.currentText.split('\n');
    const displayLines = [];

    // Handle text wrapping and line breaks
    for (const line of lines) {
      if (line.length <= inputBoxWidth - 4) {
        displayLines.push(line);
      } else {
        // Wrap long lines
        for (let i = 0; i < line.length; i += inputBoxWidth - 4) {
          displayLines.push(line.slice(i, i + inputBoxWidth - 4));
        }
      }
    }

    // Show placeholder if empty
    if (displayLines.length === 0) {
      displayLines.push(chalk.dim(this.options.placeholder));
    }

    // Display lines with scrolling if needed
    const visibleLines = displayLines.slice(-Math.max(1, availableHeight - 2));

    for (let i = 0; i < availableHeight - 2; i++) {
      const line = visibleLines[i] || '';
      const paddedLine = line
        .toString()
        .padEnd(inputBoxWidth - 4, ' ')
        .substring(0, inputBoxWidth - 4);
      console.log(chalk.gray('│ ') + paddedLine + chalk.gray(' │'));
    }

    console.log(chalk.gray('└' + '─'.repeat(inputBoxWidth - 2) + '┘'));
  }

  private renderFooter(): void {
    console.log();
    console.log(chalk.dim('Shift+Enter: New line | Enter: Submit | Escape: Cancel'));
    console.log(chalk.dim('Use Shift+Enter for multi-line input'));
  }

  async show(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.isRunning = true;

      // Setup readline interface for better keypress handling
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      // Enable keypress events
      readline.emitKeypressEvents(process.stdin, rl);

      // Set raw mode for immediate keypress detection
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      // Hide cursor
      process.stdout.write('\x1B[?25l');

      this.render();

      const handleKeypress = (str: string, key: any) => {
        if (!this.isRunning) return;

        // Handle Escape key
        if (key && key.name === 'escape') {
          this.cleanup(rl);
          resolve(null);
          return;
        }

        // Handle Enter key
        if (key && (key.name === 'return' || key.name === 'enter')) {
          if (key.shift) {
            // Shift+Enter: Add new line
            this.currentText += '\n';
            this.cursorPosition = this.currentText.length;
            this.render();
          } else {
            // Enter: Submit
            if (this.currentText.trim().length === 0) {
              this.render(); // Just re-render if empty
              return;
            }

            const validation = this.options.validate?.(this.currentText) ?? true;
            if (validation === true) {
              const result = this.currentText.trim();
              this.cleanup(rl);
              resolve(result);
            } else {
              // Show validation error briefly
              process.stdout.write('\x1B[2J\x1B[H');
              console.log(chalk.red(`Validation error: ${validation}`));
              setTimeout(() => this.render(), 1500);
            }
          }
          return;
        }

        // Handle Backspace key
        if (key && key.name === 'backspace') {
          if (this.currentText.length > 0) {
            this.currentText = this.currentText.slice(0, -1);
            this.cursorPosition = this.currentText.length;
            this.render();
          }
          return;
        }

        // Handle regular character input
        if (str && str.length === 1 && str.charCodeAt(0) >= 32) {
          this.currentText += str;
          this.cursorPosition = this.currentText.length;
          this.render();
          return;
        }

        // Handle Ctrl+C
        if (key && key.ctrl && key.name === 'c') {
          this.cleanup(rl);
          resolve(null);
          return;
        }
      };

      process.stdin.on('keypress', handleKeypress);

      // Handle cleanup on exit
      const cleanup = () => {
        process.stdin.off('keypress', handleKeypress);
        this.cleanup(rl);
        resolve(null);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    });
  }

  private cleanup(rl?: readline.Interface): void {
    this.isRunning = false;

    // Close readline interface first
    if (rl) {
      rl.close();
    }

    // Reset terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    // Show cursor
    process.stdout.write('\x1B[?25h');

    // Remove all listeners safely
    try {
      process.stdin.removeAllListeners('keypress');
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
    } catch (e) {
      // Ignore cleanup errors
    }

    // Clean up Yoga nodes safely
    try {
      this.footerContainer.free();
      this.inputContainer.free();
      this.contentContainer.free();
      this.headerContainer.free();
      this.root.free();
    } catch (e) {
      // Ignore cleanup errors
    }

    // Clear screen
    process.stdout.write('\x1B[2J\x1B[H');
  }
}

export async function createMultilineInputWithLayout(
  options: TaskInputOptions
): Promise<string | null> {
  const taskInputUI = new TaskInputUI(options);
  return await taskInputUI.show();
}
