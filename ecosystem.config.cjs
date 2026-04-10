const path = require('path');
const projectRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'product-monitor-backend',
      cwd: path.join(projectRoot, 'backend'),
      script: 'server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      time: true
    },
    {
      name: 'product-monitor-frontend',
      cwd: path.join(projectRoot, 'frontend'),
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      time: true
    }
  ]
};
