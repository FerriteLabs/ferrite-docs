import {type ReactNode, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';

import styles from './index.module.css';

function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.copyIcon}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#27c93f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const command = 'cargo install ferrite';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.installCommand} onClick={handleCopy} title="Click to copy">
      <code>$ {command}</code>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </div>
  );
}

function Badges() {
  return (
    <div className={styles.badges}>
      <a href="https://github.com/ferrite-rs/ferrite/actions" target="_blank" rel="noopener noreferrer">
        <img src="https://img.shields.io/github/actions/workflow/status/ferrite-rs/ferrite/ci.yml?branch=main&style=flat-square&logo=github&label=build" alt="Build Status" />
      </a>
      <a href="https://crates.io/crates/ferrite" target="_blank" rel="noopener noreferrer">
        <img src="https://img.shields.io/crates/v/ferrite?style=flat-square&logo=rust&color=orange" alt="Crates.io" />
      </a>
      <a href="https://docs.rs/ferrite" target="_blank" rel="noopener noreferrer">
        <img src="https://img.shields.io/docsrs/ferrite?style=flat-square&logo=docs.rs" alt="Documentation" />
      </a>
      <a href="https://github.com/ferrite-rs/ferrite/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
        <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License" />
      </a>
      <a href="https://discord.gg/ferrite" target="_blank" rel="noopener noreferrer">
        <img src="https://img.shields.io/discord/1234567890?style=flat-square&logo=discord&label=discord&color=5865F2" alt="Discord" />
      </a>
    </div>
  );
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <Badges />
        <InstallCommand />
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            style={{marginLeft: '1rem', color: 'white', borderColor: 'white'}}
            href="https://github.com/ferrite-rs/ferrite">
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function CodeExample() {
  const rustCode = `use ferrite::embedded::Database;

fn main() -> anyhow::Result<()> {
    // Open or create database
    let db = Database::open("./my_data")?;

    // Redis-compatible commands
    db.set("user:1", r#"{"name": "Alice"}"#)?;
    let user = db.get("user:1")?;

    // Vector search for AI workloads
    db.vector_create("embeddings", 384, "cosine")?;
    db.vector_add("embeddings", "doc1", &embedding, metadata)?;

    // Semantic caching - reduce LLM costs by 40-60%
    db.semantic_set("What is Rust?", cached_response)?;

    Ok(())
}`;

  const cliCode = `$ redis-cli -p 6379
127.0.0.1:6379> SET mykey "Hello, Ferrite!"
OK
127.0.0.1:6379> GET mykey
"Hello, Ferrite!"
127.0.0.1:6379> VECTOR.CREATE myindex DIM 384 DISTANCE cosine
OK
127.0.0.1:6379> SEMANTIC.SET "France's capital?" "Paris is the capital..."
OK`;

  return (
    <section className={styles.codeExample}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h3">Embedded Mode</Heading>
            <p>Use Ferrite as an embedded library - no server needed.</p>
            <CodeBlock language="rust" title="main.rs">
              {rustCode}
            </CodeBlock>
          </div>
          <div className="col col--6">
            <Heading as="h3">Server Mode</Heading>
            <p>Drop-in Redis replacement with any Redis client.</p>
            <CodeBlock language="bash" title="Terminal">
              {cliCode}
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

function PerformanceTeaser() {
  return (
    <section className={styles.performance}>
      <div className="container">
        <Heading as="h2" className="text--center">
          Blazing Fast Performance
        </Heading>
        <p className="text--center" style={{maxWidth: '600px', margin: '0 auto 2rem'}}>
          Built with epoch-based concurrency and io_uring-first persistence for predictable, low-latency operations.
        </p>
        <div className={styles.metrics}>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>11.8M+</div>
            <div className={styles.metricLabel}>GET ops/sec</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>2.6M+</div>
            <div className={styles.metricLabel}>SET ops/sec</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>&lt;250ns</div>
            <div className={styles.metricLabel}>P99 Latency</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>45K/s</div>
            <div className={styles.metricLabel}>Vector Search</div>
          </div>
        </div>
        <div className="text--center" style={{marginTop: '2rem'}}>
          <Link
            className="button button--primary button--lg"
            to="/benchmarks">
            View Full Benchmarks
          </Link>
        </div>
      </div>
    </section>
  );
}

function ComparisonTable() {
  return (
    <section className={styles.comparison}>
      <div className="container">
        <Heading as="h2" className="text--center">
          Why Ferrite?
        </Heading>
        <p className="text--center" style={{maxWidth: '600px', margin: '0 auto 2rem'}}>
          Ferrite combines the best of Redis compatibility with next-generation features for the AI/cloud-native era.
        </p>
        <div className={styles.comparisonTable}>
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Redis</th>
                <th>Dragonfly</th>
                <th>Garnet</th>
                <th>Ferrite</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Multi-threaded</td>
                <td>-</td>
                <td>+</td>
                <td>+</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>Tiered Storage</td>
                <td>-</td>
                <td>-</td>
                <td>+</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>Vector Search</td>
                <td>+</td>
                <td>-</td>
                <td>-</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>Semantic Caching</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>Time-Travel Queries</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>CRDT Replication</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>Embedded Mode</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td className={styles.highlight}>+</td>
              </tr>
              <tr>
                <td>WASM Functions</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td className={styles.highlight}>+</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TrustedBySection() {
  const companies = [
    { name: 'Your Company', placeholder: true },
    { name: 'Could Be', placeholder: true },
    { name: 'Featured', placeholder: true },
    { name: 'Here', placeholder: true },
  ];

  return (
    <section className={styles.trustedBy}>
      <div className="container">
        <p className={styles.trustedByLabel}>Trusted by developers at</p>
        <div className={styles.trustedByLogos}>
          {companies.map((company, idx) => (
            <div key={idx} className={styles.companyLogo}>
              <span className={styles.companyPlaceholder}>{company.name}</span>
            </div>
          ))}
        </div>
        <p className={styles.trustedByNote}>
          <Link to="https://github.com/ferrite-rs/ferrite/issues/new?template=showcase.md">
            Add your company
          </Link>
        </p>
      </div>
    </section>
  );
}

function OpenSourceSection() {
  return (
    <section className={styles.openSource}>
      <div className="container">
        <div className={styles.openSourceContent}>
          <div className={styles.openSourceText}>
            <Heading as="h2">100% Open Source</Heading>
            <p>
              Ferrite is released under the Apache 2.0 license. No vendor lock-in,
              no proprietary extensions. Fork it, modify it, contribute back.
            </p>
            <div className={styles.openSourceStats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>Apache 2.0</span>
                <span className={styles.statLabel}>License</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>Rust</span>
                <span className={styles.statLabel}>Language</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>Active</span>
                <span className={styles.statLabel}>Development</span>
              </div>
            </div>
            <div className={styles.buttons} style={{justifyContent: 'flex-start', marginTop: '1.5rem'}}>
              <Link
                className="button button--primary"
                href="https://github.com/ferrite-rs/ferrite">
                View on GitHub
              </Link>
              <Link
                className="button button--secondary"
                style={{marginLeft: '0.5rem'}}
                to="/docs/community/contributing">
                Contribute
              </Link>
            </div>
          </div>
          <div className={styles.openSourceCode}>
            <div className={styles.terminalWindow}>
              <div className={styles.terminalHeader}>
                <span className={styles.terminalDot} style={{background: '#ff5f56'}}></span>
                <span className={styles.terminalDot} style={{background: '#ffbd2e'}}></span>
                <span className={styles.terminalDot} style={{background: '#27c93f'}}></span>
              </div>
              <pre className={styles.terminalBody}>
{`$ git clone https://github.com/ferrite-rs/ferrite
$ cd ferrite
$ cargo build --release
$ ./target/release/ferrite

Ferrite v0.1.0
Listening on 127.0.0.1:6379
Ready to accept connections`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className={styles.cta}>
      <div className="container text--center">
        <Heading as="h2">Ready to Get Started?</Heading>
        <p style={{maxWidth: '500px', margin: '0 auto 2rem'}}>
          Ferrite is open source and free to use. Start building with the speed of memory, the capacity of disk.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/getting-started/installation">
            Installation Guide
          </Link>
          <Link
            className="button button--secondary button--lg"
            style={{marginLeft: '1rem'}}
            to="/docs">
            Read the Docs
          </Link>
        </div>
      </div>
    </section>
  );
}

type UseCase = {
  icon: ReactNode;
  title: string;
  description: string;
};

function AIIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      <path d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
      <path d="M16.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="6" height="6" rx="1"/>
      <rect x="16" y="2" width="6" height="6" rx="1"/>
      <rect x="2" y="16" width="6" height="6" rx="1"/>
      <rect x="16" y="16" width="6" height="6" rx="1"/>
      <path d="M8 5h8"/>
      <path d="M8 19h8"/>
      <path d="M5 8v8"/>
      <path d="M19 8v8"/>
    </svg>
  );
}

function EmbeddedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <path d="M4 9h5"/>
      <path d="M15 9h5"/>
      <path d="M4 15h5"/>
      <path d="M15 15h5"/>
      <path d="M9 4v5"/>
      <path d="M15 4v5"/>
      <path d="M9 15v5"/>
      <path d="M15 15v5"/>
    </svg>
  );
}

function MultiTenantIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

const useCases: UseCase[] = [
  {
    icon: <AIIcon />,
    title: 'AI & ML Applications',
    description: 'Vector search, semantic caching, and RAG pipelines for LLM-powered apps.',
  },
  {
    icon: <ScaleIcon />,
    title: 'Caching at Scale',
    description: 'Tiered storage handles datasets larger than RAM with sub-millisecond latency.',
  },
  {
    icon: <EmbeddedIcon />,
    title: 'Embedded Applications',
    description: 'Use as a library like SQLite in desktop apps, CLIs, and edge devices.',
  },
  {
    icon: <MultiTenantIcon />,
    title: 'Multi-Tenant SaaS',
    description: 'Native tenant isolation with per-tenant resource limits and quotas.',
  },
];

function UseCasesSection() {
  return (
    <section className={styles.useCases}>
      <div className="container">
        <Heading as="h2" className="text--center">
          Perfect For
        </Heading>
        <p className="text--center" style={{maxWidth: '600px', margin: '0 auto'}}>
          From AI-powered applications to high-scale caching, Ferrite adapts to your workload.
        </p>
        <div className={styles.useCaseGrid}>
          {useCases.map((useCase, idx) => (
            <div key={idx} className={styles.useCaseCard}>
              <div className={styles.useCaseIcon}>{useCase.icon}</div>
              <div className={styles.useCaseTitle}>{useCase.title}</div>
              <p className={styles.useCaseDescription}>{useCase.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="High-Performance Redis Alternative"
      description="Ferrite is a high-performance, tiered-storage key-value store designed as a drop-in Redis replacement. Built in Rust with epoch-based concurrency and io_uring-first persistence.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <UseCasesSection />
        <CodeExample />
        <PerformanceTeaser />
        <ComparisonTable />
        <TrustedBySection />
        <OpenSourceSection />
        <CallToAction />
      </main>
    </Layout>
  );
}
