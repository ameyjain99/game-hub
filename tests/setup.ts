// The home page asks the server for its contributor list as soon as it mounts.
// A jsdom test has no server, and the answer would land after the test has
// moved on (React's "not wrapped in act" warning). So in jsdom tests that
// request stays open, unless a test stubs fetch itself (tests/ui/hubSections).
if (typeof window !== 'undefined') {
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === '/api/contributors' ? new Promise<never>(() => {}) : real(input, init)) as typeof fetch;
}
