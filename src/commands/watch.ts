import { Command } from 'commander';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import ignore from 'ignore';
import { GitService } from '../services/GitService.js';

export function createWatchCommand() {
  const watch = new Command('watch');

  watch
    .description('Watch for file changes (respects .gitignore by default)')
    .option('-d, --directory <dir>', 'Directory to watch (default: current directory)', '.')
    .option('--extensions <exts>', 'Comma-separated file extensions to watch (default: all files)')
    .option('--ignore-git', 'Ignore .gitignore rules and watch all files')
    .option('--debug', 'Enable debug logging')
    .option('--git', 'Show git diffs alongside file changes')
    .option('-i, --ignore <patterns>', 'Additional comma-separated patterns to ignore')
    .action(async (options) => {
      const chalk = (await import('chalk')).default;

      try {
        const watchDir = path.resolve(options.directory);
        const gitService = new GitService(watchDir);

        // Load .gitignore if it exists and not disabled
        let ignoreFilter: ((filePath: string) => boolean) | null = null;
        if (!options.ignoreGit) {
          const gitignorePath = path.join(watchDir, '.gitignore');
          if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            const ig = ignore().add(gitignoreContent);
            ignoreFilter = (filePath: string) => {
              try {
                // Skip glob patterns and other non-file paths
                if (
                  filePath.includes('*') ||
                  filePath === '.' ||
                  filePath === '..' ||
                  !filePath.trim()
                ) {
                  return false;
                }

                // Convert absolute path to relative path from watchDir
                const relativePath = path.isAbsolute(filePath)
                  ? path.relative(watchDir, filePath)
                  : filePath;

                // Don't process empty paths or paths that are just dots
                if (!relativePath || relativePath === '.' || relativePath === '') {
                  return false;
                }

                // Normalize path separators for cross-platform compatibility
                const normalizedPath = relativePath.replace(/\\/g, '/');

                return ig.ignores(normalizedPath);
              } catch (error) {
                console.error('Error in ignoreFilter:', {
                  filePath,
                  error: error instanceof Error ? error.message : error,
                });
                return false; // Don't ignore if there's an error
              }
            };
            console.log(chalk.gray(`Using .gitignore rules from: ${gitignorePath}`));
          }
        }

        // Additional ignore patterns
        const additionalIgnorePatterns: string[] = [];
        if (options.ignore) {
          additionalIgnorePatterns.push(...options.ignore.split(',').map((p: string) => p.trim()));
        }

        console.log(chalk.blue('👀 Starting file watcher...'));
        console.log(chalk.gray(`Directory: ${watchDir}`));

        // Show git status if we're in a git repo
        if (options.git) {
          const gitStatus = gitService.getStatus();
          if (gitStatus.isRepo) {
            console.log(chalk.cyan(`🔗 Git: ${gitStatus.branch || 'unknown branch'}`));
            console.log(chalk.gray(`Repo root: ${gitStatus.repoRoot}`));
            if (gitStatus.staged.length > 0) {
              console.log(chalk.green(`Staged: ${gitStatus.staged.length} files`));
            }
            if (gitStatus.unstaged.length > 0) {
              console.log(chalk.yellow(`Unstaged: ${gitStatus.unstaged.length} files`));
            }
            if (gitStatus.untracked.length > 0) {
              console.log(chalk.blue(`Untracked: ${gitStatus.untracked.length} files`));
            }
          } else {
            console.log(chalk.gray('Not a git repository'));
          }
        }

        if (options.extensions) {
          const extensions = options.extensions.split(',').map((ext: string) => ext.trim());
          console.log(chalk.gray(`Extensions: ${extensions.join(', ')}`));
        } else {
          console.log(chalk.gray(`Extensions: all files`));
        }

        if (additionalIgnorePatterns.length > 0) {
          console.log(chalk.gray(`Additional ignore: ${additionalIgnorePatterns.join(', ')}`));
        }
        console.log(chalk.gray('Press Ctrl+C to stop watching\n'));

        // Create watch patterns
        let patterns: string | string[];
        if (options.extensions) {
          const extensions = options.extensions.split(',').map((ext: string) => ext.trim());
          patterns = extensions.map((ext: string) => `**/*.${ext}`);
        } else {
          patterns = '**/*'; // Watch all files
        }

        const watcher = chokidar.watch(patterns, {
          cwd: watchDir,
          ignored: (filePath: string) => {
            // Convert to relative path for consistent checking
            const relativePath = path.isAbsolute(filePath)
              ? path.relative(watchDir, filePath)
              : filePath;

            if (options.debug) {
              console.log(chalk.gray(`Checking: ${relativePath}`));
            }

            // System files to always ignore
            const systemIgnores = [
              '.git/',
              'node_modules/',
              'dist/',
              '.DS_Store',
              '.nyc_output/',
              'coverage/',
            ];

            for (const ignore of systemIgnores) {
              if (relativePath.includes(ignore)) {
                if (options.debug) {
                  console.log(chalk.gray(`  -> Ignored (system): ${relativePath}`));
                }
                return true;
              }
            }

            // Temp files
            if (relativePath.endsWith('~') || /^\d+$/.test(relativePath)) {
              if (options.debug) {
                console.log(chalk.gray(`  -> Ignored (temp): ${relativePath}`));
              }
              return true;
            }

            // Hidden files except .gitignore
            if (relativePath.startsWith('.') && relativePath !== '.gitignore') {
              if (options.debug) {
                console.log(chalk.gray(`  -> Ignored (hidden): ${relativePath}`));
              }
              return true;
            }

            // Check gitignore rules
            if (ignoreFilter && ignoreFilter(relativePath)) {
              if (options.debug) {
                console.log(chalk.gray(`  -> Ignored (gitignore): ${relativePath}`));
              }
              return true;
            }

            // Check additional ignore patterns
            if (additionalIgnorePatterns.length > 0) {
              const basename = path.basename(relativePath);
              const shouldIgnore = additionalIgnorePatterns.some((pattern) => {
                if (pattern.includes('*')) {
                  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                  return regex.test(basename) || regex.test(relativePath);
                }
                return basename === pattern || relativePath.includes(pattern);
              });

              if (shouldIgnore) {
                if (options.debug) {
                  console.log(chalk.gray(`  -> Ignored (custom): ${relativePath}`));
                }
                return true;
              }
            }

            if (options.debug) {
              console.log(chalk.gray(`  -> Watching: ${relativePath}`));
            }
            return false;
          },
          ignoreInitial: true,
          persistent: true,
          usePolling: false,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50,
          },
        });

        watcher
          .on('add', (filePath) => {
            if (options.debug) console.log(chalk.gray(`Event: add triggered for ${filePath}`));
            console.log(chalk.green(`[ADDED] ${filePath}`));

            // Show git info if requested
            if (options.git && gitService.isGitRepository()) {
              const changeSummary = gitService.getChangeSummary(filePath);
              if (changeSummary !== 'No changes') {
                console.log(chalk.gray(`  ${changeSummary}`));
              }
            }
          })
          .on('change', (filePath) => {
            if (options.debug) console.log(chalk.gray(`Event: change triggered for ${filePath}`));
            console.log(chalk.yellow(`[CHANGED] ${filePath}`));

            // Show git info if requested
            if (options.git && gitService.isGitRepository()) {
              const changeSummary = gitService.getChangeSummary(filePath);
              if (changeSummary !== 'No changes') {
                console.log(chalk.gray(`  ${changeSummary}`));
              }

              // Show diff snippet
              const diff = gitService.getFileDiff(filePath, false);
              if (diff && diff.diff) {
                console.log(chalk.gray('  ───'));
                const diffLines = diff.diff.split('\n').slice(0, 5);
                diffLines.forEach((line: string) => {
                  if (line.startsWith('+')) {
                    console.log(chalk.green(`  ${line}`));
                  } else if (line.startsWith('-')) {
                    console.log(chalk.red(`  ${line}`));
                  } else if (line.startsWith('@@')) {
                    console.log(chalk.cyan(`  ${line}`));
                  } else {
                    console.log(chalk.gray(`  ${line}`));
                  }
                });
                if (diff.diff.split('\n').length > 5) {
                  console.log(chalk.gray('  ... (diff truncated)'));
                }
              }
            }
          })
          .on('unlink', (filePath) => {
            if (options.debug) console.log(chalk.gray(`Event: unlink triggered for ${filePath}`));
            console.log(chalk.red(`[DELETED] ${filePath}`));
          })
          .on('addDir', (dirPath) => {
            if (options.debug) console.log(chalk.gray(`Event: addDir triggered for ${dirPath}`));
            console.log(chalk.blue(`[DIR ADDED] ${dirPath}`));
          })
          .on('unlinkDir', (dirPath) => {
            if (options.debug) console.log(chalk.gray(`Event: unlinkDir triggered for ${dirPath}`));
            console.log(chalk.red(`[DIR DELETED] ${dirPath}`));
          })
          .on('ready', () => {
            console.log(chalk.cyan('👂 Watcher is ready and listening for changes...'));
            if (options.debug) {
              console.log(
                chalk.gray(
                  `Watching patterns: ${Array.isArray(patterns) ? patterns.join(', ') : patterns}`
                )
              );
              console.log(chalk.gray(`Watch directory: ${watchDir}`));
            }
          })
          .on('error', (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(chalk.red(`[ERROR] ${message}`));
          });

        // Handle graceful shutdown
        const cleanup = () => {
          console.log(chalk.yellow('\n🛑 Stopping file watcher...'));
          watcher.close();
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Keep the process alive
        await new Promise(() => {}); // Wait indefinitely
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return watch;
}
