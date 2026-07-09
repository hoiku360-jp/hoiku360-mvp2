import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

/**
 * MVP2 data model.
 *
 * Design policy:
 * - No hasMany / belongsTo relations yet.
 * - No secondary indexes yet.
 * - Use tenantId / classroomId / childId / userId as plain ID references.
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

  /**
   * Phase 1-A:
   * Child master.
   *
   * Keep it small for now.
   * Detailed family/contact/attendance fields will be added later only if needed.
   */
  Child: a
    .model({
      tenantId: a.id().required(),
      classroomId: a.id().required(),
      displayName: a.string().required(),
      kana: a.string(),
      birthDate: a.date(),
      gender: a.string(),
      status: a.string().required(), // ACTIVE / INACTIVE
    })
    .authorization((allow) => [allow.authenticated()]),

  /**
   * Phase 1-A:
   * Ability master.
   *
   * MVP2 uses AbilityCode.id as the stable code when seeding.
   * Example:
   *   id = "HEALTH_001"
   *   code = "HEALTH_001"
   */
  AbilityCode: a
    .model({
      code: a.string().required(),
      domain: a.string().required(), // 健康 / 人間関係 / 環境 / 言葉 / 表現
      name: a.string().required(),
      description: a.string(),
      status: a.string().required(), // ACTIVE / INACTIVE
    })
    .authorization((allow) => [allow.authenticated()]),

  /**
   * Phase 1-A:
   * Observation record.
   *
   * This is the core "Do" record.
   * AI / audio / photo will be added later.
   */
  ObservationRecord: a
    .model({
      tenantId: a.id().required(),
      classroomId: a.id().required(),
      childId: a.id().required(),
      observedDate: a.date().required(),
      observerUserId: a.id(),
      sourceType: a.string().required(), // MANUAL / AUDIO / AI / IMPORT
      body: a.string().required(),
      status: a.string().required(), // DRAFT / CONFIRMED / ARCHIVED
    })
    .authorization((allow) => [allow.authenticated()]),

  /**
   * Phase 1-A:
   * Observation to Ability link.
   *
   * Keep as loose ID references.
   */
  ObservationAbilityLink: a
    .model({
      tenantId: a.id().required(),
      observationId: a.id().required(),
      childId: a.id().required(),
      abilityCode: a.string().required(),
      confidence: a.float(),
      evidenceText: a.string(),
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