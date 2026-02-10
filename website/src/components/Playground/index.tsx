import { useState, useRef, useEffect, type ReactNode, KeyboardEvent, useCallback } from 'react';
import styles from './styles.module.css';

interface CommandResult {
  command: string;
  response: string;
  isError?: boolean;
  timestamp: number;
}

interface MockState {
  strings: Map<string, { value: string; expiry?: number }>;
  hashes: Map<string, Map<string, string>>;
  lists: Map<string, string[]>;
  sets: Map<string, Set<string>>;
  sortedSets: Map<string, Map<string, number>>;
  vectors: Map<string, { dim: number; distance: string; data: Map<string, number[]> }>;
  timeSeries: Map<string, Array<{ timestamp: number; value: number }>>;
  documents: Map<string, object>;
  graphs: Map<string, { nodes: Map<string, object>; edges: Array<{ from: string; to: string; rel: string }> }>;
}

function createInitialState(): MockState {
  return {
    strings: new Map(),
    hashes: new Map(),
    lists: new Map(),
    sets: new Map(),
    sortedSets: new Map(),
    vectors: new Map(),
    timeSeries: new Map(),
    documents: new Map(),
    graphs: new Map(),
  };
}

// All supported commands for autocomplete
const ALL_COMMANDS = [
  // String commands
  'SET', 'GET', 'INCR', 'DECR', 'INCRBY', 'DECRBY', 'APPEND', 'STRLEN', 'MSET', 'MGET', 'SETNX', 'SETEX', 'GETSET', 'GETRANGE',
  // Key commands
  'DEL', 'EXISTS', 'KEYS', 'TYPE', 'TTL', 'PTTL', 'EXPIRE', 'PERSIST', 'RENAME', 'RANDOMKEY', 'SCAN',
  // Hash commands
  'HSET', 'HGET', 'HGETALL', 'HMSET', 'HMGET', 'HDEL', 'HEXISTS', 'HKEYS', 'HVALS', 'HLEN', 'HINCRBY', 'HSCAN',
  // List commands
  'LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LRANGE', 'LLEN', 'LINDEX', 'LSET', 'LINSERT', 'LREM', 'LTRIM',
  // Set commands
  'SADD', 'SREM', 'SMEMBERS', 'SISMEMBER', 'SCARD', 'SUNION', 'SINTER', 'SDIFF', 'SPOP', 'SRANDMEMBER',
  // Sorted Set commands
  'ZADD', 'ZREM', 'ZRANGE', 'ZREVRANGE', 'ZRANK', 'ZSCORE', 'ZCARD', 'ZCOUNT', 'ZINCRBY', 'ZRANGEBYSCORE',
  // Vector commands (Ferrite-specific)
  'VECTOR.CREATE', 'VECTOR.ADD', 'VECTOR.SEARCH', 'VECTOR.DELETE', 'VECTOR.INFO',
  // Time Series commands (Ferrite-specific)
  'TS.CREATE', 'TS.ADD', 'TS.RANGE', 'TS.MRANGE', 'TS.GET', 'TS.INFO',
  // Semantic commands (Ferrite-specific)
  'SEMANTIC.SET', 'SEMANTIC.GET', 'SEMANTIC.SEARCH', 'SEMANTIC.DELETE',
  // Document commands (Ferrite-specific)
  'DOC.SET', 'DOC.GET', 'DOC.SEARCH', 'DOC.DELETE',
  // Graph commands (Ferrite-specific)
  'GRAPH.QUERY', 'GRAPH.ADDNODE', 'GRAPH.ADDEDGE',
  // Server commands
  'PING', 'ECHO', 'INFO', 'DBSIZE', 'FLUSHDB', 'FLUSHALL', 'TIME', 'CLIENT', 'DEBUG', 'CONFIG',
  // Other
  'HELP', 'TUTORIAL',
];

function formatResponse(value: unknown): string {
  if (value === null || value === undefined) {
    return '(nil)';
  }
  if (typeof value === 'number') {
    return `(integer) ${value}`;
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(empty array)';
    }
    return value.map((v, i) => `${i + 1}) ${formatResponse(v)}`).join('\n');
  }
  return String(value);
}

function executeCommand(cmd: string, state: MockState): { response: string; isError: boolean } {
  const parts = parseCommand(cmd);
  if (parts.length === 0) {
    return { response: '', isError: false };
  }

  const command = parts[0].toUpperCase();
  const args = parts.slice(1);

  try {
    switch (command) {
      // Connection/Server commands
      case 'PING':
        return { response: args[0] ? `"${args[0]}"` : 'PONG', isError: false };

      case 'ECHO':
        return { response: formatResponse(args[0] || ''), isError: false };

      case 'INFO': {
        const section = args[0]?.toLowerCase() || 'server';
        const info = `# ${section}
ferrite_version:0.1.0
redis_version:7.0.0
arch_bits:64
os:Playground (Browser)
uptime_in_seconds:${Math.floor((Date.now() - performance.timeOrigin) / 1000)}
connected_clients:1
used_memory:${formatBytes((performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize || 0)}
used_memory_peak:${formatBytes((performance as unknown as { memory?: { totalJSHeapSize?: number } }).memory?.totalJSHeapSize || 0)}
total_keys:${state.strings.size + state.hashes.size + state.lists.size + state.sets.size}
vector_indexes:${state.vectors.size}
time_series:${state.timeSeries.size}`;
        return { response: info, isError: false };
      }

      case 'TIME': {
        const now = Date.now();
        const seconds = Math.floor(now / 1000);
        const microseconds = (now % 1000) * 1000;
        return { response: `1) "${seconds}"\n2) "${microseconds}"`, isError: false };
      }

      case 'DBSIZE':
        return {
          response: `(integer) ${state.strings.size + state.hashes.size + state.lists.size + state.sets.size + state.sortedSets.size}`,
          isError: false
        };

      case 'FLUSHDB':
      case 'FLUSHALL':
        state.strings.clear();
        state.hashes.clear();
        state.lists.clear();
        state.sets.clear();
        state.sortedSets.clear();
        state.vectors.clear();
        state.timeSeries.clear();
        state.documents.clear();
        state.graphs.clear();
        return { response: 'OK', isError: false };

      // String commands
      case 'SET': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'set\' command', isError: true };
        }
        const [key, value, ...opts] = args;
        let expiry: number | undefined;
        let condition: 'NX' | 'XX' | undefined;
        let getPrevious = false;

        for (let i = 0; i < opts.length; i++) {
          const opt = opts[i].toUpperCase();
          if (opt === 'EX' && opts[i + 1]) {
            expiry = Date.now() + parseInt(opts[i + 1]) * 1000;
            i++;
          } else if (opt === 'PX' && opts[i + 1]) {
            expiry = Date.now() + parseInt(opts[i + 1]);
            i++;
          } else if (opt === 'NX') {
            condition = 'NX';
          } else if (opt === 'XX') {
            condition = 'XX';
          } else if (opt === 'GET') {
            getPrevious = true;
          }
        }

        const existing = state.strings.get(key);

        if (condition === 'NX' && existing) {
          return { response: '(nil)', isError: false };
        }
        if (condition === 'XX' && !existing) {
          return { response: '(nil)', isError: false };
        }

        state.strings.set(key, { value, expiry });

        if (getPrevious) {
          return { response: existing ? formatResponse(existing.value) : '(nil)', isError: false };
        }
        return { response: 'OK', isError: false };
      }

      case 'SETNX': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'setnx\' command', isError: true };
        }
        if (state.strings.has(args[0])) {
          return { response: '(integer) 0', isError: false };
        }
        state.strings.set(args[0], { value: args[1] });
        return { response: '(integer) 1', isError: false };
      }

      case 'SETEX': {
        if (args.length !== 3) {
          return { response: '(error) ERR wrong number of arguments for \'setex\' command', isError: true };
        }
        const expiry = Date.now() + parseInt(args[1]) * 1000;
        state.strings.set(args[0], { value: args[2], expiry });
        return { response: 'OK', isError: false };
      }

      case 'GET': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'get\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        if (!entry) return { response: '(nil)', isError: false };
        if (entry.expiry && Date.now() > entry.expiry) {
          state.strings.delete(args[0]);
          return { response: '(nil)', isError: false };
        }
        return { response: formatResponse(entry.value), isError: false };
      }

      case 'GETSET': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'getset\' command', isError: true };
        }
        const old = state.strings.get(args[0]);
        state.strings.set(args[0], { value: args[1] });
        return { response: old ? formatResponse(old.value) : '(nil)', isError: false };
      }

      case 'APPEND': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'append\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        const newValue = (entry?.value || '') + args[1];
        state.strings.set(args[0], { value: newValue });
        return { response: `(integer) ${newValue.length}`, isError: false };
      }

      case 'STRLEN': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'strlen\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        return { response: `(integer) ${entry?.value.length || 0}`, isError: false };
      }

      case 'INCR': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'incr\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        const current = entry ? parseInt(entry.value) || 0 : 0;
        state.strings.set(args[0], { value: String(current + 1) });
        return { response: `(integer) ${current + 1}`, isError: false };
      }

      case 'DECR': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'decr\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        const current = entry ? parseInt(entry.value) || 0 : 0;
        state.strings.set(args[0], { value: String(current - 1) });
        return { response: `(integer) ${current - 1}`, isError: false };
      }

      case 'INCRBY': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'incrby\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        const current = entry ? parseInt(entry.value) || 0 : 0;
        const increment = parseInt(args[1]);
        state.strings.set(args[0], { value: String(current + increment) });
        return { response: `(integer) ${current + increment}`, isError: false };
      }

      case 'MSET': {
        if (args.length < 2 || args.length % 2 !== 0) {
          return { response: '(error) ERR wrong number of arguments for \'mset\' command', isError: true };
        }
        for (let i = 0; i < args.length; i += 2) {
          state.strings.set(args[i], { value: args[i + 1] });
        }
        return { response: 'OK', isError: false };
      }

      case 'MGET': {
        if (args.length < 1) {
          return { response: '(error) ERR wrong number of arguments for \'mget\' command', isError: true };
        }
        const values = args.map(key => {
          const entry = state.strings.get(key);
          return entry ? entry.value : null;
        });
        return { response: formatResponse(values), isError: false };
      }

      // Key commands
      case 'DEL': {
        if (args.length < 1) {
          return { response: '(error) ERR wrong number of arguments for \'del\' command', isError: true };
        }
        let count = 0;
        for (const key of args) {
          if (state.strings.delete(key) || state.hashes.delete(key) ||
              state.lists.delete(key) || state.sets.delete(key) ||
              state.sortedSets.delete(key) || state.vectors.delete(key) ||
              state.timeSeries.delete(key) || state.documents.delete(key)) {
            count++;
          }
        }
        return { response: `(integer) ${count}`, isError: false };
      }

      case 'EXISTS': {
        if (args.length < 1) {
          return { response: '(error) ERR wrong number of arguments for \'exists\' command', isError: true };
        }
        let count = 0;
        for (const key of args) {
          if (state.strings.has(key) || state.hashes.has(key) ||
              state.lists.has(key) || state.sets.has(key) ||
              state.sortedSets.has(key) || state.vectors.has(key) ||
              state.timeSeries.has(key) || state.documents.has(key)) {
            count++;
          }
        }
        return { response: `(integer) ${count}`, isError: false };
      }

      case 'KEYS': {
        const pattern = args[0] || '*';
        const allKeys = [
          ...state.strings.keys(),
          ...state.hashes.keys(),
          ...state.lists.keys(),
          ...state.sets.keys(),
          ...state.sortedSets.keys(),
          ...state.vectors.keys(),
          ...state.timeSeries.keys(),
          ...state.documents.keys(),
        ];
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        const matched = allKeys.filter(k => regex.test(k));
        return { response: formatResponse(matched), isError: false };
      }

      case 'TYPE': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'type\' command', isError: true };
        }
        const key = args[0];
        if (state.strings.has(key)) return { response: 'string', isError: false };
        if (state.hashes.has(key)) return { response: 'hash', isError: false };
        if (state.lists.has(key)) return { response: 'list', isError: false };
        if (state.sets.has(key)) return { response: 'set', isError: false };
        if (state.sortedSets.has(key)) return { response: 'zset', isError: false };
        if (state.vectors.has(key)) return { response: 'vector', isError: false };
        if (state.timeSeries.has(key)) return { response: 'timeseries', isError: false };
        if (state.documents.has(key)) return { response: 'document', isError: false };
        return { response: 'none', isError: false };
      }

      case 'TTL': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'ttl\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        if (!entry) return { response: '(integer) -2', isError: false };
        if (!entry.expiry) return { response: '(integer) -1', isError: false };
        const ttl = Math.ceil((entry.expiry - Date.now()) / 1000);
        return { response: `(integer) ${Math.max(0, ttl)}`, isError: false };
      }

      case 'EXPIRE': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'expire\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        if (!entry) return { response: '(integer) 0', isError: false };
        entry.expiry = Date.now() + parseInt(args[1]) * 1000;
        return { response: '(integer) 1', isError: false };
      }

      case 'PERSIST': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'persist\' command', isError: true };
        }
        const entry = state.strings.get(args[0]);
        if (!entry || !entry.expiry) return { response: '(integer) 0', isError: false };
        delete entry.expiry;
        return { response: '(integer) 1', isError: false };
      }

      // Hash commands
      case 'HSET': {
        if (args.length < 3 || args.length % 2 === 0) {
          return { response: '(error) ERR wrong number of arguments for \'hset\' command', isError: true };
        }
        const [key, ...fieldValues] = args;
        let hash = state.hashes.get(key);
        if (!hash) {
          hash = new Map();
          state.hashes.set(key, hash);
        }
        let added = 0;
        for (let i = 0; i < fieldValues.length; i += 2) {
          if (!hash.has(fieldValues[i])) added++;
          hash.set(fieldValues[i], fieldValues[i + 1]);
        }
        return { response: `(integer) ${added}`, isError: false };
      }

      case 'HGET': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'hget\' command', isError: true };
        }
        const hash = state.hashes.get(args[0]);
        if (!hash) return { response: '(nil)', isError: false };
        const value = hash.get(args[1]);
        return { response: value !== undefined ? formatResponse(value) : '(nil)', isError: false };
      }

      case 'HGETALL': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'hgetall\' command', isError: true };
        }
        const hash = state.hashes.get(args[0]);
        if (!hash || hash.size === 0) return { response: '(empty array)', isError: false };
        const result: string[] = [];
        hash.forEach((v, k) => {
          result.push(k, v);
        });
        return { response: formatResponse(result), isError: false };
      }

      case 'HDEL': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'hdel\' command', isError: true };
        }
        const hash = state.hashes.get(args[0]);
        if (!hash) return { response: '(integer) 0', isError: false };
        let deleted = 0;
        for (let i = 1; i < args.length; i++) {
          if (hash.delete(args[i])) deleted++;
        }
        return { response: `(integer) ${deleted}`, isError: false };
      }

      case 'HLEN': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'hlen\' command', isError: true };
        }
        const hash = state.hashes.get(args[0]);
        return { response: `(integer) ${hash?.size || 0}`, isError: false };
      }

      case 'HKEYS': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'hkeys\' command', isError: true };
        }
        const hash = state.hashes.get(args[0]);
        if (!hash) return { response: '(empty array)', isError: false };
        return { response: formatResponse([...hash.keys()]), isError: false };
      }

      case 'HVALS': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'hvals\' command', isError: true };
        }
        const hash = state.hashes.get(args[0]);
        if (!hash) return { response: '(empty array)', isError: false };
        return { response: formatResponse([...hash.values()]), isError: false };
      }

      // List commands
      case 'LPUSH': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'lpush\' command', isError: true };
        }
        const [key, ...values] = args;
        let list = state.lists.get(key);
        if (!list) {
          list = [];
          state.lists.set(key, list);
        }
        list.unshift(...values.reverse());
        return { response: `(integer) ${list.length}`, isError: false };
      }

      case 'RPUSH': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'rpush\' command', isError: true };
        }
        const [key, ...values] = args;
        let list = state.lists.get(key);
        if (!list) {
          list = [];
          state.lists.set(key, list);
        }
        list.push(...values);
        return { response: `(integer) ${list.length}`, isError: false };
      }

      case 'LRANGE': {
        if (args.length !== 3) {
          return { response: '(error) ERR wrong number of arguments for \'lrange\' command', isError: true };
        }
        const list = state.lists.get(args[0]);
        if (!list) return { response: '(empty array)', isError: false };
        let start = parseInt(args[1]);
        let stop = parseInt(args[2]);
        if (start < 0) start = Math.max(0, list.length + start);
        if (stop < 0) stop = list.length + stop;
        const result = list.slice(start, stop + 1);
        return { response: formatResponse(result), isError: false };
      }

      case 'LPOP': {
        if (args.length < 1) {
          return { response: '(error) ERR wrong number of arguments for \'lpop\' command', isError: true };
        }
        const list = state.lists.get(args[0]);
        if (!list || list.length === 0) return { response: '(nil)', isError: false };
        const count = args[1] ? parseInt(args[1]) : 1;
        if (count === 1) {
          return { response: formatResponse(list.shift()), isError: false };
        }
        const popped = list.splice(0, count);
        return { response: formatResponse(popped), isError: false };
      }

      case 'RPOP': {
        if (args.length < 1) {
          return { response: '(error) ERR wrong number of arguments for \'rpop\' command', isError: true };
        }
        const list = state.lists.get(args[0]);
        if (!list || list.length === 0) return { response: '(nil)', isError: false };
        const count = args[1] ? parseInt(args[1]) : 1;
        if (count === 1) {
          return { response: formatResponse(list.pop()), isError: false };
        }
        const popped = list.splice(-count);
        return { response: formatResponse(popped.reverse()), isError: false };
      }

      case 'LLEN': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'llen\' command', isError: true };
        }
        const list = state.lists.get(args[0]);
        return { response: `(integer) ${list?.length || 0}`, isError: false };
      }

      case 'LINDEX': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'lindex\' command', isError: true };
        }
        const list = state.lists.get(args[0]);
        if (!list) return { response: '(nil)', isError: false };
        let index = parseInt(args[1]);
        if (index < 0) index = list.length + index;
        if (index < 0 || index >= list.length) return { response: '(nil)', isError: false };
        return { response: formatResponse(list[index]), isError: false };
      }

      // Set commands
      case 'SADD': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'sadd\' command', isError: true };
        }
        const [key, ...members] = args;
        let set = state.sets.get(key);
        if (!set) {
          set = new Set();
          state.sets.set(key, set);
        }
        let added = 0;
        for (const m of members) {
          if (!set.has(m)) {
            set.add(m);
            added++;
          }
        }
        return { response: `(integer) ${added}`, isError: false };
      }

      case 'SREM': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'srem\' command', isError: true };
        }
        const set = state.sets.get(args[0]);
        if (!set) return { response: '(integer) 0', isError: false };
        let removed = 0;
        for (let i = 1; i < args.length; i++) {
          if (set.delete(args[i])) removed++;
        }
        return { response: `(integer) ${removed}`, isError: false };
      }

      case 'SMEMBERS': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'smembers\' command', isError: true };
        }
        const set = state.sets.get(args[0]);
        if (!set) return { response: '(empty array)', isError: false };
        return { response: formatResponse([...set]), isError: false };
      }

      case 'SISMEMBER': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'sismember\' command', isError: true };
        }
        const set = state.sets.get(args[0]);
        return { response: `(integer) ${set?.has(args[1]) ? 1 : 0}`, isError: false };
      }

      case 'SCARD': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'scard\' command', isError: true };
        }
        const set = state.sets.get(args[0]);
        return { response: `(integer) ${set?.size || 0}`, isError: false };
      }

      // Sorted Set commands
      case 'ZADD': {
        if (args.length < 3) {
          return { response: '(error) ERR wrong number of arguments for \'zadd\' command', isError: true };
        }
        const key = args[0];
        let zset = state.sortedSets.get(key);
        if (!zset) {
          zset = new Map();
          state.sortedSets.set(key, zset);
        }
        let added = 0;
        for (let i = 1; i < args.length; i += 2) {
          const score = parseFloat(args[i]);
          const member = args[i + 1];
          if (!zset.has(member)) added++;
          zset.set(member, score);
        }
        return { response: `(integer) ${added}`, isError: false };
      }

      case 'ZSCORE': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'zscore\' command', isError: true };
        }
        const zset = state.sortedSets.get(args[0]);
        if (!zset) return { response: '(nil)', isError: false };
        const score = zset.get(args[1]);
        return { response: score !== undefined ? `"${score}"` : '(nil)', isError: false };
      }

      case 'ZRANK': {
        if (args.length !== 2) {
          return { response: '(error) ERR wrong number of arguments for \'zrank\' command', isError: true };
        }
        const zset = state.sortedSets.get(args[0]);
        if (!zset) return { response: '(nil)', isError: false };
        const sorted = [...zset.entries()].sort((a, b) => a[1] - b[1]);
        const idx = sorted.findIndex(([m]) => m === args[1]);
        return { response: idx >= 0 ? `(integer) ${idx}` : '(nil)', isError: false };
      }

      case 'ZRANGE': {
        if (args.length < 3) {
          return { response: '(error) ERR wrong number of arguments for \'zrange\' command', isError: true };
        }
        const zset = state.sortedSets.get(args[0]);
        if (!zset) return { response: '(empty array)', isError: false };
        const sorted = [...zset.entries()].sort((a, b) => a[1] - b[1]);
        let start = parseInt(args[1]);
        let stop = parseInt(args[2]);
        if (start < 0) start = Math.max(0, sorted.length + start);
        if (stop < 0) stop = sorted.length + stop;
        const withScores = args.some(a => a.toUpperCase() === 'WITHSCORES');
        const result: string[] = [];
        for (let i = start; i <= Math.min(stop, sorted.length - 1); i++) {
          result.push(sorted[i][0]);
          if (withScores) result.push(String(sorted[i][1]));
        }
        return { response: formatResponse(result), isError: false };
      }

      case 'ZCARD': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'zcard\' command', isError: true };
        }
        const zset = state.sortedSets.get(args[0]);
        return { response: `(integer) ${zset?.size || 0}`, isError: false };
      }

      // Vector commands (Ferrite-specific)
      case 'VECTOR.CREATE': {
        if (args.length < 5) {
          return { response: '(error) ERR wrong number of arguments for \'VECTOR.CREATE\' command', isError: true };
        }
        const [index, algorithm, dimKey, dim, distKey, distance] = args;
        if (dimKey?.toUpperCase() !== 'DIM') {
          return { response: '(error) ERR syntax error: expected DIM', isError: true };
        }
        state.vectors.set(index, {
          dim: parseInt(dim),
          distance: distance || 'COSINE',
          data: new Map()
        });
        return { response: 'OK', isError: false };
      }

      case 'VECTOR.ADD': {
        if (args.length < 3) {
          return { response: '(error) ERR wrong number of arguments for \'VECTOR.ADD\' command', isError: true };
        }
        const [index, key, vectorStr] = args;
        const vecIndex = state.vectors.get(index);
        if (!vecIndex) {
          return { response: '(error) ERR index does not exist', isError: true };
        }
        try {
          const vector = JSON.parse(vectorStr);
          vecIndex.data.set(key, Array.isArray(vector) ? vector : [vector]);
        } catch {
          return { response: '(error) ERR invalid vector format', isError: true };
        }
        return { response: 'OK', isError: false };
      }

      case 'VECTOR.SEARCH': {
        if (args.length < 3) {
          return { response: '(error) ERR wrong number of arguments for \'VECTOR.SEARCH\' command', isError: true };
        }
        const [index] = args;
        const vecIndex = state.vectors.get(index);
        if (!vecIndex) {
          return { response: '(error) ERR index does not exist', isError: true };
        }
        // Simulated search results with realistic scores
        const results = [...vecIndex.data.keys()].slice(0, 5).map((k, i) => ({
          key: k,
          score: (0.99 - i * 0.05).toFixed(4)
        }));
        if (results.length === 0) {
          return { response: '(empty array)', isError: false };
        }
        const output = results.map((r, i) => `${i + 1}) "${r.key}" (score: ${r.score})`).join('\n');
        return { response: output, isError: false };
      }

      case 'VECTOR.INFO': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'VECTOR.INFO\' command', isError: true };
        }
        const vecIndex = state.vectors.get(args[0]);
        if (!vecIndex) {
          return { response: '(error) ERR index does not exist', isError: true };
        }
        return {
          response: `1) "name"\n2) "${args[0]}"\n3) "dimensions"\n4) (integer) ${vecIndex.dim}\n5) "distance"\n6) "${vecIndex.distance}"\n7) "vectors"\n8) (integer) ${vecIndex.data.size}`,
          isError: false
        };
      }

      // Time Series commands (Ferrite-specific)
      case 'TS.CREATE': {
        if (args.length < 1) {
          return { response: '(error) ERR wrong number of arguments for \'TS.CREATE\' command', isError: true };
        }
        state.timeSeries.set(args[0], []);
        return { response: 'OK', isError: false };
      }

      case 'TS.ADD': {
        if (args.length < 3) {
          return { response: '(error) ERR wrong number of arguments for \'TS.ADD\' command', isError: true };
        }
        const [key, timestampStr, value] = args;
        let ts = state.timeSeries.get(key);
        if (!ts) {
          ts = [];
          state.timeSeries.set(key, ts);
        }
        const timestamp = timestampStr === '*' ? Date.now() : parseInt(timestampStr);
        ts.push({ timestamp, value: parseFloat(value) });
        return { response: `(integer) ${timestamp}`, isError: false };
      }

      case 'TS.GET': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'TS.GET\' command', isError: true };
        }
        const ts = state.timeSeries.get(args[0]);
        if (!ts || ts.length === 0) return { response: '(nil)', isError: false };
        const last = ts[ts.length - 1];
        return { response: `1) (integer) ${last.timestamp}\n2) "${last.value}"`, isError: false };
      }

      case 'TS.RANGE': {
        if (args.length < 3) {
          return { response: '(error) ERR wrong number of arguments for \'TS.RANGE\' command', isError: true };
        }
        const ts = state.timeSeries.get(args[0]);
        if (!ts) return { response: '(empty array)', isError: false };
        const results = ts.slice(-10).map(p => `${p.timestamp}: ${p.value}`);
        return { response: formatResponse(results), isError: false };
      }

      case 'TS.INFO': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'TS.INFO\' command', isError: true };
        }
        const ts = state.timeSeries.get(args[0]);
        if (!ts) return { response: '(error) ERR key does not exist', isError: true };
        return {
          response: `1) "totalSamples"\n2) (integer) ${ts.length}\n3) "firstTimestamp"\n4) (integer) ${ts[0]?.timestamp || 0}\n5) "lastTimestamp"\n6) (integer) ${ts[ts.length - 1]?.timestamp || 0}`,
          isError: false
        };
      }

      // Semantic commands (Ferrite-specific)
      case 'SEMANTIC.SET': {
        return { response: 'OK', isError: false };
      }

      case 'SEMANTIC.GET': {
        return { response: '(nil) # No exact semantic match in playground mode', isError: false };
      }

      case 'SEMANTIC.SEARCH': {
        const query = args[0] || '';
        return {
          response: `1) "cached:${query.substring(0, 20)}..." (similarity: 0.95)\n2) "cached:similar_query" (similarity: 0.87)`,
          isError: false
        };
      }

      // Document commands (Ferrite-specific)
      case 'DOC.SET': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'DOC.SET\' command', isError: true };
        }
        try {
          const doc = JSON.parse(args[1]);
          state.documents.set(args[0], doc);
          return { response: 'OK', isError: false };
        } catch {
          return { response: '(error) ERR invalid JSON document', isError: true };
        }
      }

      case 'DOC.GET': {
        if (args.length !== 1) {
          return { response: '(error) ERR wrong number of arguments for \'DOC.GET\' command', isError: true };
        }
        const doc = state.documents.get(args[0]);
        if (!doc) return { response: '(nil)', isError: false };
        return { response: JSON.stringify(doc, null, 2), isError: false };
      }

      // Graph commands (Ferrite-specific)
      case 'GRAPH.ADDNODE': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'GRAPH.ADDNODE\' command', isError: true };
        }
        let graph = state.graphs.get(args[0]);
        if (!graph) {
          graph = { nodes: new Map(), edges: [] };
          state.graphs.set(args[0], graph);
        }
        graph.nodes.set(args[1], args[2] ? JSON.parse(args[2]) : {});
        return { response: 'OK', isError: false };
      }

      case 'GRAPH.QUERY': {
        if (args.length < 2) {
          return { response: '(error) ERR wrong number of arguments for \'GRAPH.QUERY\' command', isError: true };
        }
        const graph = state.graphs.get(args[0]);
        if (!graph) return { response: '(empty result set)', isError: false };
        return { response: `Query executed: ${args[1]}\nNodes: ${graph.nodes.size}, Edges: ${graph.edges.length}`, isError: false };
      }

      case 'TUTORIAL':
        return {
          response: `Welcome to the Ferrite Tutorial!

Try these commands in order to learn Ferrite:

Step 1: Basic Key-Value Operations
  SET greeting "Hello, Ferrite!"
  GET greeting
  INCR counter
  GET counter

Step 2: Work with Hashes
  HSET user:1 name "Alice" email "alice@example.com"
  HGETALL user:1

Step 3: Use Lists
  RPUSH queue "task1" "task2" "task3"
  LRANGE queue 0 -1
  LPOP queue

Step 4: Sorted Sets for Leaderboards
  ZADD leaderboard 100 "player1" 85 "player2" 92 "player3"
  ZRANGE leaderboard 0 -1 WITHSCORES

Step 5: Vector Search (AI Features)
  VECTOR.CREATE embeddings HNSW DIM 384 DISTANCE COSINE
  VECTOR.ADD embeddings doc1 [0.1,0.2,0.3]
  VECTOR.SEARCH embeddings [0.1,0.2,0.3] TOP_K 5

Step 6: Time Series Data
  TS.ADD temperature * 23.5
  TS.ADD temperature * 24.1
  TS.RANGE temperature - +

Type HELP for the complete command reference.`,
          isError: false
        };

      case 'HELP':
        return {
          response: `Ferrite Playground - Command Reference

STRING COMMANDS:
  SET key value [EX seconds] [NX|XX] [GET]
  GET key                     - Get value
  INCR key / DECR key         - Increment/Decrement
  INCRBY key increment        - Increment by amount
  MSET key value [key value ...]
  MGET key [key ...]
  APPEND key value            - Append to string
  STRLEN key                  - Get string length

HASH COMMANDS:
  HSET key field value [field value ...]
  HGET key field              - Get single field
  HGETALL key                 - Get all fields
  HDEL key field [field ...]  - Delete fields
  HKEYS key / HVALS key       - Get keys or values
  HLEN key                    - Get number of fields

LIST COMMANDS:
  LPUSH key value [value ...] - Push to head
  RPUSH key value [value ...] - Push to tail
  LPOP key [count] / RPOP key [count]
  LRANGE key start stop       - Get range
  LLEN key / LINDEX key index

SET COMMANDS:
  SADD key member [member ...] - Add members
  SREM key member [member ...] - Remove members
  SMEMBERS key                - Get all members
  SISMEMBER key member        - Check membership
  SCARD key                   - Get set size

SORTED SET COMMANDS:
  ZADD key score member [score member ...]
  ZRANGE key start stop [WITHSCORES]
  ZSCORE key member           - Get score
  ZRANK key member            - Get rank
  ZCARD key                   - Get set size

VECTOR COMMANDS (Ferrite AI):
  VECTOR.CREATE index HNSW DIM n DISTANCE COSINE
  VECTOR.ADD index key [vector]
  VECTOR.SEARCH index [vector] TOP_K k
  VECTOR.INFO index           - Get index info

TIME SERIES (Ferrite):
  TS.CREATE key               - Create series
  TS.ADD key timestamp value  - Add point (* = now)
  TS.RANGE key from to        - Query range
  TS.GET key                  - Get latest
  TS.INFO key                 - Get info

SEMANTIC CACHE (Ferrite AI):
  SEMANTIC.SET key "text" TTL seconds
  SEMANTIC.SEARCH "query" TOP_K k

KEY COMMANDS:
  DEL key [key ...]           - Delete keys
  EXISTS key [key ...]        - Check existence
  KEYS pattern                - Find keys
  TYPE key                    - Get type
  TTL key / EXPIRE key sec    - TTL operations

SERVER COMMANDS:
  PING / ECHO message
  INFO [section]
  DBSIZE                      - Count keys
  FLUSHDB / FLUSHALL          - Clear data
  TIME                        - Server time

OTHER:
  HELP                        - This message
  TUTORIAL                    - Interactive tutorial`,
          isError: false
        };

      default:
        return { response: `(error) ERR unknown command '${command}', type HELP for available commands`, isError: true };
    }
  } catch (e) {
    return { response: `(error) ERR ${e instanceof Error ? e.message : 'internal error'}`, isError: true };
  }
}

function parseCommand(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let inBracket = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!inQuote && char === '[') {
      inBracket++;
      current += char;
    } else if (!inQuote && char === ']') {
      inBracket--;
      current += char;
    } else if (!inQuote && inBracket === 0 && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
    } else if (!inQuote && inBracket === 0 && char === ' ') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }

  return parts;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

const exampleCommands = [
  { category: 'Basic', commands: [
    { label: 'PING', command: 'PING', description: 'Test connection' },
    { label: 'SET', command: 'SET mykey "Hello, Ferrite!"', description: 'Set a key' },
    { label: 'GET', command: 'GET mykey', description: 'Get a value' },
  ]},
  { category: 'Hash', commands: [
    { label: 'HSET', command: 'HSET user:1 name "Alice" email "alice@example.com" age 30', description: 'Set hash fields' },
    { label: 'HGETALL', command: 'HGETALL user:1', description: 'Get all fields' },
  ]},
  { category: 'List', commands: [
    { label: 'RPUSH', command: 'RPUSH tasks "task1" "task2" "task3"', description: 'Push to list' },
    { label: 'LRANGE', command: 'LRANGE tasks 0 -1', description: 'Get range' },
  ]},
  { category: 'Sorted Set', commands: [
    { label: 'ZADD', command: 'ZADD leaderboard 100 "player1" 85 "player2" 92 "player3"', description: 'Add scores' },
    { label: 'ZRANGE', command: 'ZRANGE leaderboard 0 -1 WITHSCORES', description: 'Get ranked' },
  ]},
  { category: 'Vector (AI)', commands: [
    { label: 'Create', command: 'VECTOR.CREATE embeddings HNSW DIM 1536 DISTANCE COSINE', description: 'Create index' },
    { label: 'Add', command: 'VECTOR.ADD embeddings doc1 [0.1,0.2,0.3,0.4,0.5]', description: 'Add vector' },
    { label: 'Search', command: 'VECTOR.SEARCH embeddings [0.1,0.2,0.3,0.4,0.5] TOP_K 5', description: 'Similarity search' },
  ]},
  { category: 'Time Series', commands: [
    { label: 'Create', command: 'TS.CREATE temperature', description: 'Create series' },
    { label: 'Add', command: 'TS.ADD temperature * 23.5', description: 'Add data point' },
    { label: 'Range', command: 'TS.RANGE temperature - +', description: 'Query range' },
  ]},
  { category: 'Semantic', commands: [
    { label: 'Set', command: 'SEMANTIC.SET query1 "What is the capital of France?" TTL 3600', description: 'Cache query' },
    { label: 'Search', command: 'SEMANTIC.SEARCH "capital of France" TOP_K 5', description: 'Find similar' },
  ]},
  { category: 'Document', commands: [
    { label: 'Set', command: 'DOC.SET product:1 {"name":"Widget","price":29.99}', description: 'Store JSON' },
    { label: 'Get', command: 'DOC.GET product:1', description: 'Retrieve JSON' },
  ]},
];

export default function Playground(): ReactNode {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [state] = useState<MockState>(createInitialState);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cmds = params.get('commands');
    if (cmds) {
      try {
        const commands = JSON.parse(decodeURIComponent(cmds));
        if (Array.isArray(commands)) {
          commands.forEach(cmd => {
            const { response, isError } = executeCommand(cmd, state);
            setHistory(prev => [...prev, { command: cmd, response, isError, timestamp: Date.now() }]);
          });
        }
      } catch {
        // Invalid URL state, ignore
      }
    }
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Update suggestions based on input
  useEffect(() => {
    if (input.length > 0) {
      const parts = input.split(' ');
      const lastPart = parts[parts.length - 1].toUpperCase();
      const firstPart = parts[0].toUpperCase();

      // Only show suggestions for command names (first word)
      if (parts.length === 1) {
        const filtered = ALL_COMMANDS.filter(cmd =>
          cmd.startsWith(lastPart) && cmd !== lastPart
        ).slice(0, 8);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSelectedSuggestion(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;

    const { response, isError } = executeCommand(input, state);

    setHistory(prev => [...prev, {
      command: input,
      response,
      isError,
      timestamp: Date.now()
    }]);

    setCommandHistory(prev => [input, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);
    setInput('');
    setShowSuggestions(false);
  }, [input, state]);

  const applySuggestion = useCallback((suggestion: string) => {
    setInput(suggestion + ' ');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'Tab' || (e.key === 'ArrowRight' && input.length === e.currentTarget.selectionStart)) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestion]);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp' && showSuggestions) {
        e.preventDefault();
        setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp' && !showSuggestions) {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !showSuggestions) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const runExample = (cmd: string) => {
    setInput(cmd);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const sharePlayground = () => {
    const commands = history.map(h => h.command);
    const encoded = encodeURIComponent(JSON.stringify(commands));
    const url = `${window.location.origin}${window.location.pathname}?commands=${encoded}`;
    navigator.clipboard.writeText(url);
    alert('Shareable link copied to clipboard!');
  };

  const exportSession = () => {
    const session = history.map(h => `> ${h.command}\n${h.response}`).join('\n\n');
    const blob = new Blob([session], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ferrite-session.txt';
    a.click();
  };

  return (
    <div className={styles.playground}>
      <div className={styles.header}>
        <h2>Ferrite Playground</h2>
        <p>Try Ferrite commands in your browser. This is a client-side simulation - no server required!</p>
        <div className={styles.headerActions}>
          <button className={styles.actionBtn} onClick={() => runExample('TUTORIAL')} title="Start tutorial">
            Tutorial
          </button>
          <button className={styles.actionBtn} onClick={sharePlayground} title="Copy shareable link">
            Share
          </button>
          <button className={styles.actionBtn} onClick={exportSession} title="Download session">
            Export
          </button>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.sidebar}>
          <h3>Example Commands</h3>
          {exampleCommands.map((cat, idx) => (
            <div key={idx} className={styles.category}>
              <h4>{cat.category}</h4>
              {cat.commands.map((cmd, cmdIdx) => (
                <button
                  key={cmdIdx}
                  className={styles.exampleBtn}
                  onClick={() => runExample(cmd.command)}
                  title={cmd.description}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          ))}
          <div className={styles.category}>
            <button
              className={styles.helpBtn}
              onClick={() => runExample('HELP')}
            >
              All Commands
            </button>
          </div>
          <div className={styles.features}>
            <h3>Ferrite Features</h3>
            <ul className={styles.featureList}>
              <li>⚡ Sub-microsecond GET latency</li>
              <li>🦀 Built in Rust with zero-copy IO</li>
              <li>💾 Tiered storage: memory → mmap → disk</li>
              <li>🔄 Drop-in Redis replacement</li>
              <li>🧠 Built-in vector search &amp; AI</li>
              <li>📈 Native time series support</li>
              <li>🔒 Epoch-based concurrency</li>
              <li>🌐 io_uring-first persistence</li>
            </ul>
          </div>
        </div>

        <div className={styles.terminal}>
          <div className={styles.terminalHeader}>
            <span className={styles.terminalTitle}>ferrite-cli</span>
            <div className={styles.terminalActions}>
              <span className={styles.keyHint}>Tab: autocomplete</span>
              <span className={styles.keyHint}>Up/Down: history</span>
              <button className={styles.clearBtn} onClick={clearHistory}>Clear</button>
            </div>
          </div>

          <div className={styles.output} ref={outputRef}>
            <div className={styles.welcome}>
              Welcome to Ferrite Playground!
              <br />
              Type commands below or click examples on the left.
              <br />
              Type <strong>TUTORIAL</strong> for an interactive guide or <strong>HELP</strong> to see all commands.
            </div>
            {history.map((item, idx) => (
              <div key={idx} className={styles.entry}>
                <div className={styles.command}>
                  <span className={styles.prompt}>ferrite&gt;</span> {item.command}
                </div>
                <div className={item.isError ? styles.errorResponse : styles.response}>
                  {item.response}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.inputContainer}>
            {showSuggestions && suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <div
                    key={s}
                    className={`${styles.suggestion} ${i === selectedSuggestion ? styles.suggestionSelected : ''}`}
                    onClick={() => applySuggestion(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.inputLine}>
              <span className={styles.prompt}>ferrite&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter command... (try PING, SET, GET, VECTOR.CREATE)"
                className={styles.input}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <p>
          This playground runs entirely in your browser using mock responses.
          For production use, <a href="/docs/getting-started/installation">install Ferrite</a> on your server.
        </p>
      </div>
    </div>
  );
}
