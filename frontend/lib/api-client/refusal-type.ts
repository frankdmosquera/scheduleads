// Frontend: the API's refusal shape, as the client reads it.

// The API's refusal shape. Loosely typed on purpose: unknown codes fall through.
export type RefusalType = {
  error?: { code?: string; message?: string };
};
