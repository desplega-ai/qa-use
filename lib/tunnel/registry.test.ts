import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TunnelQuotaError } from './errors.js';
import type { TunnelManager, TunnelSession } from './index.js';
import {
  canonicalTarget,
  type TunnelManagerFactory,
  TunnelRegistry,
  targetHash,
} from './registry.js';

function writeRecord(
  dir: string,
  record: {
    id: string;
    target: string;
    publicUrl: string;
    pid: number;
    refcount: number;
    ttlExpiresAt: number | null;
    startedAt: number;
  }
): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${record.id}.json`);
  fs.writeFileSync(file, JSON.stringify(record));
  return file;
}

/**
 * Minimal in-memory fake of `TunnelManager` for registry tests. We
 * intentionally avoid mocking the real `TunnelManager` module because
 * the registry ONLY needs `startTunnel` and `stopTunnel` to function.
 */
function makeFakeManagerFactory(publicUrlPrefix = 'https://fake-tunnel'): {
  factory: TunnelManagerFactory;
  stopCalls: { count: number };
} {
  const stopCalls = { count: 0 };
  let seq = 0;
  const factory: TunnelManagerFactory = () => {
    const id = ++seq;
    const fakeTunnel = {
      url: `${publicUrlPrefix}-${id}.example.com`,
      on: () => {},
      close: async () => {},
    } as unknown as TunnelSession['tunnel'];

    const session: TunnelSession = {
      tunnel: fakeTunnel,
      publicUrl: `${publicUrlPrefix}-${id}.example.com`,
      localPort: 0,
      isActive: true,
      host: 'fake',
      region: 'auto',
    };
    const fake = {
      startTunnel: async (port: number) => {
        session.localPort = port;
        return session;
      },
      stopTunnel: async () => {
        stopCalls.count += 1;
      },
      getSession: () => session,
      isActive: () => true,
      checkHealth: async () => true,
      getPublicUrl: () => session.publicUrl,
      getWebSocketUrl: () => null,
      getPublicIP: async () => '127.0.0.1',
    };
    return fake as unknown as TunnelManager;
  };
  return { factory, stopCalls };
}

describe('canonicalTarget', () => {
  it('lowercases host and strips path/query', () => {
    expect(canonicalTarget('http://Localhost:3000/foo?bar=1')).toBe('http://localhost:3000');
  });

  it('treats differing paths as the same target', () => {
    expect(canonicalTarget('http://localhost:3000/a')).toBe(
      canonicalTarget('http://localhost:3000/b')
    );
  });

  it('returns raw string on invalid URL', () => {
    expect(canonicalTarget('not-a-url')).toBe('not-a-url');
  });
});

describe('targetHash', () => {
  it('is stable across invocations', () => {
    expect(targetHash('http://localhost:3000')).toBe(targetHash('http://LOCALHOST:3000/x'));
  });

  it('returns a 10-char hex prefix', () => {
    expect(targetHash('http://localhost:3000')).toMatch(/^[a-f0-9]{10}$/);
  });
});

describe('TunnelRegistry', () => {
  let tmpHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-use-registry-'));
    originalHome = process.env.QA_USE_HOME;
    process.env.QA_USE_HOME = tmpHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.QA_USE_HOME;
    } else {
      process.env.QA_USE_HOME = originalHome;
    }
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('acquire starts a tunnel and persists a registry file', async () => {
    const { factory } = makeFakeManagerFactory();
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 50 });

    const handle = await registry.acquire('http://localhost:3000');
    expect(handle.publicUrl).toContain('fake-tunnel');
    expect(handle.refcount).toBe(1);

    const file = path.join(tmpHome, 'tunnels', `${handle.id}.json`);
    expect(fs.existsSync(file)).toBe(true);
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(stored.target).toBe('http://localhost:3000');
    expect(stored.refcount).toBe(1);
  });

  it('two acquires for the same target share one tunnel (refcount=2)', async () => {
    const { factory } = makeFakeManagerFactory();
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 50 });

    const a = await registry.acquire('http://localhost:3000');
    const b = await registry.acquire('http://localhost:3000');

    expect(a.publicUrl).toBe(b.publicUrl);
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].refcount).toBe(2);
  });

  it('release decrements refcount without tearing down when others hold', async () => {
    const { factory, stopCalls } = makeFakeManagerFactory();
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 50 });

    const a = await registry.acquire('http://localhost:3000');
    const b = await registry.acquire('http://localhost:3000');
    await registry.release(a);

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].refcount).toBe(1);
    expect(stopCalls.count).toBe(0);

    await registry.release(b);
  });

  it('last release tears down after the grace window', async () => {
    const { factory, stopCalls } = makeFakeManagerFactory();
    const GRACE = 30;
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: GRACE });

    const h = await registry.acquire('http://localhost:3000');
    await registry.release(h);

    // During grace, the entry is still there with refcount 0 + ttl set.
    const mid = registry.list();
    expect(mid).toHaveLength(1);
    expect(mid[0].refcount).toBe(0);
    expect(mid[0].ttlExpiresAt).toBeGreaterThan(Date.now());

    // Wait for grace to elapse.
    await new Promise((r) => setTimeout(r, GRACE + 30));

    expect(stopCalls.count).toBe(1);
    expect(registry.list()).toHaveLength(0);
  });

  it('acquire within grace window cancels tear-down', async () => {
    const { factory, stopCalls } = makeFakeManagerFactory();
    const GRACE = 60;
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: GRACE });

    const a = await registry.acquire('http://localhost:3000');
    await registry.release(a);

    // Re-acquire before grace elapses.
    await new Promise((r) => setTimeout(r, 10));
    const b = await registry.acquire('http://localhost:3000');
    expect(b.publicUrl).toBe(a.publicUrl);

    // Wait past the original grace window.
    await new Promise((r) => setTimeout(r, GRACE + 30));

    expect(stopCalls.count).toBe(0);
    expect(registry.list()).toHaveLength(1);

    await registry.release(b);
  });

  it('list reconciles stale PID file (dead pid)', async () => {
    // Seed a file with a bogus pid directly.
    const dir = path.join(tmpHome, 'tunnels');
    fs.mkdirSync(dir, { recursive: true });
    const record = {
      id: 'abcdef1234',
      target: 'http://localhost:9999',
      publicUrl: 'https://stale.example.com',
      pid: 99999999, // almost certainly not a real pid
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    };
    fs.writeFileSync(path.join(dir, `${record.id}.json`), JSON.stringify(record));

    const { factory } = makeFakeManagerFactory();
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 30 });

    const list = registry.list();
    expect(list).toHaveLength(0);
    expect(fs.existsSync(path.join(dir, `${record.id}.json`))).toBe(false);
  });

  it('acquire beyond the concurrency cap throws TunnelQuotaError', async () => {
    // Seed 10 fake-but-alive records (owned by this process pid).
    const dir = path.join(tmpHome, 'tunnels');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 10; i++) {
      const id = `cap${i.toString().padStart(7, '0')}`;
      const record = {
        id,
        target: `http://localhost:${4000 + i}`,
        publicUrl: `https://cap-${i}.example.com`,
        pid: process.pid,
        refcount: 1,
        ttlExpiresAt: null,
        startedAt: Date.now(),
      };
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(record));
    }

    const { factory } = makeFakeManagerFactory();
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 30 });

    await expect(registry.acquire('http://localhost:5999')).rejects.toBeInstanceOf(
      TunnelQuotaError
    );
  });

  it('forceClose tears down regardless of refcount', async () => {
    const { factory, stopCalls } = makeFakeManagerFactory();
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 30 });

    const h = await registry.acquire('http://localhost:3000');
    expect(registry.list()).toHaveLength(1);

    await registry.forceClose(h.target);
    expect(stopCalls.count).toBe(1);
    expect(registry.list()).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Cross-process coordination (foreign owner simulated via file seed)
  // -------------------------------------------------------------------

  it('attaches to a foreign-owner record instead of starting a new tunnel', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const target = 'http://localhost:3000';
    const hash = targetHash(target);
    const canon = canonicalTarget(target);
    // Seed a record owned by the parent process (ppid) — guaranteed
    // alive for the duration of this test process, and distinct from
    // our own pid so the registry treats it as a foreign owner.
    const foreignPid = process.ppid;
    expect(foreignPid).not.toBe(process.pid);
    writeRecord(dir, {
      id: hash,
      target: canon,
      publicUrl: 'https://attached-tunnel.example.com',
      pid: foreignPid,
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now(),
    });

    const { factory, stopCalls } = makeFakeManagerFactory('https://new-tunnel');
    let started = 0;
    const countingFactory: TunnelManagerFactory = () => {
      started += 1;
      return factory();
    };
    const registry = new TunnelRegistry({ managerFactory: countingFactory, graceMs: 30 });

    const handle = await registry.acquire(target);
    expect(handle.isCrossProcessAttach).toBe(true);
    expect(handle.publicUrl).toBe('https://attached-tunnel.example.com');
    expect(handle.refcount).toBe(2);
    expect(started).toBe(0); // No new tunnel was started.
    expect(stopCalls.count).toBe(0);

    // Release should decrement the on-disk refcount but NOT tear down
    // (we are not the owner of the in-memory manager).
    await registry.release(handle);
    const raw = JSON.parse(fs.readFileSync(path.join(dir, `${hash}.json`), 'utf8'));
    expect(raw.refcount).toBe(1);
    // Attach release with final refcount > 0 MUST NOT set a grace TTL
    // (there is still a holder).
    expect(raw.ttlExpiresAt).toBeNull();
  });

  it('reaps stale record with dead owner pid and starts a fresh tunnel', async () => {
    const dir = path.join(tmpHome, 'tunnels');
    const target = 'http://localhost:3000';
    const hash = targetHash(target);
    const canon = canonicalTarget(target);
    writeRecord(dir, {
      id: hash,
      target: canon,
      publicUrl: 'https://stale.example.com',
      pid: 99999999, // almost certainly not a real pid
      refcount: 1,
      ttlExpiresAt: null,
      startedAt: Date.now() - 60_000,
    });

    const { factory } = makeFakeManagerFactory('https://fresh');
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 30 });

    const handle = await registry.acquire(target);
    expect(handle.isCrossProcessAttach).toBe(false);
    expect(handle.publicUrl).toContain('fresh');
    expect(handle.refcount).toBe(1);
    // The record on disk should be rewritten with the current pid.
    const raw = JSON.parse(fs.readFileSync(path.join(dir, `${hash}.json`), 'utf8'));
    expect(raw.pid).toBe(process.pid);
    expect(raw.publicUrl).toContain('fresh');

    await registry.release(handle);
  });

  it('owner release sets ttlExpiresAt on disk during the grace window', async () => {
    const { factory } = makeFakeManagerFactory();
    const GRACE = 120;
    const registry = new TunnelRegistry({ managerFactory: factory, graceMs: GRACE });

    const handle = await registry.acquire('http://localhost:3000');
    await registry.release(handle);

    const file = path.join(tmpHome, 'tunnels', `${handle.id}.json`);
    const during = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(during.refcount).toBe(0);
    expect(during.ttlExpiresAt).not.toBeNull();
    expect(during.ttlExpiresAt).toBeGreaterThan(Date.now());
    expect(during.ttlExpiresAt).toBeLessThanOrEqual(Date.now() + GRACE + 20);

    // Wait out the grace window.
    await new Promise((r) => setTimeout(r, GRACE + 60));
    expect(fs.existsSync(file)).toBe(false);
    expect(registry.list()).toHaveLength(0);
  });

  it('honours QA_USE_TUNNEL_GRACE_MS env override', async () => {
    const prev = process.env.QA_USE_TUNNEL_GRACE_MS;
    process.env.QA_USE_TUNNEL_GRACE_MS = '75';
    try {
      const { factory, stopCalls } = makeFakeManagerFactory();
      // Pass a HUGE graceMs but expect the env var to override.
      const registry = new TunnelRegistry({ managerFactory: factory, graceMs: 10_000 });
      const handle = await registry.acquire('http://localhost:3000');
      await registry.release(handle);
      // Should tear down in ~75ms.
      await new Promise((r) => setTimeout(r, 150));
      expect(stopCalls.count).toBe(1);
      expect(registry.list()).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.QA_USE_TUNNEL_GRACE_MS;
      else process.env.QA_USE_TUNNEL_GRACE_MS = prev;
    }
  });

  it('race resolution on concurrent acquires: at most one tunnel survives', async () => {
    // Two parallel acquires for the SAME target. Because `startTunnel`
    // cannot be held under the lockfile (it can take seconds in real
    // use), both may start provider tunnels; the race-resolution inside
    // the post-start lock keeps exactly one and `stopTunnel`s the other.
    // Observable contract: one record on disk, refcount=2, both handles
    // share the same publicUrl.
    const { factory, stopCalls } = makeFakeManagerFactory();
    let started = 0;
    const countingFactory: TunnelManagerFactory = () => {
      started += 1;
      return factory();
    };
    const registry = new TunnelRegistry({ managerFactory: countingFactory, graceMs: 50 });

    const [a, b] = await Promise.all([
      registry.acquire('http://localhost:3000'),
      registry.acquire('http://localhost:3000'),
    ]);

    expect(started).toBeLessThanOrEqual(2);
    expect(a.publicUrl).toBe(b.publicUrl);
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].refcount).toBe(2);
    // If two were started, exactly one must have been stopped as the
    // race loser.
    if (started === 2) expect(stopCalls.count).toBe(1);
  });
});
