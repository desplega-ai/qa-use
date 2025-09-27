import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.qa-use');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface Config {
  apiKey?: string;
  defaultUrl?: string;
  appUrl?: string;
  forwarderLogging?: boolean;
}

export class ConfigService {
  private config: Config = {};

  constructor() {
    this.load();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        this.config = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load config file, using defaults');
      this.config = {};
    }
  }

  private save(): void {
    try {
      this.ensureConfigDir();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save config file:', error);
    }
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.save();
  }

  getAll(): Config {
    return { ...this.config };
  }

  reset(): void {
    this.config = {};
    this.save();
  }

  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  setApiKey(apiKey: string): void {
    this.set('apiKey', apiKey);
  }

  getDefaultUrl(): string | undefined {
    return this.config.defaultUrl;
  }

  setDefaultUrl(url: string): void {
    this.set('defaultUrl', url);
  }

  getAppUrl(): string {
    return this.config.appUrl || process.env.APP_URL || 'https://app.desplega.ai';
  }

  setAppUrl(url: string): void {
    this.set('appUrl', url);
  }

  isForwarderLoggingEnabled(): boolean {
    return this.config.forwarderLogging ?? false;
  }

  setForwarderLogging(enabled: boolean): void {
    this.set('forwarderLogging', enabled);
  }
}
