import readline from 'readline';
import chalk from 'chalk';

const COMMANDS = ['/auth', '/logout', '/config', '/forward', '/watch', '/help', '/clear', '/exit'];

export function createTabCompleteInput(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: (line: string) => {
        if (line.startsWith('/')) {
          const completions = COMMANDS.filter((cmd) => cmd.startsWith(line));
          return [completions, line];
        }
        return [[], line];
      },
    });

    rl.question(chalk.cyan('> '), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
