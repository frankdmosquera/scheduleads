// Shared config: what each subscription tier unlocks. No database code, so the API
// (to refuse) and the dashboard (to hide what would be refused) read the same rules.
// New tiers (item 23) are an edit here, not a change to any route.

// Only modules that something actually guards. A name with no code behind it would
// make the config describe a product that does not exist.
export type ModuleType = "booking" | "crm";

export type SubscriptionLimitsType = {
  modules: readonly ModuleType[]; // which parts of the product this tier may reach
};

export const SUBSCRIPTION_LIMITS = {
  agency: { modules: ["booking", "crm"] }, // the $240/mo plan
} as const satisfies Record<string, SubscriptionLimitsType>;

export type TierType = keyof typeof SUBSCRIPTION_LIMITS;

// An unknown tier unlocks nothing (fails closed). The plan column defaults to "agency",
// so an unknown value is a misconfiguration, and falling back to a paid tier would hide it.
export const LOCKED: SubscriptionLimitsType = { modules: [] };

export function isKnownTier(plan: string | null | undefined): plan is TierType {
  // Object.hasOwn, not `in`: `"toString" in SUBSCRIPTION_LIMITS` is true (it walks the
  // prototype), and a plan set to that would crash with a 500 instead of a clean 403.
  return typeof plan === "string" && Object.hasOwn(SUBSCRIPTION_LIMITS, plan);
}

// The one place a raw plan string becomes real limits.
export function getSubscriptionLimits(plan: string | null | undefined): SubscriptionLimitsType {
  return isKnownTier(plan) ? SUBSCRIPTION_LIMITS[plan] : LOCKED;
}

export function subscriptionIncludes(plan: string | null | undefined, module: ModuleType): boolean {
  return getSubscriptionLimits(plan).modules.includes(module);
}
