import styles from './IdentityBadges.module.css';

// Presentational only. Renders a row of identity chips. Returns null when there
// are no badges (which is always the case while the reward_badges flag is OFF,
// since getIdentityBadges() returns []). Safe in server or client components.
export default function IdentityBadges({ badges, size = 'md', className = '' }) {
  if (!Array.isArray(badges) || badges.length === 0) return null;

  return (
    <span className={`${styles.row} ${styles[size] || ''} ${className}`.trim()}>
      {badges.map((b) => (
        <span
          key={b.key}
          className={styles.badge}
          style={{ '--badge-color': b.color }}
          title={b.title}
        >
          <span className={styles.glyph} aria-hidden="true">{b.glyph}</span>
          <span className={styles.label}>{b.label}</span>
        </span>
      ))}
    </span>
  );
}
