module.exports = {
  apps: [
    {
      name: 'product-monitor-backend',
      cwd: '/home/jinkazama132oo/.openclaw/workspace/ydproducts/backend',
      script: 'server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'product-monitor-frontend',
      cwd: '/home/jinkazama132oo/.openclaw/workspace/ydproducts/frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
