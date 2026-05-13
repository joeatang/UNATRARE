import styles from './guide.module.css';
import Link from 'next/link';
import Nav from '../components/Nav';

export const metadata = {
  title: 'Deep Node Setup Guide — UNATRARE',
  description: 'How to run a UNATRARE Deep Node and seed the Rare Pepe art archive on the TRAC P2P network.',
};

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ lines }) {
  return (
    <div className={styles.codeBlock}>
      {lines.map((line, i) =>
        line.startsWith('#') ? (
          <span key={i} className={styles.comment}>{line}</span>
        ) : (
          <span key={i} className={styles.line}>{line}</span>
        )
      )}
    </div>
  );
}

function Note({ children }) {
  return <p className={styles.note}>⚠ {children}</p>;
}

function Good({ children }) {
  return <p className={styles.good}>✓ {children}</p>;
}

export default function NodeGuidePage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
      <div className={styles.back}>
        <Link href="/nodes" className={styles.backLink}>← BACK TO NODE REGISTRY</Link>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>DEEP NODE SETUP GUIDE</h1>
        <p className={styles.subtitle}>
          Run a UNATRARE Deep Node and help seed the Rare Pepe art archive permanently
          across the TRAC Hyperswarm P2P network. No technical background required — follow
          this guide step by step.
        </p>
      </div>

      {/* ── What is a node ── */}
      <Section title="WHAT IS A DEEP NODE?">
        <p className={styles.body}>
          A Deep Node is a computer that stores a copy of the UNATRARE-certified art archive
          and stays connected to the network. The more nodes that run, the more copies of the
          art exist across the world — making the archive permanent, with no single server
          that can be shut down or lost.
        </p>
        <p className={styles.body}>
          Every hour your node is online, it sends an automatic &ldquo;heartbeat&rdquo; ping to the network.
          You don&rsquo;t do anything — it happens automatically. Heartbeats are your proof of loyalty.
          When the NAT reward system launches, heartbeat count determines your share.
        </p>
        <p className={styles.body}>
          The first 100 nodes to register earn permanent <strong className={styles.amber}>GENESIS</strong> status —
          an on-chain record that cannot be faked or granted later. Genesis nodes receive 2× reward
          weight for their first year.
        </p>
      </Section>

      {/* ── Is this safe ── */}
      <Section title="IS THIS SAFE TO RUN?">
        <Good>Your node stores only UNATRARE-certified Rare Pepe and Counterparty art — not random internet content.</Good>
        <Good>No financial data, passwords, or private keys pass through your node.</Good>
        <Good>The node software is fully open source — read it at github.com/joeatang/unatrare-intercom.</Good>
        <Good>No open ports required on your router — the network uses UDP hole-punching automatically.</Good>
        <Good>Your IP address is visible to other nodes on the subnet, the same as torrenting. Use a VPN if that concerns you.</Good>
        <Note>Only download Pear from the official source: pear.runtime (made by Holepunch). Never run node software from untrusted sources.</Note>
        <Note>If you run on a laptop, close-to-sleep = no heartbeats logged. A VPS or always-on desktop accumulates the best record.</Note>
      </Section>

      {/* ── Requirements ── */}
      <Section title="REQUIREMENTS">
        <table className={styles.table}>
          <tbody>
            <tr>
              <td className={styles.td1}>Operating System</td>
              <td className={styles.td2}>
                Ubuntu 20.04 or newer &nbsp;<span className={styles.yes}>✓</span><br/>
                macOS 12 Monterey or newer &nbsp;<span className={styles.yes}>✓</span><br/>
                macOS 11 Big Sur / Catalina or older &nbsp;<span className={styles.no}>✗ will not work</span><br/>
                Windows &nbsp;<span className={styles.no}>✗ not yet supported</span>
              </td>
            </tr>
            <tr>
              <td className={styles.td1}>RAM</td>
              <td className={styles.td2}>1 GB minimum &nbsp;·&nbsp; 2 GB+ recommended</td>
            </tr>
            <tr>
              <td className={styles.td1}>Storage</td>
              <td className={styles.td2}>10 GB free minimum &nbsp;·&nbsp; 50 GB recommended for long-term</td>
            </tr>
            <tr>
              <td className={styles.td1}>Internet</td>
              <td className={styles.td2}>Always-on broadband &nbsp;·&nbsp; any residential connection works</td>
            </tr>
            <tr>
              <td className={styles.td1}>Node.js</td>
              <td className={styles.td2}>Version 22 or newer</td>
            </tr>
            <tr>
              <td className={styles.td1}>Bitcoin wallet</td>
              <td className={styles.td2}>Any wallet that shows your BTC address (Freewallet, Sparrow, etc.)</td>
            </tr>
          </tbody>
        </table>

        <p className={styles.body} style={{marginTop: '1rem'}}>
          <strong className={styles.amber}>Best hardware for a permanent node:</strong> a $35 Raspberry Pi 4 (2GB)
          with a 64GB SD card, running Ubuntu Server. Costs ~$1–2/month in electricity and runs 24/7
          indefinitely. A $6/month DigitalOcean droplet is the cloud equivalent.
        </p>
      </Section>

      {/* ── Linux VPS (recommended) ── */}
      <Section title="SETUP: LINUX VPS OR SERVER (RECOMMENDED)">
        <p className={styles.body}>
          This is the recommended path — always-on, no laptop sleep issues. Works on DigitalOcean,
          Vultr, Linode, Hetzner, or any Ubuntu 20.04+ server.
        </p>

        <h3 className={styles.step}>Step 1 — Install dependencies</h3>
        <CodeBlock lines={[
          '# Update system',
          'apt update && apt upgrade -y',
          '# Required for Pear on Linux',
          'apt install -y curl git libatomic1',
          '# Install Node.js 22',
          'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -',
          'apt install -y nodejs',
          '# Confirm versions',
          'node --version   # should say v22.x.x',
          'npm --version',
        ]} />

        <h3 className={styles.step}>Step 2 — Install Pear</h3>
        <CodeBlock lines={[
          'npm install -g pear',
          '# Add Pear to your PATH (Linux)',
          'export PATH="/root/.config/pear/bin:$PATH"',
          '# Make it permanent',
          'echo \'export PATH="/root/.config/pear/bin:$PATH"\' >> ~/.bashrc',
          'source ~/.bashrc',
          '# Confirm',
          'pear --version',
        ]} />

        <h3 className={styles.step}>Step 3 — Clone and install the node software</h3>
        <CodeBlock lines={[
          'git clone https://github.com/joeatang/unatrare-intercom ~/node',
          'cd ~/node && git checkout unatrare/phase-0',
          'npm install',
        ]} />

        <h3 className={styles.step}>Step 4 — Start your node</h3>
        <p className={styles.body}>
          Replace <code className={styles.code}>YOUR_BITCOIN_ADDRESS</code> with your actual BTC address
          (any Bitcoin address you own — this is your identity on the network, not a payment address).
        </p>
        <CodeBlock lines={[
          'pear run . \\',
          '  --peer-store-name unatrare-node \\',
          '  --subnet-bootstrap 38a1b001756148f3f96f8cff7bd38d2924669f5c1880b4f779512d6449cfff56 \\',
          '  --btc-address YOUR_BITCOIN_ADDRESS',
        ]} />

        <p className={styles.body}>
          You will see the INTERCOM startup block followed by:
        </p>
        <CodeBlock lines={[
          '[artdrive] Ready. Drive key: ...',
          'Sidechannel: ready',
          '[unatrare] Node registered: abc123... (GENESIS)',
        ]} />
        <Good>If you see GENESIS — you are in the first 100. Congratulations.</Good>

        <h3 className={styles.step}>Step 5 — Keep it running with PM2</h3>
        <p className={styles.body}>
          PM2 keeps your node alive after reboots and if it crashes.
        </p>
        <CodeBlock lines={[
          'npm install -g pm2',
          '# Create a start script',
          'cat > ~/start-node.sh << \'EOF\'',
          '#!/bin/bash',
          'cd ~/node',
          'export PATH="/root/.config/pear/bin:$PATH"',
          'pear run . \\',
          '  --peer-store-name unatrare-node \\',
          '  --subnet-bootstrap 38a1b001756148f3f96f8cff7bd38d2924669f5c1880b4f779512d6449cfff56 \\',
          '  --btc-address YOUR_BITCOIN_ADDRESS',
          'EOF',
          'chmod +x ~/start-node.sh',
          'pm2 start ~/start-node.sh --name unatrare-node',
          'pm2 save && pm2 startup',
          '# Check status',
          'pm2 logs unatrare-node --lines 20',
        ]} />
      </Section>

      {/* ── macOS ── */}
      <Section title="SETUP: MAC (macOS 12 MONTEREY OR NEWER ONLY)">
        <Note>macOS 11 Big Sur, Catalina, or older will NOT work. Pear requires macOS 12+.</Note>

        <h3 className={styles.step}>Step 1 — Install Node.js 22</h3>
        <p className={styles.body}>Download from <strong>nodejs.org</strong> — choose version 22 LTS.</p>

        <h3 className={styles.step}>Step 2 — Install Pear and clone the node</h3>
        <CodeBlock lines={[
          'npm install -g pear',
          'git clone https://github.com/joeatang/unatrare-intercom ~/node',
          'cd ~/node && git checkout unatrare/phase-0 && npm install',
        ]} />

        <h3 className={styles.step}>Step 3 — Start your node</h3>
        <CodeBlock lines={[
          'pear run . \\',
          '  --peer-store-name unatrare-node \\',
          '  --subnet-bootstrap 38a1b001756148f3f96f8cff7bd38d2924669f5c1880b4f779512d6449cfff56 \\',
          '  --btc-address YOUR_BITCOIN_ADDRESS',
        ]} />
        <Note>Keep this terminal window open. Closing it stops the node. For 24/7 operation, use a VPS or a Mac that never sleeps.</Note>
      </Section>

      {/* ── Raspberry Pi ── */}
      <Section title="SETUP: RASPBERRY PI (BEST VALUE)">
        <p className={styles.body}>
          A Raspberry Pi 4 (2GB RAM, ~$35) with a 64GB SD card (~$10) running Ubuntu Server 22.04
          is the ideal community node. Costs about $1–2/month in electricity. Runs silently 24/7.
        </p>
        <p className={styles.body}>
          Follow the Linux VPS steps above exactly — Ubuntu on a Pi is identical to Ubuntu on a cloud server.
          Flash Ubuntu Server 22.04 ARM to your SD card using the <strong>Raspberry Pi Imager</strong> tool.
        </p>
      </Section>

      {/* ── FAQ ── */}
      <Section title="COMMON QUESTIONS">
        <div className={styles.faq}>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>What is a heartbeat?</p>
            <p className={styles.faqA}>
              Every hour, your node automatically sends a small &ldquo;I&rsquo;m still here&rdquo; ping to the UNATRARE registry.
              You do nothing — it&rsquo;s automatic. Your total heartbeat count over time is your proof of loyal participation
              and will determine your share of future NAT rewards.
            </p>
          </div>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>What is my BTC address used for?</p>
            <p className={styles.faqA}>
              It is your identity on the network — not a payment address. UNATRARE doesn&rsquo;t charge you anything
              to run a node. Your BTC address ties your node to a real identity and will be used for reward
              distribution when NAT rewards launch.
            </p>
          </div>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>What files does my node store?</p>
            <p className={styles.faqA}>
              Only UNATRARE-certified Rare Pepe and Counterparty art — images that passed the AI judge panel.
              The full archive is currently a few gigabytes and grows slowly. A 64GB SD card or 25GB VPS
              disk is safe for many years.
            </p>
          </div>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>Can I close my terminal and have it keep running?</p>
            <p className={styles.faqA}>
              If you followed Step 5 (PM2), yes — PM2 keeps it running in the background even if you close
              the terminal or reboot. Without PM2, closing the terminal stops the node.
            </p>
          </div>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>Does saving unatrare.wtf to my homescreen make me a node?</p>
            <p className={styles.faqA}>
              No. That is just a bookmark shortcut. A node means your computer is actively storing and
              serving files. They are completely different things.
            </p>
          </div>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>What happens when TRAC updates?</p>
            <p className={styles.faqA}>
              You would need to pull the updated node software and restart — similar to updating any app.
              Updates will be announced on the UNATRARE and TRAC community channels.
              We are working on an auto-update mechanism.
            </p>
          </div>
          <div className={styles.faqItem}>
            <p className={styles.faqQ}>Who makes Pear? Can I trust it?</p>
            <p className={styles.faqA}>
              Pear is made by <strong>Holepunch</strong> (holepunch.to) — an open source company, code auditable on GitHub.
              TRAC is built on top of Holepunch&rsquo;s Hypercore protocol by the Trac Network team.
              UNATRARE is built on top of TRAC. All layers are open source and readable.
              Only download Pear from the official site.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Back ── */}
      <div className={styles.footer}>
        <Link href="/nodes" className={styles.backLink}>← VIEW NODE REGISTRY</Link>
      </div>
    </main>
    </>
  );
}
