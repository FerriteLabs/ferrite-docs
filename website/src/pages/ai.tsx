import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

const features = [
  {
    title: 'Vector Search',
    emoji: '🔍',
    description:
      'HNSW and IVF indexes with similarity search in <1ms. Store and query millions of embeddings with 0.98 recall@10.',
  },
  {
    title: 'Semantic Caching',
    emoji: '🧠',
    description:
      'Cache by meaning, not just by key. Reduce LLM API costs by 60–80% with built-in embedding and similarity matching.',
  },
  {
    title: 'RAG Pipeline',
    emoji: '📚',
    description:
      'Built-in document retrieval, chunking, and reranking. Go from raw text to ranked results in a single call.',
  },
];

const codeExample = `import redis

r = redis.Redis()
r.execute_command("VECTOR.CREATE", "idx", "DIM", 384, "TYPE", "HNSW")
r.execute_command("VECTOR.SEARCH", "idx", embedding, "K", 5)`;

function Hero(): ReactNode {
  return (
    <header style={{
      textAlign: 'center',
      padding: '4rem 1rem 3rem',
    }}>
      <Heading as="h1" style={{ fontSize: '2.8rem' }}>
        The AI-Native Cache
      </Heading>
      <p style={{
        fontSize: '1.25rem',
        maxWidth: '640px',
        margin: '0 auto',
        color: 'var(--ifm-color-emphasis-700)',
      }}>
        Vector search, semantic caching, and RAG pipelines — all inside a
        Redis-compatible store running at millions of ops per second.
      </p>
    </header>
  );
}

function FeatureCards(): ReactNode {
  return (
    <section style={{ padding: '2rem 0' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
      }}>
        {features.map((f) => (
          <div
            key={f.title}
            style={{
              border: '1px solid var(--ifm-color-emphasis-300)',
              borderRadius: '8px',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{f.emoji}</div>
            <Heading as="h3">{f.title}</Heading>
            <p style={{ color: 'var(--ifm-color-emphasis-700)' }}>{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CodeExample(): ReactNode {
  return (
    <section style={{ padding: '2rem 0' }}>
      <Heading as="h2" style={{ textAlign: 'center' }}>
        Get started in 3 lines
      </Heading>
      <pre style={{
        maxWidth: '640px',
        margin: '1.5rem auto 0',
        padding: '1.25rem',
        borderRadius: '8px',
        background: 'var(--ifm-color-emphasis-100)',
        overflowX: 'auto',
      }}>
        <code>{codeExample}</code>
      </pre>
    </section>
  );
}

function CallToAction(): ReactNode {
  return (
    <section style={{ textAlign: 'center', padding: '2rem 0 4rem' }}>
      <a
        className="button button--primary button--lg"
        href="/docs/ai-ml/overview"
      >
        Get Started
      </a>
    </section>
  );
}

export default function AI(): ReactNode {
  return (
    <Layout
      title="Ferrite for AI"
      description="Vector search, semantic caching, and RAG pipelines in a Redis-compatible store">
      <main className="container">
        <Hero />
        <FeatureCards />
        <CodeExample />
        <CallToAction />
      </main>
    </Layout>
  );
}
