import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './404.module.css';

export default function NotFound(): React.ReactElement {
  return (
    <Layout title="Page Not Found">
      <main className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>404</h1>
          <p className={styles.subtitle}>Page Not Found</p>
          <p className={styles.description}>
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className={styles.actions}>
            <Link className="button button--primary button--lg" to="/">
              Go to Homepage
            </Link>
            <Link className="button button--secondary button--lg" to="/docs">
              Browse Documentation
            </Link>
          </div>
          <div className={styles.helpLinks}>
            <h3>Looking for something specific?</h3>
            <ul>
              <li>
                <Link to="/docs/getting-started/installation">Getting Started</Link>
              </li>
              <li>
                <Link to="/docs/getting-started/quick-start">Quick Start Guide</Link>
              </li>
              <li>
                <Link to="/docs/community/faq">Frequently Asked Questions</Link>
              </li>
              <li>
                <Link to="/docs/community/support">Get Support</Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </Layout>
  );
}
