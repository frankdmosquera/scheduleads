import { describe, expect, it } from "vitest";

import { fromOurSite } from "./from-our-site.js";

const asked = (headers: Record<string, string>) =>
  new Request("https://primopainters.ca/api/chat", {
    method: "POST",
    headers: { host: "primopainters.ca", ...headers },
  });

describe("fromOurSite", () => {
  it("lets the site's own pages ask, with or without an Origin", () => {
    expect(
      fromOurSite(
        asked({
          "content-type": "application/json",
          origin: "https://primopainters.ca",
          "sec-fetch-site": "same-origin",
        })
      )
    ).toBe(true);
    expect(fromOurSite(asked({ "content-type": "application/json; charset=utf-8" }))).toBe(true);
  });

  it("refuses anything that is not JSON: a cross-site form or text/plain needs no browser check", () => {
    expect(fromOurSite(asked({ "content-type": "text/plain" }))).toBe(false);
    expect(fromOurSite(asked({ "content-type": "application/x-www-form-urlencoded" }))).toBe(false);
    expect(fromOurSite(asked({}))).toBe(false);
  });

  it("refuses another site, by the browser's own word or by its Origin", () => {
    expect(
      fromOurSite(asked({ "content-type": "application/json", "sec-fetch-site": "cross-site" }))
    ).toBe(false);
    expect(
      fromOurSite(
        asked({ "content-type": "application/json", origin: "https://elsewhere.example" })
      )
    ).toBe(false);
    expect(fromOurSite(asked({ "content-type": "application/json", origin: "not a url" }))).toBe(
      false
    );
  });
});
