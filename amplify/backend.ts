import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";

/**
 * MVP2 Phase 0:
 * Auth + minimal tenant/classroom/user assignment data model.
 */
defineBackend({
  auth,
  data,
});