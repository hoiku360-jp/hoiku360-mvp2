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

export const issueNextDayDailyPlansFn = defineFunction({
  name: "issue-next-day-daily-plans",
  entry: "../functions/issue-next-day-daily-plans/handler.ts",
  timeoutSeconds: 300,
  memoryMB: 512,
  runtime: 22,
  // Runs at 04:00 UTC = 13:00 JST on weekdays.
  // Friday's run issues the following Monday's daily plans.
  schedule: [
    "0 4 ? * 2 *",
    "0 4 ? * 3 *",
    "0 4 ? * 4 *",
    "0 4 ? * 5 *",
    "0 4 ? * 6 *",
  ],
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


  /**
   * Phase 7-B:
   * Observation hint master for daily plan issuance.
   *
   * Seed from AbilityObservationHint.csv.
   * One ability can have multiple hint rows, and each row has examples for:
   * - episode1: action / posture
   * - episode2: words
   * - episode3: gesture / expression
   */
  AbilityObservationHint: a
    .model({
      abilityCode: a.string().required(),
      abilityName: a.string().required(),
      startingAge: a.integer().required(),
      hintNo: a.integer().required(),
      episode1: a.string(),
      episode2: a.string(),
      episode3: a.string(),
      isActive: a.boolean().required(),
    })
    .secondaryIndexes((index) => [
      index("abilityCode")
        .sortKeys(["startingAge", "hintNo"])
        .queryField("listObservationHintsByAbility"),
    ])
    .authorization((allow) => [
      allow.authenticated().to(["create", "read", "update", "delete"]),
    ]),

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
   * Phase 3:
   * Plan document.
   *
   * One flexible model covers:
   * - LONG_TERM: ANNUAL / TERM / MONTHLY
   * - SHORT_TERM: WEEKLY / DAILY
   *
   * JSON payload fields are stored as strings on purpose.
   * This avoids AWSJSON variable formatting issues and keeps the model stable
   * while the plan content structure evolves.
   */
  PlanDocument: a
    .model({
      tenantId: a.id().required(),
      fiscalYear: a.integer().required(),

      classroomId: a.id(),

      planLevel: a.string().required(), // LONG_TERM / SHORT_TERM
      planKind: a.string().required(), // ANNUAL / TERM / MONTHLY / WEEKLY / DAILY

      status: a.string().required(), // DRAFT / CONFIRMED / ARCHIVED

      periodStartDate: a.date().required(),
      periodEndDate: a.date().required(),

      title: a.string(),

      sourcePlanId: a.id(),
      sourceImpactAnalysisIdsJson: a.string(),

      contentJson: a.string(),

      createdByUserId: a.id(),
      updatedByUserId: a.id(),
    })
    .authorization((allow) => [
      allow.authenticated().to(["create", "read", "update", "delete"]),
    ]),

  /**
   * Phase 3:
   * Impact analysis.
   *
   * This is the generalized successor concept to "environment impact".
   * It can analyze environment composition, outdoor play, indoor play,
   * practice activity, or a staff / classroom practice portfolio.
   */
  ImpactAnalysis: a
    .model({
      tenantId: a.id().required(),
      fiscalYear: a.integer().required(),

      scopeType: a.string().required(), // TENANT / CLASSROOM / STAFF / PLAN
      classroomId: a.id(),
      staffUserId: a.id(),

      targetKind: a.string().required(), // ENVIRONMENT / OUTDOOR_PLAY / INDOOR_PLAY / PRACTICE_ACTIVITY / PRACTICE_PORTFOLIO

      status: a.string().required(), // DRAFT / CONFIRMED / ARCHIVED

      sourcePlanId: a.id(),

      periodStartDate: a.date(),
      periodEndDate: a.date(),

      title: a.string(),

      inputJson: a.string(),
      resultJson: a.string(),
      selectedJson: a.string(),

      createdByUserId: a.id(),
      updatedByUserId: a.id(),
    })
    .authorization((allow) => [
      allow.authenticated().to(["create", "read", "update", "delete"]),
    ]),

  /**
   * Phase 3:
   * Plan phrase master.
   *
   * Seed from MVP1 PlanPhrase.csv.
   * This lets teachers choose candidate plan phrases instead of writing
   * long-term / monthly plan text from scratch.
   *
   * MVP2 intentionally starts without secondary indexes here.
   * The seed currently has only a few hundred rows, so the first UI can list
   * and filter on the client side. Add indexes only after access patterns are
   * confirmed.
   */
  PlanPhrase: a
    .model({
      planPhraseId: a.string().required(),
      planPeriodType: a.string().required(), // YEAR / TERM / MONTH
      domainCode: a.string().required(), // YEAR/TERM: 0, MONTH: 11 / 21 / 31 / 41 / 51
      domain: a.string().required(), // YEAR/TERM: 総合, MONTH: 健康 / 人間関係 / 環境 / 言葉 / 表現
      ageYears: a.integer().required(), // 3 / 4 / 5
      phraseNo: a.integer(),
      phraseType: a.string(), // 年間計画 / 4〜6月のねらい / 月のねらい など
      phraseText: a.string().required(),
      source: a.string(),
      status: a.string().required(), // active / archived
      sortOrder: a.integer(),
      note: a.string(),
    })
    .identifier(["planPhraseId"])
    .authorization((allow) => [
      allow.authenticated().to(["create", "read", "update", "delete"]),
    ]),

  /**
   * Phase 3:
   * Plan phrase to Ability link master.
   *
   * Seed from MVP1 PlanPhraseAbilityLink.csv.
   * This connects phrase candidates to 5 areas / 10 postures / leaf abilities.
   */
  PlanPhraseAbilityLink: a
    .model({
      linkId: a.string().required(),
      planPhraseId: a.string().required(),

      planPeriodType: a.string().required(), // YEAR / TERM / MONTH
      phraseDomainCode: a.string(), // YEAR/TERM: 0, MONTH: 11 / 21 / 31 / 41 / 51
      phraseDomain: a.string(), // YEAR/TERM: 総合, MONTH: 健康 / 人間関係 / 環境 / 言葉 / 表現
      ageYears: a.integer(),
      phraseNo: a.integer(),

      abilityCode: a.string().required(),
      abilityDomain: a.string(),
      categoryCode: a.string(),
      categoryName: a.string(),
      abilityName: a.string(),

      relationType: a.string(), // PRIMARY / RELATED / YEAR_DIRECTION / TERM_DIRECTION
      weight: a.integer().required(),
      status: a.string().required(), // active / archived
      sortOrder: a.integer(),
      note: a.string(),
    })
    .identifier(["linkId"])
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
   allow.resource(issueNextDayDailyPlansFn),
]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});