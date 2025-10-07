# Vercel Deployment Guide

This guide explains how to deploy the QA-Use MCP server to Vercel using serverless functions.

## ⚠️ Important Limitations

Vercel has execution time limits that may affect long-running MCP sessions:

- **Hobby plan**: 10 seconds (not recommended for SSE)
- **Pro plan**: 60 seconds max for streaming responses
- **Enterprise plan**: Custom limits

**SSE (Server-Sent Events) considerations:**
- SSE connections can stay open for up to 60 seconds on Pro plan
- After timeout, the connection will be closed
- For long-running QA sessions, consider alternatives like:
  - **Railway** - Better for long-running processes
  - **Render** - Supports long-running services
  - **Fly.io** - Full control over process lifecycle
  - **DigitalOcean App Platform** - Good for persistent connections
  - **Self-hosted VPS** - No limits

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/desplega-ai/qa-use)

## Manual Deployment Steps

### 1. Prerequisites

- Vercel account
- Vercel CLI installed: `npm i -g vercel`
- desplega.ai API key

### 2. Configuration

The repository already includes:
- `vercel.json` - Vercel configuration
- `api/mcp.ts` - Serverless function handler

### 3. Set Environment Variables

```bash
# Using Vercel CLI
vercel env add QA_USE_API_KEY

# Or in Vercel Dashboard:
# Project Settings > Environment Variables
# Add: QA_USE_API_KEY = your-api-key
```

### 4. Deploy

```bash
# Install dependencies
pnpm install

# Deploy to production
vercel --prod
```

## Build Configuration

When deploying through Vercel dashboard:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Other |
| **Build Command** | `pnpm build` |
| **Output Directory** | `dist` |
| **Install Command** | `pnpm install` |

## Testing Your Deployment

Once deployed, you can test your Vercel endpoint:

```bash
# Health check
curl https://your-project.vercel.app/health

# MCP endpoint with authentication
curl -N -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-project.vercel.app/mcp
```

## API Endpoints

Your Vercel deployment will have these endpoints:

- `GET /health` - Health check (no auth)
- `GET /mcp` - Establish SSE connection (auth required)
- `POST /mcp` - Send JSON-RPC message (auth required)
- `DELETE /mcp` - Close session (auth required)

## Example: Calling Tools

```bash
# Initialize MCP connection
curl -X POST https://your-project.vercel.app/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "client", "version": "1.0.0"}
    }
  }'

# List tools
curl -X POST https://your-project.vercel.app/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

## Monitoring

Monitor your Vercel deployment:

```bash
# View logs
vercel logs

# View real-time logs
vercel logs --follow
```

In Vercel Dashboard:
- Go to your project
- Click "Logs" tab
- Monitor function execution, errors, and timeouts

## Cost Considerations

Vercel pricing affects deployment:

- **Hobby (Free)**:
  - 100 GB-hours compute time
  - 10s execution limit (not suitable for SSE)
  - 100GB bandwidth

- **Pro ($20/month)**:
  - 1000 GB-hours compute time
  - 60s execution limit (works for SSE)
  - 1TB bandwidth

- **Enterprise**:
  - Custom limits
  - Longer execution times
  - Contact Vercel sales

## Troubleshooting

### Function Timeout

If you see timeout errors:
```
Error: Function execution timed out
```

**Solutions:**
1. Upgrade to Pro plan for 60s limit
2. Use shorter-running operations
3. Consider alternative platforms (Railway, Render)

### Cold Starts

Serverless functions have cold starts (1-3s):
- First request may be slower
- Keep functions warm with periodic health checks
- Consider a monitoring service

### Module Not Found

If you see `Cannot find module` errors:
```bash
# Ensure all dependencies are in package.json
pnpm install

# Rebuild
pnpm build

# Redeploy
vercel --prod
```

## Alternative: Railway Deployment

For better SSE support without timeout limits:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and init
railway login
railway init

# Deploy
railway up
```

Railway Configuration (railway.json):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/src/index.js --http --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Security Notes

When deploying to Vercel:

1. ✅ **Environment Variables**: Store API keys in Vercel environment variables, never in code
2. ✅ **HTTPS**: Vercel provides HTTPS by default
3. ✅ **Custom Domain**: Use custom domains for production
4. ✅ **Rate Limiting**: Consider adding rate limiting via Vercel Edge Config
5. ✅ **Monitoring**: Enable Vercel Analytics and Monitoring

## Further Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Serverless Functions](https://vercel.com/docs/functions)
- [Environment Variables](https://vercel.com/docs/environment-variables)
- [Custom Domains](https://vercel.com/docs/custom-domains)

## Support

For issues specific to Vercel deployment:
- Check [GitHub Issues](https://github.com/desplega-ai/qa-use/issues)
- Vercel Support: https://vercel.com/support
- desplega.ai: https://desplega.ai/docs
