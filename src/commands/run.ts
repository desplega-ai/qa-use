import { Command } from 'commander';
import { AuthService } from '../services/AuthService.js';
import { SessionService } from '../services/SessionService.js';
import { BrowserForwarder } from '../services/BrowserForwarder.js';
import { ConfigService } from '../services/ConfigService.js';
import { createMultilineInputWithLayout } from '../ui/TaskInputUI.js';
import { SessionMonitorUI } from '../ui/SessionMonitorUI.js';
import type { TestAgentV2Session } from '../types/session.js';

export function createRunCommand() {
  const run = new Command('run');

  run
    .description('Start QA session with authentication, browser forwarding, and session management')
    .option('--url <url>', 'Target URL to test (skip URL prompt)')
    .option('--task <task>', 'QA task description (skip task prompt)')
    .option('--session-id <id>', 'Resume existing session by ID')
    .action(async (options) => {
      const chalk = (await import('chalk')).default;
      const { input, select, confirm } = await import('@inquirer/prompts');

      try {
        console.log(chalk.cyan('🚀 Starting QA-USE session...'));

        // Initialize services
        const configService = new ConfigService();

        // Step 1: Check authentication
        console.log(chalk.blue('\n📋 Step 1: Authentication'));
        const authService = new AuthService();

        // Load API key from config if available
        const savedApiKey = configService.getApiKey();
        if (savedApiKey) {
          authService.setApiKey(savedApiKey);
        }

        let isAuthenticated = false;
        try {
          await authService.checkApiKey();
          console.log(chalk.green('✅ Authentication successful'));
          isAuthenticated = true;
        } catch (error) {
          console.log(chalk.yellow('⚠️  Not authenticated'));

          const shouldRegister = await confirm({
            message: 'Would you like to register for a new API key?',
            default: true,
          });

          if (shouldRegister) {
            const email = await input({
              message: 'Enter your email address:',
              validate: (input) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(input) || 'Please enter a valid email address';
              },
            });

            try {
              const result = await authService.register(email);
              console.log(chalk.green(`✅ ${result.message}`));
              console.log(
                chalk.gray('Please check your email and return when you have your API key.')
              );

              const apiKey = await input({
                message: 'Enter your API key:',
                validate: (input) => input.length > 0 || 'API key cannot be empty',
              });

              authService.setApiKey(apiKey);
              await authService.checkApiKey();
              configService.setApiKey(apiKey); // Save to config
              console.log(chalk.green('✅ API key validated and saved'));
              isAuthenticated = true;
            } catch (regError) {
              console.error(
                chalk.red(
                  `❌ Registration failed: ${regError instanceof Error ? regError.message : regError}`
                )
              );
              process.exit(1);
            }
          } else {
            console.log(chalk.red('❌ Authentication required to proceed'));
            process.exit(1);
          }
        }

        if (!isAuthenticated) {
          console.log(chalk.red('❌ Failed to authenticate'));
          process.exit(1);
        }

        // Step 2: Start browser forwarding
        console.log(chalk.blue('\n🌐 Step 2: Starting browser forwarding'));
        const enableForwarderLogging = configService.isForwarderLoggingEnabled();
        const browserForwarder = new BrowserForwarder(enableForwarderLogging);

        await browserForwarder.start();
        const wsUrl = browserForwarder.getWebSocketUrl();

        if (!wsUrl) {
          console.error(chalk.red('❌ Failed to get WebSocket URL'));
          process.exit(1);
        }

        console.log(chalk.green(`✅ Browser forwarding started`));
        console.log(chalk.gray(`   WebSocket URL: ${wsUrl}`));

        // Step 3: Session management
        console.log(chalk.blue('\n📋 Step 3: Session Management'));
        const sessionService = new SessionService();
        sessionService.setApiKey(authService.getApiKey()!);

        let selectedSession: TestAgentV2Session | null = null;

        // Check if user wants to resume an existing session
        if (options.sessionId) {
          try {
            selectedSession = await sessionService.getSession(options.sessionId);
            console.log(
              chalk.green(
                `✅ Resumed session: ${sessionService.formatSessionSummary(selectedSession)}`
              )
            );
          } catch (error) {
            console.log(
              chalk.yellow(`⚠️  Session ${options.sessionId} not found, creating new session`)
            );
          }
        } else {
          // List existing sessions
          try {
            const sessions = await sessionService.getSessions();

            if (sessions.length > 0) {
              console.log(chalk.cyan('\n📄 Available Sessions:'));
              sessions.slice(0, 5).forEach((session: TestAgentV2Session, index: number) => {
                const statusIndicator = sessionService.getSessionStatusColor(session, chalk);
                console.log(
                  chalk.gray(
                    `  ${index + 1}. ${statusIndicator} ${sessionService.formatSessionSummary(session)}`
                  )
                );
              });

              const shouldResume = await confirm({
                message: 'Would you like to resume an existing session?',
                default: false,
              });

              if (shouldResume) {
                const sessionChoices = sessions
                  .slice(0, 5)
                  .map((session: TestAgentV2Session, index: number) => ({
                    name: `${sessionService.formatSessionSummary(session)}`,
                    value: session,
                  }));

                selectedSession = await select({
                  message: 'Select a session to resume:',
                  choices: sessionChoices,
                });

                // Open browser to session page
                const appUrl = configService.getAppUrl();
                const sessionUrl = `${appUrl}/demo/vibe-qa?apiKey=${authService.getApiKey()}&id=${selectedSession.id}&expanded=true`;
                console.log(chalk.cyan(`🔗 Session URL: ${sessionUrl}`));

                // Automatically open in browser
                try {
                  const open = (await import('open')).default;
                  await open(sessionUrl);
                  console.log(chalk.green('✅ Opened session in browser'));
                } catch (error) {
                  console.log(chalk.yellow('⚠️  Could not open browser automatically'));
                }

                // Monitor session with UI
                const monitor = new SessionMonitorUI(sessionService, selectedSession.id);
                await monitor.start();
                return;
              }
            }
          } catch (error) {
            console.log(
              chalk.yellow('⚠️  Could not fetch existing sessions, creating new session')
            );
          }
        }

        // Step 4: Get target URL
        let targetUrl = options.url;
        if (!targetUrl) {
          // Check for saved default URL
          const defaultUrl = configService.getDefaultUrl();

          console.log(chalk.blue('\n🎯 Step 4: Target URL'));

          if (defaultUrl) {
            const useDefault = await confirm({
              message: `Use saved URL: ${defaultUrl}?`,
              default: true,
            });

            if (useDefault) {
              targetUrl = defaultUrl;
            }
          }

          if (!targetUrl) {
            const inputConfig: any = {
              message: 'Enter the URL you want to test:',
              validate: (input: string) => {
                try {
                  new URL(input);
                  return true;
                } catch {
                  return 'Please enter a valid URL (including http:// or https://)';
                }
              },
            };

            if (defaultUrl) {
              inputConfig.default = defaultUrl;
            }

            targetUrl = await input(inputConfig);

            // Ask if they want to save this URL as default
            const saveAsDefault = await confirm({
              message: 'Save this URL as default for future sessions?',
              default: true,
            });

            if (saveAsDefault) {
              configService.setDefaultUrl(targetUrl);
            }
          }
        }

        console.log(chalk.green(`✅ Target URL: ${targetUrl}`));

        // Step 5: Get QA task
        let qaTask = options.task;
        if (!qaTask) {
          qaTask = await createMultilineInputWithLayout({
            message: 'Describe the QA task you want to perform',
            placeholder:
              'e.g., Test the login flow\n- Navigate to login page\n- Enter valid credentials\n- Verify successful login',
            validate: (input) => input.trim().length > 0 || 'Task description cannot be empty',
          });

          if (!qaTask) {
            console.log(chalk.yellow('🔙 Returning to main menu...'));
            return;
          }
        }

        console.log(chalk.green(`✅ QA Task: ${qaTask}`));

        // Step 6: Create new session
        console.log(chalk.blue('\n🎬 Step 6: Creating QA Session'));

        try {
          const sessionResponse = await sessionService.createSessionWithBrowser({
            url: targetUrl,
            task: qaTask,
            wsUrl: wsUrl,
          });

          console.log(chalk.green(`✅ ${sessionResponse.message}`));
          console.log(chalk.gray(`   Agent ID: ${sessionResponse.data.agent_id}`));

          // Open browser to session page
          const appUrl = configService.getAppUrl();
          const sessionUrl = `${appUrl}/demo/vibe-qa?apiKey=${authService.getApiKey()}&id=${sessionResponse.data.agent_id}`;
          console.log(chalk.cyan(`🔗 Session URL: ${sessionUrl}`));

          // Automatically open in browser
          try {
            const open = (await import('open')).default;
            await open(sessionUrl);
            console.log(chalk.green('✅ Opened session in browser'));
          } catch (error) {
            console.log(chalk.yellow('⚠️  Could not open browser automatically'));
          }

          // Step 7: Monitor session with UI
          console.log(chalk.blue('\n⏱️  Step 7: Monitoring Session'));
          const monitor = new SessionMonitorUI(sessionService, sessionResponse.data.agent_id);
          await monitor.start();
        } catch (error) {
          console.error(
            chalk.red(
              `❌ Failed to create session: ${error instanceof Error ? error.message : error}`
            )
          );
          process.exit(1);
        }

        // Cleanup
        process.on('SIGINT', async () => {
          console.log(chalk.yellow('\n🛑 Shutting down...'));
          await browserForwarder.stop();
          process.exit(0);
        });
      } catch (error) {
        console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return run;
}
