// Frontend: after a refused save, focus the first field marked invalid, once the errors have drawn.

import { useEffect, useState, type RefObject } from "react";

// Returns the function to call on a refused save. The focus waits for React to draw the errors
// (an effect after the next render), so it finds the field that is now marked invalid.
export function useFocusFirstInvalid(formRef: RefObject<HTMLFormElement | null>): () => void {
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (request === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [request, formRef]);

  return () => setRequest((count) => count + 1);
}
