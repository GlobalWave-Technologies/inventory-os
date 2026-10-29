const FLAG = "stockline-legacy-db-deleted";

/** The first version of this app kept sample data in the browser. This removes that database once. */
export async function wipeLegacyLocalData() {
  try {
    if (localStorage.getItem(FLAG)) return;
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("northern-ledger");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
    localStorage.setItem(FLAG, "1");
  } catch {
    // Storage may be blocked. The old data is harmless, so try again next time.
  }
}
