export type ReportPeriodType = "WEEK" | "MONTH" | "TERM" | "YEAR" | "CUSTOM";

export type ReportScopeType = "CLASS" | "CHILD";

export type ReportAggregationContext = {
  periodType: ReportPeriodType;
  scopeType: ReportScopeType;
  periodStart: string;
  periodEnd: string;
  tenantId: string;
  fiscalYear: number;
  classroomId?: string;
  childId?: string;
};

export type ClassroomRow = {
  id?: string | null;
  tenantId?: string | null;
  name?: string | null;
  ageLabel?: string | null;
  fiscalYear?: number | null;
  status?: string | null;
};

export type ChildRow = {
  id?: string | null;
  tenantId?: string | null;
  displayName?: string | null;
  kana?: string | null;
  status?: string | null;
};

export type ChildClassroomEnrollmentRow = {
  id?: string | null;
  tenantId?: string | null;
  childId?: string | null;
  classroomId?: string | null;
  fiscalYear?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
};

export type ObservationRecordRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  childId?: string | null;
  childName?: string | null;
  observedDate?: string | null;
  body?: string | null;
  status?: string | null;
  reportDate?: string | null;
  practiceRole?: string | null;
  practiceCode?: string | null;
  practiceName?: string | null;
  episodeText?: string | null;
  observedByName?: string | null;
  observedAt?: string | null;
};

export type ObservationAbilityLinkRow = {
  id?: string | null;
  tenantId?: string | null;
  observationId?: string | null;
  childId?: string | null;
  abilityCode?: string | null;
  abilityName?: string | null;
  confidence?: number | null;
  evidenceText?: string | null;
  reason?: string | null;
  source?: string | null;
  status?: string | null;
};

export type AbilityCodeRow = {
  id?: string | null;
  code?: string | null;
  code_display?: string | null;
  parent_code?: string | null;
  level?: number | null;
  name?: string | null;
  domain?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_leaf?: boolean | null;
  status?: string | null;
};

export type DailyPracticeRecordRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  dailyReportId?: string | null;
  reportDate?: string | null;
  practiceRole?: string | null;
  practiceCode?: string | null;
  practiceName?: string | null;
  isPerformed?: boolean | null;
  observationHintsJson?: string | null;
  status?: string | null;
};

export type PlanDocumentRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  planLevel?: string | null;
  planKind?: string | null;
  status?: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  title?: string | null;
  contentJson?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PlanPhraseRow = {
  planPhraseId?: string | null;
  planPeriodType?: string | null;
  domainCode?: string | null;
  domain?: string | null;
  ageYears?: number | null;
  phraseNo?: number | null;
  phraseType?: string | null;
  phraseText?: string | null;
  status?: string | null;
  sortOrder?: number | null;
};

export type PlanPhraseAbilityLinkRow = {
  linkId?: string | null;
  planPhraseId?: string | null;
  planPeriodType?: string | null;
  abilityCode?: string | null;
  abilityDomain?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  abilityName?: string | null;
  weight?: number | null;
  status?: string | null;
  sortOrder?: number | null;
};

export type ObservationReportSourceData = {
  enrolledChildren: ChildRow[];
  observations: ObservationRecordRow[];
  abilityLinks: ObservationAbilityLinkRow[];
  abilityCodes: AbilityCodeRow[];
  practiceRecords: DailyPracticeRecordRow[];
  planDocuments: PlanDocumentRow[];
  planPhrases: PlanPhraseRow[];
  planPhraseAbilityLinks: PlanPhraseAbilityLinkRow[];
};

export type EpisodeAbilitySummary = {
  abilityCode: string;
  abilityName: string;
  confidence: number | null;
  evidenceText: string;
  reason: string;
  source: string;
};

export type EpisodeSummary = {
  observationId: string;
  childId: string;
  childName: string;
  reportDate: string;
  practiceRole: string;
  practiceCode: string;
  practiceName: string;
  episodeText: string;
  observedByName: string;
  abilities: EpisodeAbilitySummary[];
};

export type PracticeSummary = {
  key: string;
  practiceRole: string;
  practiceCode: string;
  practiceName: string;
  performedDateCount: number;
  observationCount: number;
  childCount: number;
};

export type ChildObservationSummary = {
  childId: string;
  childName: string;
  kana: string;
  observationCount: number;
  abilityLinkCount: number;
  latestObservationDate: string;
  episodes: EpisodeSummary[];
};

export type AbilitySummary = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
  sortOrder: number;
  observationCount: number;
  childCount: number;
};

export type DistributionSummary = {
  key: string;
  label: string;
  observationCount: number;
  childCount: number;
};

export type ExpectedAbilitySummary = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
  expectedPracticeCount: number;
  observationCount: number;
  childCount: number;
  status: "UNOBSERVED" | "LOW" | "OBSERVED";
};

export type ObservationReportSummary = {
  context: ReportAggregationContext;
  observationCount: number;
  observedChildCount: number;
  enrolledChildCount: number;
  practiceCount: number;
  abilityLinkCount: number;
  observationWithAbilityCount: number;
  observationWithoutAbilityCount: number;
  observedAbilityCount: number;
  unobservedAbilityCount: number;
  practices: PracticeSummary[];
  children: ChildObservationSummary[];
  abilities: AbilitySummary[];
  domains: DistributionSummary[];
  postures: DistributionSummary[];
  expectedAbilities: ExpectedAbilitySummary[];
  episodes: EpisodeSummary[];
  unobservedChildren: ChildObservationSummary[];
  lowObservationChildren: ChildObservationSummary[];
  warnings: string[];
};

export type ReportProgressSummary = {
  asOfDate: string;
  elapsedDays: number;
  totalDays: number;
  percentage: number;
  completedUnits: number;
  totalUnits: number;
  unitLabel: string;
};

export type PlanAnchorPhraseSummary = {
  planPhraseId: string;
  phraseType: string;
  phraseText: string;
};

export type PlanAnchorSummary = {
  planId: string;
  planKind: string;
  title: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  memo: string;
  phrases: PlanAnchorPhraseSummary[];
};

export type PlanMonthStatusSummary = {
  monthKey: string;
  label: string;
  planId: string;
  status: string;
  approved: boolean;
  phraseCount: number;
};

export type PlanDistributionSummary = {
  key: string;
  label: string;
  planScore: number;
  phraseLinkCount: number;
};

export type PlanReportSummary = {
  context: ReportAggregationContext;
  anchors: PlanAnchorSummary[];
  monthStatuses: PlanMonthStatusSummary[];
  requiredMonthCount: number;
  approvedMonthlyCount: number;
  missingMonthKeys: string[];
  planLinkCount: number;
  domains: PlanDistributionSummary[];
  postures: PlanDistributionSummary[];
  warnings: string[];
};

export type PlanActualComparisonStatus =
  | "UNDER"
  | "BALANCED"
  | "OVER"
  | "NO_PLAN";

export type PlanActualComparisonRow = {
  key: string;
  label: string;
  planScore: number;
  actualCount: number;
  planShare: number;
  actualShare: number;
  gapPoints: number;
  status: PlanActualComparisonStatus;
};

export type PlanActualComparisonSummary = {
  planTotal: number;
  actualTotal: number;
  rows: PlanActualComparisonRow[];
  underRows: PlanActualComparisonRow[];
  overRows: PlanActualComparisonRow[];
};

export type MonthlyTrendSummary = {
  monthKey: string;
  label: string;
  context: ReportAggregationContext;
  planApproved: boolean;
  observationCount: number;
  abilityLinkCount: number;
  domainComparison: PlanActualComparisonSummary;
};

export type ChildWeeklyAbilityComparisonStatus =
  | "NEW_THIS_WEEK"
  | "CONTINUING"
  | "NOT_OBSERVED_THIS_WEEK";

export type ChildWeeklyAbilityComparisonRow = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
  currentObservationCount: number;
  previousObservationCount: number;
  status: ChildWeeklyAbilityComparisonStatus;
};

export type ChildWeeklyComparisonSummary = {
  periodStart: string;
  periodEnd: string;
  observationCount: number;
  abilityLinkCount: number;
  rows: ChildWeeklyAbilityComparisonRow[];
  newAbilities: ChildWeeklyAbilityComparisonRow[];
  continuingAbilities: ChildWeeklyAbilityComparisonRow[];
  previousOnlyAbilities: ChildWeeklyAbilityComparisonRow[];
};

export type ChildWeeklyRecordSummary = {
  context: ReportAggregationContext;
  childId: string;
  childName: string;
  kana: string;
  observationCount: number;
  observationDayCount: number;
  practiceCount: number;
  abilityLinkCount: number;
  observationWithAbilityCount: number;
  observationWithoutAbilityCount: number;
  observedAbilityCount: number;
  practices: PracticeSummary[];
  abilities: AbilitySummary[];
  domains: DistributionSummary[];
  postures: DistributionSummary[];
  episodes: EpisodeSummary[];
  comparison: ChildWeeklyComparisonSummary;
  warnings: string[];
};

export type WeekendPlayRow = {
  playId: string;
  playTitle: string;
  playType: string;
  setting: string;
  status: string;
  parentHint: string;
  sourceFile: string;
  playDescriptionDraft: string;
};

export type WeekendPlayAbilityLinkRow = {
  linkId: string;
  playId: string;
  playTitle: string;
  sortOrder: number;
  relationType: string;
  weight: number;
  abilityCode: string;
  domain: string;
  category: string;
  abilityName: string;
  reason: string;
};

export type WeekendPlayMatchLevel = "EXACT" | "CATEGORY" | "DOMAIN";

export type WeekendPlayCandidateMatch = {
  matchLevel: WeekendPlayMatchLevel;
  observedAbilityCode: string;
  observedAbilityName: string;
  observedDomain: string;
  observedCategory: string;
  observedCount: number;
  linkedAbilityCode: string;
  linkedAbilityName: string;
  relationType: string;
  weight: number;
  reason: string;
  score: number;
};

export type WeekendPlayCandidate = WeekendPlayRow & {
  score: number;
  exactMatchCount: number;
  categoryMatchCount: number;
  domainMatchCount: number;
  primaryMatchCount: number;
  matches: WeekendPlayCandidateMatch[];
};

export type ChildWeekendLetterSourceEpisode = {
  observationId: string;
  reportDate: string;
  practiceName: string;
  episodeText: string;
  abilityCodes: string[];
};

export type ChildWeekendLetterSourceAbility = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
};

export type WeekendPlaySelectionSnapshot = {
  playId: string;
  playTitle: string;
  playType: string;
  setting: string;
  parentHint: string;
  playDescriptionDraft: string;
  matchReasons: Array<{
    observedAbilityCode: string;
    observedAbilityName: string;
    matchLevel: WeekendPlayMatchLevel;
    relationType: string;
    reason: string;
  }>;
};

export type ChildWeekendLetterSourceSnapshot = {
  promptVersion: string;
  childId: string;
  childName: string;
  weekStartDate: string;
  weekEndDate: string;
  episodes: ChildWeekendLetterSourceEpisode[];
  abilities: ChildWeekendLetterSourceAbility[];
  previousEpisodes: ChildWeekendLetterSourceEpisode[];
  newAbilityNames: string[];
  continuingAbilityNames: string[];
  selectedWeekendPlay: WeekendPlaySelectionSnapshot;
};

export type ChildWeekendLetterDraft = {
  title: string;
  weeklyEpisodeText: string;
  growthText: string;
  comparisonText: string;
  weekendPlayText: string;
};


export type ChildWeeklyWorkflowAction =
  | "COMPLETE"
  | "CONFIRM"
  | "RETURN";

export type ChildWeeklyWorkflowEntry = {
  action: ChildWeeklyWorkflowAction;
  status: "COMPLETED" | "CONFIRMED" | "RETURNED";
  actorUserId: string;
  actorName: string;
  actorRole: string;
  at: string;
  comment: string;
};

export type ChildWeeklyReportRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  childId?: string | null;
  childName?: string | null;
  weekStartDate?: string | null;
  weekEndDate?: string | null;
  status?: string | null;
  sourceSnapshotJson?: string | null;
  comparisonSnapshotJson?: string | null;
  weekendPlayCandidatesJson?: string | null;
  selectedWeekendPlayJson?: string | null;
  sourceObservationIdsJson?: string | null;
  sourceAbilityCodesJson?: string | null;
  title?: string | null;
  weeklyEpisodeText?: string | null;
  growthText?: string | null;
  comparisonText?: string | null;
  weekendPlayText?: string | null;
  parentLetterText?: string | null;
  aiStatus?: string | null;
  aiModel?: string | null;
  promptVersion?: string | null;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  generatedAt?: string | null;
  generationErrorMessage?: string | null;
  aiRawJson?: string | null;
  recordedByUserId?: string | null;
  recordedByName?: string | null;
  recordedAt?: string | null;
  confirmedByUserId?: string | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  reviewHistoryJson?: string | null;
  deliveryStatus?: string | null;
  finalParentLetterText?: string | null;
  deliveryPreparedByUserId?: string | null;
  deliveryPreparedByName?: string | null;
  deliveryPreparedAt?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GenerateChildWeekendLetterResponse = {
  childWeeklyReportId?: string | null;
  status?: string | null;
  title?: string | null;
  weeklyEpisodeText?: string | null;
  growthText?: string | null;
  comparisonText?: string | null;
  weekendPlayText?: string | null;
  parentLetterText?: string | null;
  aiModel?: string | null;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  generatedAt?: string | null;
};


export type ChildProgressAbilityStatus =
  | "NEW"
  | "CONTINUED"
  | "MORE_RECORDED"
  | "LESS_RECORDED"
  | "PREVIOUS_ONLY";

export type ChildProgressPeriodSummary = {
  periodStart: string;
  periodEnd: string;
  observationCount: number;
  observationDayCount: number;
  practiceCount: number;
  abilityLinkCount: number;
  observationWithAbilityCount: number;
  observationWithoutAbilityCount: number;
  observedAbilityCount: number;
  domains: DistributionSummary[];
  postures: DistributionSummary[];
  abilities: AbilitySummary[];
  practices: PracticeSummary[];
  episodes: EpisodeSummary[];
};

export type ChildProgressDomainComparisonRow = {
  key: string;
  label: string;
  currentCount: number;
  previousCount: number;
  difference: number;
};

export type ChildProgressAbilityComparisonRow = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
  currentCount: number;
  previousCount: number;
  difference: number;
  status: ChildProgressAbilityStatus;
};

export type ChildProgressEvidenceRow = EpisodeSummary & {
  selectionScore: number;
  selectionReasons: string[];
};

export type ChildProgressComparisonSummary = {
  childId: string;
  childName: string;
  kana: string;
  current: ChildProgressPeriodSummary;
  previous: ChildProgressPeriodSummary;
  domainRows: ChildProgressDomainComparisonRow[];
  abilityRows: ChildProgressAbilityComparisonRow[];
  newAbilities: ChildProgressAbilityComparisonRow[];
  continuedAbilities: ChildProgressAbilityComparisonRow[];
  moreRecordedAbilities: ChildProgressAbilityComparisonRow[];
  lessRecordedAbilities: ChildProgressAbilityComparisonRow[];
  previousOnlyAbilities: ChildProgressAbilityComparisonRow[];
  evidenceRows: ChildProgressEvidenceRow[];
  sourceObservationIds: string[];
  sourceAbilityCodes: string[];
  warnings: string[];
};

export type ChildProgressEvidenceSnapshot = {
  snapshotVersion: string;
  generatedAt: string;
  childId: string;
  childName: string;
  classroomId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  comparisonPeriodStart: string;
  comparisonPeriodEnd: string;
  sourceObservationIds: string[];
  sourceAbilityCodes: string[];
  domainRows: ChildProgressDomainComparisonRow[];
  abilityRows: ChildProgressAbilityComparisonRow[];
  practiceRows: PracticeSummary[];
  evidenceRows: ChildProgressEvidenceRow[];
};

export type ChildProgressRecordRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  childId?: string | null;
  childName?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  comparisonPeriodStart?: string | null;
  comparisonPeriodEnd?: string | null;
  status?: string | null;
  evidenceSnapshotJson?: string | null;
  sourceObservationIdsJson?: string | null;
  sourceAbilityCodesJson?: string | null;
  templateDraftText?: string | null;
  aiSourceSnapshotJson?: string | null;
  aiDraftJson?: string | null;
  aiDraftText?: string | null;
  draftText?: string | null;
  finalText?: string | null;
  aiStatus?: string | null;
  aiModel?: string | null;
  promptVersion?: string | null;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  generatedAt?: string | null;
  generationErrorMessage?: string | null;
  aiRawJson?: string | null;
  recordedByUserId?: string | null;
  recordedByName?: string | null;
  recordedAt?: string | null;
  confirmedByUserId?: string | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  reviewHistoryJson?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};


export type ChildProgressAiEpisode = {
  observationId: string;
  reportDate: string;
  practiceName: string;
  episodeText: string;
  abilityCodes: string[];
};

export type ChildProgressAiAbility = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
  currentCount: number;
  previousCount: number;
  status: ChildProgressAbilityStatus;
};

export type ChildProgressAiDomainSource = {
  domain: string;
  abilities: ChildProgressAiAbility[];
  currentEpisodes: ChildProgressAiEpisode[];
  previousEpisodes: ChildProgressAiEpisode[];
  practices: string[];
};

export type ChildProgressAiSourceSnapshot = {
  promptVersion: string;
  childId: string;
  childName: string;
  classroomId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  comparisonPeriodStart: string;
  comparisonPeriodEnd: string;
  overallCurrentEpisodes: ChildProgressAiEpisode[];
  overallPreviousEpisodes: ChildProgressAiEpisode[];
  domains: ChildProgressAiDomainSource[];
  newAbilityNames: string[];
  continuingAbilityNames: string[];
  sourceObservationIds: string[];
  sourceAbilityCodes: string[];
};

export type ChildProgressAiDraft = {
  centralThemes: string[];
  interpretationNotes: string[];
  overviewText: string;
  healthText: string;
  relationshipText: string;
  environmentText: string;
  languageText: string;
  expressionText: string;
  continuityText: string;
  nextPerspectiveText: string;
  needsTeacherInputDomains: string[];
  sourceObservationIds: string[];
  warnings: string[];
};

export type GenerateChildProgressRecordResponse = {
  childProgressRecordId?: string | null;
  status?: string | null;
  aiDraftJson?: string | null;
  aiDraftText?: string | null;
  aiModel?: string | null;
  inputTokenCount?: number | null;
  outputTokenCount?: number | null;
  generatedAt?: string | null;
};
