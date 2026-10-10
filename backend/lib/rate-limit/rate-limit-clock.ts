// Backend: what time the rate limits think it is, in milliseconds. The real clock in the API;
// tests move it to cross a window without waiting.

export const rateLimitClock = {
  now: (): number => Date.now(),
};
