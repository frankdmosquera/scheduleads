// Backend: the error code in a refusal from Twilio, "21610", or its status when the body says
// none. Only the code: Twilio's message can repeat the number it was given.

export async function twilioErrorCode(response: Response): Promise<string> {
  try {
    const { code } = (await response.json()) as { code?: unknown };
    if (typeof code === "number" || typeof code === "string") return String(code);
  } catch {
    // not JSON: a proxy's page, or nothing
  }
  return `http_${response.status}`;
}
