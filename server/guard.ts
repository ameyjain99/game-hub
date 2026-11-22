/**
 * What the server checks about a request before serving it: how often its
 * sender has tried something, where a socket connection comes from, and what
 * the page it serves is allowed to load.
 */
import type { IncomingMessage } from 'node:http';

/**
 * The address a request comes from. Behind the host's proxy that is the first
 * entry of X-Forwarded-For; a direct connection has only its socket address.
 */
export function clientAddress(headers: IncomingMessage['headers'], socketAddress: string | undefined): string {
  const forwarded = headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || socketAddress || 'unknown';
}

/** Counts events per key in windows of `windowMs`; `hit` says whether the key is still within `max`. */
export class RateLimiter {
  private counts = new Map<string, { n: number; until: number }>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Whether `key` has used up its allowance, without counting anything. */
  blocked(key: string, now: number): boolean {
    const c = this.counts.get(key);
    return !!c && now < c.until && c.n >= this.max;
  }

  /** Count one event for `key`; false once it is over the allowance for this window. */
  hit(key: string, now: number): boolean {
    const c = this.counts.get(key);
    if (!c || now >= c.until) {
      this.counts.set(key, { n: 1, until: now + this.windowMs });
      return true;
    }
    c.n += 1;
    return c.n <= this.max;
  }

  /** Forget the keys whose window has passed. */
  sweep(now: number): void {
    for (const [key, c] of this.counts) if (now >= c.until) this.counts.delete(key);
  }
}

/**
 * Whether a socket connection may come from the page that asks for it: a page
 * served by this host, or one of `allowed` (the ALLOWED_ORIGINS setting). A
 * request with no Origin is not from a browser page and is let through.
 */
export function originAllowed(headers: IncomingMessage['headers'], allowed: readonly string[]): boolean {
  const origin = headers.origin;
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  try {
    const host = new URL(origin).host;
    return host === headers.host || host === headers['x-forwarded-host'];
  } catch {
    return false;
  }
}

/**
 * The Content-Security-Policy for the pages served to `host`: everything from
 * this site itself, plus what the app is built with. Styles are set inline by
 * the components, the chess engine is WebAssembly in a worker, the money font
 * and drawn textures are data and blob URLs, contributors' faces come from
 * GitHub, and the game socket is this host's own.
 */
export function contentSecurityPolicy(host: string | undefined): string {
  const sockets = host ? ` ws://${host} wss://${host}` : '';
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    `connect-src 'self'${sockets}`,
    "media-src 'self' blob: mediastream:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}
