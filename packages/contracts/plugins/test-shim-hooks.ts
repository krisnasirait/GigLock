import { Assertion as ChaiAssertionClass, expect as chaiExpect } from "chai";
import type {
  HardhatRuntimeEnvironmentHooks,
  HookContext,
} from "hardhat/types/hooks";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { NetworkConnection } from "hardhat/types/network";

/**
 * HRE hooks for the test-shim plugin. See ./test-shim.ts for the rationale.
 *
 * The handlers are loaded lazily via the plugin's `hookHandlers.hre` factory
 * (Hardhat requires the hook handler module to be returned via a dynamic
 * `import()` so plugin loading stays async).
 */
export default async (): Promise<Partial<HardhatRuntimeEnvironmentHooks>> => {
  installChaiMatchers();
  return {
    created: async (
      _context: HookContext,
      hre: HardhatRuntimeEnvironment,
    ): Promise<void> => {
      let cached: NetworkConnection | undefined;
      let pending: Promise<NetworkConnection> | undefined;
      Object.defineProperty(hre, "viem", {
        configurable: true,
        enumerable: false,
        get() {
          if (cached !== undefined) {
            return cached.viem;
          }
          if (pending === undefined) {
            // `getOrCreate` (not `connect`) — `connect` is deprecated.
            pending = hre.network.getOrCreate();
            pending.then((c) => {
              cached = c;
            });
          }
          return makeLazyViemProxy(pending);
        },
      });
    },
  };
};

function makeLazyViemProxy(
  connectionPromise: Promise<NetworkConnection>,
): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return undefined;
        }
        return async (...args: unknown[]) => {
          const connection = await connectionPromise;
          const value = (connection.viem as unknown as Record<string | symbol, unknown>)[
            prop as string
          ];
          if (typeof value === "function") {
            return (value as (...a: unknown[]) => unknown)(...args);
          }
          return value;
        };
      },
    },
  );
}

// Minimal type for the chai Assertion class — avoids pulling in @types/chai.
type ChaiAssertion = {
  _obj: unknown;
  (): void;
};

/**
 * Minimal Chai plugin that exposes `.rejectedWith(...)` for promises.
 *
 * The test suite uses
 *   `await expect(promise).to.be.rejectedWith(/pattern/i)`
 * to assert that a transaction reverts. The standard chai `expect` doesn't
 * understand promise rejections, and the project doesn't depend on
 * chai-as-promised or hardhat-chai-matchers. Rather than add a dependency
 * just for one matcher, we define the smallest possible implementation
 * that handles the use case in the suite.
 */
function installChaiMatchers(): void {
  const Assertion = ChaiAssertionClass as unknown as ChaiAssertion & {
    prototype: Record<string, unknown>;
  };

  if (Assertion.prototype["rejectedWith"] !== undefined) {
    return;
  }

  Assertion.prototype["rejectedWith"] = function (
    this: ChaiAssertion,
    matcher: RegExp | string,
  ): ChaiAssertion {
    const promise = (this as unknown as { _obj: unknown })._obj;
    const flags = typeof matcher === "string" ? undefined : matcher.flags;
    const source = typeof matcher === "string" ? matcher : matcher.source;
    const regex = new RegExp(source, flags);
    const promiseRef = promise as Promise<unknown>;
    this._obj = chaiExpect(
      promiseRef.then(
        (value) => {
          throw new Error(
            `Expected promise to be rejected with matching ${regex}, but it resolved with ${String(value)}`,
          );
        },
        (err: unknown) => {
          const message = extractErrorMessage(err);
          if (!regex.test(message)) {
            throw new Error(
              `Expected promise rejection message to match ${regex}, got: ${message}`,
            );
          }
          return true;
        },
      ),
    );
    return this;
  };
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (
    err !== null &&
    typeof err === "object" &&
    "shortMessage" in err &&
    typeof (err as { shortMessage: unknown }).shortMessage === "string"
  ) {
    return (err as { shortMessage: string }).shortMessage;
  }
  return String(err);
}