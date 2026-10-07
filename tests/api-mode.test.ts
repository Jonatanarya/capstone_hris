import { describe, it, expect, afterEach } from "vitest";
import { apiMode, isLiveMode } from "../lib/api-mode";

describe("pemilihan mode data API", () => {
  const original = process.env.NEXT_PUBLIC_API_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_API_MODE;
    else process.env.NEXT_PUBLIC_API_MODE = original;
  });

  it("default demo saat env tidak diisi", () => {
    delete process.env.NEXT_PUBLIC_API_MODE;
    expect(apiMode()).toBe("demo");
    expect(isLiveMode()).toBe(false);
  });

  it("live hanya bila env tepat bernilai 'live'", () => {
    process.env.NEXT_PUBLIC_API_MODE = "live";
    expect(apiMode()).toBe("live");
    expect(isLiveMode()).toBe(true);
  });

  it("memperlakukan nilai lain sebagai demo", () => {
    process.env.NEXT_PUBLIC_API_MODE = "LIVE";
    expect(apiMode()).toBe("demo");
    expect(isLiveMode()).toBe(false);
    process.env.NEXT_PUBLIC_API_MODE = "true";
    expect(apiMode()).toBe("demo");
  });
});
