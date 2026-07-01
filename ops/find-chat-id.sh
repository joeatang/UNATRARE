#!/usr/bin/env bash
# ops/find-chat-id.sh — discover the chat ID of your PRIVATE alert channel/group.
#
# ONE-TIME SETUP:
#   1. In Telegram, create a new private Group (or Channel) for ops alerts.
#   2. Add your bot to it. For a Channel, make the bot an Admin.
#   3. Post any message in it (e.g. "hi").
#   4. Run this script on the host:  bash ops/find-chat-id.sh
#   5. Copy the negative id it prints, then add to .env.local:
#        TELEGRAM_ALERT_CHAT_ID=-100xxxxxxxxxx
#      (health/deploy/backup alerts will then go there instead of the public channel.)
set -u

ENV_FILE="${UNAT_ENV_FILE:-/var/www/unatrare/.env.local}"
TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
[ -n "$TOKEN" ] || { echo "TELEGRAM_BOT_TOKEN not found in $ENV_FILE"; exit 1; }

echo "Recent chats the bot can see (title -> id):"
curl -s -m 15 "https://api.telegram.org/bot${TOKEN}/getUpdates" \
| node -e '
  let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    let j; try{j=JSON.parse(s)}catch{console.log("could not parse getUpdates");process.exit(1)}
    if(!j.ok){console.log("Telegram error:",j.description);process.exit(1)}
    const seen=new Map();
    for(const u of j.result||[]){
      const c=(u.message||u.channel_post||u.my_chat_member||{}).chat;
      if(c) seen.set(c.id, (c.title||c.username||c.first_name||"(private)"));
    }
    if(!seen.size){console.log("  (none yet — post a message in the group/channel, then re-run)");return;}
    for(const [id,title] of seen) console.log(`  ${title}  ->  ${id}`);
  });
'
