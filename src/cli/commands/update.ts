/**
 * qa-use update - Self-update command for @desplega.ai/qa-use
 *
 * Handles both global npm installs and local linked/dev installs.
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { error, info, success, warning } from '../lib/output.js';

// Get current version from package.json
const require = createRequire(import.meta.url);
const { version: currentVersion } = require('../../../package.json');

interface InstallInfo {
  type: 'dev' | 'global';
  projectRoot?: string;
}

/**
 * Read version from package.json at a given project root
 */
function readVersionFromDisk(projectRoot: string): string | null {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Detect install type by resolving the CLI binary path
 */
function detectInstallType(): InstallInfo {
  try {
    // Resolve the real path of the CLI binary (follows symlinks)
    const binPath = realpathSync(process.argv[1]);

    // Walk up to find package.json
    let dir = dirname(binPath);
    let projectRoot: string | undefined;

    for (let i = 0; i < 10; i++) {
      const pkgPath = join(dir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          if (pkg.name === '@desplega.ai/qa-use') {
            projectRoot = dir;
            break;
          }
        } catch {
          // Continue searching
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    if (projectRoot) {
      // Check if .git exists → dev/linked install
      const gitPath = join(projectRoot, '.git');
      if (existsSync(gitPath)) {
        return { type: 'dev', projectRoot };
      }
    }

    // Otherwise it's a global npm install
    return { type: 'global' };
  } catch {
    // Fallback to global
    return { type: 'global' };
  }
}

/**
 * Run a shell command with output piped to terminal
 */
function runCommand(command: string, cwd?: string): boolean {
  try {
    const result = spawnSync(command, {
      shell: true,
      cwd,
      stdio: 'inherit',
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Get latest version from npm registry
 */
function getLatestNpmVersion(): string | null {
  try {
    const result = execSync('npm view @desplega.ai/qa-use version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Handle dev/linked install update
 */
function updateDevInstall(projectRoot: string, pull: boolean): void {
  console.log(info(`Dev install detected at: ${projectRoot}`));
  console.log(`Current version: ${currentVersion}\n`);

  if (pull) {
    console.log(info('Running git pull...'));
    if (!runCommand('git pull', projectRoot)) {
      console.log(error('git pull failed'));
      process.exit(1);
    }
    console.log('');
  }

  console.log(info('Installing dependencies...'));
  if (!runCommand('bun install', projectRoot)) {
    console.log(error('bun install failed'));
    process.exit(1);
  }
  console.log('');

  console.log(info('Building...'));
  if (!runCommand('bun run build', projectRoot)) {
    console.log(error('bun run build failed'));
    process.exit(1);
  }
  console.log('');

  // Re-read version from disk (may have changed after git pull)
  const finalVersion = readVersionFromDisk(projectRoot) ?? currentVersion;
  const versionChanged = finalVersion !== currentVersion;

  if (versionChanged) {
    console.log(success(`Update complete: ${currentVersion} → ${finalVersion}`));
  } else {
    console.log(success(`Rebuild complete (${finalVersion})`));
  }

  if (!pull) {
    console.log(info('Use --pull to also run git pull'));
  }
}

/**
 * Handle global npm install update
 */
function updateGlobalInstall(checkOnly: boolean): void {
  console.log(info('Global npm install detected'));
  console.log(`Current version: ${currentVersion}\n`);

  const latestVersion = getLatestNpmVersion();
  if (!latestVersion) {
    console.log(error('Failed to fetch latest version from npm'));
    process.exit(1);
  }

  if (latestVersion === currentVersion) {
    console.log(success(`Already on latest version (${currentVersion})`));
    return;
  }

  console.log(info(`New version available: ${currentVersion} → ${latestVersion}`));

  if (checkOnly) {
    console.log('');
    console.log(info('Run `qa-use update` to install the update'));
    return;
  }

  console.log('');
  console.log(info('Installing update...'));
  if (!runCommand('npm install -g @desplega.ai/qa-use@latest')) {
    console.log(error('npm install failed'));
    process.exit(1);
  }

  console.log('');
  console.log(success(`Updated: ${currentVersion} → ${latestVersion}`));
}

export const updateCommand = new Command('update')
  .description('Update qa-use to the latest version')
  .option('--check', 'Only check if an update is available (global) or show install type (dev)')
  .option('--pull', 'For dev installs, run git pull before rebuilding')
  .action(async (options: { check?: boolean; pull?: boolean }) => {
    const installInfo = detectInstallType();

    if (installInfo.type === 'dev' && installInfo.projectRoot) {
      if (options.check) {
        console.log(info(`Dev install detected at: ${installInfo.projectRoot}`));
        console.log(`Current version: ${currentVersion}`);
        console.log('');
        console.log(info('Run `qa-use update` to rebuild'));
        console.log(info('Run `qa-use update --pull` to git pull and rebuild'));
        return;
      }
      updateDevInstall(installInfo.projectRoot, options.pull ?? false);
    } else {
      if (options.pull) {
        console.log(warning('--pull is only applicable for dev installs'));
        console.log('');
      }
      updateGlobalInstall(options.check ?? false);
    }
  });
