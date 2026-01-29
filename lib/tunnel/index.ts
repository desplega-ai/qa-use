import crypto from 'node:crypto';
import https from 'node:https';
import { URL } from 'node:url';
import localtunnel from '@desplega.ai/localtunnel';
import { getEnv } from '../env/index.js';

export interface TunnelSession {
  tunnel: localtunnel.Tunnel;
  publicUrl: string;
  localPort: number;
  isActive: boolean;
  host: string;
  region: string;
}

export interface TunnelOptions {
  subdomain?: string;
  localHost?: string;
  apiKey?: string;
  sessionIndex?: number;
}

export class TunnelManager {
  private session: TunnelSession | null = null;
  private readonly defaultRegion: string = 'auto';

  /**
   * Generate a deterministic subdomain based on API key and session index
   * @param apiKey - The API key to hash
   * @param sessionIndex - Index from 0-9 for concurrent sessions
   * @returns Deterministic subdomain in format: qa-use-{hash}-{index}
   */
  static generateDeterministicSubdomain(apiKey: string, sessionIndex: number): string {
    // Hash the API key using SHA-256
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Take first 6 characters of hash for brevity
    const shortHash = hash.substring(0, 6);

    // Ensure sessionIndex is within valid range (0-9)
    const validIndex = Math.max(0, Math.min(9, sessionIndex));

    return `qa-use-${shortHash}-${validIndex}`;
  }

  async startTunnel(port: number, options: TunnelOptions = {}): Promise<TunnelSession> {
    if (this.session) {
      throw new Error('Tunnel session already active');
    }

    const region = getEnv('QA_USE_REGION') || this.defaultRegion;
    let host = getEnv('TUNNEL_HOST');

    if (!host) {
      // If no manual override, determine host based on region
      if (region === 'us') {
        host = 'https://lt.us.desplega.ai';
      } else {
        // Default for 'auto' or unset
        host = 'https://lt.desplega.ai';
      }
    }

    // Determine subdomain: custom > deterministic > random
    let subdomain = options.subdomain;
    if (!subdomain && options.apiKey !== undefined && options.sessionIndex !== undefined) {
      // Use deterministic subdomain based on API key and session index
      subdomain = TunnelManager.generateDeterministicSubdomain(
        options.apiKey,
        options.sessionIndex
      );
      console.log(`Using deterministic subdomain: ${subdomain}`);
    } else if (!subdomain) {
      // Fallback to timestamp-based random subdomain
      subdomain = `qa-use-${Date.now().toString().slice(-6)}`;
      console.log(`Using random subdomain: ${subdomain}`);
    }

    console.log(`Starting tunnel on port ${port} with host ${host} in region ${region}`);

    const tunnel = await localtunnel({
      port,
      host,
      subdomain,
      local_host: options.localHost || 'localhost',
      auth: true,
    });

    console.log(`Tunnel started at ${tunnel.url}`);

    this.session = {
      tunnel,
      publicUrl: tunnel.url,
      localPort: port,
      isActive: true,
      host,
      region,
    };

    // Handle tunnel events
    tunnel.on('close', () => {
      if (this.session) {
        this.session.isActive = false;
      }
    });

    tunnel.on('error', (err: Error) => {
      if (this.session) {
        this.session.isActive = false;
      }
      throw err;
    });

    return this.session;
  }

  async stopTunnel(): Promise<void> {
    if (!this.session) {
      return;
    }

    const session = this.session;
    this.session = null;

    try {
      await session.tunnel.close();
    } catch {
      // Silently handle cleanup errors
    }
  }

  getSession(): TunnelSession | null {
    return this.session;
  }

  isActive(): boolean {
    return this.session?.isActive ?? false;
  }

  /**
   * Check if tunnel is actually alive by pinging the public URL
   */
  async checkHealth(): Promise<boolean> {
    if (!this.session) return false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.session.publicUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      // 426 = Upgrade Required (expected for WebSocket endpoint)
      return response.ok || response.status === 426;
    } catch {
      this.session.isActive = false;
      return false;
    }
  }

  getPublicUrl(): string | null {
    return this.session?.publicUrl ?? null;
  }

  async getPublicIP(): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get('https://api.ipify.org', (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data.trim()));
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  getWebSocketUrl(originalWsEndpoint: string): string | null {
    if (!this.session) return null;

    try {
      const localWsUrl = new URL(originalWsEndpoint);
      const wsPath = localWsUrl.pathname;

      // Convert HTTP/HTTPS URLs to WebSocket URLs (ws/wss)
      return (
        this.session.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath
      );
    } catch {
      return null;
    }
  }
}
