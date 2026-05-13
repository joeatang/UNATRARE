/**
 * PM2 Ecosystem Config — UNATRARE
 *
 * Manages all processes for a full UNATRARE node:
 *   - unatrare          : Next.js production server
 *   - unatrare-seeder   : Hyperswarm art archive seeder (art p2p distribution)
 *   - unatrare-peer     : Trac Intercom peer (SC-Bridge for verdict broadcast)
 *
 * USAGE:
 *   pm2 start ecosystem.config.cjs              # start all
 *   pm2 start ecosystem.config.cjs --only unatrare-peer  # peer only
 *   pm2 save                                     # persist across reboots
 *   pm2 startup                                  # enable auto-start on boot
 *
 * REQUIREMENTS FOR unatrare-peer:
 *   - Pear runtime installed: https://pears.com
 *   - Run `pear stage pear://...` once to init storage
 *   - SC_BRIDGE_TOKEN must match .env.local value
 *
 * The Next.js app and seeder work without the peer running.
 * The peer only adds Trac network verdict broadcast. The browser SSE stream
 * (/api/events) handles real-time UI updates independently.
 */

module.exports = {
  apps: [
    {
      name: 'unatrare',
      script: 'node_modules/.bin/next',
      args: 'start -p 3007',
      cwd: '/var/www/unatrare',
      interpreter: 'node',
      node_args: '--max-old-space-size=512',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 20,
      watch: false,
    },
    {
      name: 'unatrare-seeder',
      script: '/var/www/unatrare/seeder/seed.js',
      interpreter: 'node',
      cwd: '/var/www/unatrare/seeder',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
    {
      // Trac Intercom peer — SC-Bridge for verdict broadcast to Trac network
      // Requires Pear runtime. Disable this app on servers without Pear.
      // To disable: pm2 delete unatrare-peer
      name: 'unatrare-peer',
      script: 'pear',
      args: [
        'run', '.',
        '--peer-store-name',  'unatrare-admin',
        '--msb-store-name',   'unatrare-admin-msb',
        '--subnet-channel',   'unatrare-art-archive-v1',
        '--sc-bridge',        '1',
        '--sc-bridge-port',   '49222',
        '--sc-bridge-cli',    '1',
        '--xcp-address',      '15w1CFYpLHWGAinTFCSy9i327FHoj5t9re',
        '--btc-address',      '15w1CFYpLHWGAinTFCSy9i327FHoj5t9re',
      ],
      cwd: '/var/www/unatrare/intercom',
      interpreter: 'none',
      env: {
        PATH: '/root/.config/pear/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        NODE_ENV: 'production',
        SC_BRIDGE_TOKEN: process.env.SC_BRIDGE_TOKEN || '3f113ec0131dfff2e0bcb73146ee8339b43279b224118ede854b2899704fdc33',
      },
      restart_delay: 15000,
      max_restarts: 10,
      watch: false,
      autorestart: true,
    },
  ],
};
