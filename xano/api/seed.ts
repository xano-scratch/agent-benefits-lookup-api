import { apiGroup, query, s, c } from "@xanots/sdk";
import { plans } from "../tables/plans.js";
import { callers } from "../tables/callers.js";
import { members } from "../tables/members.js";
import { benefits } from "../tables/benefits.js";
import { memberBenefitUsage } from "../tables/member-benefit-usage.js";
import { accessLog } from "../tables/access-log.js";
import {
  SEED_PLANS,
  SEED_CALLERS,
  SEED_MEMBERS,
  SEED_BENEFITS,
  SEED_USAGE,
} from "../seed-data.js";

export const seedGroup = apiGroup({ name: "seed", canonical: "gblseed" });

// Idempotently reset the environment to the demo fixtures. Truncate every table
// (reset the id sequences), clear the audit trail, then re-add the same rows the
// tables seed with. A fresh deploy is already seeded; this endpoint lets the
// frontend restore a clean state on demand. Public so the demo can reset itself.
export const seedRunQuery = query({
  name: "run",
  verb: "POST",
  apiGroup: seedGroup,
  stack: [
    s.db.truncate({ table: accessLog, reset: true }),
    s.db.truncate({ table: memberBenefitUsage, reset: true }),
    s.db.truncate({ table: benefits, reset: true }),
    s.db.truncate({ table: members, reset: true }),
    s.db.truncate({ table: callers, reset: true }),
    s.db.truncate({ table: plans, reset: true }),

    // Add in dependency order so the auto-numbered ids line up with the foreign
    // keys in the seed data (plan 1..3, member 1..3, benefit 1..11).
    ...SEED_PLANS.map((p) =>
      s.db.add({ table: plans, row: { name: p.name, tier: p.tier } }),
    ),
    ...SEED_CALLERS.map((cr) =>
      s.db.add({
        table: callers,
        row: {
          username: cr.username,
          name: cr.name,
          role: cr.role,
          password: cr.password,
          allowed_fields: c.array(cr.allowed_fields),
        },
      }),
    ),
    ...SEED_MEMBERS.map((m) =>
      s.db.add({
        table: members,
        row: {
          full_name: m.full_name,
          dob: m.dob,
          member_number: m.member_number,
          ssn_last4: m.ssn_last4,
          plan_id: m.plan_id,
        },
      }),
    ),
    ...SEED_BENEFITS.map((b) =>
      s.db.add({
        table: benefits,
        row: {
          plan_id: b.plan_id,
          category: b.category,
          coverage_summary: b.coverage_summary,
          annual_limit: b.annual_limit,
          requires_referral: b.requires_referral,
        },
      }),
    ),
    ...SEED_USAGE.map((u) =>
      s.db.add({
        table: memberBenefitUsage,
        row: {
          member_id: u.member_id,
          benefit_id: u.benefit_id,
          used_count: u.used_count,
        },
      }),
    ),
  ],
  response: {
    seeded: c.bool(true),
    plans: c.int(SEED_PLANS.length),
    callers: c.int(SEED_CALLERS.length),
    members: c.int(SEED_MEMBERS.length),
    benefits: c.int(SEED_BENEFITS.length),
    usage: c.int(SEED_USAGE.length),
  },
});
