import { describe, expect, it } from "vitest";
import {
  deriveFaucetEligibility,
  faucetErrorMessage,
  faucetTransactionUrl,
} from "./faucet.js";

describe("faucet dashboard helpers", () => {
  it("derives an ineligible next-claim timestamp from the on-chain cooldown", () => {
    expect(deriveFaucetEligibility(2_000_000_000n, 86_400n, 1_900_000_000n)).toEqual({
      eligible: false,
      eligibleAt: 2_000_086_400n,
    });
  });

  it("maps wallet rejection, faucet cooldown, and RPC errors to distinct recovery copy", () => {
    expect(faucetErrorMessage({ name: "UserRejectedRequestError", code: 4001 })).toMatch(/cancelled/i);
    expect(faucetErrorMessage(new Error("faucet: wait 24h between claims"))).toMatch(/already claimed/i);
    expect(faucetErrorMessage(new Error("network unavailable"))).toMatch(/could not reach/i);
  });

  it("derives a GIWA explorer URL for a submitted claim", () => {
    expect(faucetTransactionUrl("0x1234")).toBe("https://sepolia-explorer.giwa.io/tx/0x1234");
  });
});
