import { describe, expect, it } from "vitest";
import { GIWA_SEPOLIA_CHAIN_ID, resolveDashboardChainId } from "./chainConfig.js";

describe("dashboard chain configuration", () => {
  it("uses GIWA Sepolia by default and for its declared environment value", () => {
    expect(resolveDashboardChainId(undefined)).toBe(GIWA_SEPOLIA_CHAIN_ID);
    expect(resolveDashboardChainId("91342")).toBe(GIWA_SEPOLIA_CHAIN_ID);
  });

  it("rejects a non-GIWA dashboard chain configuration", () => {
    expect(() => resolveDashboardChainId("31337")).toThrow("GIWA Sepolia");
  });
});
