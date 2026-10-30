import { personPaths, type ChatWordsType, type PersonPathType } from "../words/chat-words-type.js";

/** Where each way to a person goes: a link the site gives (tel:, mailto:), or the site's own handler when it has none. */
export type PersonWayLinksType = Partial<Record<PersonPathType, string>>;

interface PersonWaysPropsType {
  words: ChatWordsType["ways"];
  links: PersonWayLinksType;
  /** Opens a way the site gave no link for; without it, those ways are left out. */
  onPick?: (path: PersonPathType) => void;
}

/** The ways to reach a person, under a hand-over: pills with a name, each a link or a button. */
export function PersonWays({ words, links, onPick }: PersonWaysPropsType) {
  const ways = personPaths.filter((path) => links[path] || onPick);
  return (
    <span className="sc-ways" role="group" aria-label={words.label}>
      {ways.map((path) => {
        const { label, title } = words.names[path];
        const href = links[path];
        return href ? (
          <a key={path} href={href} title={title}>
            {label}
          </a>
        ) : (
          <button key={path} type="button" title={title} onClick={() => onPick?.(path)}>
            {label}
          </button>
        );
      })}
    </span>
  );
}
