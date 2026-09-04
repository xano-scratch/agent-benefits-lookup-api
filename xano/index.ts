import { workspace } from "@xanots/sdk";

// Tables
import { plans } from "./tables/plans.js";
import { callers } from "./tables/callers.js";
import { members } from "./tables/members.js";
import { benefits } from "./tables/benefits.js";
import { memberBenefitUsage } from "./tables/member-benefit-usage.js";
import { accessLog } from "./tables/access-log.js";

// Governed functions (the business logic both people and the agent call)
import { logAccess } from "./functions/log-access.js";
import { memberRead } from "./functions/member-read.js";
import { coverageLookup } from "./functions/coverage.js";
import { eligibilityRule } from "./functions/eligibility.js";
import { remainingLimit } from "./functions/remaining.js";

// API groups, endpoints, and the agent
import { authGroup, loginQuery } from "./api/auth.js";
import { membersGroup, membersGetQuery } from "./api/members.js";
import {
  benefitsGroup,
  getCoverageQuery,
  checkEligibilityQuery,
  getRemainingLimitQuery,
} from "./api/benefits.js";
import { agentGroup, benefitsAssistant, askQuery } from "./api/agent.js";
import { auditGroup, auditQueriesQuery } from "./api/audit.js";
import { seedGroup, seedRunQuery } from "./api/seed.js";

// Governed Benefits Lookup — a permissioned, logged access layer over a health
// payer's member benefits. The same role scope decides which member fields each
// caller may read, whether a support rep or an AI agent asks; out-of-scope reads
// are refused at the API layer, and every lookup is written to the audit trail.
export default workspace("agent-benefits-lookup-api")
  .registerTables([plans, callers, members, benefits, memberBenefitUsage, accessLog])
  .registerFunctions([logAccess, memberRead, coverageLookup, eligibilityRule, remainingLimit])
  .registerAgents([benefitsAssistant])
  .registerApiGroups([authGroup, membersGroup, benefitsGroup, agentGroup, auditGroup, seedGroup])
  .registerQueries([
    loginQuery,
    membersGetQuery,
    getCoverageQuery,
    checkEligibilityQuery,
    getRemainingLimitQuery,
    askQuery,
    auditQueriesQuery,
    seedRunQuery,
  ]);
