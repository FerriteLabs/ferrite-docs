import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

// SVG Icon Components
function RedisIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  );
}

function TieredStorageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  );
}

function VectorSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
      <path d="M11 8v6M8 11h6"/>
    </svg>
  );
}

function EmbeddedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <path d="M4 9h5M15 9h5M4 15h5M15 15h5"/>
      <path d="M9 4v5M15 4v5M9 15v5M15 15v5"/>
    </svg>
  );
}

function TimeTravelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
      <path d="M2 12h2M20 12h2M12 2v2M12 20v2"/>
    </svg>
  );
}

function MultiModelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"/>
    </svg>
  );
}

type FeatureItem = {
  title: string;
  icon: ReactNode;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Redis Compatible',
    icon: <RedisIcon />,
    description: (
      <>
        Full RESP2/RESP3 wire protocol support. Works with any Redis client library.
        Drop-in replacement for existing Redis deployments.
      </>
    ),
  },
  {
    title: 'Tiered Storage',
    icon: <TieredStorageIcon />,
    description: (
      <>
        Inspired by Microsoft FASTER. Hot data in memory, warm data in mmap,
        cold data on disk or cloud storage. Automatic tier management.
      </>
    ),
  },
  {
    title: 'Vector Search',
    icon: <VectorSearchIcon />,
    description: (
      <>
        Native HNSW and IVF indexes for AI/ML workloads.
        Semantic caching reduces LLM API costs by 40-60%.
      </>
    ),
  },
  {
    title: 'Embedded Mode',
    icon: <EmbeddedIcon />,
    description: (
      <>
        Use as a library like SQLite - no separate server process.
        Perfect for desktop apps, CLIs, and edge deployments.
      </>
    ),
  },
  {
    title: 'Time-Travel Queries',
    icon: <TimeTravelIcon />,
    description: (
      <>
        Query data at any point in time. Debug issues, audit changes,
        and recover from mistakes without backups.
      </>
    ),
  },
  {
    title: 'Multi-Model Database',
    icon: <MultiModelIcon />,
    description: (
      <>
        Beyond key-value: document store, graph database, time series,
        and full-text search - all in one unified system.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>{icon}</div>
        <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
        <p className={styles.featureDescription}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className="text--center" style={{marginBottom: '2rem'}}>
          Key Features
        </Heading>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
