import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from './config.js';

const ENV_KEYS = [
  'QA_USE_HEADERS',
  'QA_USE_API_KEY',
  'QA_USE_API_URL',
  'QA_USE_DEFAULT_APP_CONFIG_ID',
  'HOME',
];

describe('loadConfig — header precedence', () => {
  let originalCwd: string;
  let savedEnv: Record<string, string | undefined>;
  let cwdDir: string;
  let homeDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    cwdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-cfg-cwd-'));
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-cfg-home-'));
    process.chdir(cwdDir);
    process.env.HOME = homeDir;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(cwdDir, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  const writeConfig = (headers: Record<string, string>) => {
    fs.writeFileSync(path.join(cwdDir, '.qa-use.json'), JSON.stringify({ headers }), 'utf-8');
  };

  it('config-file header overrides env on key conflict', async () => {
    writeConfig({ 'X-Argus-Created-By': 'file' });
    process.env.QA_USE_HEADERS = JSON.stringify({ 'X-Argus-Created-By': 'env' });

    const config = await loadConfig();

    expect(config.headers?.['X-Argus-Created-By']).toBe('file');
  });

  it('env contributes non-conflicting header keys', async () => {
    writeConfig({ 'X-From-File': 'file-value' });
    process.env.QA_USE_HEADERS = JSON.stringify({ 'X-From-Env': 'env-value' });

    const config = await loadConfig();

    expect(config.headers).toEqual({
      'X-From-Env': 'env-value',
      'X-From-File': 'file-value',
    });
  });

  it('env-only headers still apply when no file headers are set', async () => {
    process.env.QA_USE_HEADERS = JSON.stringify({ 'X-Only-Env': 'env-value' });

    const config = await loadConfig();

    expect(config.headers).toEqual({ 'X-Only-Env': 'env-value' });
  });

  it('invalid JSON in QA_USE_HEADERS is ignored, file headers still apply', async () => {
    writeConfig({ 'X-From-File': 'file-value' });
    process.env.QA_USE_HEADERS = 'not-json{';

    const config = await loadConfig();

    expect(config.headers).toEqual({ 'X-From-File': 'file-value' });
  });
});
