// Frontend: a Settings card tells its page while its Save runs, so the page greys out the other
// cards' buttons and no other card opens until the Save's answer has been shown (F-511, F-514).

import { useEffect } from "react";

export function useReportSaving(saving: boolean, onSavingChange?: (saving: boolean) => void) {
  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);
  // A card that closes is no longer saving.
  useEffect(() => () => onSavingChange?.(false), [onSavingChange]);
}
