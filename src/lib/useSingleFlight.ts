import { useCallback, useRef, useState } from "react";

/**
 * Lets an action run one at a time. While one run is still in progress, extra taps are
 * ignored, so a double tap can't send the request twice or show the success message twice.
 */
export function useSingleFlight() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (task: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await task();
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending };
}
