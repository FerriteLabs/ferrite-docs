function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function encodeResp(input: string): string {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return '';
  }

  const lines: string[] = [`*${parts.length}`];

  for (const part of parts) {
    lines.push(`$${utf8Length(part)}`);
    lines.push(part);
  }

  return `${lines.join('\\r\\n')}\\r\\n`;
}
