# Localhost Testing

**When your base URL is localhost and your API is remote, qa-use auto-tunnels. No flag required.**

Testing applications running on `localhost` usually requires a tunnel because the cloud-hosted browser cannot reach your local machine. qa-use detects this automatically — the tri-state `--tunnel` flag only needs to be set for the edge cases.

## Why Tunnels Are Needed

```
Your Machine                    Cloud
┌─────────────────┐            ┌─────────────────┐
│ localhost:3000  │     ✗      │ Cloud Browser   │
│ (your app)      │ ◄──────────│ (qa-use API)    │
└─────────────────┘            └─────────────────┘

Without tunnel: Cloud cannot reach localhost
```

```
Your Machine                    Cloud
┌─────────────────┐            ┌─────────────────┐
│ localhost:3000  │            │ Cloud Browser   │
│ (your app)      │            │ (qa-use API)    │
└────────┬────────┘            └────────┬────────┘
         │                              │
         └──────────┐    ┌──────────────┘
                    │    │
              ┌─────▼────▼─────┐
              │  Local Browser │
              │   + Tunnel     │
              └────────────────┘

With tunnel: Local browser accesses localhost,
             API controls browser through tunnel
```

## Auto-Tunnel (Default)

For the common case — your app on `http://localhost:3000`, your API at `https://api.desplega.ai` — you don't need to pass any flag:

```bash
# Base URL is localhost, API is remote → qa-use auto-tunnels
qa-use browser create --no-headless http://localhost:3000
qa-use test run my-test
```

This:
1. Starts a local browser (Playwright)
2. Creates a tunnel for API control
3. Runs your commands/tests
4. Cleans up automatically when the session closes

## Tri-State `--tunnel` Flag

Use `--tunnel` only when you need to override the auto-decision:

| Flag form | Mode | When to use |
|-----------|------|-------------|
| _(none)_ | `auto` | Default. Tunnel iff localhost base + remote API. |
| `--tunnel` / `--tunnel on` | `on` | Force a tunnel — e.g. dev mode where both API and app are local. |
| `--no-tunnel` / `--tunnel off` | `off` | Never tunnel — e.g. both sides are on your machine and you want the cloud browser to stay out of it. |
| `--tunnel auto` | `auto` | Explicit form (same as omitting). |

You can also pin a project-wide default in `~/.qa-use.json`:

```json
{
  "tunnel": "on"
}
```

CLI flag beats config; config beats the `auto` default.

### With Visible Browser

For debugging, add `--no-headless`:

```bash
qa-use browser create --no-headless http://localhost:3000
qa-use test run my-test --no-headless
```

## Holding a Tunnel Outside a Browser Session

If you just need a public URL (for webhook testing, sharing a dev build with a remote backend, etc.) without spinning up a browser session, use `qa-use tunnel`:

```bash
# Acquire and hold a public tunnel to localhost:3000 until Ctrl+C
qa-use tunnel start http://localhost:3000 --hold

# From another shell, inspect the registry
qa-use tunnel ls
qa-use tunnel status http://localhost:3000
```

The tunnel registry refcounts — if a `browser create` session and `tunnel start --hold` point at the same target, they share one tunnel and the tunnel stays up as long as either holder exists.

## Browser Session Commands with Localhost

Detached `browser create` returns immediately — the browser + tunnel run in a background child. Your terminal is free for the next command:

```bash
# Create session — returns in < 3s, background child holds the browser
qa-use browser create --no-headless http://localhost:3000

# Explore
qa-use browser snapshot
qa-use browser click e3
qa-use browser screenshot

# List all active sessions (across processes)
qa-use browser status --list

# Close when done
qa-use browser close
```

## Environment-Specific URLs

If your app runs on different ports in different environments, use variables:

```yaml
# test.yaml
name: Local Test
app_config: my-app
variables:
  base_url: http://localhost:3000
steps:
  - action: goto
    url: $base_url/login
```

Override at runtime:

```bash
# Local development — auto-tunnels
qa-use test run my-test --var base_url=http://localhost:3000

# Staging — no tunnel
qa-use test run my-test --var base_url=https://staging.example.com
```

## Cleaning Up Stale State

Detached sessions persist PID + registry files in `~/.qa-use/`. If a child crashes or is killed with `SIGKILL`, stale entries can linger. Reap them with:

```bash
qa-use doctor             # Reap stale sessions + tunnels (dead PIDs)
qa-use doctor --dry-run   # Preview what would be cleaned
```

A bounded startup sweep also runs silently on every CLI invocation, so most stale state is cleaned opportunistically — `doctor` is the explicit escape hatch when you want to see and audit the reaping.

## Common Issues

### "Connection refused" / "Network error"

Your local server isn't running or is on a different port.

**Fix:** Verify your app is running:
```bash
curl http://localhost:3000
```

### Tunnel disconnects

The tunnel process was interrupted.

**Fix:** Re-run the command — `browser create` will acquire a fresh tunnel. If stale registry entries remain, run `qa-use doctor`.

### "localhost" resolved differently

Some setups resolve `localhost` differently than `127.0.0.1`.

**Fix:** Try the explicit IP:
```bash
qa-use browser goto http://127.0.0.1:3000
```

### HTTPS localhost with self-signed cert

Local HTTPS with self-signed certificates may fail.

**Fix:** Use HTTP for local testing, or configure your browser to accept the cert:
```bash
# Use HTTP locally
qa-use browser goto http://localhost:3000

# Test HTTPS only in staging/prod environments
```

### Tunnel errors have triage hints

Structured tunnel errors (`TunnelNetworkError`, `TunnelAuthError`, `TunnelQuotaError`, `TunnelUnknownError`) print a `Next steps:` block with the `--no-tunnel` opt-out and other recovery hints. No silent retries — failures surface immediately.

## Best Practices

1. **Trust auto-mode** — Don't pass `--tunnel` unless you're overriding the default.

2. **Use `--tunnel on` in pure-local dev** — When both your API and app are on localhost, auto-mode skips the tunnel; add `--tunnel on` if the cloud still needs to reach you.

3. **Use `--no-headless` for debugging** — Watch what's happening.

4. **`qa-use tunnel start --hold` for shared public URLs** — When a tunnel needs to outlive any single command.

5. **`qa-use doctor` if state feels stale** — Fast, safe, and `--dry-run` previews the plan.

---

> **Runtime access:** `qa-use docs localhost-testing` | All topics: `qa-use docs --list`
