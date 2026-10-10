// Booking component: the fetch every call goes through. Never the visitor's cookies, and never
// waiting past a time limit, so a stuck spinner is impossible.

export function fetchWithTimeLimit(
  timeLimitMilliseconds: number,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init)
): typeof fetch {
  return (input, init) => {
    const timeLimit = AbortSignal.timeout(timeLimitMilliseconds);
    return fetchImpl(input, {
      ...init,
      // The public routes refuse credentials, and a client site's cookies are not ours to send.
      credentials: "omit",
      signal: init?.signal ? AbortSignal.any([init.signal, timeLimit]) : timeLimit,
    });
  };
}
