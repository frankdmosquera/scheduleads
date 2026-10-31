// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { englishChatWords } from "../words/english-chat-words.js";
import { openSiteChat } from "./open-site-chat.js";
import { SiteChat } from "./site-chat.js";

// The conversation itself is not under test: a stand-in with the question field the chat focuses.
vi.mock("./chat-conversation.js", () => ({
  ChatConversation: () => createElement("input", { "aria-label": "Your question" }),
}));

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const isOpen = () => document.getElementById("site-chat")!.hasAttribute("data-open");

function page() {
  const askUs = document.createElement("button");
  askUs.textContent = "Ask us";
  document.body.append(askUs);
  render(
    createElement(SiteChat, { words: englishChatWords, loadAnswers: async () => ({ stored: [] }) })
  );
  return askUs;
}

// A phone's visible area, which the open panel follows above the keyboard.
function fakeVisibleArea() {
  const area = Object.assign(new EventTarget(), { height: 500, offsetTop: 40 });
  const add = vi.spyOn(area, "addEventListener");
  const remove = vi.spyOn(area, "removeEventListener");
  vi.stubGlobal("visualViewport", area);
  return { area, add, remove };
}

describe("the site chat", () => {
  it("opens from a page's own Ask us and never closes from it", async () => {
    page();
    act(() => openSiteChat());
    await screen.findByLabelText("Your question");
    expect(isOpen()).toBe(true);
    act(() => openSiteChat());
    expect(isOpen()).toBe(true);
  });

  it("returns focus on Escape to the Ask us that opened it", async () => {
    const askUs = page();
    askUs.focus();
    act(() => openSiteChat());
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Your question"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(askUs);
  });

  it("returns focus on Escape to its own button when opened from there", async () => {
    page();
    const launcher = document.querySelector<HTMLButtonElement>(".sc-launcher")!;
    fireEvent.click(launcher);
    await screen.findByLabelText("Your question");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(launcher);
  });

  it("follows the visible area only while open, and lets go on close", async () => {
    const { area, add, remove } = fakeVisibleArea();
    page();
    expect(add).not.toHaveBeenCalled();
    act(() => openSiteChat());
    await screen.findByLabelText("Your question");
    const panel = document.getElementById("site-chat")!;
    expect(panel.style.getPropertyValue("--sc-visible-height")).toBe("500px");
    area.height = 300;
    act(() => {
      area.dispatchEvent(new Event("resize"));
    });
    expect(panel.style.getPropertyValue("--sc-visible-height")).toBe("300px");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(panel.style.getPropertyValue("--sc-visible-height")).toBe("");
  });
});
