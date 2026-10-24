// Backend: gives every refused sign-in code the same answer. An unknown address never has
// a code row, so Better Auth only ever answers it 400 "Invalid OTP"; a customer's address would
// also hear 400 "OTP expired" and, on the fourth try, 403 "Too many attempts", which tells anyone
// typing wrong codes that the address is a customer. Rewritten on the finished answer, because a
// Better Auth after-hook can change the body but not the status.

const TOLD_APART = new Set(["OTP_EXPIRED", "TOO_MANY_ATTEMPTS"]);

export async function oneAnswerForAWrongCode(answer: Response): Promise<Response> {
  if (answer.ok) return answer;
  const body = (await answer
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown } | null;
  if (!TOLD_APART.has(String(body?.code))) return answer;
  // The code stays spent or locked as Better Auth decided; only the answer changes.
  const headers = new Headers(answer.headers);
  headers.delete("content-length");
  // Byte for byte Better Auth's own answer to an unknown address, key order included.
  return new Response(JSON.stringify({ message: "Invalid OTP", code: "INVALID_OTP" }), {
    status: 400,
    headers,
  });
}
