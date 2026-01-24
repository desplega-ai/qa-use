# Localhost Testing

Testing applications running on `localhost` requires a tunnel because the cloud-hosted browser cannot access your local machine.

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

## Using `--tunnel` Flag

The simplest approach - add `--tunnel` to your test run command:

```bash
qa-use test run my-test --tunnel
```

This:
1. Starts a local headless browser
2. Creates a tunnel for API control
3. Runs the test
4. Cleans up automatically

### With Visible Browser

For debugging, add `--headful`:

```bash
qa-use test run my-test --tunnel --headful
```

## Persistent Tunnel Session

For running multiple tests or interactive development, create a persistent tunnel session:

### Terminal 1: Start Tunnel

```bash
qa-use browser create --tunnel --no-headless
```

Output:
```
Session created: abc123
WebSocket URL: wss://tunnel.desplega.ai/abc123
Tunnel active. Press Ctrl+C to stop.
```

### Terminal 2: Run Tests

```bash
# Run test against the tunneled browser
qa-use test run my-test --ws-url wss://tunnel.desplega.ai/abc123

# Or run multiple tests
qa-use test run login --ws-url wss://tunnel.desplega.ai/abc123
qa-use test run checkout --ws-url wss://tunnel.desplega.ai/abc123
```

### Benefits

- **Reuse browser session** - no startup time between tests
- **Watch execution** - see what's happening in real-time
- **Debug interactively** - use browser commands between test runs
- **Inspect state** - check page state after failures

## Browser Session Commands with Tunnel

You can also use browser commands directly for exploration:

```bash
# Create tunneled session
qa-use browser create --tunnel --no-headless

# Navigate to your local app
qa-use browser goto http://localhost:3000

# Explore
qa-use browser snapshot
qa-use browser click e3
qa-use browser screenshot

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
# Local development
qa-use test run my-test --tunnel --var base_url=http://localhost:3000

# Staging
qa-use test run my-test --var base_url=https://staging.example.com
```

## Common Issues

### "Connection refused" / "Network error"

Your local server isn't running or is on a different port.

**Fix:** Verify your app is running:
```bash
curl http://localhost:3000
```

### Tunnel disconnects

The tunnel process was interrupted.

**Fix:** Restart the tunnel:
```bash
qa-use browser create --tunnel
```

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

## Best Practices

1. **Use `--tunnel` for all localhost tests** - Don't forget, or tests will fail with confusing network errors

2. **Keep tunnel running during development** - Create once, run many tests

3. **Use `--no-headless` for debugging** - Watch what's happening

4. **Save WebSocket URL** - Copy it from tunnel output for reuse in `--ws-url`

5. **Clean up sessions** - Run `qa-use browser close` when done to free resources
