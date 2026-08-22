import { describe, expect, it } from "vitest";

import {
  loadCustomerDraft,
  saveCustomerDraft,
} from "../../src/modules/customer/draft-storage";

const draft = {
  idempotencyKey: "72000000-0000-4000-8000-000000000001",
  originalText: "น้ำเปล่า 1",
};

describe("customer draft storage", () => {
  it("falls back to session storage without changing the draft", () => {
    const sessionValues = new Map<string, string>();
    const browserWindow = {
      get localStorage() {
        throw new DOMException("blocked", "SecurityError");
      },
      sessionStorage: makeStorage(sessionValues),
    } as unknown as Window;

    expect(saveCustomerDraft(browserWindow, "draft", draft)).toBe("session");
    expect(loadCustomerDraft(browserWindow, "draft")).toEqual(draft);
  });

  it("reports memory-only mode when every storage tier fails", () => {
    const blockedStorage = makeStorage(new Map(), true);
    const browserWindow = {
      localStorage: blockedStorage,
      sessionStorage: blockedStorage,
    } as unknown as Window;

    expect(saveCustomerDraft(browserWindow, "draft", draft)).toBe("memory");
  });
});

function makeStorage(values: Map<string, string>, blocked = false): Storage {
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      if (blocked) {
        throw new DOMException("blocked", "QuotaExceededError");
      }
      values.set(key, value);
    },
  };
}
