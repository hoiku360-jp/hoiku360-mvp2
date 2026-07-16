import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/issue-next-day-daily-plans";
import type { Schema } from "../../data/resource";

type ModelError = {
  message?: string | null;
};

type ListResult<T> = {
  data?: T[] | null;
  nextToken?: string | null;
  errors?: ReadonlyArray<ModelError> | null;
};

type OperationResult<T> = {
  data?: T | null;
  errors?: ReadonlyArray<ModelError> | null;
};

type PlanDocumentRow = {
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
  sourcePlanId?: string | null;
  sourceImpactAnalysisIdsJson?: string | null;
  contentJson?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PracticeCodeRow = {
  id?: string | null;
  practice_code?: string | null;
  category_code?: string | null;
  category_name?: string | null;
  name?: string | null;
  memo?: string | null;
  status?: string | null;
  tenantId?: string | null;
  owner?: string | null;
  visibility?: string | null;
  publishScope?: string | null;
  practiceCategory?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  seasonalityType?: string | null;
  seasonMonthsJson?: unknown;
  recordedAt?: string | null;
  transcriptText?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AbilityPracticeLinkRow = {
  abilityCode?: string | null;
  practiceCode?: string | null;
  score?: number | null;
};

type AbilityObservationHintRow = {
  id?: string | null;
  abilityCode?: string | null;
  abilityName?: string | null;
  startingAge?: number | null;
  hintNo?: number | null;
  episode1?: string | null;
  episode2?: string | null;
  episode3?: string | null;
  isActive?: boolean | null;
};

type WeekdayKey = "MON" | "TUE" | "WED" | "THU" | "FRI";

type DailyWeeklyDayContent = {
  date: string;
  dayOfWeek: WeekdayKey;
  dayLabel: string;
  primaryPracticeCode: string;
  primaryPracticeName: string;
  reservePracticeCode: string;
  reservePracticeName: string;
};

type DailyObservationHintRow = {
  abilityCode: string;
  abilityName: string;
  postureCode: string;
  postureName: string;
  score: number;
  startingAge: number;
  episodes: {
    episode1: string;
    episode2: string;
    episode3: string;
  };
  sourceHintIds: {
    episode1: string;
    episode2: string;
    episode3: string;
  };
};

type PlanDocumentModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<PlanDocumentRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<PlanDocumentRow>>;
};

type PracticeCodeModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<PracticeCodeRow>>;
};

type AbilityPracticeLinkModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<AbilityPracticeLinkRow>>;
};

type AbilityObservationHintModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<AbilityObservationHintRow>>;
};

type ScheduledEventLike = {
  id?: string;
  time?: string;
  targetDate?: string;
  detail?: {
    targetDate?: string;
  };
};

type IssueSummary = {
  targetDate: string;
  scannedWeeklyPlans: number;
  matchedWeeklyPlans: number;
  createdDailyPlans: number;
  skippedExistingDailyPlans: number;
  skippedNoPrimaryPractice: number;
  skippedInvalidWeeklyContent: number;
  errors: Array<{
    weeklyPlanId: string;
    message: string;
  }>;
};

const DAILY_OBSERVATION_HINT_LIMIT = 4;
const SYSTEM_USER_ID = "system:auto-daily-plan";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const rawClient = generateClient<Schema>();
const planDocumentModel = rawClient.models.PlanDocument as unknown as PlanDocumentModelClient;
const practiceCodeModel = rawClient.models.PracticeCode as unknown as PracticeCodeModelClient;
const abilityPracticeLinkModel = rawClient.models
  .AbilityPracticeLink as unknown as AbilityPracticeLinkModelClient;
const abilityObservationHintModel = rawClient.models
  .AbilityObservationHint as unknown as AbilityObservationHintModelClient;

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function errorText(
  errors: ReadonlyArray<ModelError> | null | undefined,
  fallback: string,
): string {
  if (!errors?.length) return fallback;

  const message = errors
    .map((e) => e.message ?? "")
    .filter(Boolean)
    .join("\n");

  return message || fallback;
}

async function listAll<T>(
  listFn: (input?: Record<string, unknown>) => Promise<ListResult<T>>,
  input?: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const result = await listFn({
      ...(input ?? {}),
      limit: 1000,
      nextToken,
    });

    if (result.errors?.length) {
      throw new Error(errorText(result.errors, "一覧取得に失敗しました。"));
    }

    rows.push(...(result.data ?? []));
    nextToken = result.nextToken ?? null;
  } while (nextToken);

  return rows;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  const text = s(value);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDaysDateOnly(value: string, days: number): string {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const date = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw)));
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function todayJstDateOnly(now = new Date()): { date: string; dayOfWeek: number } {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    date: formatDateOnly(shifted),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function nextBusinessDateFromJst(now = new Date()): string {
  const { date, dayOfWeek } = todayJstDateOnly(now);

  // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday.
  if (dayOfWeek >= 1 && dayOfWeek <= 4) return addDaysDateOnly(date, 1);
  if (dayOfWeek === 5) return addDaysDateOnly(date, 3); // Friday 13:00 JST issues Monday.
  if (dayOfWeek === 6) return addDaysDateOnly(date, 2);
  return addDaysDateOnly(date, 1);
}

function targetDateFromEvent(event: ScheduledEventLike): string {
  const explicitTargetDate = s(event.targetDate) || s(event.detail?.targetDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicitTargetDate)) return explicitTargetDate;

  return nextBusinessDateFromJst();
}

function dateInRange(date: string, startDate: unknown, endDate: unknown): boolean {
  const start = s(startDate);
  const end = s(endDate);
  return Boolean(date && start && end && start <= date && date <= end);
}

function postureLabelForCode(postureCode: string): string {
  switch (postureCode) {
    case "1101":
      return "健康な心と体";
    case "2101":
      return "自立心";
    case "2102":
      return "協同性";
    case "2103":
      return "道徳性・規範意識の芽生え";
    case "2104":
    case "3101":
      return "社会生活との関わり";
    case "3102":
      return "思考力の芽生え";
    case "3103":
      return "自然との関わり・生命尊重";
    case "3104":
    case "4101":
      return "数量や図形、標識や文字などへの関心・感覚";
    case "4102":
      return "言葉による伝え合い";
    case "5101":
      return "豊かな感性と表現";
    default:
      return postureCode;
  }
}

function postureCodeFromAbilityCode(value: unknown): string {
  const code = s(value);
  return /^[0-9]{4}/.test(code) ? code.slice(0, 4) : code;
}

function normalizePracticeCategory(value: unknown): string {
  const raw = s(value);
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (["outdoor", "indoor", "life", "event", "environment"].includes(lower)) return lower;

  switch (raw) {
    case "外遊び":
      return "outdoor";
    case "室内遊び":
      return "indoor";
    case "生活":
    case "生活（身支度/食事/排泄など）":
      return "life";
    case "行事":
      return "event";
    case "環境":
    case "環境構成":
      return "environment";
    default:
      return raw;
  }
}

function practiceCategoryLabel(value: unknown): string {
  const normalized = normalizePracticeCategory(value);
  switch (normalized) {
    case "outdoor":
      return "外遊び";
    case "indoor":
      return "室内遊び";
    case "life":
      return "生活";
    case "event":
      return "行事";
    case "environment":
      return "環境構成";
    default:
      return normalized || "-";
  }
}

function weeklyPlanDaysFromContent(value: unknown): DailyWeeklyDayContent[] {
  const parsed = parseJsonRecord(value);
  const days = parsed?.days;

  if (!Array.isArray(days)) return [];

  return days
    .map((item): DailyWeeklyDayContent | null => {
      if (typeof item !== "object" || item === null) return null;

      const row = item as {
        date?: unknown;
        dayOfWeek?: unknown;
        dayLabel?: unknown;
        primaryPracticeCode?: unknown;
        primaryPracticeName?: unknown;
        reservePracticeCode?: unknown;
        reservePracticeName?: unknown;
        practiceCodes?: unknown;
      };

      const date = s(row.date);
      if (!date) return null;

      const practiceCodes = Array.isArray(row.practiceCodes)
        ? row.practiceCodes.map((code) => s(code)).filter(Boolean)
        : [];

      return {
        date,
        dayOfWeek: (s(row.dayOfWeek) || "MON") as WeekdayKey,
        dayLabel: s(row.dayLabel) || date,
        primaryPracticeCode: s(row.primaryPracticeCode) || practiceCodes[0] || "",
        primaryPracticeName: s(row.primaryPracticeName),
        reservePracticeCode: s(row.reservePracticeCode) || practiceCodes[1] || "",
        reservePracticeName: s(row.reservePracticeName),
      };
    })
    .filter((item): item is DailyWeeklyDayContent => Boolean(item));
}

function sourceImpactAnalysisIds(value: unknown): string[] {
  const text = s(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => s(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

function hintSourceId(hint: AbilityObservationHintRow): string {
  return s(hint.id) || `${s(hint.abilityCode)}-${n(hint.startingAge)}-${n(hint.hintNo)}`;
}

function uniqueAbilityObservationHintRows(rows: AbilityObservationHintRow[]): AbilityObservationHintRow[] {
  const seen = new Set<string>();
  const result: AbilityObservationHintRow[] = [];

  for (const row of rows) {
    const key = [
      s(row.abilityCode),
      n(row.startingAge),
      n(row.hintNo),
      s(row.episode1),
      s(row.episode2),
      s(row.episode3),
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function abilityHintsForCode(
  abilityCode: string,
  selectedAgeYears: number | null,
  hints: AbilityObservationHintRow[],
): AbilityObservationHintRow[] {
  if (!selectedAgeYears) return [];

  const code = s(abilityCode);
  if (!code) return [];

  const postureCode = postureCodeFromAbilityCode(code);
  const activeHints = hints.filter((hint) => {
    if (hint.isActive === false) return false;
    const hintAbilityCode = s(hint.abilityCode);
    const startingAge = n(hint.startingAge);
    if (!hintAbilityCode || startingAge <= 0 || startingAge > selectedAgeYears) return false;

    return hintAbilityCode === code || hintAbilityCode.startsWith(postureCode);
  });

  if (activeHints.length === 0) return [];

  const exactHints = activeHints.filter((hint) => s(hint.abilityCode) === code);
  const source = exactHints.length > 0 ? exactHints : activeHints;
  const bestAge = Math.max(...source.map((hint) => n(hint.startingAge)));

  return source
    .filter((hint) => n(hint.startingAge) === bestAge)
    .sort((a, b) => {
      const abilityDiff = s(a.abilityCode).localeCompare(s(b.abilityCode));
      if (abilityDiff !== 0) return abilityDiff;
      return n(a.hintNo, 9999) - n(b.hintNo, 9999);
    });
}

function pickHintEpisode(
  hints: AbilityObservationHintRow[],
  key: "episode1" | "episode2" | "episode3",
  seed: string,
): { text: string; sourceHintId: string; startingAge: number; abilityCode: string; abilityName: string } {
  const candidates = hints.filter((hint) => s(hint[key]));
  if (candidates.length === 0) {
    return { text: "", sourceHintId: "", startingAge: 0, abilityCode: "", abilityName: "" };
  }

  const index = stableHash(`${seed}::${key}`) % candidates.length;
  const selected = candidates[index];

  return {
    text: s(selected[key]),
    sourceHintId: hintSourceId(selected),
    startingAge: n(selected.startingAge),
    abilityCode: s(selected.abilityCode),
    abilityName: s(selected.abilityName),
  };
}

function buildDailyObservationHints(args: {
  targetDate: string;
  classroomId: string;
  ageYears: number | null;
  practiceCode: string;
  linksByPracticeCode: Map<string, AbilityPracticeLinkRow[]>;
  observationHints: AbilityObservationHintRow[];
  maxCount?: number;
}): DailyObservationHintRow[] {
  const practiceCode = s(args.practiceCode);
  if (!practiceCode || !args.ageYears) return [];

  const bestLinkByAbilityCode = new Map<string, AbilityPracticeLinkRow>();

  for (const link of args.linksByPracticeCode.get(practiceCode) ?? []) {
    const abilityCode = s(link.abilityCode);
    if (!abilityCode) continue;

    const current = bestLinkByAbilityCode.get(abilityCode);
    if (!current || Math.max(1, n(link.score, 1)) > Math.max(1, n(current.score, 1))) {
      bestLinkByAbilityCode.set(abilityCode, link);
    }
  }

  const links = Array.from(bestLinkByAbilityCode.values()).sort((a, b) => {
    const scoreDiff = Math.max(1, n(b.score, 1)) - Math.max(1, n(a.score, 1));
    if (scoreDiff !== 0) return scoreDiff;
    return s(a.abilityCode).localeCompare(s(b.abilityCode));
  });

  const candidateRows = links
    .map((link) => {
      const abilityCode = s(link.abilityCode);
      const postureCode = postureCodeFromAbilityCode(abilityCode);
      const hints = abilityHintsForCode(abilityCode, args.ageYears, args.observationHints);
      return {
        abilityCode,
        postureCode,
        score: Math.max(1, n(link.score, 1)),
        hints,
      };
    })
    .filter((row) => row.hints.length > 0);

  const maxCount = Math.max(1, args.maxCount ?? DAILY_OBSERVATION_HINT_LIMIT);
  const selected: typeof candidateRows = [];
  const usedPostures = new Set<string>();

  for (const row of candidateRows) {
    if (selected.length >= maxCount) break;
    if (usedPostures.has(row.postureCode)) continue;
    selected.push(row);
    usedPostures.add(row.postureCode);
  }

  for (const row of candidateRows) {
    if (selected.length >= maxCount) break;
    if (selected.includes(row)) continue;
    selected.push(row);
  }

  return selected.slice(0, maxCount).map((row) => {
    const seed = `${args.targetDate}::${args.classroomId}::${practiceCode}::${row.abilityCode}`;
    const episode1 = pickHintEpisode(row.hints, "episode1", seed);
    const episode2 = pickHintEpisode(row.hints, "episode2", seed);
    const episode3 = pickHintEpisode(row.hints, "episode3", seed);
    const abilityCode = episode1.abilityCode || episode2.abilityCode || episode3.abilityCode || row.abilityCode;
    const abilityName = episode1.abilityName || episode2.abilityName || episode3.abilityName || row.abilityCode;
    const startingAge = Math.max(episode1.startingAge, episode2.startingAge, episode3.startingAge, 0);

    return {
      abilityCode,
      abilityName,
      postureCode: row.postureCode,
      postureName: postureLabelForCode(row.postureCode),
      score: row.score,
      startingAge,
      episodes: {
        episode1: episode1.text,
        episode2: episode2.text,
        episode3: episode3.text,
      },
      sourceHintIds: {
        episode1: episode1.sourceHintId,
        episode2: episode2.sourceHintId,
        episode3: episode3.sourceHintId,
      },
    };
  });
}

function practiceByCodeMap(practices: PracticeCodeRow[]): Map<string, PracticeCodeRow> {
  const map = new Map<string, PracticeCodeRow>();
  for (const practice of practices) {
    const code = s(practice.practice_code);
    if (code) map.set(code, practice);
  }
  return map;
}

function linksByPracticeCodeMap(links: AbilityPracticeLinkRow[]): Map<string, AbilityPracticeLinkRow[]> {
  const map = new Map<string, AbilityPracticeLinkRow[]>();
  for (const link of links) {
    const practiceCode = s(link.practiceCode);
    if (!practiceCode) continue;
    const list = map.get(practiceCode) ?? [];
    list.push(link);
    map.set(practiceCode, list);
  }
  return map;
}

function dailyPlanKey(plan: PlanDocumentRow): string {
  return [s(plan.sourcePlanId), s(plan.classroomId), s(plan.periodStartDate)].join("::");
}

function dailyTitle(classroomName: string, targetDate: string): string {
  return `${classroomName || "クラス"} 日案 ${targetDate}`;
}

function buildDailyPlanContent(args: {
  weeklyPlan: PlanDocumentRow;
  weeklyContent: Record<string, unknown>;
  day: DailyWeeklyDayContent;
  primaryPractice: PracticeCodeRow | null;
  reservePractice: PracticeCodeRow | null;
  primaryObservationHints: DailyObservationHintRow[];
  reserveObservationHints: DailyObservationHintRow[];
  sourceImpactAnalysisIds: string[];
  issuedAt: string;
}): Record<string, unknown> {
  const primaryPracticeCode = s(args.day.primaryPracticeCode);
  const reservePracticeCode = s(args.day.reservePracticeCode);

  return {
    schemaVersion: 2,
    planAnchorType: "SHORT_TERM_DAILY_PLAN",
    sourceWeeklyPlanId: s(args.weeklyPlan.id),
    sourceWeeklyPlanTitle: s(args.weeklyPlan.title),
    sourceMonthlyPlanId: s(args.weeklyContent.sourceMonthlyPlanId),
    sourceMonthlyPlanTitle: s(args.weeklyContent.sourceMonthlyPlanTitle),
    sourceImpactAnalysisId: s(args.weeklyContent.sourceImpactAnalysisId) || args.sourceImpactAnalysisIds[0] || "",
    classroomId: s(args.weeklyPlan.classroomId),
    classroomName: s(args.weeklyContent.classroomName),
    ageYears: n(args.weeklyContent.ageYears),
    targetDate: args.day.date,
    dayOfWeek: args.day.dayOfWeek,
    dayLabel: args.day.dayLabel,
    primaryPractice: {
      practiceCode: primaryPracticeCode,
      name: s(args.primaryPractice?.name) || s(args.day.primaryPracticeName) || primaryPracticeCode,
      memo: s(args.primaryPractice?.memo) || s(args.primaryPractice?.transcriptText),
      practiceCategory: normalizePracticeCategory(
        s(args.primaryPractice?.practiceCategory) || s(args.primaryPractice?.category_name),
      ),
      practiceCategoryLabel: practiceCategoryLabel(
        s(args.primaryPractice?.practiceCategory) || s(args.primaryPractice?.category_name),
      ),
      observationHints: args.primaryObservationHints,
    },
    reservePractice: {
      practiceCode: reservePracticeCode,
      name: reservePracticeCode
        ? s(args.reservePractice?.name) || s(args.day.reservePracticeName) || reservePracticeCode
        : "",
      memo: reservePracticeCode
        ? s(args.reservePractice?.memo) || s(args.reservePractice?.transcriptText)
        : "",
      practiceCategory: reservePracticeCode
        ? normalizePracticeCategory(
            s(args.reservePractice?.practiceCategory) || s(args.reservePractice?.category_name),
          )
        : "",
      practiceCategoryLabel: reservePracticeCode
        ? practiceCategoryLabel(
            s(args.reservePractice?.practiceCategory) || s(args.reservePractice?.category_name),
          )
        : "",
      observationHints: args.reserveObservationHints,
    },
    observationHintPolicy: {
      maxAbilityCountPerPractice: DAILY_OBSERVATION_HINT_LIMIT,
      ageRule: "startingAge <= classroomAgeYears; prefer nearest startingAge",
      episodeSelection: "episode1 / episode2 / episode3 are selected independently by stable hash",
      abilitySelection: "score priority with posture diversification",
      practiceScope: "PRIMARY_AND_RESERVE_SEPARATE",
      reservePracticeIncluded: Boolean(reservePracticeCode),
    },
    issue: {
      issueType: "AUTO",
      issueVersion: 1,
      issuedAt: args.issuedAt,
      issuedByUserId: SYSTEM_USER_ID,
      sourceWeeklyStatus: s(args.weeklyPlan.status),
      autoIssuePolicy: "AUTO_SKIP_IF_DAILY_EXISTS",
    },
  };
}

export const handler = async (event: ScheduledEventLike = {}): Promise<IssueSummary> => {
  const targetDate = targetDateFromEvent(event);
  const issuedAt = new Date().toISOString();

  const summary: IssueSummary = {
    targetDate,
    scannedWeeklyPlans: 0,
    matchedWeeklyPlans: 0,
    createdDailyPlans: 0,
    skippedExistingDailyPlans: 0,
    skippedNoPrimaryPractice: 0,
    skippedInvalidWeeklyContent: 0,
    errors: [],
  };

  console.log("issue-next-day-daily-plans start", JSON.stringify({ targetDate, event }));

  const [weeklyPlans, existingDailyPlans, practices, abilityPracticeLinks, observationHintRows] = await Promise.all([
    listAll<PlanDocumentRow>(planDocumentModel.list, {
      filter: {
        planLevel: { eq: "SHORT_TERM" },
        planKind: { eq: "WEEKLY" },
        status: { eq: "APPROVED" },
      },
    }),
    listAll<PlanDocumentRow>(planDocumentModel.list, {
      filter: {
        planLevel: { eq: "SHORT_TERM" },
        planKind: { eq: "DAILY" },
        periodStartDate: { eq: targetDate },
        periodEndDate: { eq: targetDate },
      },
    }),
    listAll<PracticeCodeRow>(practiceCodeModel.list),
    listAll<AbilityPracticeLinkRow>(abilityPracticeLinkModel.list),
    listAll<AbilityObservationHintRow>(abilityObservationHintModel.list),
  ]);

  summary.scannedWeeklyPlans = weeklyPlans.length;

  const practiceMap = practiceByCodeMap(practices);
  const linksByPracticeCode = linksByPracticeCodeMap(abilityPracticeLinks);
  const observationHints = uniqueAbilityObservationHintRows(
    observationHintRows.filter((row) => row.isActive !== false),
  );
  const existingDailyByKey = new Map(
    existingDailyPlans
      .filter((plan) => s(plan.status).toUpperCase() !== "ARCHIVED")
      .map((plan) => [dailyPlanKey(plan), plan]),
  );

  const matchedWeeklyPlans = weeklyPlans.filter((plan) =>
    s(plan.status).toUpperCase() === "APPROVED" &&
    dateInRange(targetDate, plan.periodStartDate, plan.periodEndDate),
  );

  summary.matchedWeeklyPlans = matchedWeeklyPlans.length;

  for (const weeklyPlan of matchedWeeklyPlans) {
    const weeklyPlanId = s(weeklyPlan.id);

    try {
      const weeklyContent = parseJsonRecord(weeklyPlan.contentJson);
      if (!weeklyContent) {
        summary.skippedInvalidWeeklyContent += 1;
        continue;
      }

      const day = weeklyPlanDaysFromContent(weeklyPlan.contentJson)
        .find((row) => row.date === targetDate) ?? null;

      if (!day) {
        summary.skippedInvalidWeeklyContent += 1;
        continue;
      }

      const primaryPracticeCode = s(day.primaryPracticeCode);
      if (!primaryPracticeCode) {
        summary.skippedNoPrimaryPractice += 1;
        continue;
      }

      const existingKey = [weeklyPlanId, s(weeklyPlan.classroomId), targetDate].join("::");
      if (existingDailyByKey.has(existingKey)) {
        summary.skippedExistingDailyPlans += 1;
        continue;
      }

      const primaryPractice = practiceMap.get(primaryPracticeCode) ?? null;
      const reservePractice = practiceMap.get(s(day.reservePracticeCode)) ?? null;
      const sourceImpactIds = sourceImpactAnalysisIds(weeklyPlan.sourceImpactAnalysisIdsJson);
      const primaryObservationHints = buildDailyObservationHints({
        targetDate,
        classroomId: s(weeklyPlan.classroomId),
        ageYears: n(weeklyContent.ageYears),
        practiceCode: primaryPracticeCode,
        linksByPracticeCode,
        observationHints,
        maxCount: DAILY_OBSERVATION_HINT_LIMIT,
      });
      const reserveObservationHints = buildDailyObservationHints({
        targetDate,
        classroomId: s(weeklyPlan.classroomId),
        ageYears: n(weeklyContent.ageYears),
        practiceCode: s(day.reservePracticeCode),
        linksByPracticeCode,
        observationHints,
        maxCount: DAILY_OBSERVATION_HINT_LIMIT,
      });

      const content = buildDailyPlanContent({
        weeklyPlan,
        weeklyContent,
        day,
        primaryPractice,
        reservePractice,
        primaryObservationHints,
        reserveObservationHints,
        sourceImpactAnalysisIds: sourceImpactIds,
        issuedAt,
      });

      const createResult = await planDocumentModel.create({
        tenantId: s(weeklyPlan.tenantId),
        fiscalYear: n(weeklyPlan.fiscalYear),
        classroomId: s(weeklyPlan.classroomId),
        planLevel: "SHORT_TERM",
        planKind: "DAILY",
        status: "ISSUED",
        periodStartDate: targetDate,
        periodEndDate: targetDate,
        title: dailyTitle(s(weeklyContent.classroomName), targetDate),
        sourcePlanId: weeklyPlanId,
        sourceImpactAnalysisIdsJson: JSON.stringify(sourceImpactIds),
        contentJson: JSON.stringify(content),
        createdByUserId: SYSTEM_USER_ID,
        updatedByUserId: SYSTEM_USER_ID,
      });

      if (createResult.errors?.length) {
        throw new Error(errorText(createResult.errors, "日案自動発行に失敗しました。"));
      }

      existingDailyByKey.set(existingKey, createResult.data ?? {
        sourcePlanId: weeklyPlanId,
        classroomId: s(weeklyPlan.classroomId),
        periodStartDate: targetDate,
      });
      summary.createdDailyPlans += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("issue-next-day-daily-plans weekly plan error", JSON.stringify({ weeklyPlanId, message }));
      summary.errors.push({ weeklyPlanId, message });
    }
  }

  console.log("issue-next-day-daily-plans complete", JSON.stringify(summary));
  return summary;
};
