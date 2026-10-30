/**
 * Only the site's own pages may ask its AI: a JSON body (a cross-site form or text/plain request cannot send one
 * without the browser's own check), and when the browser says where the request came from, it must be this
 * site. Stops other sites from spending the AI budget through their visitors' browsers.
 */
export function fromOurSite(request: Request): boolean {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
