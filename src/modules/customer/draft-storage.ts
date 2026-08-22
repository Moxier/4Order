export type StoredCustomerDraft = {
  idempotencyKey: string;
  originalText: string;
};

export type DraftStorageLevel = "local" | "memory" | "session";

export function loadCustomerDraft(
  browserWindow: Window,
  storageKey: string,
): StoredCustomerDraft | null {
  for (const getStorage of storageProviders(browserWindow)) {
    try {
      const storage = getStorage();
      const value = storage.getItem(storageKey);
      if (value) {
        return JSON.parse(value) as StoredCustomerDraft;
      }
    } catch {
      // Try the next storage tier. Schema validation happens at the caller.
    }
  }
  return null;
}

export function saveCustomerDraft(
  browserWindow: Window,
  storageKey: string,
  draft: StoredCustomerDraft,
): DraftStorageLevel {
  const value = JSON.stringify(draft);

  try {
    const localStorage = browserWindow.localStorage;
    localStorage.setItem(storageKey, value);
    try {
      browserWindow.sessionStorage.removeItem(storageKey);
    } catch {
      // A stale session fallback is harmless while local storage is canonical.
    }
    return "local";
  } catch {
    try {
      browserWindow.sessionStorage.setItem(storageKey, value);
      return "session";
    } catch {
      return "memory";
    }
  }
}

export function removeCustomerDraft(
  browserWindow: Window,
  storageKey: string,
): void {
  for (const getStorage of storageProviders(browserWindow)) {
    try {
      const storage = getStorage();
      storage.removeItem(storageKey);
    } catch {
      // The server receipt remains authoritative even when storage is blocked.
    }
  }
}

function storageProviders(browserWindow: Window): Array<() => Storage> {
  return [
    () => browserWindow.localStorage,
    () => browserWindow.sessionStorage,
  ];
}
