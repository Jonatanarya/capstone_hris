import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthFlow, readAuthFlow } from "../lib/auth-flow";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("signed recovery flow", () => {
  it("binds flow to user/type and rejects tampering or expiration", () => {
    vi.stubEnv("AUTH_FLOW_SECRET", "test-only-private-signing-key");
    vi.useFakeTimers();
    const token = createAuthFlow("user-1", "recovery");
    expect(readAuthFlow(token)).toMatchObject({
      userId: "user-1",
      type: "recovery",
    });
    expect(readAuthFlow(token + "x")).toBeNull();
    expect(readAuthFlow("forged.signature")).toBeNull();
    vi.advanceTimersByTime(900001);
    expect(readAuthFlow(token)).toBeNull();
  });
});
