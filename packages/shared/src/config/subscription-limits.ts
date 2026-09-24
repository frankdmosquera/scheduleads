/**
 * What a business has paid for.
 *
 * A pure config module: no database import, no server-only code. The API
 * reads it to refuse a request, and the dashboard reads it to stop
 * offering something that would be refused. Keeping it free of database
 * access is what lets both sides share one definition instead of the UI
 * guessing at rules the server enforces.
 *
 * Only one tier exists today. The ladder above it is build-plan item 23,
 * and when it arrives it is an edit to this file, not a change to any
 * route: every module route already calls the subscription middleware.
 */

/**
 * A slice of the product a tier can unlock.
 *
 * Only modules that something actually guards belong here. Adding a name
 * before there is code behind it makes the config describe a product that
 * does not exist, which is how a check quietly stops meaning anything.
 */
export type ModuleType = "booking" | "crm";

export type SubscriptionLimitsType = {
  /** Which parts of the product this tier may reach. */
  modules: readonly ModuleType[];
};

/** The tiers that exist. `agency` is the $240/mo plan. */
export const SUBSCRIPTION_LIMITS = {
  agency: { modules: ["booking", "crm"] },
} as const satisfies Record<string, SubscriptionLimitsType>;

export type TierType = keyof typeof SUBSCRIPTION_LIMITS;

/**
 * What an unrecognised tier resolves to: nothing.
 *
 * This is the direction that matters. `organization.plan` is server-set
 * and defaults to `agency`, so a value this file does not know is a
 * misconfiguration, not a customer on a cheaper tier. Falling back to the
 * base tier would hand the product to an organization nobody deliberately
 * put there, and the mistake would be invisible because everything would
 * keep working. Failing closed makes it loud and harmless.
 */
export const LOCKED: SubscriptionLimitsType = { modules: [] };

/**
 * Whether a raw plan string names a tier this file defines.
 *
 * `Object.hasOwn`, not `in`. The `in` operator walks the prototype, so
 * `"toString" in SUBSCRIPTION_LIMITS` and `"constructor" in SUBSCRIPTION_LIMITS` are both
 * true and resolve to functions with no `modules`. A plan hand-edited to
 * either would have crashed the subscription middleware with a 500 instead of failing closed
 * with a 403. Only reachable through a manual database write, but this is
 * the function whose whole job is failing safely.
 */
export function isKnownTier(plan: string | null | undefined): plan is TierType {
  return typeof plan === "string" && Object.hasOwn(SUBSCRIPTION_LIMITS, plan);
}

/**
 * The one place a raw plan string becomes real limits. Nothing else reads
 * `organization.plan` directly.
 */
export function getSubscriptionLimits(plan: string | null | undefined): SubscriptionLimitsType {
  return isKnownTier(plan) ? SUBSCRIPTION_LIMITS[plan] : LOCKED;
}

/** Whether a tier reaches a given module. */
export function subscriptionIncludes(plan: string | null | undefined, module: ModuleType): boolean {
  return getSubscriptionLimits(plan).modules.includes(module);
}
