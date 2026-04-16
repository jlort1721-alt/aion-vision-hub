// /opt/aion/services/reverse-gateway/ops/pm2/ecosystem.reverse.config.js
//
// PM2 ecosystem for the reverse-connect gateway ONLY.
// Do NOT merge this into the main AION ecosystem.config.js yet — keep it
// loadable separately so it can be started/stopped/restarted independently
// without risk to aion-api, aion-agent, aion-web, go2rtc.
//
// Start:   pm2 start /opt/aion/services/reverse-gateway/ops/pm2/ecosystem.reverse.config.js
// Status:  pm2 list | grep reverse
// Logs:    pm2 logs aion-reverse-gateway --lines 200
// Stop:    pm2 stop aion-reverse-gateway && pm2 delete aion-reverse-gateway
// Persist: pm2 save

module.exports = {
  apps: [
    {
      name: 'aion-reverse-gateway',
      script: '/opt/aion/services/reverse-gateway/bin/gateway',
      args: ['--config', '/etc/aion/reverse/gateway.toml'],
      cwd: '/opt/aion/services/reverse-gateway',
      interpreter: 'none',       // native binary, not Node
      instances: 1,              // singleton: the gateway owns ports 7660/7661/7681
      exec_mode: 'fork',

      // Run as dedicated unprivileged user. The user must exist:
      //   sudo useradd --system --no-create-home --shell /usr/sbin/nologin aion-reverse
      //   sudo chown -R aion-reverse:aion /opt/aion/services/reverse-gateway /etc/aion/reverse
      uid: 'aion-reverse',
      gid: 'aion',

      env: {
        AION_RG_ENV: 'production',
        LD_LIBRARY_PATH:
          '/opt/aion/services/reverse-gateway/sdks/dahua/lib:' +
          '/opt/aion/services/reverse-gateway/sdks/hikvision/lib',
        TZ: 'America/Bogota',
        GOMAXPROCS: '4',
        GOMEMLIMIT: '2750MiB',  // leave headroom on t3.xlarge (16 GiB total)
      },

      // Resource guardrails
      max_memory_restart: '3G',
      kill_timeout: 15000,       // give the gateway 15s to drain sessions on SIGTERM
      listen_timeout: 10000,
      restart_delay: 5000,

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      exp_backoff_restart_delay: 1000,

      // Logs (captured as JSON because the gateway emits zerolog JSON)
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: '/var/log/aion/reverse-gateway.out.log',
      error_file: '/var/log/aion/reverse-gateway.err.log',

      // Signals
      shutdown_with_message: false,  // we respond to plain SIGTERM
    },
  ],
};
