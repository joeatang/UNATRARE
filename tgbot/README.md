# UNATRARE Telegram Bot

A small, isolated bot that does two jobs:

1. **`/u` command** — anyone in the main UNATRARE Telegram group can type `/u` to see a random card from the directory.
   - `/u` → random approved card
   - `/u TOKENNAME` → specific card (case-insensitive)
   - `/u latest` → most recently approved
   - Rate limit: 1 per user per 30 seconds (silent — no nagging)
   - Group-only: ignores DMs and any other chat

2. **Dispenser scanner** — every 2 minutes, reads any `tokens` row that has a
   `dispenser_address`, queries Counterparty's API for matching dispensers, and
   announces:
   - 🟢 **NEW DISPENSER** — when a new open dispenser appears for a watched token
   - 🔥 **SALE** — when `give_remaining` drops between scans
   - ⚫ **DISPENSER CLOSED** — when a dispenser flips out of open status

   First scan after startup is **silent** — it baselines existing state without
   announcing, so old/historical dispensers don't spam the channel.

## Why a separate process

The website's existing notification flow (`lib/telegram.js`) is **outbound only**
— it never listens. This bot adds a long-poll listener for `/u`, which is a
totally separate Telegram API capability. Running it in its own pm2 process
means a crash here can't impact the site or the existing notifications.

The bot is kill-safe at any time:
```bash
pm2 stop unatrare-tgbot
```

## State

A new SQLite table `dispenser_state` is created on first run inside the existing
`unatrare.db`. Only this bot writes to it. The `tokens` table is read-only from
this bot's perspective.

## Run

Local dev:
```bash
cd tgbot
npm install
node bot.js
```

Production: started by `ecosystem.config.cjs` as `unatrare-tgbot`.
