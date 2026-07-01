#!/usr/bin/env python3
"""Insert UNATRARE maintenance-mode blocks into the live nginx server block.
Idempotent: does nothing if already applied. Reads MAINT_SECRET from env.
Target: /etc/nginx/sites-enabled/unatrare
"""
import os, sys

secret = os.environ.get("MAINT_SECRET")
if not secret:
    sys.exit("MAINT_SECRET not set")

path = os.environ.get("NGINX_CONF", "/etc/nginx/sites-enabled/unatrare")
s = open(path).read()

if "unat_bypass" in s:
    print("maintenance blocks already present; nothing to do")
    sys.exit(0)

gate = (
    "        # -- Maintenance gate (instant flag-file toggle; no nginx reload) --\n"
    "        # /art/ and /uploads/ are separate location blocks and stay LIVE\n"
    "        # during maintenance so certified art never disappears from wallets.\n"
    "        set $maint 0;\n"
    "        if (-f /var/www/unatrare/MAINTENANCE)   { set $maint 1; }\n"
    '        if ($cookie_unat_bypass = "%s") { set $maint 0; }\n'
    "        if ($maint = 1) { return 503; }\n\n"
) % secret

marker = "    location / {\n"
idx = s.find(marker)
if idx == -1:
    sys.exit("could not find 'location / {'")
s = s[: idx + len(marker)] + gate + s[idx + len(marker):]

extra = (
    "    # Operator bypass: visit https://unatrare.wtf/__unlock once during maintenance.\n"
    "    location = /__unlock {\n"
    '        add_header Set-Cookie "unat_bypass=%s; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax" always;\n'
    '        add_header Cache-Control "no-store" always;\n'
    "        return 302 https://unatrare.wtf/;\n"
    "    }\n\n"
    "    # Friendly maintenance page (preserves 503 status for crawlers).\n"
    "    error_page 503 @maintenance;\n"
    "    location @maintenance {\n"
    "        root /var/www/unatrare/ops/maintenance;\n"
    "        rewrite ^ /maintenance.html break;\n"
    '        add_header Retry-After 600 always;\n'
    '        add_header Cache-Control "no-store" always;\n'
    '        add_header X-Frame-Options "SAMEORIGIN" always;\n'
    '        add_header X-Content-Type-Options "nosniff" always;\n'
    "    }\n\n"
) % secret

lmark = "    listen 443 ssl;"
lidx = s.find(lmark)
if lidx == -1:
    sys.exit("could not find 'listen 443 ssl;'")
s = s[:lidx] + extra + s[lidx:]

open(path, "w").write(s)
print("nginx maintenance blocks inserted")
