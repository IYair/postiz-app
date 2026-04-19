module.exports = {
  apps: [
    {
      name: 'nginx',
      script: 'nginx',
      args: "-g 'daemon off;'",
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      kill_timeout: 5000,
    },
    {
      name: 'backend',
      cwd: '/app/apps/backend',
      script: 'dist/apps/backend/src/main.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '2G',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
    {
      // Orchestrator loads a webpack-compiled workflow bundle per Temporal
      // task queue (~30 social platforms + internals). Steady-state memory
      // lands around 2GB, which used to collide with a 1GB max_memory_restart
      // and spin PM2 into a crash loop (~2 restarts/min). 3GB gives 50%
      // headroom over the observed footprint.
      name: 'orchestrator',
      cwd: '/app/apps/orchestrator',
      script: 'dist/apps/orchestrator/src/main.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '3G',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'frontend',
      cwd: '/app/apps/frontend',
      script: '/app/node_modules/next/dist/bin/next',
      args: 'start -p 4200 -H 0.0.0.0',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '1536M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '4200',
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
