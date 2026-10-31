import { afterEach, describe, expect, it, vi } from "vitest";

import { OPEN_SITE_CHAT_EVENT, openSiteChat } from "./open-site-chat.js";

afterEach(() => vi.unstubAllGlobals());

describe("openSiteChat", () => {
  it("sends the one event the chat listens for", () => {
    const page = new EventTarget();
    vi.stubGlobal("window", page);
    const heard = vi.fn();
    page.addEventListener(OPEN_SITE_CHAT_EVENT, heard);
    openSiteChat();
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
