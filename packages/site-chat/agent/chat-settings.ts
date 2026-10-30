/**
 * The chat's limits and thresholds, the same on every site as on ialaorden.com. Jev's confidences were set on the
 * real Jev from a test set of everyday questions; rerun those checks before moving one.
 */
export const CHAT_SETTINGS = {
  model: "gpt-5.4-mini",
  maxQuestionChars: 500,
  maxTurns: 20,
  maxAnswerTokens: 1024,
  // The longest the AI may take to write its first word before it is tried once more.
  firstWordMs: 6000,
  retryAfterMs: 400,
  maxRetryWaitMs: 3000,
  maxAnswerChars: 4000,
  // Soft, per browser tab (sessionStorage): past it only the AI stops; Jev and the fixed lines still answer.
  answersPerVisit: 30,
  // Soft, per address and server instance: stops casual overuse; the provider's monthly limit stops the bill.
  requestsPerHour: 60,
  // Google's Chirp 3 HD voices, the first the default. Past Google's free amount it refuses, and the browser's voice speaks.
  voice: {
    choices: ["Achernar", "Algieba", "Rasalgethi"] as readonly string[],
    languageCodes: { en: "en-US", es: "es-US" },
    maxSpokenChars: 600,
  },
  // An answer shows its first line at once and each next line a moment after, never longer than maxMs in all.
  textArrival: { lineGapMs: 250, maxMs: 1500 },
  jev: {
    model: "jev-latest",
    gatewayModel: "typesafe-ai/jev",
    timeoutMs: 1500,
    storedConfidence: 0.7,
    personConfidence: 0.5,
    toolConfidence: 0.7,
    suggestConfidence: 0.5,
    // Below this yes that the message asks one thing, it asks several and the AI answers both.
    oneThingYes: 0.15,
    languageYes: 0.5,
    // Below this clarity (0 garbled to 3 clear) the visitor is asked "Did you mean...?" first.
    clarityFloor: 1.2,
    // How many earlier turns go with the latest message.
    turns: 4,
  },
} as const;

export type JevSettingsType = typeof CHAT_SETTINGS.jev;
