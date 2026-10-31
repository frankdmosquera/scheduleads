// Site chat: opens the corner chat from anywhere on the page (feature 13c, a calendar card's "Ask us"). The chat
// listens for this one event, so the page needs no ref to it and the two never import each other.

export const OPEN_SITE_CHAT_EVENT = "site-chat:open";

export function openSiteChat(): void {
  window.dispatchEvent(new Event(OPEN_SITE_CHAT_EVENT));
}
