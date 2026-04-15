/**
 * AION Platform — PM2 Ecosystem (Production, Blue-Green ready)
 * -------------------------------------------------------------
 * Usage:
 *   pm2 start ecosystem.config.js --env production --only aion-api-blue
 *   pm2 reload ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 *
 * Each logical service has BLUE and GREEN instances on different ports.
 * Nginx upstream switches between them during deploys (see deploy.sh).
 */

const path = require('path');
const LOG_DIR = '/var/log/aion';
const APP_ROOT = '/opt/aion';

// Common options applied to every app
const common = {
  instance_var: 'INSTANCE_ID',
  max_memory_restart: '1200M',
  kill_timeout: 10000,       // give in-flight HTTP requests time to finish
  listen_timeout: 15000,     // wait up to 15s for 'ready' signal
  wait_ready: true,          // requires process.send('ready') in the app
  autorestart: true,
  exp_backoff_restart_delay: 2000,
  max_restarts: 15,
  min_uptime: '30s',
  merge_logs: true,
  time: true,
  log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
  node_args: '--enable-source-maps --max-old-space-size=1024',
};

// Build a pair (blue + green) from a base definition
const pair = (base) => {
  const make = (color, portOffset) => ({
    ...common,
    ...base,
    name: `${base.name}-${color}`,
    env_production: {
      NODE_ENV: 'production',
      DEPLOY_COLOR: color,
      PORT: base.basePort + portOffset,
      ...(base.env_production || {}),
    },
    error_file: path.join(LOG_DIR, `${base.name}-${color}.err.log`),
    out_file:   path.join(LOG_DIR, `${base.name}-${color}.out.log`),
    pid_file:   path.join('/var/run/aion', `${base.name}-${color}.pid`),
  });
  return [make('blue', 0), make('green', 1)];
};

module.exports = {
  apps: [
    // === Core API (Express + pg Pool + jsonwebtoken) ============================
    ...pair({
      name: 'aion-api',
      cwd: `${APP_ROOT}/api`,
      script: 'dist/server.js',
      instances: 4,
      exec_mode: 'cluster',
      basePort: 3000, // blue=3000, green=3001
      env_production: {
        DATABASE_URL: 'postgres://aion:${PGPASS}@127.0.0.1:5432/aion',
        PG_POOL_MAX: '40',
        JWT_ISSUER: 'aionseg.co',
        SENTRY_DSN: '${SENTRY_DSN}',
      },
    }),

    // === Frontend (Next.js SSR) =================================================
    ...pair({
      name: 'aion-frontend',
      cwd: `${APP_ROOT}/frontend`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p $PORT',
      instances: 2,
      exec_mode: 'cluster',
      basePort: 3100,
      env_production: {
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_API_URL: 'https://aionseg.co/api',
      },
    }),

    // === AION Agent (Claude-powered, 28 tool handlers, streaming SSE) ==========
    ...pair({
      name: 'aion-agent',
      cwd: `${APP_ROOT}/agent`,
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      basePort: 3200,
      max_memory_restart: '2G',
      env_production: {
        MODEL_ROUTER_URL: 'http://127.0.0.1:8787',
        ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}',
        TOOL_ORCHESTRATOR_CONCURRENCY: '8',
      },
    }),

    // === Model Router (@aion/model-router, Haiku default, audit → Sonnet/Opus) =
    ...pair({
      name: 'aion-model-router',
      cwd: `${APP_ROOT}/model-router`,
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      basePort: 8787,
      env_production: {
        DEFAULT_MODEL: 'claude-haiku-4-5-20251001',
        AUDIT_MODEL: 'claude-opus-4-6',
        COMPLIANCE_MODEL: 'claude-sonnet-4-6',
        COST_LOG_DB: 'postgres://aion:${PGPASS}@127.0.0.1:5432/aion',
      },
    }),

    // === Vision Hub (go2rtc orchestrator + HCNetSDK bridge) ====================
    ...pair({
      name: 'aion-vision-hub',
      cwd: `${APP_ROOT}/vision-hub`,
      script: 'dist/hub.js',
      instances: 1,
      exec_mode: 'fork',
      basePort: 3030,
      max_memory_restart: '3G',
      env_production: {
        GO2RTC_URL: 'http://127.0.0.1:1984',
        HCNET_BRIDGE_URL: 'http://127.0.0.1:9099',
        IMOU_REGION: 'openapi-sg.easy4ip.com', // Américas
        STREAM_TARGET_COUNT: '228',
      },
    }),

    // === Twilio / Asterisk bridge (WhatsApp + voice + WebRTC + IVR) ===========
    ...pair({
      name: 'aion-comms',
      cwd: `${APP_ROOT}/comms`,
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      basePort: 3300,
      env_production: {
        ASTERISK_AMI_HOST: '127.0.0.1',
        ASTERISK_AMI_PORT: '5038',
        TWILIO_ACCOUNT_SID: '${TWILIO_ACCOUNT_SID}',
        TWILIO_AUTH_TOKEN:  '${TWILIO_AUTH_TOKEN}',
        POLLY_VOICE: 'Polly.Mia-Neural',
        SMS_PROXY_NUMBER_US: '${TWILIO_US_NUMBER}', // +57 landline is voice-only
      },
    }),

    // === Background workers (queues, n8n bridges, report generators) ==========
    {
      ...common,
      name: 'aion-worker',
      cwd: `${APP_ROOT}/worker`,
      script: 'dist/worker.js',
      instances: 3,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        QUEUE_URL: 'redis://127.0.0.1:6379',
        WORKER_CONCURRENCY: '5',
      },
      error_file: path.join(LOG_DIR, 'aion-worker.err.log'),
      out_file:   path.join(LOG_DIR, 'aion-worker.out.log'),
    },

    // === Scheduler (cron jobs: reports, health polls, device reboots) =========
    {
      ...common,
      name: 'aion-scheduler',
      cwd: `${APP_ROOT}/scheduler`,
      script: 'dist/scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env_production: {
        NODE_ENV: 'production',
        TZ: 'America/Bogota',
      },
      error_file: path.join(LOG_DIR, 'aion-scheduler.err.log'),
      out_file:   path.join(LOG_DIR, 'aion-scheduler.out.log'),
    },
  ],

  deploy: {
    production: {
      user: 'aion',
      host: ['vps.aionseg.co'],
      ref: 'origin/main',
      repo: 'git@github.com:Bella1023/aion-monorepo.git',
      path: APP_ROOT,
      'post-deploy':
        'pnpm install --frozen-lockfile && ' +
        'pnpm -r build && ' +
        'pnpm db:migrate && ' +
        'pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'mkdir -p /var/log/aion /var/run/aion && chown -R aion:aion /var/log/aion /var/run/aion',
    },
  },
};
