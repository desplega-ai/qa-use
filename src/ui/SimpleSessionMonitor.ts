import chalk from 'chalk';
import { SessionService } from '../services/SessionService.js';
import type { TestAgentV2Session } from '../types/session.js';

export class SimpleSessionMonitor {
  private readonly sessionService: SessionService;
  private readonly sessionId: string;
  private isRunning = false;
  private lastHistoryLength = 0;
  private lastStatus = '';

  constructor(sessionService: SessionService, sessionId: string) {
    this.sessionService = sessionService;
    this.sessionId = sessionId;
  }

  async start(): Promise<void> {
    this.isRunning = true;

    console.log(chalk.cyan('👀 Starting session monitoring...'));
    console.log(chalk.gray(`Session ID: ${this.sessionId}`));
    console.log(chalk.gray('Press Ctrl+C to exit\n'));

    const POLL_INTERVAL = 3000; // 3 seconds

    const pollInterval = setInterval(async () => {
      try {
        if (!this.isRunning) {
          clearInterval(pollInterval);
          return;
        }

        const session = await this.sessionService.getSession(this.sessionId);
        const status = session.data.status;

        // Only log status changes
        if (status !== this.lastStatus) {
          const timestamp = new Date().toLocaleTimeString();
          console.log(
            chalk.blue(`[${timestamp}] Status: ${this.lastStatus || 'unknown'} → ${status}`)
          );
          this.lastStatus = status;
        }

        // Handle user input needed
        if (status === 'need_user_input') {
          const { input } = await import('@inquirer/prompts');

          console.log(chalk.blue('\n💬 Session needs user input!'));

          if (session.data.pending_user_input?.question) {
            console.log(chalk.cyan(`Question: ${session.data.pending_user_input.question}`));
          }

          const userResponse = await input({
            message: 'Your response:',
            validate: (input) => input.trim().length > 0 || 'Response cannot be empty',
          });

          try {
            await this.sessionService.sendUserResponse(this.sessionId, userResponse);
            console.log(chalk.green('✅ Response sent successfully\n'));
          } catch (error) {
            console.error(
              chalk.red(
                `❌ Failed to send response: ${error instanceof Error ? error.message : error}\n`
              )
            );
          }
        }

        // Log new history items
        if (session.data.history && session.data.history.length > this.lastHistoryLength) {
          const newItems = session.data.history.slice(this.lastHistoryLength);
          newItems.forEach((item: any, index: number) => {
            console.log(chalk.blue(`📋 Task ${this.lastHistoryLength + index + 1}: ${item.task}`));
            if (item.status === 'completed') {
              console.log(chalk.green(`   ✅ Completed in ${item.elapsed_ms || 0}ms`));
            } else if (item.status === 'failed') {
              console.log(chalk.red(`   ❌ Failed: ${item.error || 'Unknown error'}`));
            } else {
              console.log(chalk.yellow(`   ⏳ ${item.status}`));
            }
          });
          this.lastHistoryLength = session.data.history.length;
        }

        // Check if session is closed
        if (status === 'closed') {
          console.log(chalk.green('\n🎉 Session completed!'));

          if (session.data.last_done) {
            console.log(chalk.cyan(`Final Status: ${session.data.last_done.status}`));
            console.log(chalk.gray(`Message: ${session.data.last_done.message}`));
          }

          clearInterval(pollInterval);
          this.stop();
          return;
        }
      } catch (error) {
        console.error(
          chalk.red(`❌ Failed to fetch session: ${error instanceof Error ? error.message : error}`)
        );
        clearInterval(pollInterval);
        this.stop();
      }
    }, POLL_INTERVAL);

    // Handle cleanup
    const cleanup = () => {
      clearInterval(pollInterval);
      this.stop();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  stop(): void {
    this.isRunning = false;
    console.log(chalk.yellow('\n👋 Session monitoring stopped'));
  }
}
