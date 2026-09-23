/**
 * What a business has paid for.
 *
 * A pure config module: no database import, no server-only code. The API
 * reads it to refuse a request, and the dashboard reads it to stop
 * offering something that would be refused. Keeping it free of database
 * access is what lets both sides share one definition instead of the UI
 * guessing at rules the server enforces.
 *
 * Only one rung exists today. The ladder above it is build-plan item 23,
 * and when it arrives it is an edit to this file, not a change to any
 * route: every module route already calls the gate.
 */

/**
 * A slice of the product a rung can unlock.
 *
 * Only modules that something actually guards belong here. Adding a name
 * before there is code behind it makes the config describe a product that
 * does not exist, which is how a gate quietly stops meaning anything.
 */
export type Module = "booking" | "crm";

export type PlanLimits = {
  /** Which parts of the product this rung may reach. */
  modules: readonly Module[];
};

/** The rungs that exist. `agency` is the $240/mo plan. */
export const PLAN_LIMITS = {
  agency: { modules: ["booking", "crm"] },
} as const satisfies Record<string, PlanLimits>;

export type Rung = keyof typeof PLAN_LIMITS;

/**
 * What an unrecognised rung resolves to: nothing.
 *
 * This is the direction that matters. `organization.plan` is server-set
 * and defaults to `agency`, so a value this file does not know is a
 * misconfiguration, not a customer on a cheaper tier. Falling back to the
 * base rung would hand the product to an organization nobody deliberately
 * put there, and the mistake would be invisible because everything would
 * keep working. Failing closed makes it loud and harmless.
 */
export const LOCKED: PlanLimits = { modules: [] };

/**
 * Whether a raw plan string names a rung this file defines.
 *
 * `Object.hasOwn`, not `in`. The `in` operator walks the prototype, so
 * `"toString" in PLAN_LIMITS` and `"constructor" in PLAN_LIMITS` are both
 * true and resolve to functions with no `modules`. A plan hand-edited to
 * either would have crashed the gate with a 500 instead of failing closed
 * with a 403. Only reachable through a manual database write, but this is
 * the function whose whole job is failing safely.
 */
export function isKnownRung(plan: string | null | undefined): plan is Rung {
  return typeof plan === "string" && Object.hasOwn(PLAN_LIMITS, plan);
}

/**
 * The one place a raw plan string becomes real limits. Nothing else reads
 * `organization.plan` directly.
 */
export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return isKnownRung(plan) ? PLAN_LIMITS[plan] : LOCKED;
}

/** Whether a rung reaches a given module. */
export function planIncludes(
  plan: string | null | undefined,
  module: Module
): boolean {
  return getPlanLimits(plan).modules.includes(module);
}
