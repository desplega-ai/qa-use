#!/usr/bin/env bun

/**
 * Release script for qa-use-mcp
 *
 * Usage:
 *   bun release              # Interactive - prompts for version
 *   bun release 1.6.0        # Direct - uses provided version
 *   bun release patch        # Bump patch version
 *   bun release minor        # Bump minor version
 *   bun release major        # Bump major version
 */

import { $ } from 'bun';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type BumpType = 'major' | 'minor' | 'patch';

async function exec(command: string): Promise<void> {
  try {
    await $`${command}`.quiet();
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
}

async function execVisible(command: string): Promise<void> {
  try {
    await $`${command}`;
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    process.exit(1);
  }
}

async function execOutput(command: string): Promise<string | null> {
  try {
    const result = await $`${command}`.quiet();
    return result.stdout.toString().trim();
  } catch {
    return null;
  }
}

async function question(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  for await (const line of console) {
    return line.trim();
  }
  return '';
}

function getCurrentVersion(): string {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  return packageJson.version;
}

function updateVersion(newVersion: string): void {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

function bumpVersion(currentVersion: string, type: BumpType): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function validateVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

async function main() {
  console.log('🚀 Starting release process...\n');

  // Check if we're on main branch
  const currentBranch = await execOutput('git branch --show-current');
  if (currentBranch !== 'main') {
    console.log(`⚠️  Warning: You're on branch '${currentBranch}', not 'main'`);
    const proceed = await question('Do you want to continue anyway? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Release cancelled');
      process.exit(0);
    }
  }

  // Check if working directory is clean
  const gitStatus = await execOutput('git status --porcelain');
  if (gitStatus) {
    console.error(
      '❌ Working directory is not clean. Please commit or stash your changes.',
    );
    process.exit(1);
  }

  // Get current version
  const currentVersion = getCurrentVersion();
  console.log(`📦 Current version: ${currentVersion}\n`);

  // Determine new version
  let newVersion: string;
  const arg = process.argv[2];

  if (arg) {
    if (['major', 'minor', 'patch'].includes(arg)) {
      newVersion = bumpVersion(currentVersion, arg as BumpType);
      console.log(
        `📈 Bumping ${arg} version: ${currentVersion} → ${newVersion}\n`,
      );
    } else if (validateVersion(arg)) {
      newVersion = arg;
      console.log(`📝 Using provided version: ${newVersion}\n`);
    } else {
      console.error(
        '❌ Invalid version format. Use: X.Y.Z, major, minor, or patch',
      );
      process.exit(1);
    }
  } else {
    // Interactive mode
    console.log('Select version bump type:');
    console.log(`  1) patch  → ${bumpVersion(currentVersion, 'patch')}`);
    console.log(`  2) minor  → ${bumpVersion(currentVersion, 'minor')}`);
    console.log(`  3) major  → ${bumpVersion(currentVersion, 'major')}`);
    console.log(`  4) custom → enter manually\n`);

    const choice = await question('Your choice (1-4): ');

    switch (choice.trim()) {
      case '1':
        newVersion = bumpVersion(currentVersion, 'patch');
        break;
      case '2':
        newVersion = bumpVersion(currentVersion, 'minor');
        break;
      case '3':
        newVersion = bumpVersion(currentVersion, 'major');
        break;
      case '4':
        const custom = await question('Enter version (X.Y.Z): ');
        if (!validateVersion(custom.trim())) {
          console.error('❌ Invalid version format');
          process.exit(1);
        }
        newVersion = custom.trim();
        break;
      default:
        console.error('❌ Invalid choice');
        process.exit(1);
    }
  }

  // Confirm
  console.log(`\n🎯 About to release version ${newVersion}`);
  const confirm = await question('Continue? (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    console.log('❌ Release cancelled');
    process.exit(0);
  }

  console.log('\n📝 Updating package.json...');
  updateVersion(newVersion);

  console.log('🔨 Running build and checks...');
  await execVisible('bun run build');
  await execVisible('bun lint');
  await execVisible('bun typecheck');

  console.log('\n📦 Committing version bump...');
  await exec('git add package.json');
  await exec(`git commit -m "Release v${newVersion}"`);

  console.log('🏷️  Creating git tag...');
  await exec(`git tag v${newVersion}`);

  console.log('⬆️  Pushing to remote...');
  await exec(`git push origin ${currentBranch}`);
  await exec(`git push origin v${newVersion}`);

  console.log('📤 Publishing to npm with bun...');
  await execVisible('bun publish --access public');

  console.log(`\n✅ Successfully released v${newVersion}!`);
  console.log(
    `\n📦 Package: https://www.npmjs.com/package/@desplega.ai/qa-use-mcp`,
  );
  console.log(
    `🏷️  Tag: https://github.com/desplega-ai/qa-use/releases/tag/v${newVersion}`,
  );
  console.log(`\n💡 Don't forget to create a GitHub release with release notes!`);
}

main().catch((error) => {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
});
