import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";

/**
 * MVP2 Phase 0-0:
 * Start with Auth only.
 *
 * Data models will be added after confirming that the minimal sandbox
 * can be created safely.
 */
defineBackend({
  auth,
});