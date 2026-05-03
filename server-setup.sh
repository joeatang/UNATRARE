#!/bin/bash
# UNATRARE — DigitalOcean Ubuntu 24.04 setup script
# Run as root on a fresh droplet: bash server-setup.sh
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== [1/7] System update ==="
apt-get update -qq && apt-get upgrade -y -qq -o Dpkg::Options::="--force-confold" -o Dpkg::Options::="--force-confdef"

echo "=== [2/7] Install Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "=== [3/7] Install Nginx + PM2 ==="
apt-get install -y nginx
npm install -g pm2

echo "=== [4/7] Clone UNATRARE ==="
mkdir -p /var/www
cd /var/www
git clone https://github.com/joeatang/UNATRARE.git unatrare
cd /var/www/unatrare

echo "=== [5/7] Install dependencies ==="
npm install --production

echo "=== [6/7] Build Next.js ==="
npm run build

echo "=== [7/7] Configure Nginx ==="
cat > /etc/nginx/sites-available/unatrare << 'NGINX'
server {
    listen 80;
    server_name unatrare.wtf www.unatrare.wtf;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/unatrare /etc/nginx/sites-enabled/unatrare
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "======================================================"
echo "  Setup complete. Now do:"
echo ""
echo "  1. Create /var/www/unatrare/.env.local (see below)"
echo "  2. Run:  pm2 start 'npm start' --name unatrare -- -p 3007"
echo "           pm2 save && pm2 startup"
echo "  3. Run:  apt install certbot python3-certbot-nginx -y"
echo "           certbot --nginx -d unatrare.wtf -d www.unatrare.wtf"
echo "======================================================"
