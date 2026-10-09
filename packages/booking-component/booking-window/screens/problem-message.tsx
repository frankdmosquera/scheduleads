// Booking component: a problem's words, with Try again when trying again can help and the
// business's phone whenever it is known. Never a dead end. Used by the whole window and inside a
// screen's panel alike.

import { telHref } from "@scheduleads-app/shared/tel-href";

export type ProblemMessagePropsType = {
  words: string;
  retry: (() => void) | null;
  phone: string | null;
};

export function ProblemMessage({ words, retry, phone }: ProblemMessagePropsType) {
  return (
    <div className="sa-problem">
      <p className="sa-problem-words" role="alert">
        {words}
      </p>
      {(retry || phone) && (
        <div className="sa-actions">
          {retry && (
            <button type="button" className="sa-go" onClick={retry}>
              Try again
            </button>
          )}
          {phone && (
            <a className="sa-call" href={telHref(phone)}>
              Call {phone}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
