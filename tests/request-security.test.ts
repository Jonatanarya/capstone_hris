import { describe, it, expect } from "vitest";
import { mutationAllowed, safeNextPath } from "../lib/api/request-security";
import { readJson } from "../lib/api/http";

describe("same-origin mutation protection", () => {
  const make = (headers: Record<string, string>, method = "POST") =>
    new Request("https://hris.test/api/v1/auth/logout", { method, headers });
  it("allows reads and correctly marked same-origin writes", () => {
    expect(mutationAllowed(make({}, "GET"))).toBe(true);
    expect(
      mutationAllowed(
        make({
          origin: "https://hris.test",
          "x-hris-request": "1",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });
  it.each([
    {},
    { origin: "https://evil.test", "x-hris-request": "1" },
    { origin: "https://hris.test" },
    {
      origin: "https://hris.test",
      "x-hris-request": "1",
      "sec-fetch-site": "cross-site",
    },
  ])("rejects untrusted mutation %j", (headers) =>
    expect(mutationAllowed(make(headers as Record<string, string>))).toBe(
      false,
    ),
  );
  it.each([
    "//evil.test",
    "/\\evil.test",
    "https://evil.test",
    "/%2f%2fevil.test",
    "/unknown",
    null,
  ])("does not redirect to %s", (path) => expect(safeNextPath(path)).toBe("/"));
});

describe("JSON body validation", () => {
  const make = (body: string, type = "application/json") =>
    new Request("https://hris.test/api", {
      method: "POST",
      headers: { "Content-Type": type },
      body,
    });
  it.each(["null", "[]", "1", '"string"', "{broken", " "])(
    "rejects %s",
    async (body) => {
      await expect(readJson(make(body))).rejects.toMatchObject({
        status: 400,
        code: "INVALID_JSON",
      });
    },
  );
  it("rejects simple form/text requests and oversized JSON", async () => {
    await expect(readJson(make("{}", "text/plain"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      readJson(make(JSON.stringify({ text: "a".repeat(32768) }))),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("accepts a normal object", async () =>
    expect(await readJson(make('{"email":"a@b.test"}'))).toEqual({
      email: "a@b.test",
    }));
});
