import { useEffect, useRef, useState } from "react";
import type { ChatTileItemType, ChatTileType } from "../answers/chat-answers-type.js";

/**
 * An answer that is a list, as tiles under its words: each with its name and its line, a link when it has a page.
 * A tile that holds items opens in place to list them, one open at a time, each with a Book button when `onBook`
 * is given and the item names its booking link.
 */
export function AnswerTiles({
  tiles,
  bookLabel,
  onBook,
}: {
  tiles: readonly ChatTileType[];
  bookLabel?: string;
  onBook?: (item: ChatTileItemType) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const opened = tiles.find((tile) => tile.label === open && tile.items?.length);
  const list = useRef<HTMLSpanElement>(null);
  // An opened tile brings its list into view: below the tiles, it can open under the fold.
  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);
  return (
    <>
      <span className="sc-tiles">
        {tiles.map((tile) => {
          const face = (
            <>
              <span className="sc-tile-label">{tile.label}</span>
              {tile.note && <span className="sc-tile-note">{tile.note}</span>}
            </>
          );
          if (tile.items?.length)
            return (
              <button
                key={tile.label}
                type="button"
                className="sc-tile"
                aria-expanded={open === tile.label}
                data-open={open === tile.label || undefined}
                onClick={() => setOpen((now) => (now === tile.label ? null : tile.label))}
              >
                {face}
              </button>
            );
          return tile.href ? (
            <a key={tile.label} href={tile.href} className="sc-tile">
              {face}
            </a>
          ) : (
            <span key={tile.label} className="sc-tile">
              {face}
            </span>
          );
        })}
      </span>
      {opened && (
        <span ref={list} className="sc-tile-items" aria-label={opened.label}>
          {opened.items!.map((item) => (
            <span key={item.label} className="sc-tile-item">
              <span className="sc-tile-item-text">
                <span className="sc-tile-label">{item.label}</span>
                {item.note && <span className="sc-tile-note">{item.note}</span>}
              </span>
              {item.book && onBook && (
                <button type="button" onClick={() => onBook(item)}>
                  {bookLabel}
                </button>
              )}
            </span>
          ))}
        </span>
      )}
    </>
  );
}
