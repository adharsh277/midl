/**
 * Production Deployment Guide
 * 
 * This guide covers deploying Bitcoin Smart Escrow to production
 */

# Production Deployment Guide

## Pre-Deployment Checklist

- [ ] All TypeScript types verified (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] All tests pass
- [ ] Environment variables configured
- [ ] Security audit completed
- [ ] Error handling tested
- [ ] Wallet integration tested
- [ ] Transaction signing tested

## Environment Setup

### Testnet (Current)

```env
# .env.local
NEXT_PUBLIC_BITCOIN_NETWORK=testnet
NEXT_PUBLIC_MEMPOOL_API=https://mempool.space/testnet/api
NEXT_PUBLIC_APP_TITLE=Bitcoin Smart Escrow
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### Mainnet (Production)

```env
# .env.production
NEXT_PUBLIC_BITCOIN_NETWORK=mainnet
NEXT_PUBLIC_MEMPOOL_API=https://mempool.space/api
NEXT_PUBLIC_APP_TITLE=Bitcoin Smart Escrow
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com
NODE_ENV=production
```

## Deployment Platforms

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Then redeploy
vercel --prod
```

### AWS (EC2 + ALB)

```bash
# Build
npm run build

# Start server
npm start

# Use PM2 for process management
npm install -g pm2
pm2 start "npm start" --name "midl"
pm2 startup
pm2 save
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t bitcoin-escrow .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_BASE_URL=https://your-domain.com bitcoin-escrow
```

## Security Hardening

### 1. Rate Limiting

```typescript
// lib/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 h'),
});

export async function middleware(request: NextRequest) {
  const identifier = request.ip;
  const { success } = await ratelimit.limit(identifier);

  if (!success) {
    return new NextResponse('Too many requests', { status: 429 });
  }
}
```

### 2. CORS Configuration

```typescript
// next.config.js
const nextConfig = {
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_API_BASE_URL,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### 3. Content Security Policy

```typescript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  connect-src 'self' https://mempool.space;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`;

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
        ],
      },
    ];
  },
};
```

### 4. HTTPS Redirect

```typescript
// next.config.js
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'X-Forwarded-Proto', value: 'http' }],
        destination: 'https://:host/:path*',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
```

## Database Integration

### PostgreSQL Setup

```sql
-- Create escrows table
CREATE TABLE escrows (
  id VARCHAR(255) PRIMARY KEY,
  funding_txid VARCHAR(64),
  receiver_address VARCHAR(255) NOT NULL,
  locker_address VARCHAR(255) NOT NULL,
  amount BIGINT NOT NULL,
  unlock_type VARCHAR(50) NOT NULL,
  unlock_time INT,
  buyer_address VARCHAR(255),
  seller_address VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  script_hex TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unlocked_at TIMESTAMP,
  redeem_txid VARCHAR(64)
);

CREATE INDEX idx_escrows_locker ON escrows(locker_address);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_created ON escrows(created_at);
```

```typescript
// lib/db/escrow.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getEscrow(id: string) {
  const result = await pool.query(
    'SELECT * FROM escrows WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

export async function createEscrow(escrow: EscrowConfig) {
  const result = await pool.query(
    `INSERT INTO escrows 
    (id, funding_txid, receiver_address, locker_address, amount, unlock_type, unlock_time, status, script_hex, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *`,
    [
      escrow.id,
      escrow.fundingTxid,
      escrow.receiverAddress,
      escrow.locker,
      escrow.amount,
      escrow.unlockType,
      escrow.unlockTime,
      escrow.status,
      escrow.scriptHex,
    ]
  );
  return result.rows[0];
}

export async function updateEscrowStatus(id: string, status: string) {
  const result = await pool.query(
    'UPDATE escrows SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
}
```

## Monitoring & Observability

### Logging

```typescript
// lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
```

### Error Tracking

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

### Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
  });
}
```

## Performance Optimization

### Image Optimization

```typescript
// next.config.js
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
};
```

### API Caching

```typescript
// app/api/wallet/balance/route.ts
export const revalidate = 60; // Cache for 60 seconds

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ /* ... */ });
  
  response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  
  return response;
}
```

## Testing

### Unit Tests

```typescript
// __tests__/escrow.test.ts
import { buildTimelockScript } from '@/lib/bitcoin/scripts';

describe('Escrow Scripts', () => {
  it('should build valid timelock script', () => {
    const script = buildTimelockScript(850000, '0279be...');
    expect(script).toBeInstanceOf(Buffer);
    expect(script.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// __tests__/api/wallet.test.ts
import { GET } from '@/app/api/wallet/balance/route';

describe('Wallet API', () => {
  it('should fetch balance for valid address', async () => {
    const request = new Request(
      'http://localhost:3000/api/wallet/balance?address=tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
    );
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.balances).toBeDefined();
  });
});
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm install --legacy-peer-deps
      - run: npm run type-check
      - run: npm run lint
      - run: npm run build
      
      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: |
          npm install -g vercel
          vercel --prod --token $VERCEL_TOKEN
```

## Disaster Recovery

### Backup Strategy

```bash
# Daily backups of escrow database
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/escrow-$(date +%Y%m%d).sql.gz

# Retention: 30 days
find /backups -name "escrow-*.sql.gz" -mtime +30 -delete
```

### Restore from Backup

```bash
# Restore database
gunzip < escrow-20260219.sql.gz | psql $DATABASE_URL

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM escrows;"
```

## Maintenance

### Database Maintenance

```sql
-- Vacuum and analyze
VACUUM ANALYZE escrows;

-- Reindex
REINDEX TABLE escrows;
```

### Upgrade Dependencies

```bash
# Check for updates
npm outdated

# Update safely
npm update

# Audit for security issues
npm audit fix
```

## Support & Monitoring

- Monitor dashboard: [Vercel/AWS/etc]
- Error tracking: [Sentry/Rollbar]
- Logging: [CloudWatch/ELK]
- Uptime monitoring: [Pingdom/Uptime Robot]
- Performance: [Datadog/New Relic]
