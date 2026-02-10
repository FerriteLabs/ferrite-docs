import React from 'react';
import styles from './styles.module.css';

type MaturityLevel = 'stable' | 'beta' | 'experimental';

const MATURITY_CONFIG: Record<MaturityLevel, { emoji: string; label: string; className: string }> = {
  stable: { emoji: '✅', label: 'Stable', className: 'stable' },
  beta: { emoji: '🧪', label: 'Beta', className: 'beta' },
  experimental: { emoji: '🔬', label: 'Experimental', className: 'experimental' },
};

interface Props {
  level: MaturityLevel;
}

export default function MaturityBadge({ level }: Props): JSX.Element | null {
  const config = MATURITY_CONFIG[level];
  if (!config) return null;

  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      {config.emoji} {config.label}
    </span>
  );
}
