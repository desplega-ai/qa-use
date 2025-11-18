declare module '@desplega.ai/localtunnel' {
  import { EventEmitter } from 'events';

  namespace localtunnel {
    interface TunnelOptions {
      port: number;
      subdomain?: string;
      host?: string;
      auth?: boolean | string;
      local_host?: string;
      local_https?: boolean;
      local_cert?: string;
      local_key?: string;
      local_ca?: string;
      allow_invalid_cert?: boolean;
    }

    interface Tunnel extends EventEmitter {
      url: string;
      cachedUrl?: string;
      tunnelCluster: unknown;
      clientId?: string;
      opts: TunnelOptions;
      closed: boolean;
      open(cb: (err?: Error) => void): void;
      close(): void;
    }
  }

  function localtunnel(
    options: localtunnel.TunnelOptions
  ): Promise<localtunnel.Tunnel>;

  export = localtunnel;
}
