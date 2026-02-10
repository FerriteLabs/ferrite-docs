import {useState, type ReactNode} from 'react';
import styles from './styles.module.css';

function encodeResp(input: string): string {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return '';
  }

  const lines: string[] = [`*${parts.length}`];

  for (const part of parts) {
    lines.push(`$${part.length}`);
    lines.push(part);
  }

  return lines.join('\\r\\n') + '\\r\\n';
}

function formatRespForDisplay(encoded: string): ReactNode[] {
  const parts = encoded.split('\\r\\n');
  return parts.map((part, idx) => {
    let className = styles.respPlain;
    let label = '';

    if (part.startsWith('*')) {
      className = styles.respArray;
      label = 'Array length';
    } else if (part.startsWith('$')) {
      className = styles.respBulk;
      label = 'String length';
    } else if (part.startsWith('+')) {
      className = styles.respSimple;
      label = 'Simple string';
    } else if (part.startsWith('-')) {
      className = styles.respError;
      label = 'Error';
    } else if (part.startsWith(':')) {
      className = styles.respInteger;
      label = 'Integer';
    } else if (part.length > 0) {
      className = styles.respData;
      label = 'Data';
    }

    if (part === '') return null;

    return (
      <div key={idx} className={styles.respLine}>
        <span className={className}>{part}</span>
        <span className={styles.respCrlf}>\\r\\n</span>
        {label && <span className={styles.respLabel}>{label}</span>}
      </div>
    );
  }).filter(Boolean);
}

const examples = [
  { label: 'GET key', command: 'GET mykey' },
  { label: 'SET key value', command: 'SET mykey Hello' },
  { label: 'HSET hash field value', command: 'HSET user:1 name Alice' },
  { label: 'LPUSH list value', command: 'LPUSH queue task1' },
  { label: 'ZADD sorted_set score member', command: 'ZADD leaderboard 100 player1' },
];

export default function RespDemo(): ReactNode {
  const [input, setInput] = useState('SET mykey Hello');
  const encoded = encodeResp(input);

  return (
    <div className={styles.demoContainer}>
      <div className={styles.demoHeader}>
        <h3>Interactive RESP Encoder</h3>
        <p>Enter a Redis command to see how it's encoded in the RESP protocol.</p>
      </div>

      <div className={styles.exampleButtons}>
        {examples.map((ex, idx) => (
          <button
            key={idx}
            className={styles.exampleButton}
            onClick={() => setInput(ex.command)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className={styles.inputSection}>
        <label htmlFor="resp-input">Command:</label>
        <input
          id="resp-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={styles.input}
          placeholder="Enter a Redis command..."
        />
      </div>

      <div className={styles.outputSection}>
        <div className={styles.outputHeader}>
          <span>RESP Encoding:</span>
          <button
            className={styles.copyButton}
            onClick={() => navigator.clipboard.writeText(encoded.replace(/\\r\\n/g, '\r\n'))}
          >
            Copy
          </button>
        </div>
        <div className={styles.output}>
          {encoded ? formatRespForDisplay(encoded) : (
            <span className={styles.placeholder}>Enter a command above</span>
          )}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendTitle}>Legend:</div>
        <div className={styles.legendItems}>
          <span><span className={styles.respArray}>*</span> Array</span>
          <span><span className={styles.respBulk}>$</span> Bulk String</span>
          <span><span className={styles.respSimple}>+</span> Simple String</span>
          <span><span className={styles.respInteger}>:</span> Integer</span>
          <span><span className={styles.respError}>-</span> Error</span>
        </div>
      </div>
    </div>
  );
}
