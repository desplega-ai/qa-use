import readline from 'readline';
import chalk from 'chalk';

// Enable keypress events
readline.emitKeypressEvents(process.stdin);

export interface MultilineInputOptions {
  message: string;
  placeholder?: string;
  validate?: (input: string) => boolean | string;
  minHeight?: number;
}

export async function createMultilineInput(options: MultilineInputOptions): Promise<string> {
  const {
    message,
    placeholder = 'Enter your task description...',
    validate,
    minHeight = 3,
  } = options;

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const lines: string[] = [];
    let currentLine = '';
    let cursorRow = 0;
    const maxDisplayHeight = Math.max(minHeight, 8);

    // Hide cursor initially
    process.stdout.write('\x1B[?25l');

    const renderInterface = () => {
      // Clear the screen and go to top
      process.stdout.write('\x1B[2J\x1B[H');

      // Header
      console.log(chalk.blue('📝 Step 5: QA Task'));
      console.log(chalk.gray(message));
      console.log();

      // Instructions
      console.log(chalk.yellow('Enter your task description:'));
      console.log(chalk.gray('• Use Shift+Enter for new lines'));
      console.log(chalk.gray('• Press Enter to submit'));
      console.log(chalk.gray('• Press Ctrl+C to cancel'));
      console.log();

      // Text box border (top)
      console.log(chalk.gray('┌' + '─'.repeat(78) + '┐'));

      // Content area
      const displayLines = [...lines, currentLine];

      // Add empty lines to reach minimum height
      while (displayLines.length < minHeight) {
        displayLines.push('');
      }

      // Display lines (up to max height)
      const visibleLines = displayLines.slice(0, maxDisplayHeight);

      for (let i = 0; i < maxDisplayHeight; i++) {
        const line = visibleLines[i] || '';
        const content =
          line ||
          (i === 0 && lines.length === 0 && currentLine === '' ? chalk.dim(placeholder) : '');
        const paddedContent = content.padEnd(78, ' ').substring(0, 78);
        console.log(chalk.gray('│') + paddedContent + chalk.gray('│'));
      }

      // Text box border (bottom)
      console.log(chalk.gray('└' + '─'.repeat(78) + '┘'));

      // Status line
      const lineCount = lines.length + (currentLine ? 1 : 0);
      const charCount = [...lines, currentLine].join('\n').length;
      console.log(chalk.dim(`Lines: ${lineCount} | Characters: ${charCount}`));
    };

    const cleanup = () => {
      process.stdout.write('\x1B[?25h'); // Show cursor
      rl.close();
    };

    // Initial render
    renderInterface();

    // Handle input
    process.stdin.on('keypress', (str, key) => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('User cancelled'));
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (key.shift) {
          // Shift+Enter: New line
          lines.push(currentLine);
          currentLine = '';
          cursorRow++;
        } else {
          // Enter: Submit
          const finalText = [...lines, currentLine].join('\n').trim();

          if (validate) {
            const validation = validate(finalText);
            if (validation !== true) {
              // Show validation error
              console.log(
                chalk.red(`\n❌ ${typeof validation === 'string' ? validation : 'Invalid input'}`)
              );
              setTimeout(() => renderInterface(), 1500);
              return;
            }
          }

          cleanup();
          resolve(finalText);
          return;
        }
      } else if (key.name === 'backspace') {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
        } else if (lines.length > 0) {
          // Move to previous line
          currentLine = lines.pop() || '';
          cursorRow = Math.max(0, cursorRow - 1);
        }
      } else if (key.name === 'delete') {
        // Delete character at cursor (not implemented for simplicity)
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        // Regular character input
        currentLine += str;
      }

      renderInterface();
    });

    // Enable keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    // Cleanup on exit
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
