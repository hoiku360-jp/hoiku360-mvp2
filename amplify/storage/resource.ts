import { defineStorage } from "@aws-amplify/backend";

/**
 * Phase 12-A1:
 * Private photo storage for daily reports and child weekend letters.
 *
 * Design policy:
 * - Files are never public.
 * - Signed-in nursery users can upload and fetch a known object path.
 * - S3 list and physical delete are not granted to the frontend.
 * - Photo discovery and lifecycle are managed by PhotoAttachment records.
 * - keepOnDelete protects deployed branch data; Amplify Sandbox still removes
 *   its bucket when the sandbox is deleted.
 */
export const storage = defineStorage({
  name: "hoiku360Photos",
  keepOnDelete: true,
  access: (allow) => ({
    "photos/*": [allow.authenticated.to(["get", "write"])],
  }),
});
