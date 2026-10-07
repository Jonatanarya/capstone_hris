import { describe, expect, it } from "vitest";
import { hasFreshInviteProof } from "../lib/invite-proof";
const now = Date.now();
const user = {
  id: "user-1",
  invited_at: "2026-10-07",
  email_confirmed_at: "2026-10-07",
};
const claims = {
  sub: user.id,
  amr: [{ method: "otp", timestamp: now / 1000 }],
};
describe("fresh invitation proof (signature verified by caller)", () => {
  it("accepts fresh OTP for a confirmed, still-invited identity", () => {
    expect(hasFreshInviteProof(claims, user, "INVITED", now)).toBe(true);
  });
  it.each([
    { sub: "other", amr: claims.amr },
    { sub: user.id, amr: [{ method: "password", timestamp: now / 1000 }] },
    {
      sub: user.id,
      amr: [{ method: "otp", timestamp: (now - 900001) / 1000 }],
    },
    { sub: user.id, amr: [{ method: "otp", timestamp: (now + 30001) / 1000 }] },
    { sub: user.id, amr: [null, "otp"] },
    { sub: user.id },
  ])(
    "rejects wrong identity, ordinary login, stale/future or malformed proofs %#",
    (proof) => {
      expect(hasFreshInviteProof(proof, user, "INVITED", now)).toBe(false);
    },
  );
  it("rejects already-active accounts and unconfirmed/noninvited identities", () => {
    expect(hasFreshInviteProof(claims, user, "ACTIVE", now)).toBe(false);
    expect(hasFreshInviteProof(claims, { id: user.id }, "INVITED", now)).toBe(
      false,
    );
    expect(
      hasFreshInviteProof(
        claims,
        { ...user, email_confirmed_at: undefined },
        "INVITED",
        now,
      ),
    ).toBe(false);
  });
});
