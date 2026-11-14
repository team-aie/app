/**
 * Privacy helpers for 100% offline diagnostics: the user's home directory is
 * replaced with `~` in everything that lands in logs or the diagnostic zip.
 */

export type Scrubber = (text: string) => string;

export function createHomeScrubber(homeDir: string): Scrubber {
  const trimmed = homeDir.replace(/[\\/]+$/, '');
  // Never scrub when the "home" is a filesystem root or empty: it would mangle every path.
  if (trimmed.length < 2) return (text) => text;
  const variants = new Set<string>([
    trimmed,
    trimmed.replace(/\\/g, '/'),
    trimmed.replace(/\\/g, '\\\\'),
    trimmed.replace(/\//g, '\\'),
    encodeURI(trimmed.replace(/\\/g, '/'))
  ]);
  const ordered = [...variants].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    ordered.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'gi'
  );
  return (text) => text.replace(pattern, '~');
}

/** Deeply scrubs strings inside logged values; `Error`s become plain `{name,message,stack}` objects. */
export function scrubValue(value: unknown, scrub: Scrubber, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return scrub(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (depth > 5) return '[Truncated]';
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrub(value.message),
      ...(value.stack ? { stack: scrub(value.stack) } : {})
    };
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, scrub, depth + 1, seen));
  if (ArrayBuffer.isView(value)) return `[${value.constructor.name} ${value.byteLength} bytes]`;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) out[scrub(key)] = scrubValue(v, scrub, depth + 1, seen);
  return out;
}

export class RingBuffer<T> {
  private readonly items: T[] = [];
  constructor(readonly capacity: number) {}

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }

  toArray(): T[] {
    return [...this.items];
  }

  get size(): number {
    return this.items.length;
  }
}

export interface TelemetryEntry {
  at: string;
  level: string;
  message: string;
}
