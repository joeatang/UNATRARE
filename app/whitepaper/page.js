import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './whitepaper.module.css';

export const metadata = {
  title: 'UNATPAPER',
  description: 'The UNATRARE protocol document. Counterparty, TAP, DMT, UNATPEPE, and the case for permanent P2P Pepe art preservation on Bitcoin.',
};

export default function WhitepaperPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.docHeader}>
          <pre className={styles.asciiHeader}>{`─ UNATPAPER ─
─ UNATRARE PROTOCOL DOCUMENTATION ─
─ v0.4 · May 2026 ─`}</pre>
        </header>

        <div className={styles.doc}>

          {/* I. THE ORIGIN */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>I. THE ORIGIN</h2>
            <pre className={styles.block}>{`2016. Bitcoin. Counterparty. Rare Pepe.
The first art movement native to Bitcoin.
Artists creating cards, trading them peer-to-peer,
building a culture that nobody could take down
because the tokens lived on the chain.

We found it. We never left.

The problem: the Counterparty token names are permanent.
The art they point to is not.
IPFS links rot. Imgur disappears.
Arweave requires AR tokens to stay alive.
The culture that gave these tokens meaning
is stored on infrastructure that doesn't share
Bitcoin's permanence.

That bothered us.`}</pre>
          </section>

          {/* II. THE BRIDGE */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>II. THE BRIDGE</h2>
            <pre className={styles.block}>{`2023. The Block Runners. Digital Matter Theory.
While studying the Ordinals protocol, the Block Runners
discovered something deeper inside Bitcoin itself —
block data that could define non-arbitrary tokens.
Not issued on a whim. Derived from Bitcoin's own history.

They called it DMT. Digital Matter Theory.
Two asset classes born from it:
  UNAT = Unique Non-Arbitrary Token
  NAT  = Non-Arbitrary Token

TAP Protocol — built by Benny the Dev and the Trac team —
made DMT programmable on Bitcoin.
Trac Network — also built by Benny the Dev and the Trac team —
is its own L1, running alongside Bitcoin, not on it.
It became the peer infrastructure that indexes
and propagates the data.
TAP settles on Bitcoin. Trac moves it.

We built our own UNAT: UNATPEPE.
Element: UNATP.3dd.11

Current supply: 2,016. 420 holders (as of May 2026).
(2,016 — because that's the year it started.)

UNATPEPE is not a fixed supply token in the
traditional sense. Its supply is governed by
Bitcoin's own block data. If Bitcoin's mining
naturally produces the UNATP.3dd.11 pattern again,
new units can emerge — not because we decide it,
but because the protocol dictates it.
That is the principle of DMT.
The supply is non-arbitrary. Bitcoin holds the key.

We realized the people deep in DMT and TAP
were the same people who had loved Rare Pepe.
They just hadn't met yet.

UNATRARE is the meeting point.
Counterparty culture. TAP infrastructure.
One platform. One network.`}</pre>
          </section>

          {/* III. THE PLATFORM */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>III. THE PLATFORM</h2>
            <pre className={styles.block}>{`UNATRARE is four things running as one:

THE DIRECTORY
An art directory — an homage to the Rare Pepe Directory.
Artists submit Counterparty tokens.
A council of AI scientist judges evaluate each submission.
Certified art is listed permanently.
1,774 cards. No more.
In honor of the 1,774 Rare Pepe series cards
that started everything.
Artists who opt in may offer at least 10 cards from their
collection for auction to UNATPEPE holders —
first access to certified art, directly from the source.

THE VAULT
Permanent P2P art storage for any Counterparty token.
Upload once. Get a JSON URL.
Your art lives on the UNATRARE Pepe node network,
not on a platform you don't control.

THE ARCHIVE
We are scraping Counterparty for broken links —
thousands of assets pointing to dead URLs.
We host the recovered art so it resolves again.
Cultural preservation, not curation.

THE NODE NETWORK
The moat. The long game.
These are not Trac nodes.
These are UNATRARE's own Pepe nodes —
independent operators running the archive,
seeding the culture, built on Trac/Hypercore
technology but owned by no one but the people
who run them.
Each node sends a heartbeat every hour.
The heartbeat count is the ledger. It cannot be faked.`}</pre>
          </section>

          {/* IV. THE ELEVEN */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>IV. THE ELEVEN</h2>
            <pre className={styles.block}>{`The genesis of any network is not its size —
it's the commitment of the first ones who ran it
when running it meant nothing yet.

The eleven genesis node operators hold numbered seats.
Seat #1 through Seat #11.
These seats are not purchased. They are earned by running.
They are kept by running.

What a genesis seat carries:
  · 2× permanent reward weight in all distributions
  · RAREUNATPEPE — issued at seat confirmation
  · Genesis badge on the node registry, permanent
  · Priority consideration in protocol governance
  · First access to NATCASH allocation

The rule is simple:
Your heartbeat is your membership.

If a node goes dark — misses enough heartbeats
that the network can no longer verify commitment —
the seat opens. The RAREUNATPEPE stays with you.
That record is yours. The history of that seat is preserved.
But the privileges transfer to whoever earns
the open seat by running.

Seat #4 has always been Seat #4.
What changes is who holds it.

This is not punishment. This is the protocol.
The network rewards presence.
Absence is just absence.

There will only ever be eleven genesis seats.
The window is open until all eleven are confirmed.
Then it closes. Forever.`}</pre>
          </section>

          {/* V. THE TOKENS */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>V. THE TOKENS</h2>
            <pre className={styles.block}>{`UNATPEPE — the pass
Element: UNATP.3dd.11. Supply: 2,016.
420 holders as of May 2026.
UNAT on TAP Protocol — built by Benny the Dev and the Trac team.
Supply governed by Bitcoin's block data, not by us.
Hold it → access to artist-curated card auctions
when artists opt their certified collection in.
Hold it → the proof you were here before it was obvious.
Verify at: tap3.link

NATcash — the burn ritual
Two forms. One name. One ethos.

$CASH on nat.fun (Solana) — live now.
nat.fun built by The Block Runners.
A NAT-inspired token designed for burn mechanics at scale.

Burn it to SALUTE a certified card.
The SALUTE is the mechanic:
burn $CASH, enter the leaderboard,
let the chain record your commitment to a piece of art.
The top burner earns the card drop —
the artist sends supply directly to the address on record.
There are no fixed tiers. There is only the record.
The chain doesn't grade your commitment — it keeps it.
Want the card? Burn more than anyone else.
The community sets the price by burning,
not by voting, not by paying a fee —
by destroying something real.

NATCASH on Counterparty — coming.
A Counterparty token issued in honor of $CASH.
Will become the native burn mechanic for directory
submissions and entries as the protocol matures.
The Solana burn inspired it.
Bitcoin will complete it.

SOFTPWAR — the founders token
2,009 supply. Counterparty.
The original burn token. Distributed to early supporters.
Legacy tier — if you hold SOFTPWAR, you were there first.
Not deprecated. Honored.

PEPECASH — the culture token
Counterparty. 2016. Pre-existing.
The language the community already speaks.
Accepted for vault uploads and submissions.
We didn't create it. We respect it.

RAREUNATPEPE — the Series 1 card
Counterparty. Limited.
Issued to confirmed Genesis Node operators
and SOFTPWAR campaign supporters.
A piece of the archive, not just a pass.`}</pre>
          </section>

          {/* VI. THE ETHOS */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>VI. THE ETHOS</h2>
            <pre className={styles.block}>{`We are building the best tools for the community
we already belong to.
That community reflecting positively on UNATPEPE
is the goal. Everything else follows from that.

Rare Pepe culture is the foundation of crypto art.
TAP/DMT is the new infrastructure on top of Bitcoin.
UNATRARE is the only place both exist at once.

The art will still be here in 10 years.
The nodes will still be running.
The tokens will still be on chain.

That's the road.`}</pre>
          </section>

          {/* VII. CREDITS */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>VII. CREDITS</h2>
            <pre className={styles.block}>{`Pepe the Frog — created by Matt Furie, 2005
Rare Pepe (crypto art pioneer) — Mike and Joe Looney
Digital Matter Theory (DMT) — The Block Runners
nat.fun — The Block Runners
TAP Protocol — Benny the Dev and the Trac team
Trac Network — Benny the Dev and the Trac team
Rare Pepe — the artists. all of them.`}</pre>
          </section>

          <footer className={styles.docFooter}>
            <pre className={styles.asciiFooter}>{`─ unatrare.wtf ─`}</pre>
            <div className={styles.footerLinks}>
              <Link href="/nodes/guide">Run a Node</Link>
              <Link href="/submit">Submit Art</Link>
              <Link href="/vault">The Vault</Link>
              <Link href="/archive">The Archive</Link>
            </div>
          </footer>

        </div>
      </main>
    </>
  );
}
