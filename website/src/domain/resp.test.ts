import {describe, expect, it} from 'vitest';
import {encodeResp} from './resp';

describe('encodeResp', () => {
  it('encodes a Redis command as a RESP array', () => {
    expect(encodeResp('SET mykey Hello')).toBe(
      '*3\\r\\n$3\\r\\nSET\\r\\n$5\\r\\nmykey\\r\\n$5\\r\\nHello\\r\\n',
    );
  });

  it('normalizes surrounding and repeated whitespace', () => {
    expect(encodeResp('  GET   mykey  ')).toBe(
      '*2\\r\\n$3\\r\\nGET\\r\\n$5\\r\\nmykey\\r\\n',
    );
  });

  it('uses UTF-8 byte lengths', () => {
    expect(encodeResp('SET key café')).toContain('$5\\r\\ncafé');
  });

  it('returns an empty encoding for blank input', () => {
    expect(encodeResp('   ')).toBe('');
  });
});
