/**
 * Type declarations for the HH3-compat test shim.
 *
 * The runtime shim (plugins/test-shim.ts) registers `describe` / `it` as
 * globals and exposes `hre.viem` lazily. TypeScript can't see either, so
 * this file declares them as ambient for the test suite only.
 *
 * Coupled with the runtime shim — do not edit without updating the plugin.
 */

declare global {
  function describe(name: string, fn: () => void | Promise<void>): void;
  function it(name: string, fn: () => void | Promise<void>): Promise<void>;

  namespace chai {
    interface Assertion {
      rejectedWith(matcher: RegExp | string): Promise<chai.Assertion>;
    }
  }
}

// Augment HardhatRuntimeEnvironment to expose `viem` (HH2-compat surface).
declare module "hardhat" {
  interface HardhatRuntimeEnvironment {
    readonly viem: any;
  }
}

export {};
