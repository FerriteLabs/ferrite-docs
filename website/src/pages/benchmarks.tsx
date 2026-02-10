import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './benchmarks.module.css';

type BenchmarkRow = {
  operation: string;
  throughput: string;
  p50: string;
  p99: string;
  p999: string;
};

type VectorBenchmarkRow = {
  operation: string;
  indexType: string;
  throughput: string;
  p50: string;
  p99: string;
  recall: string;
};

const coreOperations: BenchmarkRow[] = [
  { operation: 'GET', throughput: '11.8M/s', p50: '83ns', p99: '125ns', p999: '167ns' },
  { operation: 'SET', throughput: '2.6M/s', p50: '84ns', p99: '250ns', p999: '16us' },
  { operation: 'HGET', throughput: '8.2M/s', p50: '95ns', p99: '180ns', p999: '350ns' },
  { operation: 'SADD', throughput: '3.1M/s', p50: '120ns', p99: '290ns', p999: '1us' },
  { operation: 'ZADD', throughput: '1.8M/s', p50: '180ns', p99: '450ns', p999: '2us' },
];

const vectorOperations: VectorBenchmarkRow[] = [
  { operation: 'VECTOR.SEARCH (k=10)', indexType: 'HNSW', throughput: '45K/s', p50: '18us', p99: '85us', recall: '0.98' },
  { operation: 'VECTOR.SEARCH (k=10)', indexType: 'IVF', throughput: '28K/s', p50: '32us', p99: '120us', recall: '0.95' },
  { operation: 'VECTOR.SEARCH (k=10)', indexType: 'Flat', throughput: '850/s', p50: '1.1ms', p99: '1.8ms', recall: '1.00' },
  { operation: 'VECTOR.ADD', indexType: 'HNSW', throughput: '12K/s', p50: '75us', p99: '350us', recall: '-' },
  { operation: 'VECTOR.ADD', indexType: 'IVF', throughput: '18K/s', p50: '48us', p99: '180us', recall: '-' },
];

const semanticOperations = [
  { operation: 'SEMANTIC.GET (hit)', embedding: 'ONNX local', throughput: '32K/s', p50: '28us', p99: '95us' },
  { operation: 'SEMANTIC.GET (hit)', embedding: 'Cached embed', throughput: '41K/s', p50: '22us', p99: '78us' },
  { operation: 'SEMANTIC.SET', embedding: 'ONNX local', throughput: '1.2K/s', p50: '0.8ms', p99: '2.1ms' },
  { operation: 'SEMANTIC.SET', embedding: 'OpenAI API', throughput: '180/s', p50: '5.2ms', p99: '12ms' },
];

const queryOperations = [
  { query: 'Simple SELECT', dataset: '100K keys', throughput: '85K/s', p50: '11us', p99: '45us' },
  { query: 'SELECT with WHERE', dataset: '100K keys', throughput: '42K/s', p50: '22us', p99: '95us' },
  { query: 'JOIN (2 patterns)', dataset: '10K x 10K', throughput: '2.8K/s', p50: '340us', p99: '1.2ms' },
  { query: 'GROUP BY + COUNT', dataset: '100K keys', throughput: '1.5K/s', p50: '0.6ms', p99: '2.1ms' },
  { query: 'Materialized View (read)', dataset: '-', throughput: '95K/s', p50: '9us', p99: '38us' },
];

const timeTravelOperations = [
  { operation: 'GET AS OF (in memory)', depth: '<1h', throughput: '8.5M/s', p50: '95ns', p99: '180ns' },
  { operation: 'GET AS OF (warm tier)', depth: '1-24h', throughput: '450K/s', p50: '2us', p99: '12us' },
  { operation: 'GET AS OF (cold tier)', depth: '>24h', throughput: '25K/s', p50: '38us', p99: '180us' },
  { operation: 'HISTORY (10 versions)', depth: '-', throughput: '1.2M/s', p50: '0.8us', p99: '3.5us' },
];

function CoreBenchmarks(): ReactNode {
  return (
    <section className={styles.benchmarkSection}>
      <Heading as="h2">Core Operations</Heading>
      <p className={styles.subtitle}>Apple M1 Pro, Single-threaded</p>
      <div className={styles.tableWrapper}>
        <table className={styles.benchmarkTable}>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Throughput</th>
              <th>P50</th>
              <th>P99</th>
              <th>P99.9</th>
            </tr>
          </thead>
          <tbody>
            {coreOperations.map((row, idx) => (
              <tr key={idx}>
                <td><code>{row.operation}</code></td>
                <td className={styles.highlight}>{row.throughput}</td>
                <td>{row.p50}</td>
                <td>{row.p99}</td>
                <td>{row.p999}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VectorBenchmarks(): ReactNode {
  return (
    <section className={styles.benchmarkSection}>
      <Heading as="h2">Vector Search</Heading>
      <p className={styles.subtitle}>1M vectors, 384 dimensions</p>
      <div className={styles.tableWrapper}>
        <table className={styles.benchmarkTable}>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Index Type</th>
              <th>Throughput</th>
              <th>P50</th>
              <th>P99</th>
              <th>Recall@10</th>
            </tr>
          </thead>
          <tbody>
            {vectorOperations.map((row, idx) => (
              <tr key={idx}>
                <td><code>{row.operation}</code></td>
                <td>{row.indexType}</td>
                <td className={styles.highlight}>{row.throughput}</td>
                <td>{row.p50}</td>
                <td>{row.p99}</td>
                <td>{row.recall}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SemanticBenchmarks(): ReactNode {
  return (
    <section className={styles.benchmarkSection}>
      <Heading as="h2">Semantic Caching</Heading>
      <p className={styles.subtitle}>Cache hit rate depends on query similarity; typical LLM workloads see 40-60% hit rates</p>
      <div className={styles.tableWrapper}>
        <table className={styles.benchmarkTable}>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Embedding</th>
              <th>Throughput</th>
              <th>P50</th>
              <th>P99</th>
            </tr>
          </thead>
          <tbody>
            {semanticOperations.map((row, idx) => (
              <tr key={idx}>
                <td><code>{row.operation}</code></td>
                <td>{row.embedding}</td>
                <td className={styles.highlight}>{row.throughput}</td>
                <td>{row.p50}</td>
                <td>{row.p99}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QueryBenchmarks(): ReactNode {
  return (
    <section className={styles.benchmarkSection}>
      <Heading as="h2">FerriteQL Queries</Heading>
      <p className={styles.subtitle}>SQL-like query performance</p>
      <div className={styles.tableWrapper}>
        <table className={styles.benchmarkTable}>
          <thead>
            <tr>
              <th>Query Type</th>
              <th>Dataset Size</th>
              <th>Throughput</th>
              <th>P50</th>
              <th>P99</th>
            </tr>
          </thead>
          <tbody>
            {queryOperations.map((row, idx) => (
              <tr key={idx}>
                <td>{row.query}</td>
                <td>{row.dataset}</td>
                <td className={styles.highlight}>{row.throughput}</td>
                <td>{row.p50}</td>
                <td>{row.p99}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TimeTravelBenchmarks(): ReactNode {
  return (
    <section className={styles.benchmarkSection}>
      <Heading as="h2">Time-Travel Queries</Heading>
      <p className={styles.subtitle}>Query data at any point in time</p>
      <div className={styles.tableWrapper}>
        <table className={styles.benchmarkTable}>
          <thead>
            <tr>
              <th>Operation</th>
              <th>History Depth</th>
              <th>Throughput</th>
              <th>P50</th>
              <th>P99</th>
            </tr>
          </thead>
          <tbody>
            {timeTravelOperations.map((row, idx) => (
              <tr key={idx}>
                <td><code>{row.operation}</code></td>
                <td>{row.depth}</td>
                <td className={styles.highlight}>{row.throughput}</td>
                <td>{row.p50}</td>
                <td>{row.p99}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ComparisonData = {
  operation: string;
  ferrite: number;
  redis: number;
  dragonfly?: number;
  garnet?: number;
  unit: string;
};

const throughputComparison: ComparisonData[] = [
  { operation: 'GET', ferrite: 11800, redis: 750, dragonfly: 4000, garnet: 2500, unit: 'K ops/s' },
  { operation: 'SET', ferrite: 2600, redis: 650, dragonfly: 3500, garnet: 2000, unit: 'K ops/s' },
  { operation: 'HGET', ferrite: 8200, redis: 600, dragonfly: 3200, garnet: 1800, unit: 'K ops/s' },
  { operation: 'LPUSH', ferrite: 3100, redis: 550, dragonfly: 2800, garnet: 1500, unit: 'K ops/s' },
];

function ComparisonChart(): ReactNode {
  const maxValue = Math.max(...throughputComparison.flatMap(d => [d.ferrite, d.redis, d.dragonfly || 0, d.garnet || 0]));

  return (
    <section className={styles.comparisonSection}>
      <Heading as="h2">Performance Comparison</Heading>
      <p className={styles.subtitle}>Throughput comparison with other Redis alternatives (higher is better)</p>

      <div className={styles.chartContainer}>
        {throughputComparison.map((data, idx) => (
          <div key={idx} className={styles.chartRow}>
            <div className={styles.chartLabel}>{data.operation}</div>
            <div className={styles.chartBars}>
              <div
                className={`${styles.chartBar} ${styles.chartBarFerrite}`}
                style={{ width: `${(data.ferrite / maxValue) * 100}%` }}
              >
                <span className={styles.chartValue}>{(data.ferrite / 1000).toFixed(1)}M</span>
              </div>
              {data.dragonfly && (
                <div
                  className={`${styles.chartBar} ${styles.chartBarDragonfly}`}
                  style={{ width: `${(data.dragonfly / maxValue) * 100}%` }}
                >
                  <span className={styles.chartValue}>{(data.dragonfly / 1000).toFixed(1)}M</span>
                </div>
              )}
              {data.garnet && (
                <div
                  className={`${styles.chartBar} ${styles.chartBarGarnet}`}
                  style={{ width: `${(data.garnet / maxValue) * 100}%` }}
                >
                  <span className={styles.chartValue}>{(data.garnet / 1000).toFixed(1)}M</span>
                </div>
              )}
              <div
                className={`${styles.chartBar} ${styles.chartBarRedis}`}
                style={{ width: `${(data.redis / maxValue) * 100}%` }}
              >
                <span className={styles.chartValue}>{(data.redis / 1000).toFixed(1)}M</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.legendFerrite}`}></div>
          <span>Ferrite</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.legendDragonfly}`}></div>
          <span>Dragonfly</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.legendGarnet}`}></div>
          <span>Garnet</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.legendRedis}`}></div>
          <span>Redis</span>
        </div>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--ifm-color-emphasis-600)', marginTop: '1rem', textAlign: 'center' }}>
        * All benchmarks on equivalent hardware. Redis is single-threaded; others use multi-threading.
      </p>
    </section>
  );
}

function Methodology(): ReactNode {
  return (
    <section className={styles.methodology}>
      <Heading as="h2">Benchmark Methodology</Heading>
      <div className={styles.methodologyContent}>
        <div className={styles.methodologyItem}>
          <Heading as="h3">Hardware</Heading>
          <ul>
            <li>Apple M1 Pro (8 performance cores)</li>
            <li>32GB RAM</li>
            <li>1TB NVMe SSD</li>
          </ul>
        </div>
        <div className={styles.methodologyItem}>
          <Heading as="h3">Software</Heading>
          <ul>
            <li>macOS Sonoma 14.x</li>
            <li>Rust 1.88+ (release build with LTO)</li>
            <li>Criterion.rs for microbenchmarks</li>
          </ul>
        </div>
        <div className={styles.methodologyItem}>
          <Heading as="h3">Conditions</Heading>
          <ul>
            <li>Single-threaded unless noted</li>
            <li>Warm cache after 10K iterations</li>
            <li>10K+ samples per benchmark</li>
          </ul>
        </div>
      </div>
      <div className={styles.runYourOwn}>
        <Heading as="h3">Run Your Own Benchmarks</Heading>
        <pre>
          <code>
{`# Clone the repository
git clone https://github.com/ferrite-rs/ferrite.git
cd ferrite

# Run benchmarks
cargo bench

# Run specific benchmark
cargo bench --bench throughput`}
          </code>
        </pre>
      </div>
    </section>
  );
}

export default function Benchmarks(): ReactNode {
  return (
    <Layout
      title="Benchmarks"
      description="Ferrite performance benchmarks - throughput and latency measurements">
      <main className={styles.benchmarksPage}>
        <div className="container">
          <header className={styles.header}>
            <Heading as="h1">Performance Benchmarks</Heading>
            <p>
              Ferrite is built for predictable, low-latency performance.
              Here are our benchmark results across different workloads.
            </p>
          </header>
          <ComparisonChart />
          <CoreBenchmarks />
          <VectorBenchmarks />
          <SemanticBenchmarks />
          <QueryBenchmarks />
          <TimeTravelBenchmarks />
          <Methodology />
        </div>
      </main>
    </Layout>
  );
}
