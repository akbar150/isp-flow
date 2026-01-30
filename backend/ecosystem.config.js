/**
 * PM2 Ecosystem Configuration
 * 
 * For cPanel VPS deployment with Node.js
 * 
 * Commands:
 * - Start: pm2 start ecosystem.config.js
 * - Stop: pm2 stop easylink-api
 * - Restart: pm2 restart easylink-api
 * - Logs: pm2 logs easylink-api
 * - Monitor: pm2 monit
 */

export default {
  apps: [
    {
      name: 'easylink-api',
      script: './src/app.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '../logs/pm2-error.log',
      out_file: '../logs/pm2-out.log',
      log_file: '../logs/pm2-combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};
