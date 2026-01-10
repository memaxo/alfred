# Deployment Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide provides a production deployment checklist, environment variable configuration, monitoring setup, backup/recovery procedures, and scaling considerations for ALFRED.

## Prerequisites

- PostgreSQL 16+ with pgvector extension
- Redis (optional, for biometric cache and run registry)
- Node.js 20+ or Bun 1.2+
- Domain name with SSL certificate
- (Optional) GPU for local voice models (MLX/ROCm/CUDA)

## Proxmox (Optional)

This section targets **ALFRED itself** (not generated apps) and distinguishes:

- **Provisioning (Proxmox resources)**: creating/starting containers on a Proxmox VE host.
- **Deployment (inside the containers)**: installing Postgres/Redis and running the ALFRED server process.

### Provisioning (host-side)

Use the idempotent provisioning script:

```bash
bun run scripts/proxmox.ts
```

The script creates or reuses three LXCs (`alfred`, `alfred-db`, `alfred-redis`) and starts them if needed. It does **not** destroy anything by default.

Required Proxmox env vars: `PROXMOX_HOST`, `PROXMOX_TOKEN_ID`, `PROXMOX_TOKEN_SECRET`, `PROXMOX_NODE`.

Recommended provisioning env vars: `PROXMOX_OSTEMPLATE`, `PROXMOX_STORAGE`, `PROXMOX_BRIDGE`, `PROXMOX_GATEWAY`, `PROXMOX_CIDR`, and static IPs (`PROXMOX_ALFRED_IP`, `PROXMOX_DB_IP`, `PROXMOX_REDIS_IP`).

### Deployment (in-container)

Once containers exist, deploy ALFRED and its dependencies inside them (install Postgres 16 + pgvector in `alfred-db`, Redis in `alfred-redis`, and the ALFRED server in `alfred`).

After ALFRED is running, verify:

```bash
curl http://<alfred-ip>:3000/healthz
curl http://<alfred-ip>:3000/healthz/deps
```

See: `docs/architecture/deployment-proxmox.md` and `docs/architecture/production-proxmox.md`.

## Environment Variables

### Required Variables

**Database:**
```bash
DATABASE_URL=postgresql://user:password@host:5432/alfred
```

**Authentication:**
```bash
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=https://your-domain.com
```

**Application:**
```bash
PUBLIC_URL=https://your-domain.com
NODE_ENV=production
```

### Optional Variables

**Redis (for multi-instance deployments):**
```bash
REDIS_URL=redis://host:6379
RUN_REGISTRY_BACKEND=redis
```

**Linear Integration:**
```bash
LINEAR_CLIENT_ID=your-client-id
LINEAR_CLIENT_SECRET=your-client-secret
LINEAR_WEBHOOK_SECRET=your-webhook-secret
LINEAR_REDIRECT_URI=https://your-domain.com/api/auth/callback/linear
```

**Voice System:**
```bash
VOICE_PROVIDER=maya1
VOICE_STT_POOL_SIZE=2
VOICE_TTS_POOL_SIZE=1
WHISPER_MODEL_PATH=model-id
PIPER_MODEL_PATH=model-path
```

**Memory System:**
```bash
MEMORY_DECAY_ENABLED=true
MEMORY_DECAY_INTERVAL_MS=3600000
MEMORY_DECAY_THRESHOLD_MS=86400000
MEMORY_DECAY_FACTOR=0.95
MEMORY_PRUNE_CONFIDENCE=0.2
MEMORY_CLEANUP_AGE_MS=2592000000
```

**Workflow Schedulers (gate with env flags):**
```bash
SCHED_REMIND=1
SCHED_MEMORY_MAINTENANCE=1
```

**See:** `config/env.example` for complete list

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations applied (`bun run db:migrate`)
- [ ] SSL certificate configured
- [ ] Domain DNS configured
- [ ] Firewall rules configured
- [ ] Backup strategy in place
- [ ] Monitoring configured (Prometheus/Grafana)
- [ ] Log aggregation configured
- [ ] Health checks configured (`/healthz`, `/healthz/deps`)

### Build and Deploy

1. **Build application:**
   ```bash
   bun install --frozen-lockfile
   bun run build
   ```

2. **Verify build:**
   ```bash
   bun run verify-build
   ```

3. **Run migrations:**
   ```bash
   bun run db:migrate
   ```

4. **Start application:**
   ```bash
   bun run start
   ```

### Post-Deployment

- [ ] Verify health endpoints respond
- [ ] Verify metrics endpoint (`/api/metrics`)
- [ ] Test authentication flow
- [ ] Test workflow execution
- [ ] Test voice system (if enabled)
- [ ] Verify Linear integration (if configured)
- [ ] Check logs for errors
- [ ] Monitor metrics for anomalies

## Database Migrations

### Applying Migrations

**Production:**
```bash
bun run db:migrate
```

**With plan (dry-run):**
```bash
bun run db:migrate --plan
```

**Migration runner:** `packages/db/scripts/migrate.ts`

### Migration Best Practices

1. **Idempotent migrations**: Use `IF NOT EXISTS` / `IF EXISTS` when safe
2. **Test migrations**: Test on staging before production
3. **Backup before**: Always backup database before major migrations
4. **Rollback plan**: Have rollback strategy for destructive migrations
5. **Index creation**: Create indexes concurrently to avoid locks

### Migration Troubleshooting

**"Relation already exists" errors:**
- Check if migration partially applied
- Manually verify database state
- Use `IF NOT EXISTS` in migration

**"Column already exists" errors:**
- Check migration status in `_migrations` table
- Verify column exists before adding

## Monitoring Setup

### Prometheus Metrics

Metrics exposed on `/api/metrics`:

**Key Metrics to Monitor:**
- `trpc_requests_total` - Request counts
- `trpc_request_duration_seconds` - Request latency
- `workflow_stream_events_total` - Workflow activity
- `workflow_stream_duration_seconds` - Workflow duration
- `cognitive_transition_duration` - Cognitive loop performance
- `memory_maintenance_duration_seconds` - Memory system health
- `voice_session_duration_seconds` - Voice system usage
- `policy_decisions_total` - Security events

**Scrape Configuration:**
```yaml
scrape_configs:
  - job_name: 'alfred'
    scrape_interval: 15s
    metrics_path: '/api/metrics'
    static_configs:
      - targets: ['your-domain.com:3000']
```

### Health Checks

**Basic Health:**
```bash
curl https://your-domain.com/healthz
```

**Dependency Health:**
```bash
curl https://your-domain.com/healthz/deps
```

**Expected Response:**
```json
{
  "status": "ok",
  "dependencies": {
    "database": "ok",
    "redis": "ok" // if configured
  }
}
```

### Logging

**Structured Logs:**
- JSON format for machine parsing
- Context included (runId, userId, etc.)
- Error logs include stack traces
- Security events logged separately

**Log Levels:**
- `error` - Errors requiring investigation
- `warn` - Warnings (budget violations, retries)
- `info` - Important events (workflow start/complete)
- `debug` - Development only

## Backup and Recovery

### Database Backups

**PostgreSQL Backup:**
```bash
pg_dump -h host -U user -d alfred > backup-$(date +%Y%m%d).sql
```

**Automated Backups:**
- Schedule daily backups
- Retain 7 days of daily backups
- Retain 4 weeks of weekly backups
- Test restore procedures regularly

### Recovery Procedures

**Restore Database:**
```bash
psql -h host -U user -d alfred < backup-YYYYMMDD.sql
```

**After Restore:**
1. Verify data integrity
2. Re-run migrations if needed
3. Restart application
4. Verify health checks

### Disaster Recovery

**RTO (Recovery Time Objective):** < 1 hour  
**RPO (Recovery Point Objective):** < 24 hours

**Recovery Steps:**
1. Restore database from latest backup
2. Restore Redis (if used)
3. Restart application
4. Verify functionality
5. Monitor for issues

## Scaling Considerations

### Horizontal Scaling

**Multi-Instance Deployment:**
- Use Redis for run registry (`RUN_REGISTRY_BACKEND=redis`)
- Use sticky sessions or Redis for state
- Ensure consistent routing for suspended workflows
- Gate schedulers behind env flags (`SCHED_REMIND=1`)

**Load Balancing:**
- Use health checks for routing
- Sticky sessions for WebSocket connections
- Distribute HTTP requests evenly

### Vertical Scaling

**Resource Requirements:**
- **CPU**: 2+ cores recommended
- **Memory**: 4GB+ recommended (8GB+ for voice models)
- **Disk**: 20GB+ for models and data
- **GPU**: Optional (for local voice models)

### Performance Optimization

**Database:**
- Connection pooling (default: 10 connections)
- Index optimization
- Query performance monitoring

**Application:**
- Enable production optimizations
- Monitor hot path performance
- Optimize slow queries

## Security Hardening

### Authentication

- Use strong `BETTER_AUTH_SECRET` (32+ characters)
- Enable passkey authentication
- Configure session expiration
- Use HTTPS only

### Network Security

- Firewall rules (only expose necessary ports)
- Rate limiting (if multi-user)
- DDoS protection (if exposed to internet)
- VPN access for admin endpoints

### Secrets Management

- Never commit secrets to git
- Use environment variables or secret management service
- Rotate secrets regularly
- Audit secret access

## Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify `DATABASE_URL` format
- Check firewall rules
- Verify PostgreSQL is running
- Check connection pool limits

**Migration Failures:**
- Check migration status
- Verify database permissions
- Review migration logs
- Test migrations on staging first

**Performance Issues:**
- Check Prometheus metrics
- Review slow query logs
- Monitor resource usage
- Profile hot paths

**See:** `docs/guides/troubleshooting.md` for detailed troubleshooting

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - System architecture
- [Production Proxmox](../architecture/production-proxmox.md) - Proxmox-specific deployment
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [Developer Onboarding](./developer-onboarding.md) - Development setup
