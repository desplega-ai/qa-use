import localtunnel from 'localtunnel';
import { URL } from 'url';
import https from 'https';

export interface TunnelSession {
  tunnel: localtunnel.Tunnel;
  publicUrl: string;
  localPort: number;
  isActive: boolean;
}

export interface TunnelOptions {
  subdomain?: string;
  localHost?: string;
}

export class TunnelManager {
  private session: TunnelSession | null = null;

  async startTunnel(port: number, options: TunnelOptions = {}): Promise<TunnelSession> {
    if (this.session) {
      throw new Error('Tunnel session already active');
    }

    const tunnel = await localtunnel({
      port,
      subdomain: options.subdomain || `qa-use-${Date.now().toString().slice(-6)}`,
      local_host: options.localHost || 'localhost',
    });

    this.session = {
      tunnel,
      publicUrl: tunnel.url,
      localPort: port,
      isActive: true,
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
      session.tunnel.close();
    } catch (error) {
      // Silently handle cleanup errors
    }
  }

  getSession(): TunnelSession | null {
    return this.session;
  }

  isActive(): boolean {
    return this.session?.isActive ?? false;
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
      return (
        this.session.publicUrl.replace('https://', 'wss://').replace('http://', 'ws://') + wsPath
      );
    } catch (error) {
      return null;
    }
  }
}
