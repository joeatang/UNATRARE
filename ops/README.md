# UNATRARE Ops — Guardrails & Runbook

Plain-English operations for keeping unatrare.wtf solid. Everything here exists so
the "all my data disappeared" scare from 2026-07-01 can never repeat.

> Root cause of that scare: a database-path bug made every live page 404 after a
> rebuild. The data was always safe — the site just couldn't find it. These
> guardrails catch that class of problem in ~60 seconds instead of by panic.

---

## The two layers (know the difference)

| Layer | Holds | Permanence |
|-------|-------|------------|
| **Website database** (`data/unatrare.db`, one server) | listings, stats, salutes, config | Fragile — one machine. Backed up nightly + pulled off-site. |
| **P2P art archive** (`unatrare-peer`, Hyperdrive) + on-chain hashes | the actual art files | Permanent — replicated P2P, hashes live on Bitcoin forever. |

`/art/<hash>` URLs are embedded on-chain and render in wallets worldwide.
**They must never go down** — maintenance mode keeps them live on purpose.

---

## Maintenance mode ("live but closed while I work")

```bash
# On the host:
bash /var/www/unatrare/ops/maint-on.sh    # visitors see a friendly "tuning up" page
bash /var/www/unatrare/ops/maint-off.sh   # back online
```

- Takes effect **instantly** (no nginx reload).
- Human pages + write APIs return a branded 503; **art & wallets stay live**.
- To browse the site yourself while it's closed, open **https://unatrare.wtf/__unlock**
  once (sets a 12-hour operator bypass cookie).
- The health alarm stays silent while maintenance is on.

## Deploying an update (the ONLY safe way)

```bash
# On the host, from /var/www/unatrare:
bash ops/deploy.sh
```
Maintenance on → pull code (keeps judges overrides) → DB snapshot → build on host →
verify a real card renders → **go live only if healthy, else roll back and stay closed.**
Never rsync a locally-built `.next` — it prerenders against the empty local DB.

## Health alarm

`ops/healthcheck.sh` runs every minute via cron. Pings `/`, `/directory`,
`/card/UNATCROBATS`; if real data stops rendering it messages Telegram, and again
on recovery. Silent during maintenance.

## Backups

- `ops/backup-db.sh` — nightly WAL-safe snapshot on the host, integrity-checked,
  keeps 14, in `backups/db/`.
- `ops/pull-backup.sh` — **run on your Mac** to pull the latest snapshot off-site.

## Archive audit (prove permanence)

```bash
node ops/archive-audit.mjs          # disk + gateway (fast)
node ops/archive-audit.mjs --deep   # also verifies each file is in the P2P archive
```
Non-zero exit if any approved card isn't retrievable.

---

## Cron (installed on host)

```
* * * * *  /usr/bin/env bash /var/www/unatrare/ops/healthcheck.sh >/dev/null 2>&1
17 4 * * * /usr/bin/env bash /var/www/unatrare/ops/backup-db.sh >> /var/www/unatrare/backups/backup.log 2>&1
```

## Never touch

PM2 processes `unatrare-peer`, `unatrare-seeder`, `unatrare-tgbot`. Only `unatrare`
(the web app) is restarted by deploys.
