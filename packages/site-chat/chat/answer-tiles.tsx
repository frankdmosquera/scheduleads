import type { ChatTileType } from "../answers/chat-answers-type.js";

/** An answer that is a list, as tiles under its words: each with its name and its line, a link when it has a page. */
export function AnswerTiles({ tiles }: { tiles: readonly ChatTileType[] }) {
  return (
    <span className="sc-tiles">
      {tiles.map((tile) => {
        const face = (
          <>
            <span className="sc-tile-label">{tile.label}</span>
            {tile.note && <span className="sc-tile-note">{tile.note}</span>}
          </>
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
  );
}
