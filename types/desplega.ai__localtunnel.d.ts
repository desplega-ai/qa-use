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

    interface RequestInfo {
      method: string;
      path: string;
    }

    interface Tunnel extends EventEmitter {
      url: string;
      cachedUrl?: string;
      tunnelCluster: unknown;
      clientId?: string;
      opts: TunnelOptions;
      closed: boolean;
      open(cb: (err?: Error) => void): void;
      close(): Promise<void>;

      // Event emitter overrides for better typing
      on(event: 'url', listener: (url: string) => void): this;
      on(event: 'error', listener: (err: Error) => void): this;
      on(event: 'close', listener: () => void): this;
      on(event: 'request', listener: (info: RequestInfo) => void): this;
      on(event: string | symbol, listener: (...args: any[]) => void): this;

      once(event: 'url', listener: (url: string) => void): this;
      once(event: 'error', listener: (err: Error) => void): this;
      once(event: 'close', listener: () => void): this;
      once(event: 'request', listener: (info: RequestInfo) => void): this;
      once(event: string | symbol, listener: (...args: any[]) => void): this;

      emit(event: 'url', url: string): boolean;
      emit(event: 'error', err: Error): boolean;
      emit(event: 'close'): boolean;
      emit(event: 'request', info: RequestInfo): boolean;
      emit(event: string | symbol, ...args: any[]): boolean;
    }
  }

  // Promise-based signature
  function localtunnel(
    options: localtunnel.TunnelOptions
  ): Promise<localtunnel.Tunnel>;

  // Callback-based signature
  function localtunnel(
    options: localtunnel.TunnelOptions,
    callback: (err: Error | null, tunnel?: localtunnel.Tunnel) => void
  ): localtunnel.Tunnel;

  // Convenience signature with port as first argument
  function localtunnel(
    port: number,
    options?: Omit<localtunnel.TunnelOptions, 'port'>,
    callback?: (err: Error | null, tunnel?: localtunnel.Tunnel) => void
  ): Promise<localtunnel.Tunnel> | localtunnel.Tunnel;

  export = localtunnel;
}
