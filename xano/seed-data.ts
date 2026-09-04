// One source of truth for the demo fixtures. Used two ways:
//   1. `table({ seed })` on each table, so a fresh deploy is browsable at once.
//   2. the `seed/run` endpoint, which truncates and re-adds these same rows.
//
// Rows auto-number 1..N in array order (id is omitted), so the foreign keys
// below refer to those positions: a member's plan_id is a plans id, a usage
// row's benefit_id is a benefits id. Keep the arrays in this order.
//
// The passwords are DELIBERATE public demo credentials (documented in the
// README). They ship in the static bundle behind `--allow-seed-in-static`.

export type CallerRole = "support_rep" | "benefits_agent" | "governance_lead";
export type PlanTier = "bronze" | "silver" | "gold";
export type BenefitCategory =
  | "dental"
  | "vision"
  | "physical_therapy"
  | "mental_health";

export interface PlanSeed {
  name: string;
  tier: PlanTier;
}

export interface CallerSeed {
  username: string;
  name: string;
  role: CallerRole;
  password: string;
  // The member field groups this caller may read. The scope guard checks
  // membership: "benefits" to look a member up, "pii" to see PII fields,
  // "audit" to read the access log.
  allowed_fields: string[];
}

export interface MemberSeed {
  full_name: string; // PII
  dob: string; // PII
  member_number: string;
  ssn_last4: string; // PII
  plan_id: number; // -> plans
}

export interface BenefitSeed {
  plan_id: number; // -> plans
  category: BenefitCategory;
  coverage_summary: string;
  annual_limit: number; // covered visits per year (a count, not currency)
  requires_referral: boolean;
}

export interface UsageSeed {
  member_id: number; // -> members
  benefit_id: number; // -> benefits
  used_count: number;
}

// The demo password every seeded caller shares.
export const DEMO_PASSWORD = "demo1234";

// plans: ids 1, 2, 3
export const SEED_PLANS: PlanSeed[] = [
  { name: "Bronze HMO", tier: "bronze" },
  { name: "Silver PPO", tier: "silver" },
  { name: "Gold PPO", tier: "gold" },
];

// callers (the auth table): ids 1, 2, 3
export const SEED_CALLERS: CallerSeed[] = [
  {
    username: "rep",
    name: "Dana Whitfield",
    role: "support_rep",
    password: DEMO_PASSWORD,
    allowed_fields: ["benefits", "eligibility", "pii"],
  },
  {
    username: "agent",
    name: "Aria (Benefits Agent)",
    role: "benefits_agent",
    password: DEMO_PASSWORD,
    allowed_fields: ["benefits", "eligibility"],
  },
  {
    username: "gov",
    name: "Morgan Vance",
    role: "governance_lead",
    password: DEMO_PASSWORD,
    allowed_fields: ["audit"],
  },
];

// members: ids 1, 2, 3
export const SEED_MEMBERS: MemberSeed[] = [
  {
    full_name: "Dana Reyes",
    dob: "1984-03-12",
    member_number: "M-1001",
    ssn_last4: "4821",
    plan_id: 3, // Gold PPO
  },
  {
    full_name: "Luis Ortega",
    dob: "1991-07-22",
    member_number: "M-1002",
    ssn_last4: "3390",
    plan_id: 2, // Silver PPO
  },
  {
    full_name: "Priya Nair",
    dob: "1978-11-02",
    member_number: "M-1003",
    ssn_last4: "7715",
    plan_id: 1, // Bronze HMO
  },
];

// benefits: ids 1..11 (gold 1-4, silver 5-8, bronze 9-11; bronze has no vision)
export const SEED_BENEFITS: BenefitSeed[] = [
  // Gold PPO (plan 3)
  { plan_id: 3, category: "dental", coverage_summary: "Cleanings and basic restorative dental care.", annual_limit: 26, requires_referral: false },
  { plan_id: 3, category: "vision", coverage_summary: "Annual eye exam and one pair of lenses.", annual_limit: 12, requires_referral: false },
  { plan_id: 3, category: "physical_therapy", coverage_summary: "Outpatient physical therapy visits.", annual_limit: 20, requires_referral: true },
  { plan_id: 3, category: "mental_health", coverage_summary: "Counseling and behavioral health sessions.", annual_limit: 30, requires_referral: false },
  // Silver PPO (plan 2)
  { plan_id: 2, category: "dental", coverage_summary: "Cleanings and basic restorative dental care.", annual_limit: 20, requires_referral: false },
  { plan_id: 2, category: "vision", coverage_summary: "Annual eye exam and one pair of lenses.", annual_limit: 10, requires_referral: false },
  { plan_id: 2, category: "physical_therapy", coverage_summary: "Outpatient physical therapy visits.", annual_limit: 15, requires_referral: true },
  { plan_id: 2, category: "mental_health", coverage_summary: "Counseling and behavioral health sessions.", annual_limit: 20, requires_referral: false },
  // Bronze HMO (plan 1) — no vision benefit on this plan
  { plan_id: 1, category: "dental", coverage_summary: "Preventive dental cleanings.", annual_limit: 3, requires_referral: false },
  { plan_id: 1, category: "physical_therapy", coverage_summary: "Outpatient physical therapy visits.", annual_limit: 1, requires_referral: true },
  { plan_id: 1, category: "mental_health", coverage_summary: "Counseling sessions.", annual_limit: 6, requires_referral: false },
];

// member_benefit_usage: feeds the remaining-limit math (limit minus used)
export const SEED_USAGE: UsageSeed[] = [
  { member_id: 1, benefit_id: 1, used_count: 10 }, // Dana / gold dental       -> 16 left
  { member_id: 1, benefit_id: 3, used_count: 5 }, //  Dana / gold PT           -> 15 left
  { member_id: 1, benefit_id: 4, used_count: 8 }, //  Dana / gold mental       -> 22 left
  { member_id: 2, benefit_id: 5, used_count: 2 }, //  Luis / silver dental     -> 18 left
  { member_id: 2, benefit_id: 7, used_count: 5 }, //  Luis / silver PT         -> 10 left
  { member_id: 3, benefit_id: 9, used_count: 1 }, //  Priya / bronze dental    ->  2 left
];
