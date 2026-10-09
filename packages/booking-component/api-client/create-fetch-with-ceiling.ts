// Booking component: the fetch every call goes through. Never the visitor's cookies, and never
// waiting past a ceiling, so a stuck spinner is impossible.

export function createFetchWithCeiling(
  ceilingMilliseconds: number,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init)
): typeof fetch {
  return (input, init) => {
    const ceiling = AbortSignal.timeout(ceilingMilliseconds);
    return fetchImpl(input, {
      ...init,
      // The public routes refuse credentials, and a client site's cookies are not ours to send.
      credentials: "omit",
      signal: init?.signal ? AbortSignal.any([init.signal, ceiling]) : ceiling,
    });
  };
}
