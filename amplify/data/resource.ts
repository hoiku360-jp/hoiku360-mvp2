import {
  a,
  defineData,
  defineFunction,
  type ClientSchema,
} from "@aws-amplify/backend";

/**
 * MVP2 data model.
 *
 * Design policy:
 * - No hasMany / belongsTo relations yet.
 * - No secondary indexes yet.
 * - Use tenantId / classroomId / childId / userId as plain ID references.
 * - Add indexes only after real access patterns are confirmed.
 */

export const cleanupTranscriptTextFn = defineFunction({
  name: "cleanup-transcript-text",
  entry: "../functions/cleanup-transcript-text/handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 22,
  environment: {
    BEDROCK_MODEL_ID: "jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
  },
});

export const analyzePracticeFn = defineFunction({
  name: "analyze-practice",
  entry: "../functions/practice-analyze/handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 22,
  environment: {
    BEDROCK_MODEL_ID: "jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
  },
});

export const suggestPracticeLinksFn = defineFunction({
  name: "suggest-practice-links",
  entry: "../functions/practice-link-suggest/handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 22,
  environment: {
    BEDROCK_MODEL_ID: "jp.anthropic.claude-sonnet-4-5-20250929-v1:0",
  },
});

export const registerPracticeLinksFn = defineFunction({
  name: "register-practice-links",
  entry: "../functions/practice-link-register/handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
  runtime: 22,
});

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
   * Child belongs to a tenant, not directly to a classroom.
   * Classroom assignment is managed by ChildClassroomEnrollment.
   */
  Child: a
    .model({
      tenantId: a.id().required(),
      displayName: a.string().required(),
      kana: a.string(),
      birthDate: a.date(),
      gender: a.string(),
      status: a.string().required(), // ACTIVE / INACTIVE / GRADUATED / TRANSFERRED
    })
    .authorization((allow) => [allow.authenticated()]),

  /**
   * Phase 1-A:
   * Fiscal-year classroom assignment for children.
   *
   * This separates the child identity from yearly classroom changes.
   * A child keeps the same Child.id across fiscal years.
   */
  ChildClassroomEnrollment: a
    .model({
      tenantId: a.id().required(),
      childId: a.id().required(),
      classroomId: a.id().required(),
      fiscalYear: a.integer().required(),
      startDate: a.date().required(),
      endDate: a.date(),
      status: a.string().required(), // ACTIVE / INACTIVE / TRANSFERRED
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
      code_display: a.string().required(),
      parent_code: a.string(),
      level: a.integer().required(),
      name: a.string().required(),
      domain: a.string(),
      category: a.string(),
      sort_order: a.integer(),
      is_leaf: a.boolean().required(),
      status: a.string().required(),
      note: a.string(),
    })
    .authorization((allow) => [allow.authenticated()]),

  CleanupTranscriptTextResponse: a.customType({
    originalText: a.string().required(),
    cleanedText: a.string().required(),
    status: a.string().required(),
    message: a.string(),
  }),

  cleanupTranscriptText: a
    .mutation()
    .arguments({
      practiceCode: a.string(),
      childNames: a.string().array(),
      transcriptText: a.string().required(),
    })
    .returns(a.ref("CleanupTranscriptTextResponse"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cleanupTranscriptTextFn)),

  AnalyzePracticeResponse: a.customType({
    practiceId: a.string().required(),
    practiceCode: a.string().required(),
    name: a.string().required(),
    memo: a.string().required(),
    status: a.string().required(),
    aiModel: a.string(),
  }),

  analyzePractice: a
    .mutation()
    .arguments({
      practiceId: a.string().required(),
    })
    .returns(a.ref("AnalyzePracticeResponse"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(analyzePracticeFn)),

  SuggestPracticeLinksResponse: a.customType({
    practiceId: a.string().required(),
    practiceCode: a.string().required(),
    suggestionCount: a.integer().required(),
    status: a.string().required(),
    aiModel: a.string(),
  }),

  suggestPracticeLinks: a
    .mutation()
    .arguments({
      practiceId: a.string().required(),
    })
    .returns(a.ref("SuggestPracticeLinksResponse"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(suggestPracticeLinksFn)),

  RegisterPracticeLinksResponse: a.customType({
    practiceCode: a.string().required(),
    registeredCount: a.integer().required(),
    status: a.string().required(),
  }),

  registerPracticeLinks: a
    .mutation()
    .arguments({
      practiceCode: a.string().required(),
    })
    .returns(a.ref("RegisterPracticeLinksResponse"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(registerPracticeLinksFn)),
  
    PracticeCode: a
  .model({
    practice_code: a.string().required(),

    tenantId: a.string().required(),
    owner: a.string().required(),

    category_code: a.string(),
    category_name: a.string(),
    name: a.string().required(),
    memo: a.string(),

    source_type: a.string().required(),
    source_ref: a.string(),
    source_url: a.string(),

    status: a.string().required(),
    version: a.integer().required(),

    createdBy: a.string(),
    updatedBy: a.string(),

    visibility: a.string(),
    publishScope: a.string(),
    ownerType: a.string(),

    practiceCategory: a.string(),
    practiceSourceType: a.string(),

    // Practice eligibility metadata for Plan / ImpactAnalysis.
    // MVP2 initial default:
    // - targetAgeMin = 3
    // - targetAgeMax = 5
    // - seasonalityType = "ALL_YEAR"
    // - seasonMonthsJson = [1,2,3,4,5,6,7,8,9,10,11,12]
    targetAgeMin: a.integer(),
    targetAgeMax: a.integer(),
    seasonalityType: a.string(), // ALL_YEAR / MONTHS
    seasonMonthsJson: a.json(),

    recordedAt: a.datetime(),
    transcriptText: a.string(),

    aiStatus: a.string(),
    aiModel: a.string(),
    aiRawJson: a.string(),

    errorMessage: a.string(),

    reviewedAt: a.datetime(),
    completedAt: a.datetime(),
  })
  .secondaryIndexes((index) => [
    index("tenantId")
      .sortKeys(["practice_code"])
      .queryField("listPracticeCodesByTenant"),
    index("tenantId")
      .sortKeys(["status", "practice_code"])
      .queryField("listPracticeCodesByTenantStatus"),
    index("tenantId")
      .sortKeys(["practiceCategory", "practice_code"])
      .queryField("listPracticeCodesByTenantCategory"),
    index("owner")
      .sortKeys(["practice_code"])
      .queryField("listPracticeCodesByOwner"),
  ])
  .authorization((allow) => [
    allow.authenticated().to(["create", "read", "update", "delete"]),
  ]),

PracticeLinkSuggestion: a
  .model({
    tenantId: a.string().required(),
    practiceCode: a.string().required(),
    abilityCode: a.string().required(),
    score: a.integer().required(),
    reason: a.string(),
    status: a.string().required(),
    sortOrder: a.integer(),
    createdBy: a.string(),
    updatedBy: a.string(),
  })
  .secondaryIndexes((index) => [
    index("practiceCode")
      .sortKeys(["status", "sortOrder"])
      .queryField("listPracticeLinkSuggestionsByPractice"),
    index("tenantId")
      .sortKeys(["practiceCode", "status"])
      .queryField("listPracticeLinkSuggestionsByTenantPractice"),
  ])
  .authorization((allow) => [
    allow.authenticated().to(["create", "read", "update", "delete"]),
  ]),

AbilityPracticeLink: a
  .model({
    abilityCode: a.string().required(),
    practiceCode: a.string().required(),
    score: a.integer().required(),
  })
  .identifier(["abilityCode", "practiceCode"])
  .secondaryIndexes((index) => [
    index("abilityCode")
      .sortKeys(["practiceCode"])
      .queryField("listByAbility"),
    index("practiceCode")
      .sortKeys(["abilityCode"])
      .queryField("listByPractice"),
  ])
  .authorization((allow) => [
    allow.authenticated().to(["create", "read", "update", "delete"]),
  ]),

AbilityPracticeAgg: a
  .model({
    abilityCode: a.string().required(),
    practiceCode: a.string().required(),
    scoreSum: a.integer().required(),
    scoreMax: a.integer().required(),
    linkCount: a.integer().required(),
    level: a.integer().required(),
  })
  .authorization((allow) => [
    allow.authenticated().to(["create", "read", "update", "delete"]),
  ]),
  
    /**
   * Phase 1-A:
   * Observation record.
   *
   * This is the core "Do" record.
   * AI / audio / photo will be added later.
   *
   * Keep both childId and classroomId:
   * - childId identifies the child.
   * - classroomId fixes the classroom context at the time of observation.
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
})
 .authorization((allow) => [
   allow.resource(cleanupTranscriptTextFn),
   allow.resource(analyzePracticeFn),
   allow.resource(suggestPracticeLinksFn),
   allow.resource(registerPracticeLinksFn),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});