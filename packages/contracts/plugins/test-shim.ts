import { describe, it } from "node:test";
import { definePlugin } from "hardhat/plugins";
import type { HardhatPlugin } from "hardhat/types/plugins";

/**
 * Mocha-compat shim for Hardhat 3 + node:test.
 *
 * Hardhat 3's node:test runner does NOT expose `describe`/`it` as globals
 * (unlike `node --test` on the CLI), and `hardhat-viem` v3 attaches `viem`
 * to `NetworkConnection`, not to the HRE directly. The test suite was
 * authored against the Hardhat 2 + Mocha-style API, so this plugin restores
 * both:
 *
 *   1. `describe` and `it` are mirrored onto `globalThis` so test files can
 *      use the Mocha-style API without an explicit `node:test` import.
 *
 *   2. `hre.viem` is added lazily — on first access it calls
 *      `hre.network.getOrCreate()` and returns the resulting connection's
 *      viem helpers. The connection is memoized so all `hre.viem.*` calls
 *      share the same network state.
 *
 *   3. Chai is extended with a minimal `rejectedWith` matcher (see
 *      `./test-shim-hooks.ts`) so the test suite can assert on reverted
 *      transactions without pulling in chai-as-promised or
 *      hardhat-chai-matchers as a new dependency.
 *
 * Production scripts (which don't run under `node:test`) get the official
 * Hardhat 3 API surface — only the global `describe`/`it` mirror is set
 * unconditionally at config-load time.
 *
 * TODO follow-up plan: rewrite test files in HH3 idioms
 *   (`await network.connect().viem`, `import { describe, it } from "node:test"`)
 *   and remove this shim.
 */
const hardhatPlugin: HardhatPlugin = definePlugin({
  id: "giglock-test-shim",
  hookHandlers: {
    hre: () => import("./test-shim-hooks.js"),
  },
  npmPackage: "@giglock/contracts",
});

export default hardhatPlugin;

// Eagerly install the node:test globals so they're available even before
// the HRE is created (i.e., during test file evaluation).
(globalThis as { describe?: typeof describe }).describe = describe;
(globalThis as { it?: typeof it }).it = it;