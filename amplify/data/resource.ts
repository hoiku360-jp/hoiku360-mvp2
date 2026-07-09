import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

/**
 * MVP2 Phase 0 data model.
 *
 * Design policy:
 * - No hasMany / belongsTo relations yet.
 * - No secondary indexes yet.
 * - Use tenantId / classroomId / userId as plain ID references.
 * - Add indexes only after real access patterns are confirmed.
 */

const schema = a.schema({
  Tenant: a
    .model({
      name: a.string().required(),
      displayName: a.string(),
      status: a.string().required(), // ACTIVE / INACTIVE
    })
    .authorization((allow) => [allow.authenticated()]),

  Classroom: a
    .model({
      tenantId: a.id().required(),
      name: a.string().required(),
      ageLabel: a.string(),
      fiscalYear: a.integer().required(),
      status: a.string().required(), // ACTIVE / INACTIVE
    })
    .authorization((allow) => [allow.authenticated()]),

  UserProfile: a
    .model({
      /**
       * MVP2 rule:
       * UserProfile.id should be the Cognito user sub.
       *
       * This avoids the MVP1 mismatch:
       * - getUserProfile({ userId }) was invalid
       * - getUserProfile({ id }) was required
       */
      userId: a.id().required(),
      tenantId: a.id().required(),
      displayName: a.string().required(),
      email: a.email(),
      role: a.string().required(), // DIRECTOR / LEAD / TEACHER / STAFF
      status: a.string().required(), // ACTIVE / INACTIVE
    })
    .authorization((allow) => [allow.authenticated()]),

  StaffAssignment: a
    .model({
      tenantId: a.id().required(),
      userId: a.id().required(),
      classroomId: a.id(),
      role: a.string().required(), // DIRECTOR / LEAD / HOMEROOM / SUPPORT
      fiscalYear: a.integer().required(),
      status: a.string().required(), // ACTIVE / INACTIVE
    })
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});