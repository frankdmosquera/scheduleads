// Backend: the Resend key every business's booking emails go through, the agency's own (feature
// 25a). Live, and in the tests (which fake Resend), it is RESEND_API_KEY. On the laptop it is
// none, so nothing is sent: the seed's customers have made-up addresses.

export function readAgencyBookingKey(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV !== "production" && env.NODE_ENV !== "test") return null;
  return env.RESEND_API_KEY?.trim() || null;
}
