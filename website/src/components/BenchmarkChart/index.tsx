import React from 'react';
import styles from './styles.module.css';

interface BenchmarkResult {
  name: string;
  value: number;
  color: string;
}

interface Props {
  title: string;
  unit: string;
  results: BenchmarkResult[];
}

export default function BenchmarkChart({ title, unit, results }: Props): JSX.Element {
  const maxValue = Math.max(...results.map(r => r.value));

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>{title}</h4>
      {results.map((result) => (
        <div key={result.name} className={styles.row}>
          <span className={styles.label}>{result.name}</span>
          <div className={styles.barContainer}>
            <div
              className={styles.bar}
              style={{
                width: `${(result.value / maxValue) * 100}%`,
                backgroundColor: result.color,
              }}
            >
              <span className={styles.value}>
                {result.value.toLocaleString()} {unit}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
