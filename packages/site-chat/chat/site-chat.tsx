import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";

import type { ChatAnswersType } from "../answers/chat-answers-type.js";
import type { BookingAccountType } from "../booking/booking-api.js";
import type { ChatDevFactsType } from "../dev/dev-row.js";
import type { ChatLanguageType, ChatWordsType, PersonPathType } from "../words/chat-words-type.js";
import type { ChatConversationPropsType } from "./chat-conversation.js";
import { OPEN_SITE_CHAT_EVENT } from "./open-site-chat.js";
import { PersonWays, type PersonWayLinksType } from "./person-ways.js";

// The inspector, downloaded only on the laptop, so visitors never get it.
const ChatInspector = lazy(() =>
  import("../dev/chat-inspector.js").then((m) => ({ default: m.ChatInspector }))
);

export interface SiteChatPropsType {
  words: ChatWordsType;
  /** The site's language; English unless given. */
  lang?: ChatLanguageType;
  /** The site's stored answers, downloaded with the chat on its first open, so no page loads them before. */
  loadAnswers: () => Promise<ChatAnswersType>;
  /** Where the ways to a person go (tel:, mailto:); a way with none goes to `onWay`. */
  links?: PersonWayLinksType;
  /** Opens a way the site gave no link for (its own booking window), with the visitor's question. */
  onWay?: (path: PersonPathType, question: string) => void;
  /** The business in Booking CRM, as the site's booking window gets it: with it, the chat books in the conversation. */
  booking?: BookingAccountType;
  /** The addresses the site mounted the chat's routes at. */
  chatUrl?: string;
  voiceUrl?: string;
  bookingUrl?: string;
  /** Laptop only: shows the inspector beside the open chat. */
  debug?: boolean;
}

interface LoadedType {
  Conversation: ComponentType<ChatConversationPropsType>;
  answers: ChatAnswersType;
}

/** Said once per visit, after a while on the site: never pushy. */
const HELLO_AFTER_MS = 20_000;
const HELLO_KEY = "site-chat-hello-said";

/**
 * The site's AI in the corner of every page: a button that opens the chat, which stays with the visitor from page
 * to page. Once per visit it says hello. The chat's code and the site's answers download on the first open, so no
 * page loads more for it.
 */
export function SiteChat({
  words,
  lang = "en",
  loadAnswers,
  links = {},
  onWay,
  booking,
  chatUrl = "/api/chat",
  voiceUrl = "/api/chat/voice",
  bookingUrl = "/api/chat/booking",
  debug = false,
}: SiteChatPropsType) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<LoadedType | null>(null);
  const [failed, setFailed] = useState(false);
  const [hello, setHello] = useState(false);
  const [devRows, setDevRows] = useState<(ChatDevFactsType & { id: number })[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // What a page's own "Ask us" had focused when it opened the chat: Escape goes back there.
  const openerRef = useRef<HTMLElement | null>(null);

  // The hello, once per visit, only while the chat was never opened.
  useEffect(() => {
    if (loaded) return;
    try {
      if (sessionStorage.getItem(HELLO_KEY)) return;
    } catch {
      // Storage blocked: the hello may say itself once per page instead.
    }
    const timer = window.setTimeout(() => {
      setHello(true);
      try {
        sessionStorage.setItem(HELLO_KEY, "1");
      } catch {
        // As above.
      }
    }, HELLO_AFTER_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  // A phone's keyboard covers the bottom of a full-height panel: an iPhone keeps the screen's whole height
  // while it shows. While open, the panel follows the part of the page left visible (the visual viewport), so the
  // question field stays just above the keyboard (Frank's phone, Oct 31).
  useEffect(() => {
    const panel = panelRef.current;
    const visible = window.visualViewport;
    if (!open || !panel || !visible) return;
    const fit = () => {
      panel.style.setProperty("--sc-visible-height", `${visible.height}px`);
      panel.style.setProperty("--sc-visible-top", `${visible.offsetTop}px`);
    };
    fit();
    visible.addEventListener("resize", fit);
    visible.addEventListener("scroll", fit);
    return () => {
      visible.removeEventListener("resize", fit);
      visible.removeEventListener("scroll", fit);
      panel.style.removeProperty("--sc-visible-height");
      panel.style.removeProperty("--sc-visible-top");
    };
  }, [open]);

  // Open: the question field takes the focus once the chat is there; Escape closes it.
  useEffect(() => {
    if (!open || !loaded) return;
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      const opener = openerRef.current;
      (opener?.isConnected ? opener : buttonRef.current)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loaded]);

  // A page's own "Ask us" (openSiteChat) opens it, never closes it.
  const openRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onOpen = () => openRef.current();
    window.addEventListener(OPEN_SITE_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SITE_CHAT_EVENT, onOpen);
  }, []);

  async function toggle() {
    openerRef.current = null; // opened or closed from the chat's own buttons
    if (open) {
      setHello(false);
      setOpen(false);
      return;
    }
    await openChat();
  }

  async function openChat() {
    setHello(false);
    setOpen(true);
    if (loaded) return;
    setFailed(false);
    try {
      const [{ ChatConversation }, answers] = await Promise.all([
        import("./chat-conversation.js"),
        loadAnswers(),
      ]);
      setLoaded({ Conversation: ChatConversation, answers });
    } catch {
      // The download failed (offline, a new deploy): the ways to a person still work; the next open tries again.
      setFailed(true);
    }
  }
  openRef.current = () => {
    if (open) return;
    const focused = document.activeElement;
    openerRef.current = focused instanceof HTMLElement && focused !== document.body ? focused : null;
    void openChat();
  };

  return (
    <>
      <div
        ref={panelRef}
        id="site-chat"
        role="dialog"
        aria-label={words.float.title}
        className="sc-panel"
        data-open={open ? "" : undefined}
      >
        <div className="sc-head">
          <b>{words.float.title}</b>
          <button
            type="button"
            className="sc-close"
            aria-label={words.float.close}
            onClick={() => void toggle()}
          >
            &times;
          </button>
        </div>
        {/* Mounted once opened and kept, so the conversation is still there when it opens again. */}
        {loaded ? (
          <loaded.Conversation
            lang={lang}
            words={words}
            answers={loaded.answers}
            links={links}
            onWay={onWay}
            booking={booking}
            chatUrl={chatUrl}
            voiceUrl={voiceUrl}
            bookingUrl={bookingUrl}
            onAnswered={
              debug
                ? (row) => setDevRows((rows) => [{ ...row, id: (rows[0]?.id ?? 0) + 1 }, ...rows])
                : undefined
            }
          />
        ) : (
          failed && (
            <div className="sc-body">
              <div className="sc-bubble">
                {words.handOver}
                <PersonWays
                  words={words.ways}
                  links={links}
                  onPick={onWay && ((path) => onWay(path, ""))}
                />
              </div>
            </div>
          )
        )}
      </div>
      {debug && open && devRows.length > 0 && (
        <Suspense fallback={null}>
          <ChatInspector rows={devRows} />
        </Suspense>
      )}
      {hello && !open && (
        <div className="sc-hello">
          <button type="button" className="sc-hello-text" onClick={() => void toggle()}>
            {words.float.hello}
          </button>
          <button
            type="button"
            className="sc-hello-dismiss"
            aria-label={words.float.dismiss}
            onClick={() => setHello(false)}
          >
            &times;
          </button>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="sc-launcher"
        data-open={open ? "" : undefined}
        aria-label={open ? words.float.close : words.float.open}
        aria-expanded={open}
        aria-controls="site-chat"
        onClick={() => void toggle()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
        <span>{words.float.button}</span>
      </button>
    </>
  );
}
