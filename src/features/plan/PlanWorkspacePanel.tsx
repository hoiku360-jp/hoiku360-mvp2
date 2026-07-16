import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type Props = {
  tenantId: string;
  tenantName?: string | null;
  owner: string;
  fiscalYear: number;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
};

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

type ClassroomRow = {
  id?: string | null;
  tenantId?: string | null;
  name?: string | null;
  ageLabel?: string | null;
  fiscalYear?: number | null;
  status?: string | null;
};

type PlanPhraseRow = {
  planPhraseId?: string | null;
  planPeriodType?: string | null;
  domainCode?: string | null;
  domain?: string | null;
  ageYears?: number | null;
  phraseNo?: number | null;
  phraseType?: string | null;
  phraseText?: string | null;
  source?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  note?: string | null;
};

type PlanPhraseAbilityLinkRow = {
  linkId?: string | null;
  planPhraseId?: string | null;
  planPeriodType?: string | null;
  phraseDomainCode?: string | null;
  phraseDomain?: string | null;
  ageYears?: number | null;
  phraseNo?: number | null;
  abilityCode?: string | null;
  abilityDomain?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  abilityName?: string | null;
  relationType?: string | null;
  weight?: number | null;
  status?: string | null;
  sortOrder?: number | null;
  note?: string | null;
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

type UserProfileRow = {
  id?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
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

type ImpactAnalysisRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  scopeType?: string | null;
  classroomId?: string | null;
  staffUserId?: string | null;
  targetKind?: string | null;
  status?: string | null;
  sourcePlanId?: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  title?: string | null;
  inputJson?: string | null;
  resultJson?: string | null;
  selectedJson?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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

type DailyWeeklyDayContent = {
  date: string;
  dayOfWeek: WeekdayKey;
  dayLabel: string;
  primaryPracticeCode: string;
  primaryPracticeName: string;
  reservePracticeCode: string;
  reservePracticeName: string;
};

type ClassroomModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<ClassroomRow>>;
};

type PlanPhraseModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<PlanPhraseRow>>;
};

type PlanPhraseAbilityLinkModelClient = {
  list: (
    input?: Record<string, unknown>,
  ) => Promise<ListResult<PlanPhraseAbilityLinkRow>>;
};

type PlanDocumentModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<PlanDocumentRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<PlanDocumentRow>>;
  update: (
    input: Record<string, unknown> & { id: string },
  ) => Promise<OperationResult<PlanDocumentRow>>;
};

type UserProfileModelClient = {
  get: (input: { id: string }) => Promise<OperationResult<UserProfileRow>>;
};

type PracticeCodeModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<PracticeCodeRow>>;
};

type AbilityPracticeLinkModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<AbilityPracticeLinkRow>>;
};

type ImpactAnalysisModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<ImpactAnalysisRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<ImpactAnalysisRow>>;
  update: (
    input: Record<string, unknown> & { id: string },
  ) => Promise<OperationResult<ImpactAnalysisRow>>;
};


type AbilityObservationHintModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<AbilityObservationHintRow>>;
};

type PlanPeriodType = "YEAR" | "TERM" | "MONTH";
type TermKey = "Q1" | "Q2" | "Q3" | "Q4";
type WorkspaceView = "edit" | "overview" | "impact" | "weekly" | "daily";

type PeriodRange = {
  startDate: string;
  endDate: string;
  label: string;
};

type PlanContent = {
  selectedPhraseIds?: unknown;
  memo?: unknown;
  review?: unknown;
};

type ReviewHistoryItem = {
  action: "SUBMITTED" | "APPROVED" | "REJECTED";
  at: string;
  byUserId: string;
  byName: string;
  comment: string;
};

type ReviewContent = {
  submittedAt?: string;
  submittedByUserId?: string;
  submitComment?: string;
  submitByName?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  approvalComment?: string;
  approvalByName?: string;
  rejectedAt?: string;
  rejectedByUserId?: string;
  rejectionComment?: string;
  rejectionByName?: string;
  history?: ReviewHistoryItem[];
};

type CoverageRow = {
  code: string;
  label: string;
  score: number;
  count: number;
};

type ImpactRequiredAbilityRow = {
  abilityCode: string;
  label: string;
  areaCode: string;
  areaLabel: string;
  requiredScore: number;
};

type ImpactCoverageRow = ImpactRequiredAbilityRow & {
  coveredScore: number;
  remainingScore: number;
};

type ImpactCandidateRow = {
  practice: PracticeCodeRow;
  practiceCode: string;
  matchedRequiredCodes: string[];
  matchedRequiredLabels: string[];
  potentialScore: number;
  uncoveredScore: number;
  linkCount: number;
};

type WeekdayKey = "MON" | "TUE" | "WED" | "THU" | "FRI";

type WeeklyPracticeSlot = {
  primaryPracticeCode?: string;
  reservePracticeCode?: string;
};

type WeeklyAssignments = Record<string, WeeklyPracticeSlot>;

type WeeklyDayRow = {
  date: string;
  dayOfWeek: WeekdayKey;
  dayLabel: string;
};

type WeeklyOption = {
  weekStartDate: string;
  weekEndDate: string;
  label: string;
  primaryMonth: string;
  monthDayCount: number;
};

type WeeklyWeekSummary = {
  option: WeeklyOption;
  savedPlan: PlanDocumentRow | null;
  statusLabel: string;
  primaryCount: number;
  reserveCount: number;
};

const PLAN_PERIOD_OPTIONS: Array<{ value: PlanPeriodType; label: string }> = [
  { value: "MONTH", label: "月間計画" },
  { value: "TERM", label: "期計画" },
  { value: "YEAR", label: "年間計画" },
];

const TERM_OPTIONS: Array<{
  value: TermKey;
  label: string;
  startMonth: number;
  endMonth: number;
}> = [
  { value: "Q1", label: "4〜6月", startMonth: 4, endMonth: 6 },
  { value: "Q2", label: "7〜9月", startMonth: 7, endMonth: 9 },
  { value: "Q3", label: "10〜12月", startMonth: 10, endMonth: 12 },
  { value: "Q4", label: "1〜3月", startMonth: 1, endMonth: 3 },
];

const PRACTICE_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "outdoor", label: "外遊び" },
  { value: "indoor", label: "室内遊び" },
  { value: "life", label: "生活" },
  { value: "event", label: "行事" },
  { value: "environment", label: "環境構成" },
];

const AREA_DEFS: CoverageRow[] = [
  { code: "11", label: "健康", score: 0, count: 0 },
  { code: "21", label: "人間関係", score: 0, count: 0 },
  { code: "31", label: "環境", score: 0, count: 0 },
  { code: "41", label: "言葉", score: 0, count: 0 },
  { code: "51", label: "表現", score: 0, count: 0 },
];

const POSTURE_DEFS: CoverageRow[] = [
  { code: "1101", label: "健康な心と体", score: 0, count: 0 },
  { code: "2101", label: "自立心", score: 0, count: 0 },
  { code: "2102", label: "協同性", score: 0, count: 0 },
  { code: "2103", label: "道徳性・規範意識の芽生え", score: 0, count: 0 },
  { code: "2104", label: "社会生活との関わり", score: 0, count: 0 },
  { code: "3101", label: "社会生活との関わり", score: 0, count: 0 },
  { code: "3102", label: "思考力の芽生え", score: 0, count: 0 },
  { code: "3103", label: "自然との関わり・生命尊重", score: 0, count: 0 },
  { code: "3104", label: "数量や図形、標識や文字などへの関心・感覚", score: 0, count: 0 },
  { code: "4101", label: "数量や図形、標識や文字などへの関心・感覚", score: 0, count: 0 },
  { code: "4102", label: "言葉による伝え合い", score: 0, count: 0 },
  { code: "5101", label: "豊かな感性と表現", score: 0, count: 0 },
];

const DAILY_OBSERVATION_HINT_LIMIT = 4;

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

function parseMonths(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
  }

  const text = s(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return text
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
}

function monthFromDate(value: unknown): number | null {
  const text = s(value);
  const match = text.match(/^\d{4}-(\d{2})-/);
  if (!match) return null;

  const month = Number(match[1]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function practiceVisibleForTenant(
  row: { tenantId?: string | null; publishScope?: string | null; visibility?: string | null },
  targetTenantId: string,
): boolean {
  const rowTenantId = s(row.tenantId);
  const publishScope = s(row.publishScope).toLowerCase();
  const visibility = s(row.visibility).toLowerCase();

  if (!targetTenantId) return true;
  if (!rowTenantId || rowTenantId === targetTenantId) return true;
  if (rowTenantId === "global" || rowTenantId === "common") return true;

  // MVP2 common-practice rule:
  // PracticeCode keeps tenantId for provenance, but publishScope=global means
  // it can be used as a common practice candidate across tenants.
  return publishScope === "global" || (visibility === "public" && publishScope === "global");
}

function activePracticeStatus(value: unknown): boolean {
  const status = s(value || "COMPLETED").toUpperCase();
  return status !== "ARCHIVED" && status !== "ERROR" && status !== "DELETED";
}

function normalizePracticeCategory(value: unknown): string {
  const raw = s(value);
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (PRACTICE_CATEGORY_OPTIONS.some((opt) => opt.value === lower)) {
    return lower;
  }

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
  if (!normalized) return "-";

  return PRACTICE_CATEGORY_OPTIONS.find((opt) => opt.value === normalized)?.label ?? normalized;
}

function practiceTargetAgeLabel(practice?: PracticeCodeRow | null): string {
  if (!practice) return "-";

  const min = n(practice.targetAgeMin, 3);
  const max = n(practice.targetAgeMax, 5);
  return min === max ? `${min}歳` : `${min}〜${max}歳`;
}

function practiceSeasonalityLabel(practice?: PracticeCodeRow | null): string {
  if (!practice) return "-";

  const type = s(practice.seasonalityType || "ALL_YEAR").toUpperCase();
  if (type !== "MONTHS") return "通年";

  const months = parseMonths(practice.seasonMonthsJson);
  if (months.length === 0) return "月指定（未設定）";

  return months
    .slice()
    .sort((a, b) => a - b)
    .map((month) => `${month}月`)
    .join("、");
}

function practiceFitsAgeAndMonth(
  practice: PracticeCodeRow,
  ageYears: number | null,
  targetMonth: number | null,
): boolean {
  if (!ageYears || !targetMonth) return false;

  const min = n(practice.targetAgeMin, 3);
  const max = n(practice.targetAgeMax, 5);
  if (ageYears < Math.min(min, max) || ageYears > Math.max(min, max)) return false;

  const seasonalityType = s(practice.seasonalityType || "ALL_YEAR").toUpperCase();
  if (seasonalityType !== "MONTHS") return true;

  return parseMonths(practice.seasonMonthsJson).includes(targetMonth);
}

function areaLabelForCode(areaCode: string): string {
  return AREA_DEFS.find((row) => row.code === areaCode)?.label ?? areaCode;
}

function postureLabelForCode(postureCode: string): string {
  return POSTURE_DEFS.find((row) => row.code === postureCode)?.label ?? postureCode;
}

function postureCodeFromAbilityCode(value: unknown): string {
  const code = s(value);
  return /^[0-9]{4}/.test(code) ? code.slice(0, 4) : code;
}

function requiredAbilityLabel(link: PlanPhraseAbilityLinkRow, postureCode: string): string {
  const categoryCode = s(link.categoryCode);
  if (categoryCode.startsWith(postureCode) && s(link.categoryName)) {
    return s(link.categoryName);
  }

  const abilityCode = s(link.abilityCode);
  if (abilityCode === postureCode && s(link.abilityName)) {
    return s(link.abilityName);
  }

  return postureLabelForCode(postureCode);
}

function requiredAbilitiesFromPhraseIds(
  selectedPhraseIds: string[],
  phraseLinks: PlanPhraseAbilityLinkRow[],
): ImpactRequiredAbilityRow[] {
  const selectedSet = new Set(selectedPhraseIds);
  const map = new Map<string, ImpactRequiredAbilityRow>();

  for (const link of phraseLinks) {
    if (!activeStatus(link.status)) continue;
    if (!selectedSet.has(s(link.planPhraseId))) continue;

    const postureCode = postureCodeFromLink(link);
    if (!postureCode) continue;

    const areaCode = areaCodeFromLink(link);
    const existing = map.get(postureCode);
    const weight = Math.max(1, n(link.weight, 1));

    if (existing) {
      existing.requiredScore += weight;
    } else {
      map.set(postureCode, {
        abilityCode: postureCode,
        label: requiredAbilityLabel(link, postureCode),
        areaCode,
        areaLabel: areaLabelForCode(areaCode),
        requiredScore: weight,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.abilityCode.localeCompare(b.abilityCode),
  );
}

function buildPracticePostureScoreMap(
  practiceCode: string,
  linksByPracticeCode: Map<string, AbilityPracticeLinkRow[]>,
): Map<string, number> {
  const map = new Map<string, number>();

  for (const link of linksByPracticeCode.get(practiceCode) ?? []) {
    const postureCode = postureCodeFromAbilityCode(link.abilityCode);
    if (!postureCode) continue;

    map.set(postureCode, (map.get(postureCode) ?? 0) + Math.max(1, n(link.score, 1)));
  }

  return map;
}

function selectedPracticeCodesFromImpact(value: unknown): string[] {
  const parsed = parseJsonRecord(value);
  const selectedPracticeCodes = parsed?.selectedPracticeCodes;

  if (Array.isArray(selectedPracticeCodes)) {
    return selectedPracticeCodes.map((item) => s(item)).filter(Boolean);
  }

  const selectedPractices = parsed?.selectedPractices;
  if (Array.isArray(selectedPractices)) {
    return selectedPractices
      .map((item) => {
        if (typeof item !== "object" || item === null) return "";
        return s((item as { practiceCode?: unknown }).practiceCode);
      })
      .filter(Boolean);
  }

  return [];
}

function parseDateOnly(value: unknown): Date | null {
  const text = s(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mondayOf(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function monthKeyFromPlan(plan: PlanDocumentRow | null | undefined): string {
  const date = parseDateOnly(plan?.periodStartDate);
  return date ? monthKeyFromDate(date) : "";
}

function weekdayJapaneseLabel(day: WeekdayKey): string {
  switch (day) {
    case "MON":
      return "月";
    case "TUE":
      return "火";
    case "WED":
      return "水";
    case "THU":
      return "木";
    case "FRI":
      return "金";
    default:
      return day;
  }
}

function buildWeekDays(weekStartDate: string): WeeklyDayRow[] {
  const start = parseDateOnly(weekStartDate);
  if (!start) return [];

  const keys: WeekdayKey[] = ["MON", "TUE", "WED", "THU", "FRI"];
  return keys.map((dayOfWeek, index) => {
    const date = addDays(start, index);
    return {
      date: formatDateOnly(date),
      dayOfWeek,
      dayLabel: `${formatDateOnly(date)}（${weekdayJapaneseLabel(dayOfWeek)}）`,
    };
  });
}

function primaryMonthForWeek(weekStart: Date): { primaryMonth: string; monthDayCount: number } {
  const counts = new Map<string, number>();

  for (let index = 0; index < 5; index += 1) {
    const key = monthKeyFromDate(addDays(weekStart, index));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows = Array.from(counts.entries()).sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return {
    primaryMonth: rows[0]?.[0] ?? "",
    monthDayCount: rows[0]?.[1] ?? 0,
  };
}

function buildMonthlyWeekOptions(plan: PlanDocumentRow | null | undefined): WeeklyOption[] {
  const start = parseDateOnly(plan?.periodStartDate);
  const end = parseDateOnly(plan?.periodEndDate);
  if (!start || !end) return [];

  const targetMonth = monthKeyFromDate(start);
  const firstMonday = mondayOf(start);
  const lastCandidateMonday = mondayOf(addDays(end, 6));
  const rows: WeeklyOption[] = [];

  for (let current = firstMonday; current <= lastCandidateMonday; current = addDays(current, 7)) {
    const { primaryMonth, monthDayCount } = primaryMonthForWeek(current);
    if (primaryMonth !== targetMonth) continue;

    const weekStartDate = formatDateOnly(current);
    const weekEndDate = formatDateOnly(addDays(current, 4));
    rows.push({
      weekStartDate,
      weekEndDate,
      primaryMonth,
      monthDayCount,
      label: `${weekStartDate}〜${weekEndDate}（${targetMonth}主所属 / ${monthDayCount}日）`,
    });
  }

  return rows;
}

function weeklyAssignmentsFromPlanContent(value: unknown): WeeklyAssignments {
  const parsed = parseJsonRecord(value);
  const days = parsed?.days;
  const result: WeeklyAssignments = {};

  if (!Array.isArray(days)) return result;

  for (const item of days) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as {
      date?: unknown;
      primaryPracticeCode?: unknown;
      reservePracticeCode?: unknown;
      practiceCodes?: unknown;
    };
    const date = s(row.date);
    if (!date) continue;

    const practiceCodes = Array.isArray(row.practiceCodes)
      ? row.practiceCodes.map((code) => s(code)).filter(Boolean)
      : [];

    result[date] = {
      primaryPracticeCode: s(row.primaryPracticeCode) || practiceCodes[0] || "",
      reservePracticeCode: s(row.reservePracticeCode) || practiceCodes[1] || "",
    };
  }

  return result;
}

function assignmentCodesForDays(
  assignments: WeeklyAssignments,
  days: WeeklyDayRow[],
  slot: keyof WeeklyPracticeSlot,
): string[] {
  return days
    .map((day) => s(assignments[day.date]?.[slot]))
    .filter(Boolean);
}

function countAssignmentCodes(
  assignments: WeeklyAssignments,
  days: WeeklyDayRow[],
  slot: keyof WeeklyPracticeSlot,
): number {
  return assignmentCodesForDays(assignments, days, slot).length;
}

function coverageFromPracticeCodes(
  practiceCodes: string[],
  linksByPracticeCode: Map<string, AbilityPracticeLinkRow[]>,
): { areaRows: CoverageRow[]; postureRows: CoverageRow[]; linkCount: number } {
  const areaMap = new Map(AREA_DEFS.map((row) => [row.code, { ...row }]));
  const postureMap = new Map(POSTURE_DEFS.map((row) => [row.code, { ...row }]));
  let linkCount = 0;

  for (const practiceCode of practiceCodes) {
    for (const link of linksByPracticeCode.get(practiceCode) ?? []) {
      const postureCode = postureCodeFromAbilityCode(link.abilityCode);
      if (!postureCode) continue;

      const areaCode = /^[0-9]{2}/.test(postureCode) ? postureCode.slice(0, 2) : "";
      const weight = Math.max(1, n(link.score, 1));

      const area = areaMap.get(areaCode);
      if (area) {
        area.score += weight;
        area.count += 1;
      }

      const posture = postureMap.get(postureCode);
      if (posture) {
        posture.score += weight;
        posture.count += 1;
      }

      linkCount += 1;
    }
  }

  return {
    areaRows: Array.from(areaMap.values()),
    postureRows: Array.from(postureMap.values()),
    linkCount,
  };
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
    if (!hintAbilityCode || startingAge <= 0 || startingAge > selectedAgeYears) {
      return false;
    }

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
    return {
      text: "",
      sourceHintId: "",
      startingAge: 0,
      abilityCode: "",
      abilityName: "",
    };
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

  return selected.map((row) => {
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

function uniqueDailyObservationHints(
  rows: DailyObservationHintRow[],
  maxCount = DAILY_OBSERVATION_HINT_LIMIT,
): DailyObservationHintRow[] {
  const seenAbility = new Set<string>();
  const result: DailyObservationHintRow[] = [];

  for (const row of rows) {
    const key = s(row.abilityCode) || `${s(row.postureCode)}-${s(row.abilityName)}`;
    if (!key || seenAbility.has(key)) continue;

    seenAbility.add(key);
    result.push(row);

    if (result.length >= maxCount) break;
  }

  return result;
}

function nextIssueVersion(contentJson: unknown): number {
  const content = parseJsonRecord(contentJson);
  const issue = content?.issue;
  if (typeof issue !== "object" || issue === null) return 1;

  return n((issue as { issueVersion?: unknown }).issueVersion, 0) + 1;
}


function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => s(value)).filter(Boolean)));
}

function practiceNameByCode(practices: PracticeCodeRow[], practiceCode: string): string {
  const practice = practices.find((row) => s(row.practice_code) === practiceCode);
  return s(practice?.name) || practiceCode || "-";
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

function activeStatus(value: unknown): boolean {
  const status = s(value || "active").toLowerCase();
  return status === "active" || status === "confirmed";
}

function extractClassroomAgeYears(classroom: ClassroomRow | null | undefined): number | null {
  if (!classroom) return null;

  const text = `${s(classroom.ageLabel)} ${s(classroom.name)}`;

  if (text.includes("年少")) return 3;
  if (text.includes("年中")) return 4;
  if (text.includes("年長")) return 5;

  const match = text.match(/([0-5])\s*歳/);
  if (match) return Number(match[1]);

  const simpleMatch = text.match(/(^|\D)([3-5])($|\D)/);
  if (simpleMatch) return Number(simpleMatch[2]);

  return null;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultMonthValue(fiscalYear: number): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (currentYear === fiscalYear || currentYear === fiscalYear + 1) {
    return `${currentYear}-${pad2(currentMonth)}`;
  }

  return `${fiscalYear}-07`;
}

function getFiscalYearRange(fiscalYear: number): PeriodRange {
  return {
    startDate: `${fiscalYear}-04-01`,
    endDate: `${fiscalYear + 1}-03-31`,
    label: `${fiscalYear}年度`,
  };
}

function getTermRange(fiscalYear: number, termKey: TermKey): PeriodRange {
  const option = TERM_OPTIONS.find((item) => item.value === termKey) ?? TERM_OPTIONS[0];
  const startYear = option.startMonth <= 3 ? fiscalYear + 1 : fiscalYear;
  const endYear = option.endMonth <= 3 ? fiscalYear + 1 : fiscalYear;

  return {
    startDate: `${startYear}-${pad2(option.startMonth)}-01`,
    endDate: `${endYear}-${pad2(option.endMonth)}-${lastDayOfMonth(
      endYear,
      option.endMonth,
    )}`,
    label: `${fiscalYear}年度 ${option.label}`,
  };
}

function getMonthRange(monthValue: string): PeriodRange {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return getMonthRange(defaultMonthValue(new Date().getFullYear()));
  }

  return {
    startDate: `${year}-${pad2(month)}-01`,
    endDate: `${year}-${pad2(month)}-${lastDayOfMonth(year, month)}`,
    label: `${year}年${month}月`,
  };
}

function termPhraseTypeLabel(termKey: TermKey): string {
  const option = TERM_OPTIONS.find((item) => item.value === termKey) ?? TERM_OPTIONS[0];
  return `${option.label}のねらい`;
}

function planKindFromPeriod(periodType: PlanPeriodType): string {
  switch (periodType) {
    case "YEAR":
      return "ANNUAL";
    case "TERM":
      return "TERM";
    case "MONTH":
    default:
      return "MONTHLY";
  }
}

function planPeriodLabel(value: PlanPeriodType): string {
  return PLAN_PERIOD_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function planKindLabel(value: unknown): string {
  const kind = s(value).toUpperCase();
  if (kind === "ANNUAL") return "年間計画";
  if (kind === "TERM") return "期計画";
  if (kind === "MONTHLY") return "月間計画";
  if (kind === "WEEKLY") return "週案";
  if (kind === "DAILY") return "日案";
  return kind || "-";
}

function statusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  switch (status) {
    case "DRAFT":
      return "下書き";
    case "SUBMITTED":
      return "承認依頼中";
    case "APPROVED":
      return "承認済み";
    case "REJECTED":
      return "差し戻し";
    case "ARCHIVED":
      return "アーカイブ";
    case "ISSUED":
      return "発行済み";
    default:
      return status || "未保存";
  }
}

function statusClass(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "APPROVED") return "approved";
  if (status === "SUBMITTED") return "submitted";
  if (status === "REJECTED") return "rejected";
  if (status === "ISSUED") return "issued";
  return "draft";
}

function reviewActionLabel(action: unknown): string {
  const value = s(action).toUpperCase();
  if (value === "SUBMITTED") return "承認依頼";
  if (value === "APPROVED") return "承認";
  if (value === "REJECTED") return "差し戻し";
  return value || "履歴";
}

function shortDisplayName(value: unknown): string {
  const raw = s(value);
  if (!raw) return "-";

  const compact = raw
    .replace(/先生$/u, "")
    .replace(/園長$/u, "")
    .replace(/主任$/u, "")
    .replace(/保育士$/u, "")
    .trim();

  if (!compact) return raw;

  const parts = compact.split(/[\s　]+/u).filter(Boolean);
  return parts.length > 0 ? parts[0] : compact;
}

function formatReviewDate(value: unknown): string {
  const text = s(value);
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reviewMessageText(item: ReviewHistoryItem): string {
  const comment = s(item.comment) || reviewActionLabel(item.action);
  const byName = s(item.byName) || shortDisplayName(item.byUserId);
  return `${comment}：${byName}`;
}

function sortClassrooms(rows: ClassroomRow[]): ClassroomRow[] {
  return [...rows].sort((a, b) => {
    const ageA = extractClassroomAgeYears(a) ?? 99;
    const ageB = extractClassroomAgeYears(b) ?? 99;
    if (ageA !== ageB) return ageA - ageB;
    return s(a.name).localeCompare(s(b.name), "ja");
  });
}

function sortPhrases(rows: PlanPhraseRow[]): PlanPhraseRow[] {
  return [...rows].sort((a, b) => {
    const domainA = s(a.domainCode).localeCompare(s(b.domainCode));
    if (domainA !== 0) return domainA;

    const sortA = n(a.sortOrder, 999999);
    const sortB = n(b.sortOrder, 999999);
    if (sortA !== sortB) return sortA - sortB;

    return n(a.phraseNo, 999999) - n(b.phraseNo, 999999);
  });
}

function sortPlanDocuments(rows: PlanDocumentRow[]): PlanDocumentRow[] {
  const order = new Map([
    ["ANNUAL", 1],
    ["TERM", 2],
    ["MONTHLY", 3],
  ]);

  return [...rows].sort((a, b) => {
    const kindDiff = (order.get(s(a.planKind).toUpperCase()) ?? 99) -
      (order.get(s(b.planKind).toUpperCase()) ?? 99);
    if (kindDiff !== 0) return kindDiff;
    return s(a.periodStartDate).localeCompare(s(b.periodStartDate));
  });
}

function safeParsePlanContent(value: unknown): PlanContent | null {
  const text = s(value);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function planContentSelectedIds(content: PlanContent | null): string[] {
  return Array.isArray(content?.selectedPhraseIds)
    ? content.selectedPhraseIds.map((item) => s(item)).filter(Boolean)
    : [];
}

function planContentReview(content: PlanContent | null): ReviewContent {
  const review = content?.review;
  return typeof review === "object" && review !== null ? review as ReviewContent : {};
}

function planReviewHistory(review: ReviewContent): ReviewHistoryItem[] {
  if (!Array.isArray(review.history)) return [];

  return review.history.filter((item): item is ReviewHistoryItem => {
    if (typeof item !== "object" || item === null) return false;
    const action = s((item as ReviewHistoryItem).action).toUpperCase();
    return action === "SUBMITTED" || action === "APPROVED" || action === "REJECTED";
  });
}

function legacyReviewHistory(review: ReviewContent): ReviewHistoryItem[] {
  const rows: ReviewHistoryItem[] = [];

  if (review.submittedAt) {
    rows.push({
      action: "SUBMITTED",
      at: review.submittedAt,
      byUserId: s(review.submittedByUserId),
      byName: s(review.submitByName) || shortDisplayName(review.submittedByUserId),
      comment: s(review.submitComment),
    });
  }

  if (review.rejectedAt) {
    rows.push({
      action: "REJECTED",
      at: review.rejectedAt,
      byUserId: s(review.rejectedByUserId),
      byName: s(review.rejectionByName) || shortDisplayName(review.rejectedByUserId),
      comment: s(review.rejectionComment),
    });
  }

  if (review.approvedAt) {
    rows.push({
      action: "APPROVED",
      at: review.approvedAt,
      byUserId: s(review.approvedByUserId),
      byName: s(review.approvalByName) || shortDisplayName(review.approvedByUserId),
      comment: s(review.approvalComment),
    });
  }

  return rows;
}

function displayReviewHistory(review: ReviewContent): ReviewHistoryItem[] {
  const history = planReviewHistory(review);
  return history.length > 0 ? history : legacyReviewHistory(review);
}

function abilityLabelsForPhrase(
  linksByPhraseId: Map<string, PlanPhraseAbilityLinkRow[]>,
  planPhraseId: string,
): string[] {
  const links = linksByPhraseId.get(planPhraseId) ?? [];
  const primary = links
    .filter((link) => s(link.relationType).toUpperCase() === "PRIMARY")
    .slice(0, 3);

  const source = primary.length > 0 ? primary : links.slice(0, 3);

  return source
    .map((link) => s(link.abilityName) || s(link.categoryName) || s(link.abilityCode))
    .filter(Boolean);
}

function uniqueDomainOptions(phrases: PlanPhraseRow[]): Array<{
  code: string;
  label: string;
}> {
  const map = new Map<string, string>();

  for (const phrase of phrases) {
    const code = s(phrase.domainCode);
    const label = s(phrase.domain);
    if (code && label && !map.has(code)) {
      map.set(code, label);
    }
  }

  return Array.from(map.entries())
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function areaCodeFromLink(link: PlanPhraseAbilityLinkRow): string {
  const categoryCode = s(link.categoryCode);
  if (/^[0-9]{2}/.test(categoryCode)) return categoryCode.slice(0, 2);

  const abilityCode = s(link.abilityCode);
  if (/^[0-9]{2}/.test(abilityCode)) return abilityCode.slice(0, 2);

  const phraseDomainCode = s(link.phraseDomainCode);
  if (/^[0-9]{2}/.test(phraseDomainCode)) return phraseDomainCode.slice(0, 2);

  return "";
}

function postureCodeFromLink(link: PlanPhraseAbilityLinkRow): string {
  const categoryCode = s(link.categoryCode);
  if (/^[0-9]{4}/.test(categoryCode)) return categoryCode.slice(0, 4);

  const abilityCode = s(link.abilityCode);
  if (/^[0-9]{4}/.test(abilityCode)) return abilityCode.slice(0, 4);

  return "";
}

function coverageFromPhraseIds(
  selectedPhraseIds: string[],
  phraseLinks: PlanPhraseAbilityLinkRow[],
): { areaRows: CoverageRow[]; postureRows: CoverageRow[]; linkCount: number } {
  const selectedSet = new Set(selectedPhraseIds);
  const areaMap = new Map(AREA_DEFS.map((row) => [row.code, { ...row }]));
  const postureMap = new Map(POSTURE_DEFS.map((row) => [row.code, { ...row }]));
  let linkCount = 0;

  for (const link of phraseLinks) {
    if (!activeStatus(link.status)) continue;
    if (!selectedSet.has(s(link.planPhraseId))) continue;

    const weight = Math.max(1, n(link.weight, 1));
    const areaCode = areaCodeFromLink(link);
    const postureCode = postureCodeFromLink(link);

    const area = areaMap.get(areaCode);
    if (area) {
      area.score += weight;
      area.count += 1;
    }

    const posture = postureMap.get(postureCode);
    if (posture) {
      posture.score += weight;
      posture.count += 1;
    }

    linkCount += 1;
  }

  return {
    areaRows: Array.from(areaMap.values()),
    postureRows: Array.from(postureMap.values()),
    linkCount,
  };
}

function maxScore(rows: CoverageRow[]): number {
  return Math.max(1, ...rows.map((row) => row.score));
}

function buildPlanContent(args: {
  tenantId: string;
  tenantName?: string | null;
  selectedClassroomId: string;
  selectedClassroom: ClassroomRow;
  selectedAgeYears: number;
  fiscalYear: number;
  periodType: PlanPeriodType;
  selectedPeriodRange: PeriodRange;
  selectedDomainCode: string;
  selectedDomain: string;
  selectedPhraseIds: string[];
  selectedPhrases: PlanPhraseRow[];
  linksByPhraseId: Map<string, PlanPhraseAbilityLinkRow[]>;
  memo: string;
  existingReview?: ReviewContent;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    planAnchorType: "LONG_TERM_PHRASE_SELECTION",
    tenantId: args.tenantId,
    tenantName: args.tenantName ?? "",
    classroomId: args.selectedClassroomId,
    classroomName: s(args.selectedClassroom.name),
    classroomAgeLabel: s(args.selectedClassroom.ageLabel),
    ageYears: args.selectedAgeYears,
    fiscalYear: args.fiscalYear,
    planPeriodType: args.periodType,
    planKind: planKindFromPeriod(args.periodType),
    periodStartDate: args.selectedPeriodRange.startDate,
    periodEndDate: args.selectedPeriodRange.endDate,
    periodLabel: args.selectedPeriodRange.label,
    selectedDomainCode: args.selectedDomainCode,
    selectedDomain: args.selectedDomain,
    selectedPhraseIds: args.selectedPhraseIds,
    selectedPhrases: args.selectedPhrases.map((phrase) => ({
      planPhraseId: s(phrase.planPhraseId),
      planPeriodType: s(phrase.planPeriodType),
      domainCode: s(phrase.domainCode),
      domain: s(phrase.domain),
      ageYears: n(phrase.ageYears),
      phraseNo: n(phrase.phraseNo),
      phraseType: s(phrase.phraseType),
      phraseText: s(phrase.phraseText),
      abilityLabels: abilityLabelsForPhrase(
        args.linksByPhraseId,
        s(phrase.planPhraseId),
      ),
    })),
    memo: args.memo.trim(),
    review: args.existingReview ?? {},
  };
}

export default function PlanWorkspacePanel(props: Props) {
  const {
    tenantId,
    tenantName,
    owner,
    fiscalYear,
    currentClassroomId,
    allowedClassroomIds,
    isSchoolScope,
  } = props;

  const client = useMemo(() => generateClient<Schema>(), []);
  const classroomModel = client.models.Classroom as unknown as ClassroomModelClient;
  const planPhraseModel = client.models.PlanPhrase as unknown as PlanPhraseModelClient;
  const planPhraseAbilityLinkModel = client.models
    .PlanPhraseAbilityLink as unknown as PlanPhraseAbilityLinkModelClient;
  const planDocumentModel = client.models.PlanDocument as unknown as PlanDocumentModelClient;
  const userProfileModel = client.models.UserProfile as unknown as UserProfileModelClient;
  const practiceCodeModel = client.models.PracticeCode as unknown as PracticeCodeModelClient;
  const abilityPracticeLinkModel = client.models
    .AbilityPracticeLink as unknown as AbilityPracticeLinkModelClient;
  const impactAnalysisModel = client.models.ImpactAnalysis as unknown as ImpactAnalysisModelClient;
  const abilityObservationHintModel = client.models
    .AbilityObservationHint as unknown as AbilityObservationHintModelClient;

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("edit");

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");

  const [periodType, setPeriodType] = useState<PlanPeriodType>("MONTH");
  const [selectedMonth, setSelectedMonth] = useState(() =>
    defaultMonthValue(fiscalYear),
  );
  const [selectedTerm, setSelectedTerm] = useState<TermKey>("Q2");
  const [selectedDomainCode, setSelectedDomainCode] = useState("");

  const [phrases, setPhrases] = useState<PlanPhraseRow[]>([]);
  const [phraseLinks, setPhraseLinks] = useState<PlanPhraseAbilityLinkRow[]>([]);
  const [selectedPhraseIds, setSelectedPhraseIds] = useState<string[]>([]);
  const [memo, setMemo] = useState("");

  const [existingPlanId, setExistingPlanId] = useState("");
  const [existingPlanRow, setExistingPlanRow] = useState<PlanDocumentRow | null>(null);
  const [currentPlanStatus, setCurrentPlanStatus] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewerName, setReviewerName] = useState(() => shortDisplayName(owner));
  const [overviewPlans, setOverviewPlans] = useState<PlanDocumentRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [impactPlanId, setImpactPlanId] = useState("");
  const [impactPractices, setImpactPractices] = useState<PracticeCodeRow[]>([]);
  const [abilityPracticeLinks, setAbilityPracticeLinks] = useState<AbilityPracticeLinkRow[]>([]);
  const [selectedImpactPracticeCodes, setSelectedImpactPracticeCodes] = useState<string[]>([]);
  const [impactAnalysisId, setImpactAnalysisId] = useState("");
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactSaving, setImpactSaving] = useState(false);

  const [weeklyPlanId, setWeeklyPlanId] = useState("");
  const [weeklyImpactAnalysisId, setWeeklyImpactAnalysisId] = useState("");
  const [weeklyImpactAnalyses, setWeeklyImpactAnalyses] = useState<ImpactAnalysisRow[]>([]);
  const [weeklyPlanRows, setWeeklyPlanRows] = useState<PlanDocumentRow[]>([]);
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState("");
  const [weeklyAssignments, setWeeklyAssignments] = useState<WeeklyAssignments>({});
  const [weeklyExistingPlanId, setWeeklyExistingPlanId] = useState("");
  const [weeklyReviewComment, setWeeklyReviewComment] = useState("");
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [weeklyReviewUpdating, setWeeklyReviewUpdating] = useState(false);

  const [dailyWeeklyPlans, setDailyWeeklyPlans] = useState<PlanDocumentRow[]>([]);
  const [dailyWeeklyPlanId, setDailyWeeklyPlanId] = useState("");
  const [dailyTargetDate, setDailyTargetDate] = useState("");
  const [dailyObservationHintRows, setDailyObservationHintRows] = useState<AbilityObservationHintRow[]>([]);
  const [dailyExistingPlanId, setDailyExistingPlanId] = useState("");
  const [dailyExistingPlanRow, setDailyExistingPlanRow] = useState<PlanDocumentRow | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewUpdating, setReviewUpdating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const allowedIdSet = useMemo(
    () => new Set((allowedClassroomIds ?? []).filter(Boolean)),
    [allowedClassroomIds],
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((item) => s(item.id) === selectedClassroomId) ?? null,
    [classrooms, selectedClassroomId],
  );

  const selectedAgeYears = useMemo(
    () => extractClassroomAgeYears(selectedClassroom),
    [selectedClassroom],
  );

  const selectedPeriodRange = useMemo(() => {
    if (periodType === "YEAR") return getFiscalYearRange(fiscalYear);
    if (periodType === "TERM") return getTermRange(fiscalYear, selectedTerm);
    return getMonthRange(selectedMonth);
  }, [fiscalYear, periodType, selectedMonth, selectedTerm]);

  const termPhraseType = useMemo(
    () => termPhraseTypeLabel(selectedTerm),
    [selectedTerm],
  );

  const linksByPhraseId = useMemo(() => {
    const map = new Map<string, PlanPhraseAbilityLinkRow[]>();

    for (const link of phraseLinks) {
      if (!activeStatus(link.status)) continue;

      const planPhraseId = s(link.planPhraseId);
      if (!planPhraseId) continue;

      const list = map.get(planPhraseId) ?? [];
      list.push(link);
      map.set(planPhraseId, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const weightDiff = n(b.weight) - n(a.weight);
        if (weightDiff !== 0) return weightDiff;
        return n(a.sortOrder, 999999) - n(b.sortOrder, 999999);
      });
    }

    return map;
  }, [phraseLinks]);

  const periodMatchedPhrases = useMemo(() => {
    if (!selectedAgeYears) return [];

    return phrases.filter((phrase) => {
      const baseMatched =
        activeStatus(phrase.status) &&
        s(phrase.planPeriodType).toUpperCase() === periodType &&
        n(phrase.ageYears) === selectedAgeYears;

      if (!baseMatched) return false;

      if (periodType === "TERM") {
        return s(phrase.phraseType) === termPhraseType;
      }

      return true;
    });
  }, [periodType, phrases, selectedAgeYears, termPhraseType]);

  const domainOptions = useMemo(
    () => uniqueDomainOptions(periodMatchedPhrases),
    [periodMatchedPhrases],
  );

  const visiblePhrases = useMemo(() => {
    const rows = periodMatchedPhrases.filter((phrase) => {
      if (!selectedDomainCode) return true;
      return s(phrase.domainCode) === selectedDomainCode;
    });

    return sortPhrases(rows);
  }, [periodMatchedPhrases, selectedDomainCode]);

  const selectedPhrases = useMemo(() => {
    const selectedSet = new Set(selectedPhraseIds);
    return sortPhrases(phrases.filter((phrase) => selectedSet.has(s(phrase.planPhraseId))));
  }, [phrases, selectedPhraseIds]);

  const classroomSelectionLocked =
    !isSchoolScope && (allowedClassroomIds?.length ?? 0) <= 1;

  const planTitle = useMemo(() => {
    const classroomName = s(selectedClassroom?.name) || "クラス未選択";
    return `${selectedPeriodRange.label} ${classroomName} ${planPeriodLabel(
      periodType,
    )}アンカー`;
  }, [periodType, selectedClassroom?.name, selectedPeriodRange.label]);

  const selectedPlanCoverage = useMemo(
    () => coverageFromPhraseIds(selectedPhraseIds, phraseLinks),
    [phraseLinks, selectedPhraseIds],
  );

  const overviewItems = useMemo(() => {
    return sortPlanDocuments(overviewPlans)
      .filter((plan) => s(plan.status).toUpperCase() !== "ARCHIVED")
      .map((plan) => {
        const content = safeParsePlanContent(plan.contentJson);
        return {
          plan,
          content,
          selectedPhraseIds: planContentSelectedIds(content),
        };
      });
  }, [overviewPlans]);

  const overviewPhraseIds = useMemo(() => {
    return Array.from(
      new Set(overviewItems.flatMap((item) => item.selectedPhraseIds)),
    );
  }, [overviewItems]);

  const overviewCoverage = useMemo(
    () => coverageFromPhraseIds(overviewPhraseIds, phraseLinks),
    [overviewPhraseIds, phraseLinks],
  );

  const phraseById = useMemo(() => {
    const map = new Map<string, PlanPhraseRow>();
    for (const phrase of phrases) {
      const id = s(phrase.planPhraseId);
      if (id) map.set(id, phrase);
    }
    return map;
  }, [phrases]);

  const approvedMonthlyCount = useMemo(
    () => overviewItems.filter((item) =>
      s(item.plan.planKind).toUpperCase() === "MONTHLY" &&
      s(item.plan.status).toUpperCase() === "APPROVED",
    ).length,
    [overviewItems],
  );


  const approvedMonthlyPlans = useMemo(
    () => overviewItems.filter((item) =>
      s(item.plan.planKind).toUpperCase() === "MONTHLY" &&
      s(item.plan.status).toUpperCase() === "APPROVED",
    ),
    [overviewItems],
  );

  const selectedImpactItem = useMemo(
    () => approvedMonthlyPlans.find((item) => s(item.plan.id) === impactPlanId) ?? null,
    [approvedMonthlyPlans, impactPlanId],
  );

  const impactTargetMonth = useMemo(
    () => monthFromDate(selectedImpactItem?.plan.periodStartDate),
    [selectedImpactItem?.plan.periodStartDate],
  );

  const selectedImpactPhraseIds = useMemo(
    () => selectedImpactItem?.selectedPhraseIds ?? [],
    [selectedImpactItem?.selectedPhraseIds],
  );

  const requiredImpactAbilities = useMemo(
    () => requiredAbilitiesFromPhraseIds(selectedImpactPhraseIds, phraseLinks),
    [phraseLinks, selectedImpactPhraseIds],
  );

  const linksByPracticeCode = useMemo(() => {
    const map = new Map<string, AbilityPracticeLinkRow[]>();

    for (const link of abilityPracticeLinks) {
      const practiceCode = s(link.practiceCode);
      if (!practiceCode) continue;

      const list = map.get(practiceCode) ?? [];
      list.push(link);
      map.set(practiceCode, list);
    }

    return map;
  }, [abilityPracticeLinks]);

  const selectedImpactPracticeCodeSet = useMemo(
    () => new Set(selectedImpactPracticeCodes),
    [selectedImpactPracticeCodes],
  );

  const impactCoverageRows = useMemo<ImpactCoverageRow[]>(() => {
    return requiredImpactAbilities.map((ability) => {
      let coveredScore = 0;

      for (const practiceCode of selectedImpactPracticeCodes) {
        const scores = buildPracticePostureScoreMap(practiceCode, linksByPracticeCode);
        coveredScore += scores.get(ability.abilityCode) ?? 0;
      }

      return {
        ...ability,
        coveredScore,
        remainingScore: Math.max(0, ability.requiredScore - coveredScore),
      };
    });
  }, [linksByPracticeCode, requiredImpactAbilities, selectedImpactPracticeCodes]);

  const impactRequiredTotal = useMemo(
    () => impactCoverageRows.reduce((sum, row) => sum + row.requiredScore, 0),
    [impactCoverageRows],
  );

  const impactRemainingTotal = useMemo(
    () => impactCoverageRows.reduce((sum, row) => sum + row.remainingScore, 0),
    [impactCoverageRows],
  );

  const impactCompleted =
    requiredImpactAbilities.length > 0 && impactRemainingTotal === 0;

  const impactCandidateRows = useMemo<ImpactCandidateRow[]>(() => {
    const requiredByCode = new Map<string, ImpactRequiredAbilityRow>(requiredImpactAbilities.map((row) => [row.abilityCode, row]));
    const remainingByCode = new Map<string, number>(impactCoverageRows.map((row) => [row.abilityCode, row.remainingScore]));

    return impactPractices
      .filter((practice) => {
        const practiceCode = s(practice.practice_code);
        if (!practiceCode.startsWith("PR-")) return false;
        if (!practiceVisibleForTenant(practice, tenantId)) return false;
        if (!activePracticeStatus(practice.status)) return false;
        return practiceFitsAgeAndMonth(practice, selectedAgeYears, impactTargetMonth);
      })
      .map((practice): ImpactCandidateRow => {
        const practiceCode = s(practice.practice_code);
        const scores = buildPracticePostureScoreMap(practiceCode, linksByPracticeCode);
        const matchedRequiredCodes = Array.from(scores.keys()).filter((code) => requiredByCode.has(code));
        const matchedRequiredLabels = matchedRequiredCodes.map((code) => requiredByCode.get(code)?.label ?? code);
        const potentialScore = matchedRequiredCodes.reduce(
          (sum, code) => sum + (scores.get(code) ?? 0),
          0,
        );
        const uncoveredScore = matchedRequiredCodes.reduce(
          (sum, code) => sum + Math.min(scores.get(code) ?? 0, remainingByCode.get(code) ?? 0),
          0,
        );

        return {
          practice,
          practiceCode,
          matchedRequiredCodes,
          matchedRequiredLabels,
          potentialScore,
          uncoveredScore,
          linkCount: linksByPracticeCode.get(practiceCode)?.length ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.uncoveredScore !== b.uncoveredScore) return b.uncoveredScore - a.uncoveredScore;
        if (a.potentialScore !== b.potentialScore) return b.potentialScore - a.potentialScore;
        if (a.linkCount !== b.linkCount) return b.linkCount - a.linkCount;
        return s(a.practice.name).localeCompare(s(b.practice.name), "ja");
      });
  }, [impactCoverageRows, impactPractices, impactTargetMonth, linksByPracticeCode, requiredImpactAbilities, selectedAgeYears, tenantId]);

  const selectedImpactPracticeRows = useMemo(
    () => impactCandidateRows.filter((row) => selectedImpactPracticeCodeSet.has(row.practiceCode)),
    [impactCandidateRows, selectedImpactPracticeCodeSet],
  );

  const selectedWeeklyMonthlyItem = useMemo(
    () => approvedMonthlyPlans.find((item) => s(item.plan.id) === weeklyPlanId) ?? null,
    [approvedMonthlyPlans, weeklyPlanId],
  );

  const selectedWeeklyMonthlyPlan = selectedWeeklyMonthlyItem?.plan ?? null;

  const weeklyMonthKey = useMemo(
    () => monthKeyFromPlan(selectedWeeklyMonthlyPlan),
    [selectedWeeklyMonthlyPlan],
  );

  const weeklyWeekOptions = useMemo(
    () => buildMonthlyWeekOptions(selectedWeeklyMonthlyPlan),
    [selectedWeeklyMonthlyPlan],
  );

  const selectedWeeklyOption = useMemo(
    () => weeklyWeekOptions.find((item) => item.weekStartDate === selectedWeekStartDate) ?? null,
    [selectedWeekStartDate, weeklyWeekOptions],
  );

  const weeklyDays = useMemo(
    () => buildWeekDays(selectedWeekStartDate),
    [selectedWeekStartDate],
  );

  const selectedWeeklyImpact = useMemo(
    () => weeklyImpactAnalyses.find((row) => s(row.id) === weeklyImpactAnalysisId) ?? null,
    [weeklyImpactAnalyses, weeklyImpactAnalysisId],
  );

  const weeklySelectedPracticeCodes = useMemo(
    () => selectedPracticeCodesFromImpact(selectedWeeklyImpact?.selectedJson),
    [selectedWeeklyImpact?.selectedJson],
  );

  const weeklyPracticeOptions = useMemo(() => {
    const selectedSet = new Set(weeklySelectedPracticeCodes);
    return impactPractices
      .filter((practice) => selectedSet.has(s(practice.practice_code)))
      .sort((a, b) => s(a.name).localeCompare(s(b.name), "ja"));
  }, [impactPractices, weeklySelectedPracticeCodes]);

  const weeklyPracticeCodeSet = useMemo(
    () => new Set(weeklySelectedPracticeCodes),
    [weeklySelectedPracticeCodes],
  );

  const weeklyPlansByWeekStart = useMemo(() => {
    const map = new Map<string, PlanDocumentRow>();

    for (const plan of weeklyPlanRows) {
      const weekStartDate = s(plan.periodStartDate);
      if (!weekStartDate) continue;
      map.set(weekStartDate, plan);
    }

    return map;
  }, [weeklyPlanRows]);

  const selectedWeeklyPlanRow = useMemo(
    () => weeklyPlansByWeekStart.get(selectedWeekStartDate) ?? null,
    [selectedWeekStartDate, weeklyPlansByWeekStart],
  );

  const weeklyCurrentStatus = s(selectedWeeklyPlanRow?.status);
  const weeklyCanSubmit = Boolean(selectedWeeklyPlanRow?.id) &&
    ["DRAFT", "REJECTED", ""].includes(weeklyCurrentStatus.toUpperCase());
  const weeklyCanApprove = Boolean(isSchoolScope) &&
    weeklyCurrentStatus.toUpperCase() === "SUBMITTED";

  const weeklyCurrentReviewHistory = useMemo(() => {
    const content = safeParsePlanContent(selectedWeeklyPlanRow?.contentJson);
    return displayReviewHistory(planContentReview(content));
  }, [selectedWeeklyPlanRow?.contentJson]);

  const weeklyAssignedPrimaryPracticeCodes = useMemo(() => {
    return uniqueStrings(
      assignmentCodesForDays(
        weeklyAssignments,
        weeklyDays,
        "primaryPracticeCode",
      ).filter((practiceCode) => weeklyPracticeCodeSet.has(practiceCode)),
    );
  }, [weeklyAssignments, weeklyDays, weeklyPracticeCodeSet]);

  const weeklyAssignedReservePracticeCodes = useMemo(() => {
    return uniqueStrings(
      assignmentCodesForDays(
        weeklyAssignments,
        weeklyDays,
        "reservePracticeCode",
      ).filter((practiceCode) => weeklyPracticeCodeSet.has(practiceCode)),
    );
  }, [weeklyAssignments, weeklyDays, weeklyPracticeCodeSet]);

  const weeklyAssignedPracticeCodes = useMemo(
    () => uniqueStrings([...weeklyAssignedPrimaryPracticeCodes, ...weeklyAssignedReservePracticeCodes]),
    [weeklyAssignedPrimaryPracticeCodes, weeklyAssignedReservePracticeCodes],
  );

  const weeklyPrimaryCount = useMemo(
    () => countAssignmentCodes(weeklyAssignments, weeklyDays, "primaryPracticeCode"),
    [weeklyAssignments, weeklyDays],
  );

  const weeklyReserveCount = useMemo(
    () => countAssignmentCodes(weeklyAssignments, weeklyDays, "reservePracticeCode"),
    [weeklyAssignments, weeklyDays],
  );

  const weeklyWeekSummaries = useMemo<WeeklyWeekSummary[]>(() => {
    return weeklyWeekOptions.map((option) => {
      const savedPlan = weeklyPlansByWeekStart.get(option.weekStartDate) ?? null;
      const days = buildWeekDays(option.weekStartDate);
      const assignments =
        option.weekStartDate === selectedWeekStartDate
          ? weeklyAssignments
          : weeklyAssignmentsFromPlanContent(savedPlan?.contentJson);

      return {
        option,
        savedPlan,
        statusLabel: savedPlan ? `保存済み / ${statusLabel(savedPlan.status)}` : "未保存",
        primaryCount: countAssignmentCodes(assignments, days, "primaryPracticeCode"),
        reserveCount: countAssignmentCodes(assignments, days, "reservePracticeCode"),
      };
    });
  }, [selectedWeekStartDate, weeklyAssignments, weeklyPlansByWeekStart, weeklyWeekOptions]);

  const weeklyMonthPrimaryCount = useMemo(
    () => weeklyWeekSummaries.reduce((sum, week) => sum + week.primaryCount, 0),
    [weeklyWeekSummaries],
  );

  const weeklyMonthReserveCount = useMemo(
    () => weeklyWeekSummaries.reduce((sum, week) => sum + week.reserveCount, 0),
    [weeklyWeekSummaries],
  );

  const weeklyMonthlyPlanCoverage = useMemo(
    () => coverageFromPhraseIds(selectedWeeklyMonthlyItem?.selectedPhraseIds ?? [], phraseLinks),
    [phraseLinks, selectedWeeklyMonthlyItem?.selectedPhraseIds],
  );

  const weeklyCurrentWeekPracticeCoverage = useMemo(
    () => coverageFromPracticeCodes(
      assignmentCodesForDays(weeklyAssignments, weeklyDays, "primaryPracticeCode")
        .filter((practiceCode) => weeklyPracticeCodeSet.has(practiceCode)),
      linksByPracticeCode,
    ),
    [linksByPracticeCode, weeklyAssignments, weeklyDays, weeklyPracticeCodeSet],
  );

  const weeklyMonthlyAssignedPrimaryPracticeCodes = useMemo(() => {
    return weeklyWeekOptions.flatMap((option) => {
      const savedPlan = weeklyPlansByWeekStart.get(option.weekStartDate) ?? null;
      const assignments =
        option.weekStartDate === selectedWeekStartDate
          ? weeklyAssignments
          : weeklyAssignmentsFromPlanContent(savedPlan?.contentJson);
      const days = buildWeekDays(option.weekStartDate);

      return assignmentCodesForDays(assignments, days, "primaryPracticeCode")
        .filter((practiceCode) => weeklyPracticeCodeSet.has(practiceCode));
    });
  }, [selectedWeekStartDate, weeklyAssignments, weeklyPlansByWeekStart, weeklyPracticeCodeSet, weeklyWeekOptions]);

  const weeklyMonthlyPracticeCoverage = useMemo(
    () => coverageFromPracticeCodes(
      weeklyMonthlyAssignedPrimaryPracticeCodes,
      linksByPracticeCode,
    ),
    [linksByPracticeCode, weeklyMonthlyAssignedPrimaryPracticeCodes],
  );


  const approvedWeeklyPlansForDaily = useMemo(
    () =>
      dailyWeeklyPlans
        .filter((plan) => s(plan.status).toUpperCase() === "APPROVED")
        .sort((a, b) => s(a.periodStartDate).localeCompare(s(b.periodStartDate))),
    [dailyWeeklyPlans],
  );

  const selectedDailyWeeklyPlan = useMemo(
    () => approvedWeeklyPlansForDaily.find((plan) => s(plan.id) === dailyWeeklyPlanId) ?? null,
    [approvedWeeklyPlansForDaily, dailyWeeklyPlanId],
  );

  const selectedDailyWeeklyContent = useMemo(
    () => parseJsonRecord(selectedDailyWeeklyPlan?.contentJson),
    [selectedDailyWeeklyPlan?.contentJson],
  );

  const dailyWeekDays = useMemo(
    () => weeklyPlanDaysFromContent(selectedDailyWeeklyPlan?.contentJson),
    [selectedDailyWeeklyPlan?.contentJson],
  );

  const selectedDailyDay = useMemo(
    () => dailyWeekDays.find((day) => day.date === dailyTargetDate) ?? null,
    [dailyTargetDate, dailyWeekDays],
  );

  const dailyPrimaryPractice = useMemo(
    () => impactPractices.find((practice) => s(practice.practice_code) === s(selectedDailyDay?.primaryPracticeCode)) ?? null,
    [impactPractices, selectedDailyDay?.primaryPracticeCode],
  );

  const dailyReservePractice = useMemo(
    () => impactPractices.find((practice) => s(practice.practice_code) === s(selectedDailyDay?.reservePracticeCode)) ?? null,
    [impactPractices, selectedDailyDay?.reservePracticeCode],
  );

  const dailyPrimaryPreviewObservationHints = useMemo(
    () =>
      uniqueDailyObservationHints(
        buildDailyObservationHints({
          targetDate: dailyTargetDate,
          classroomId: selectedClassroomId,
          ageYears: selectedAgeYears,
          practiceCode: s(selectedDailyDay?.primaryPracticeCode),
          linksByPracticeCode,
          observationHints: dailyObservationHintRows,
          maxCount: DAILY_OBSERVATION_HINT_LIMIT,
        }),
        DAILY_OBSERVATION_HINT_LIMIT,
      ),
    [
      dailyObservationHintRows,
      dailyTargetDate,
      linksByPracticeCode,
      selectedClassroomId,
      selectedAgeYears,
      selectedDailyDay?.primaryPracticeCode,
    ],
  );

  const dailyReservePreviewObservationHints = useMemo(
    () =>
      uniqueDailyObservationHints(
        buildDailyObservationHints({
          targetDate: dailyTargetDate,
          classroomId: selectedClassroomId,
          ageYears: selectedAgeYears,
          practiceCode: s(selectedDailyDay?.reservePracticeCode),
          linksByPracticeCode,
          observationHints: dailyObservationHintRows,
          maxCount: DAILY_OBSERVATION_HINT_LIMIT,
        }),
        DAILY_OBSERVATION_HINT_LIMIT,
      ),
    [
      dailyObservationHintRows,
      dailyTargetDate,
      linksByPracticeCode,
      selectedClassroomId,
      selectedAgeYears,
      selectedDailyDay?.reservePracticeCode,
    ],
  );

  const dailySourceImpactAnalysisIds = useMemo(
    () => sourceImpactAnalysisIds(selectedDailyWeeklyPlan?.sourceImpactAnalysisIdsJson),
    [selectedDailyWeeklyPlan?.sourceImpactAnalysisIdsJson],
  );

  const dailyExistingStatus = s(dailyExistingPlanRow?.status);


  const loadOverviewPlans = useCallback(async () => {
    if (!tenantId || !selectedClassroomId) {
      setOverviewPlans([]);
      return;
    }

    setOverviewLoading(true);

    try {
      const rows = await listAll<PlanDocumentRow>(planDocumentModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          classroomId: { eq: selectedClassroomId },
          planLevel: { eq: "LONG_TERM" },
        },
      });

      setOverviewPlans(rows.filter((row) => s(row.status).toUpperCase() !== "ARCHIVED"));
    } catch (e) {
      console.error(e);
      setError(
        `中長期計画俯瞰の読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setOverviewLoading(false);
    }
  }, [fiscalYear, planDocumentModel.list, selectedClassroomId, tenantId]);

  const loadImpactPracticeData = useCallback(async () => {
    if (!tenantId) {
      setImpactPractices([]);
      setAbilityPracticeLinks([]);
      return;
    }

    setImpactLoading(true);
    setError("");

    try {
      const [practiceRows, linkRows] = await Promise.all([
        listAll<PracticeCodeRow>(practiceCodeModel.list),
        listAll<AbilityPracticeLinkRow>(abilityPracticeLinkModel.list),
      ]);

      setImpactPractices(practiceRows);
      setAbilityPracticeLinks(linkRows);
    } catch (e) {
      console.error(e);
      setError(
        `インパクト分析データ読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setImpactLoading(false);
    }
  }, [abilityPracticeLinkModel.list, practiceCodeModel.list, tenantId]);

  const loadExistingImpactAnalysis = useCallback(async (sourcePlanId: string) => {
    if (!tenantId || !sourcePlanId) {
      setImpactAnalysisId("");
      setSelectedImpactPracticeCodes([]);
      return;
    }

    try {
      const rows = await listAll<ImpactAnalysisRow>(impactAnalysisModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          sourcePlanId: { eq: sourcePlanId },
          targetKind: { eq: "PRACTICE_ACTIVITY" },
        },
      });

      const latest = rows
        .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
        .sort((a, b) => s(b.updatedAt || b.createdAt).localeCompare(s(a.updatedAt || a.createdAt)))[0] ?? null;

      setImpactAnalysisId(s(latest?.id));

      if (latest?.selectedJson) {
        setSelectedImpactPracticeCodes(selectedPracticeCodesFromImpact(latest.selectedJson));
      } else {
        setSelectedImpactPracticeCodes([]);
      }
    } catch (e) {
      console.error(e);
      setError(
        `保存済みインパクト分析読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setImpactAnalysisId("");
    }
  }, [fiscalYear, impactAnalysisModel.list, tenantId]);



  const loadWeeklyImpactAnalyses = useCallback(async (sourcePlanId: string) => {
    if (!tenantId || !sourcePlanId) {
      setWeeklyImpactAnalyses([]);
      setWeeklyImpactAnalysisId("");
      return;
    }

    setWeeklyLoading(true);
    setError("");

    try {
      const rows = await listAll<ImpactAnalysisRow>(impactAnalysisModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          sourcePlanId: { eq: sourcePlanId },
          targetKind: { eq: "PRACTICE_ACTIVITY" },
        },
      });

      const visible = rows
        .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
        .sort((a, b) => s(b.updatedAt || b.createdAt).localeCompare(s(a.updatedAt || a.createdAt)));

      setWeeklyImpactAnalyses(visible);
      setWeeklyImpactAnalysisId((prev) => {
        if (prev && visible.some((row) => s(row.id) === prev)) return prev;
        return s(visible[0]?.id);
      });
    } catch (e) {
      console.error(e);
      setError(
        `週案用ImpactAnalysis読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setWeeklyImpactAnalyses([]);
      setWeeklyImpactAnalysisId("");
    } finally {
      setWeeklyLoading(false);
    }
  }, [fiscalYear, impactAnalysisModel.list, tenantId]);

  const loadWeeklyPlanRows = useCallback(async (sourcePlanId: string) => {
    if (!tenantId || !selectedClassroomId || !sourcePlanId) {
      setWeeklyPlanRows([]);
      return;
    }

    try {
      const rows = await listAll<PlanDocumentRow>(planDocumentModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          classroomId: { eq: selectedClassroomId },
          planLevel: { eq: "SHORT_TERM" },
          planKind: { eq: "WEEKLY" },
          sourcePlanId: { eq: sourcePlanId },
        },
      });

      setWeeklyPlanRows(
        rows.filter((row) => s(row.status).toUpperCase() !== "ARCHIVED"),
      );
    } catch (e) {
      console.error(e);
      setError(
        `週案一覧読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setWeeklyPlanRows([]);
    }
  }, [fiscalYear, planDocumentModel.list, selectedClassroomId, tenantId]);


  const loadDailyIssueData = useCallback(async () => {
    if (!tenantId || !selectedClassroomId) {
      setDailyWeeklyPlans([]);
      setDailyObservationHintRows([]);
      return;
    }

    setDailyLoading(true);
    setError("");

    try {
      const [weeklyRows, hintRows] = await Promise.all([
        listAll<PlanDocumentRow>(planDocumentModel.list, {
          filter: {
            tenantId: { eq: tenantId },
            fiscalYear: { eq: fiscalYear },
            classroomId: { eq: selectedClassroomId },
            planLevel: { eq: "SHORT_TERM" },
            planKind: { eq: "WEEKLY" },
          },
        }),
        listAll<AbilityObservationHintRow>(abilityObservationHintModel.list),
      ]);

      setDailyWeeklyPlans(
        weeklyRows.filter((row) => s(row.status).toUpperCase() !== "ARCHIVED"),
      );
      setDailyObservationHintRows(
        uniqueAbilityObservationHintRows(
          hintRows.filter((row) => row.isActive !== false),
        ),
      );
    } catch (e) {
      console.error(e);
      setError(
        `日案発行データ読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setDailyWeeklyPlans([]);
      setDailyObservationHintRows([]);
    } finally {
      setDailyLoading(false);
    }
  }, [
    abilityObservationHintModel.list,
    fiscalYear,
    planDocumentModel.list,
    selectedClassroomId,
    tenantId,
  ]);

  const loadExistingDailyPlan = useCallback(async (args: {
    weeklyPlanId: string;
    targetDate: string;
  }) => {
    if (!tenantId || !selectedClassroomId || !args.weeklyPlanId || !args.targetDate) {
      setDailyExistingPlanId("");
      setDailyExistingPlanRow(null);
      return;
    }

    setDailyLoading(true);
    setError("");

    try {
      const rows = await listAll<PlanDocumentRow>(planDocumentModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          classroomId: { eq: selectedClassroomId },
          planLevel: { eq: "SHORT_TERM" },
          planKind: { eq: "DAILY" },
          sourcePlanId: { eq: args.weeklyPlanId },
        },
      });

      const matched = rows
        .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
        .find(
          (row) =>
            s(row.periodStartDate) === args.targetDate &&
            s(row.periodEndDate) === args.targetDate,
        ) ?? null;

      setDailyExistingPlanId(s(matched?.id));
      setDailyExistingPlanRow(matched);
    } catch (e) {
      console.error(e);
      setError(
        `発行済み日案読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setDailyExistingPlanId("");
      setDailyExistingPlanRow(null);
    } finally {
      setDailyLoading(false);
    }
  }, [fiscalYear, planDocumentModel.list, selectedClassroomId, tenantId]);


  const loadExistingWeeklyPlan = useCallback(async (args: {
    sourcePlanId: string;
    weekStartDate: string;
    weekEndDate: string;
  }) => {
    if (!tenantId || !selectedClassroomId || !args.sourcePlanId || !args.weekStartDate) {
      setWeeklyExistingPlanId("");
      setWeeklyAssignments({});
      return;
    }

    setWeeklyLoading(true);
    setError("");

    try {
      const rows = await listAll<PlanDocumentRow>(planDocumentModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          classroomId: { eq: selectedClassroomId },
          planLevel: { eq: "SHORT_TERM" },
          planKind: { eq: "WEEKLY" },
          sourcePlanId: { eq: args.sourcePlanId },
        },
      });

      const matched = rows
        .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
        .find(
          (row) =>
            s(row.periodStartDate) === args.weekStartDate &&
            s(row.periodEndDate) === args.weekEndDate,
        ) ?? null;

      setWeeklyExistingPlanId(s(matched?.id));
      setWeeklyAssignments(matched?.contentJson ? weeklyAssignmentsFromPlanContent(matched.contentJson) : {});
      setWeeklyReviewComment("");
    } catch (e) {
      console.error(e);
      setError(
        `保存済み週案読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      setWeeklyExistingPlanId("");
    } finally {
      setWeeklyLoading(false);
    }
  }, [fiscalYear, planDocumentModel.list, selectedClassroomId, tenantId]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [classroomRows, phraseRows, linkRows] = await Promise.all([
        listAll<ClassroomRow>(classroomModel.list, {
          filter: {
            tenantId: { eq: tenantId },
            fiscalYear: { eq: fiscalYear },
            status: { eq: "ACTIVE" },
          },
        }),
        listAll<PlanPhraseRow>(planPhraseModel.list),
        listAll<PlanPhraseAbilityLinkRow>(planPhraseAbilityLinkModel.list),
      ]);

      const visibleClassrooms = sortClassrooms(
        classroomRows.filter((classroom) => {
          const classroomId = s(classroom.id);
          if (!classroomId) return false;
          if (isSchoolScope) return true;
          return allowedIdSet.has(classroomId);
        }),
      );

      setClassrooms(visibleClassrooms);
      setPhrases(phraseRows.filter((row) => activeStatus(row.status)));
      setPhraseLinks(linkRows.filter((row) => activeStatus(row.status)));

      const preferredId =
        currentClassroomId && visibleClassrooms.some((row) => s(row.id) === currentClassroomId)
          ? currentClassroomId
          : s(visibleClassrooms[0]?.id);

      setSelectedClassroomId((prev) => {
        if (prev && visibleClassrooms.some((row) => s(row.id) === prev)) {
          return prev;
        }

        return preferredId;
      });
    } catch (e) {
      console.error(e);
      setError(
        `Plan Workspace 初期読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, [
    allowedIdSet,
    classroomModel.list,
    currentClassroomId,
    fiscalYear,
    isSchoolScope,
    planPhraseAbilityLinkModel.list,
    planPhraseModel.list,
    tenantId,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadReviewerName() {
      const fallback = shortDisplayName(owner);
      setReviewerName(fallback);

      if (!owner) return;

      try {
        const result = await userProfileModel.get({ id: owner });
        if (ignore) return;

        const displayName = s(result.data?.displayName);
        setReviewerName(displayName ? shortDisplayName(displayName) : fallback);
      } catch (e) {
        console.error(e);
        if (!ignore) setReviewerName(fallback);
      }
    }

    void loadReviewerName();

    return () => {
      ignore = true;
    };
  }, [owner, userProfileModel]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadOverviewPlans();
  }, [loadOverviewPlans]);


  useEffect(() => {
    if (workspaceView !== "impact") return;

    void loadOverviewPlans();
    void loadImpactPracticeData();
  }, [loadImpactPracticeData, loadOverviewPlans, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "impact") return;

    const currentExists = approvedMonthlyPlans.some((item) => s(item.plan.id) === impactPlanId);
    const firstId = s(approvedMonthlyPlans[0]?.plan.id);

    if (!currentExists) {
      setImpactPlanId(firstId);
      if (!firstId) {
        setSelectedImpactPracticeCodes([]);
        setImpactAnalysisId("");
      }
    }
  }, [approvedMonthlyPlans, impactPlanId, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "impact") return;

    if (!impactPlanId) {
      setImpactAnalysisId("");
      setSelectedImpactPracticeCodes([]);
      return;
    }

    void loadExistingImpactAnalysis(impactPlanId);
  }, [impactPlanId, loadExistingImpactAnalysis, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "weekly") return;

    void loadOverviewPlans();
    void loadImpactPracticeData();
  }, [loadImpactPracticeData, loadOverviewPlans, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "weekly") return;

    const currentExists = approvedMonthlyPlans.some((item) => s(item.plan.id) === weeklyPlanId);
    const firstId = s(approvedMonthlyPlans[0]?.plan.id);

    if (!currentExists) {
      setWeeklyPlanId(firstId);
      setWeeklyImpactAnalyses([]);
      setWeeklyImpactAnalysisId("");
      setSelectedWeekStartDate("");
      setWeeklyAssignments({});
      setWeeklyExistingPlanId("");
      setWeeklyPlanRows([]);
    }
  }, [approvedMonthlyPlans, weeklyPlanId, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "weekly") return;

    if (!weeklyPlanId) {
      setWeeklyImpactAnalyses([]);
      setWeeklyImpactAnalysisId("");
      setWeeklyPlanRows([]);
      return;
    }

    void loadWeeklyImpactAnalyses(weeklyPlanId);
    void loadWeeklyPlanRows(weeklyPlanId);
  }, [loadWeeklyImpactAnalyses, loadWeeklyPlanRows, weeklyPlanId, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "weekly") return;

    const currentExists = weeklyWeekOptions.some((item) => item.weekStartDate === selectedWeekStartDate);
    const firstWeek = weeklyWeekOptions[0]?.weekStartDate ?? "";

    if (!currentExists) {
      setSelectedWeekStartDate(firstWeek);
      setWeeklyAssignments({});
      setWeeklyExistingPlanId("");
    }
  }, [selectedWeekStartDate, weeklyWeekOptions, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "weekly") return;

    if (!weeklyPlanId || !selectedWeeklyOption) {
      setWeeklyExistingPlanId("");
      setWeeklyAssignments({});
      return;
    }

    void loadExistingWeeklyPlan({
      sourcePlanId: weeklyPlanId,
      weekStartDate: selectedWeeklyOption.weekStartDate,
      weekEndDate: selectedWeeklyOption.weekEndDate,
    });
  }, [loadExistingWeeklyPlan, selectedWeeklyOption, weeklyPlanId, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "weekly") return;

    setWeeklyAssignments((prev) => {
      const next: WeeklyAssignments = {};
      for (const day of weeklyDays) {
        const current = prev[day.date] ?? {};
        next[day.date] = {
          primaryPracticeCode: weeklyPracticeCodeSet.has(s(current.primaryPracticeCode))
            ? s(current.primaryPracticeCode)
            : "",
          reservePracticeCode: weeklyPracticeCodeSet.has(s(current.reservePracticeCode))
            ? s(current.reservePracticeCode)
            : "",
        };
      }
      return next;
    });
  }, [weeklyDays, weeklyPracticeCodeSet, workspaceView]);


  useEffect(() => {
    if (workspaceView !== "daily") return;

    void loadOverviewPlans();
    void loadImpactPracticeData();
    void loadDailyIssueData();
  }, [loadDailyIssueData, loadImpactPracticeData, loadOverviewPlans, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "daily") return;

    const currentExists = approvedWeeklyPlansForDaily.some((plan) => s(plan.id) === dailyWeeklyPlanId);
    const firstId = s(approvedWeeklyPlansForDaily[0]?.id);

    if (!currentExists) {
      setDailyWeeklyPlanId(firstId);
      setDailyTargetDate("");
      setDailyExistingPlanId("");
      setDailyExistingPlanRow(null);
    }
  }, [approvedWeeklyPlansForDaily, dailyWeeklyPlanId, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "daily") return;

    const currentExists = dailyWeekDays.some((day) => day.date === dailyTargetDate);
    const firstDate = dailyWeekDays[0]?.date ?? "";

    if (!currentExists) {
      setDailyTargetDate(firstDate);
      setDailyExistingPlanId("");
      setDailyExistingPlanRow(null);
    }
  }, [dailyTargetDate, dailyWeekDays, workspaceView]);

  useEffect(() => {
    if (workspaceView !== "daily") return;

    if (!dailyWeeklyPlanId || !dailyTargetDate) {
      setDailyExistingPlanId("");
      setDailyExistingPlanRow(null);
      return;
    }

    void loadExistingDailyPlan({
      weeklyPlanId: dailyWeeklyPlanId,
      targetDate: dailyTargetDate,
    });
  }, [dailyTargetDate, dailyWeeklyPlanId, loadExistingDailyPlan, workspaceView]);


  useEffect(() => {
    if (domainOptions.length === 0) {
      setSelectedDomainCode("");
      return;
    }

    setSelectedDomainCode((prev) => {
      if (prev && domainOptions.some((item) => item.code === prev)) {
        return prev;
      }

      return domainOptions[0]?.code ?? "";
    });
  }, [domainOptions]);

  useEffect(() => {
    const availableIds = new Set(
      periodMatchedPhrases.map((phrase) => s(phrase.planPhraseId)),
    );
    setSelectedPhraseIds((prev) => prev.filter((id) => availableIds.has(id)));
  }, [periodMatchedPhrases]);

  useEffect(() => {
    let ignore = false;

    async function loadExistingPlan() {
      if (!tenantId || !selectedClassroomId) {
        setExistingPlanId("");
        setExistingPlanRow(null);
        setCurrentPlanStatus("");
        return;
      }

      setLoadingPlan(true);
      setError("");

      try {
        const rows = await listAll<PlanDocumentRow>(planDocumentModel.list, {
          filter: {
            tenantId: { eq: tenantId },
            fiscalYear: { eq: fiscalYear },
            classroomId: { eq: selectedClassroomId },
            planLevel: { eq: "LONG_TERM" },
            planKind: { eq: planKindFromPeriod(periodType) },
          },
        });

        const matched =
          rows
            .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
            .find(
              (row) =>
                s(row.periodStartDate) === selectedPeriodRange.startDate &&
                s(row.periodEndDate) === selectedPeriodRange.endDate,
            ) ?? null;

        if (ignore) return;

        setExistingPlanId(s(matched?.id));
        setExistingPlanRow(matched);
        setCurrentPlanStatus(s(matched?.status));

        const content = safeParsePlanContent(matched?.contentJson);
        const ids = planContentSelectedIds(content);
        void planContentReview(content);

        setSelectedPhraseIds(ids);
        setMemo(s(content?.memo));
        setReviewComment("");

        if (matched?.id) {
          setMessage(`保存済みの計画アンカーを読み込みました: ${s(matched.title)}`);
        } else {
          setMessage("");
          setReviewComment("");
        }
      } catch (e) {
        if (!ignore) {
          console.error(e);
          setError(
            `PlanDocument読み込みエラー: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          setExistingPlanId("");
          setExistingPlanRow(null);
          setCurrentPlanStatus("");
        }
      } finally {
        if (!ignore) setLoadingPlan(false);
      }
    }

    void loadExistingPlan();

    return () => {
      ignore = true;
    };
  }, [
    fiscalYear,
    periodType,
    planDocumentModel.list,
    selectedClassroomId,
    selectedPeriodRange.endDate,
    selectedPeriodRange.startDate,
    tenantId,
  ]);

  function togglePhrase(planPhraseId: string, checked: boolean) {
    setSelectedPhraseIds((prev) => {
      const current = new Set(prev);

      if (checked) {
        current.add(planPhraseId);
      } else {
        current.delete(planPhraseId);
      }

      return Array.from(current);
    });
  }

  async function handleSavePlanDocument() {
    if (!tenantId) {
      setError("tenantId が未取得です。");
      return;
    }

    if (!selectedClassroom) {
      setError("クラスを選択してください。");
      return;
    }

    if (!selectedAgeYears) {
      setError("選択中クラスの年齢を判定できません。Classroom.ageLabel を確認してください。");
      return;
    }

    if (selectedPhraseIds.length === 0) {
      setError("計画に入れる文例を1つ以上選択してください。");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const selectedDomain =
        domainOptions.find((item) => item.code === selectedDomainCode)?.label ?? "";
      const currentContent = safeParsePlanContent(existingPlanRow?.contentJson);
      const currentReview = planContentReview(currentContent);

      const content = buildPlanContent({
        tenantId,
        tenantName,
        selectedClassroomId,
        selectedClassroom,
        selectedAgeYears,
        fiscalYear,
        periodType,
        selectedPeriodRange,
        selectedDomainCode,
        selectedDomain,
        selectedPhraseIds,
        selectedPhrases,
        linksByPhraseId,
        memo,
        existingReview: currentReview,
      });

      const payload = {
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        planLevel: "LONG_TERM",
        planKind: planKindFromPeriod(periodType),
        status: "DRAFT",
        periodStartDate: selectedPeriodRange.startDate,
        periodEndDate: selectedPeriodRange.endDate,
        title: planTitle,
        sourcePlanId: undefined,
        sourceImpactAnalysisIdsJson: "[]",
        contentJson: JSON.stringify(content),
        createdByUserId: existingPlanId ? undefined : owner,
        updatedByUserId: owner,
      };

      const result = existingPlanId
        ? await planDocumentModel.update({ id: existingPlanId, ...payload })
        : await planDocumentModel.create(payload);

      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "PlanDocument保存に失敗しました。"));
      }

      setExistingPlanId(s(result.data?.id) || existingPlanId);
      setExistingPlanRow(result.data ?? existingPlanRow);
      setCurrentPlanStatus("DRAFT");
      await loadOverviewPlans();
      setMessage(
        `計画アンカーを保存しました: ${planTitle} / 文例 ${selectedPhraseIds.length}件`,
      );
    } catch (e) {
      console.error(e);
      setError(
        `PlanDocument保存エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateCurrentPlanStatus(nextStatus: "SUBMITTED" | "APPROVED" | "REJECTED") {
    if (!existingPlanId || !existingPlanRow) {
      setError("先に計画アンカーを保存してください。");
      return;
    }

    setReviewUpdating(true);
    setError("");
    setMessage("");

    try {
      const currentContent = safeParsePlanContent(existingPlanRow.contentJson) ?? {};
      const review = planContentReview(currentContent);
      const nowIso = new Date().toISOString();
      const comment = reviewComment.trim();

      const actorName = reviewerName || shortDisplayName(owner);
      const nextHistoryItem: ReviewHistoryItem = {
        action: nextStatus,
        at: nowIso,
        byUserId: owner,
        byName: actorName,
        comment,
      };

      const nextReview: ReviewContent = {
        ...review,
        history: [...displayReviewHistory(review), nextHistoryItem],
      };
      if (nextStatus === "SUBMITTED") {
        nextReview.submittedAt = nowIso;
        nextReview.submittedByUserId = owner;
        nextReview.submitByName = actorName;
        nextReview.submitComment = comment;
      }
      if (nextStatus === "APPROVED") {
        nextReview.approvedAt = nowIso;
        nextReview.approvedByUserId = owner;
        nextReview.approvalByName = actorName;
        nextReview.approvalComment = comment;
      }
      if (nextStatus === "REJECTED") {
        nextReview.rejectedAt = nowIso;
        nextReview.rejectedByUserId = owner;
        nextReview.rejectionByName = actorName;
        nextReview.rejectionComment = comment;
      }

      const nextContent = {
        ...currentContent,
        review: nextReview,
      };

      const result = await planDocumentModel.update({
        id: existingPlanId,
        status: nextStatus,
        contentJson: JSON.stringify(nextContent),
        updatedByUserId: owner,
      });

      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "承認ステータス更新に失敗しました。"));
      }

      setExistingPlanRow(result.data ?? { ...existingPlanRow, status: nextStatus, contentJson: JSON.stringify(nextContent) });
      setCurrentPlanStatus(nextStatus);
      setReviewComment("");
      await loadOverviewPlans();
      setMessage(`計画ステータスを更新しました: ${statusLabel(nextStatus)} / ${reviewMessageText(nextHistoryItem)}`);
    } catch (e) {
      console.error(e);
      setError(
        `承認ステータス更新エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setReviewUpdating(false);
    }
  }

  function toggleImpactPractice(practiceCode: string, checked: boolean) {
    setSelectedImpactPracticeCodes((prev) => {
      const current = new Set(prev);

      if (checked) {
        current.add(practiceCode);
      } else {
        current.delete(practiceCode);
      }

      return Array.from(current);
    });
  }

  async function handleSaveImpactAnalysis() {
    if (!tenantId) {
      setError("tenantId が未取得です。");
      return;
    }

    if (!selectedClassroomId) {
      setError("クラスを選択してください。");
      return;
    }

    if (!selectedImpactItem) {
      setError("承認済み月間計画を選択してください。");
      return;
    }

    setImpactSaving(true);
    setError("");
    setMessage("");

    try {
      const sourcePlan = selectedImpactItem.plan;
      const selectedPractices = selectedImpactPracticeRows.map((row) => ({
        practiceCode: row.practiceCode,
        name: s(row.practice.name),
        practiceCategory: normalizePracticeCategory(
          s(row.practice.practiceCategory) || s(row.practice.category_name),
        ),
        practiceCategoryLabel: practiceCategoryLabel(
          s(row.practice.practiceCategory) || s(row.practice.category_name),
        ),
        matchedRequiredCodes: row.matchedRequiredCodes,
        matchedRequiredLabels: row.matchedRequiredLabels,
        potentialScore: row.potentialScore,
      }));

      const inputJson = {
        schemaVersion: 1,
        analysisType: "MONTHLY_PLAN_ABILITY_PRACTICE_COVERAGE",
        sourcePlanId: s(sourcePlan.id),
        sourcePlanTitle: s(sourcePlan.title),
        classroomId: selectedClassroomId,
        classroomName: s(selectedClassroom?.name),
        ageYears: selectedAgeYears,
        targetMonth: impactTargetMonth,
        periodStartDate: s(sourcePlan.periodStartDate),
        periodEndDate: s(sourcePlan.periodEndDate),
        selectedPhraseIds: selectedImpactPhraseIds,
        filter: {
          practiceCategory: "ALL",
          ageYears: selectedAgeYears,
          targetMonth: impactTargetMonth,
        },
      };

      const resultJson = {
        requiredAbilities: impactCoverageRows.map((row) => ({
          abilityCode: row.abilityCode,
          label: row.label,
          areaCode: row.areaCode,
          areaLabel: row.areaLabel,
          requiredScore: row.requiredScore,
          coveredScore: row.coveredScore,
          remainingScore: row.remainingScore,
        })),
        candidatePractices: impactCandidateRows.map((row) => ({
          practiceCode: row.practiceCode,
          name: s(row.practice.name),
          practiceCategory: normalizePracticeCategory(
            s(row.practice.practiceCategory) || s(row.practice.category_name),
          ),
          targetAge: practiceTargetAgeLabel(row.practice),
          seasonality: practiceSeasonalityLabel(row.practice),
          matchedRequiredCodes: row.matchedRequiredCodes,
          matchedRequiredLabels: row.matchedRequiredLabels,
          potentialScore: row.potentialScore,
          uncoveredScore: row.uncoveredScore,
          linkCount: row.linkCount,
        })),
      };

      const selectedJson = {
        selectedPracticeCodes: selectedImpactPracticeCodes,
        selectedPractices,
        remainingAbilities: impactCoverageRows.map((row) => ({
          abilityCode: row.abilityCode,
          label: row.label,
          remainingScore: row.remainingScore,
        })),
        completed: impactCompleted,
        requiredTotal: impactRequiredTotal,
        remainingTotal: impactRemainingTotal,
      };

      const payload = {
        tenantId,
        fiscalYear,
        scopeType: "PLAN",
        classroomId: selectedClassroomId,
        staffUserId: owner,
        targetKind: "PRACTICE_ACTIVITY",
        status: impactCompleted ? "CONFIRMED" : "DRAFT",
        sourcePlanId: s(sourcePlan.id),
        periodStartDate: s(sourcePlan.periodStartDate),
        periodEndDate: s(sourcePlan.periodEndDate),
        title: `${s(sourcePlan.title) || "月間計画"} Practice消込`,
        inputJson: JSON.stringify(inputJson),
        resultJson: JSON.stringify(resultJson),
        selectedJson: JSON.stringify(selectedJson),
        createdByUserId: impactAnalysisId ? undefined : owner,
        updatedByUserId: owner,
      };

      const result = impactAnalysisId
        ? await impactAnalysisModel.update({ id: impactAnalysisId, ...payload })
        : await impactAnalysisModel.create(payload);

      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "ImpactAnalysis保存に失敗しました。"));
      }

      setImpactAnalysisId(s(result.data?.id) || impactAnalysisId);
      setMessage(
        impactCompleted
          ? `ImpactAnalysisを保存しました。月間計画Abilityは選択Practiceで満たされています。選択 ${selectedImpactPracticeCodes.length}件`
          : `ImpactAnalysisを保存しました。残りAbilityスコア ${impactRemainingTotal} / 選択 ${selectedImpactPracticeCodes.length}件`,
      );
    } catch (e) {
      console.error(e);
      setError(
        `ImpactAnalysis保存エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setImpactSaving(false);
    }
  }

  function updateWeeklyAssignment(
    date: string,
    slot: keyof WeeklyPracticeSlot,
    practiceCode: string,
  ) {
    setWeeklyAssignments((prev) => {
      const current = prev[date] ?? {};
      const nextSlot: WeeklyPracticeSlot = {
        ...current,
        [slot]: practiceCode,
      };

      if (
        nextSlot.primaryPracticeCode &&
        nextSlot.reservePracticeCode &&
        nextSlot.primaryPracticeCode === nextSlot.reservePracticeCode
      ) {
        if (slot === "primaryPracticeCode") {
          nextSlot.reservePracticeCode = "";
        } else {
          nextSlot.primaryPracticeCode = "";
        }
      }

      return {
        ...prev,
        [date]: nextSlot,
      };
    });
  }

  async function handleSaveWeeklyPlan() {
    if (!tenantId) {
      setError("tenantId が未取得です。");
      return;
    }

    if (!selectedClassroomId) {
      setError("クラスを選択してください。");
      return;
    }

    if (!selectedWeeklyMonthlyPlan || !selectedWeeklyOption) {
      setError("承認済み月間計画と対象週を選択してください。");
      return;
    }

    if (!selectedWeeklyImpact) {
      setError("ImpactAnalysisを選択してください。");
      return;
    }

    if (weeklyPrimaryCount === 0) {
      setError("主活動Practiceを1件以上配置してください。");
      return;
    }

    setWeeklySaving(true);
    setError("");
    setMessage("");

    try {
      const existingWeeklyContent = safeParsePlanContent(selectedWeeklyPlanRow?.contentJson);
      const existingWeeklyReview = planContentReview(existingWeeklyContent);

      const days = weeklyDays.map((day) => {
        const slot = weeklyAssignments[day.date] ?? {};
        const primaryPracticeCode = s(slot.primaryPracticeCode);
        const reservePracticeCode = s(slot.reservePracticeCode);

        return {
          date: day.date,
          dayOfWeek: day.dayOfWeek,
          dayLabel: day.dayLabel,
          primaryPracticeCode,
          primaryPracticeName: practiceNameByCode(weeklyPracticeOptions, primaryPracticeCode),
          reservePracticeCode,
          reservePracticeName: reservePracticeCode
            ? practiceNameByCode(weeklyPracticeOptions, reservePracticeCode)
            : "",
          practiceCodes: [primaryPracticeCode, reservePracticeCode].filter(Boolean),
        };
      });

      const content = {
        schemaVersion: 1,
        planAnchorType: "SHORT_TERM_WEEKLY_PRACTICE_ALLOCATION",
        sourceMonthlyPlanId: s(selectedWeeklyMonthlyPlan.id),
        sourceMonthlyPlanTitle: s(selectedWeeklyMonthlyPlan.title),
        sourceImpactAnalysisId: s(selectedWeeklyImpact.id),
        classroomId: selectedClassroomId,
        classroomName: s(selectedClassroom?.name),
        ageYears: selectedAgeYears,
        weekStartDate: selectedWeeklyOption.weekStartDate,
        weekEndDate: selectedWeeklyOption.weekEndDate,
        primaryMonth: selectedWeeklyOption.primaryMonth,
        monthOwnershipRule: "WEEKDAY_MAJORITY",
        dailyPracticeLimit: {
          primaryMax: 1,
          reserveMax: 1,
          note: "1日1件を基本とし、2件目は予備Practiceとして扱う。",
        },
        weeklyPlanPolicy: {
          abilityComparison: "COVERAGE_REFERENCE_ONLY",
          note: "週単位のAbility偏りは許容し、月単位のPDCAで調整する。",
        },
        review: existingWeeklyReview,
        selectedPracticeCodes: weeklySelectedPracticeCodes,
        assignedPrimaryPracticeCodes: weeklyAssignedPrimaryPracticeCodes,
        assignedReservePracticeCodes: weeklyAssignedReservePracticeCodes,
        days,
        abilityCoverage: {
          targetMethod: "MONTHLY_PLAN_COVERAGE_AND_PRACTICE_CUMULATIVE",
          reservePracticeIncluded: false,
          note: "予備Practiceはカバレッジ積み上げに含めず、主活動Practiceのみを参考表示する。",
          currentWeekPracticeCoverage: {
            areaRows: weeklyCurrentWeekPracticeCoverage.areaRows,
            postureRows: weeklyCurrentWeekPracticeCoverage.postureRows,
            linkCount: weeklyCurrentWeekPracticeCoverage.linkCount,
          },
          monthlyPlanCoverage: {
            areaRows: weeklyMonthlyPlanCoverage.areaRows,
            postureRows: weeklyMonthlyPlanCoverage.postureRows,
            linkCount: weeklyMonthlyPlanCoverage.linkCount,
          },
        },
      };

      const title = `${s(selectedWeeklyMonthlyPlan.title) || "月間計画"} 週案 ${selectedWeeklyOption.weekStartDate}〜${selectedWeeklyOption.weekEndDate}`;
      const payload = {
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        planLevel: "SHORT_TERM",
        planKind: "WEEKLY",
        status: "DRAFT",
        periodStartDate: selectedWeeklyOption.weekStartDate,
        periodEndDate: selectedWeeklyOption.weekEndDate,
        title,
        sourcePlanId: s(selectedWeeklyMonthlyPlan.id),
        sourceImpactAnalysisIdsJson: JSON.stringify([s(selectedWeeklyImpact.id)]),
        contentJson: JSON.stringify(content),
        createdByUserId: weeklyExistingPlanId ? undefined : owner,
        updatedByUserId: owner,
      };

      const result = weeklyExistingPlanId
        ? await planDocumentModel.update({ id: weeklyExistingPlanId, ...payload })
        : await planDocumentModel.create(payload);

      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "週案保存に失敗しました。"));
      }

      setWeeklyExistingPlanId(s(result.data?.id) || weeklyExistingPlanId);
      setWeeklyReviewComment("");
      await loadWeeklyPlanRows(s(selectedWeeklyMonthlyPlan.id));
      setMessage(
        `週案を保存しました: ${title} / 主活動 ${weeklyPrimaryCount}件 / 予備 ${weeklyReserveCount}件`,
      );
    } catch (e) {
      console.error(e);
      setError(`週案保存エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWeeklySaving(false);
    }
  }

  async function updateWeeklyPlanStatus(nextStatus: "SUBMITTED" | "APPROVED" | "REJECTED") {
    if (!selectedWeeklyPlanRow?.id) {
      setError("先に週案を保存してください。");
      return;
    }

    setWeeklyReviewUpdating(true);
    setError("");
    setMessage("");

    try {
      const currentContent = safeParsePlanContent(selectedWeeklyPlanRow.contentJson) ?? {};
      const review = planContentReview(currentContent);
      const nowIso = new Date().toISOString();
      const comment = weeklyReviewComment.trim();
      const actorName = reviewerName || shortDisplayName(owner);
      const nextHistoryItem: ReviewHistoryItem = {
        action: nextStatus,
        at: nowIso,
        byUserId: owner,
        byName: actorName,
        comment,
      };

      const nextReview: ReviewContent = {
        ...review,
        history: [...displayReviewHistory(review), nextHistoryItem],
      };

      if (nextStatus === "SUBMITTED") {
        nextReview.submittedAt = nowIso;
        nextReview.submittedByUserId = owner;
        nextReview.submitByName = actorName;
        nextReview.submitComment = comment;
      }
      if (nextStatus === "APPROVED") {
        nextReview.approvedAt = nowIso;
        nextReview.approvedByUserId = owner;
        nextReview.approvalByName = actorName;
        nextReview.approvalComment = comment;
      }
      if (nextStatus === "REJECTED") {
        nextReview.rejectedAt = nowIso;
        nextReview.rejectedByUserId = owner;
        nextReview.rejectionByName = actorName;
        nextReview.rejectionComment = comment;
      }

      const nextContent = {
        ...currentContent,
        review: nextReview,
      };

      const result = await planDocumentModel.update({
        id: s(selectedWeeklyPlanRow.id),
        status: nextStatus,
        contentJson: JSON.stringify(nextContent),
        updatedByUserId: owner,
      });

      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "週案承認ステータス更新に失敗しました。"));
      }

      setWeeklyReviewComment("");
      await loadWeeklyPlanRows(weeklyPlanId);
      setMessage(`週案ステータスを更新しました: ${statusLabel(nextStatus)} / ${reviewMessageText(nextHistoryItem)}`);
    } catch (e) {
      console.error(e);
      setError(`週案承認ステータス更新エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWeeklyReviewUpdating(false);
    }
  }


  async function handleIssueDailyPlan() {
    if (!tenantId) {
      setError("tenantId が未取得です。");
      return;
    }

    if (!selectedClassroomId) {
      setError("クラスを選択してください。");
      return;
    }

    if (!selectedDailyWeeklyPlan) {
      setError("承認済み週案を選択してください。");
      return;
    }

    if (!selectedDailyDay) {
      setError("対象日を選択してください。");
      return;
    }

    if (!s(selectedDailyDay.primaryPracticeCode)) {
      setError("対象日に主活動Practiceが配置されていません。週案策定で主活動を配置してください。");
      return;
    }

    if (dailyObservationHintRows.length === 0) {
      setError("AbilityObservationHint が未登録です。CSV seedを実行してください。");
      return;
    }

    setDailySaving(true);
    setError("");
    setMessage("");

    try {
      const primaryPracticeCode = s(selectedDailyDay.primaryPracticeCode);
      const reservePracticeCode = s(selectedDailyDay.reservePracticeCode);
      const issueVersion = nextIssueVersion(dailyExistingPlanRow?.contentJson);
      const nowIso = new Date().toISOString();

      const content = {
        schemaVersion: 2,
        planAnchorType: "SHORT_TERM_DAILY_PLAN",
        sourceWeeklyPlanId: s(selectedDailyWeeklyPlan.id),
        sourceWeeklyPlanTitle: s(selectedDailyWeeklyPlan.title),
        sourceMonthlyPlanId: s(selectedDailyWeeklyContent?.sourceMonthlyPlanId),
        sourceMonthlyPlanTitle: s(selectedDailyWeeklyContent?.sourceMonthlyPlanTitle),
        sourceImpactAnalysisId: s(selectedDailyWeeklyContent?.sourceImpactAnalysisId) || dailySourceImpactAnalysisIds[0] || "",
        classroomId: selectedClassroomId,
        classroomName: s(selectedClassroom?.name),
        ageYears: selectedAgeYears,
        targetDate: selectedDailyDay.date,
        dayOfWeek: selectedDailyDay.dayOfWeek,
        dayLabel: selectedDailyDay.dayLabel,
        primaryPractice: {
          practiceCode: primaryPracticeCode,
          name: s(dailyPrimaryPractice?.name) || s(selectedDailyDay.primaryPracticeName) || primaryPracticeCode,
          memo: s(dailyPrimaryPractice?.memo) || s(dailyPrimaryPractice?.transcriptText),
          practiceCategory: normalizePracticeCategory(
            s(dailyPrimaryPractice?.practiceCategory) || s(dailyPrimaryPractice?.category_name),
          ),
          practiceCategoryLabel: practiceCategoryLabel(
            s(dailyPrimaryPractice?.practiceCategory) || s(dailyPrimaryPractice?.category_name),
          ),
          observationHints: dailyPrimaryPreviewObservationHints,
        },
        reservePractice: {
          practiceCode: reservePracticeCode,
          name: reservePracticeCode
            ? s(dailyReservePractice?.name) || s(selectedDailyDay.reservePracticeName) || reservePracticeCode
            : "",
          memo: reservePracticeCode
            ? s(dailyReservePractice?.memo) || s(dailyReservePractice?.transcriptText)
            : "",
          practiceCategory: reservePracticeCode
            ? normalizePracticeCategory(
                s(dailyReservePractice?.practiceCategory) || s(dailyReservePractice?.category_name),
              )
            : "",
          practiceCategoryLabel: reservePracticeCode
            ? practiceCategoryLabel(
                s(dailyReservePractice?.practiceCategory) || s(dailyReservePractice?.category_name),
              )
            : "",
          observationHints: dailyReservePreviewObservationHints,
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
          issueType: "MANUAL",
          issueVersion,
          issuedAt: nowIso,
          issuedByUserId: owner,
          sourceWeeklyStatus: s(selectedDailyWeeklyPlan.status),
        },
      };

      const title = `${s(selectedClassroom?.name) || "クラス"} 日案 ${selectedDailyDay.date}`;
      const payload = {
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        planLevel: "SHORT_TERM",
        planKind: "DAILY",
        status: "ISSUED",
        periodStartDate: selectedDailyDay.date,
        periodEndDate: selectedDailyDay.date,
        title,
        sourcePlanId: s(selectedDailyWeeklyPlan.id),
        sourceImpactAnalysisIdsJson: JSON.stringify(dailySourceImpactAnalysisIds),
        contentJson: JSON.stringify(content),
        createdByUserId: dailyExistingPlanId ? undefined : owner,
        updatedByUserId: owner,
      };

      const result = dailyExistingPlanId
        ? await planDocumentModel.update({ id: dailyExistingPlanId, ...payload })
        : await planDocumentModel.create(payload);

      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "日案発行に失敗しました。"));
      }

      setDailyExistingPlanId(s(result.data?.id) || dailyExistingPlanId);
      setDailyExistingPlanRow(result.data ?? null);
      setMessage(
        `${dailyExistingPlanId ? "日案を再発行しました" : "日案を発行しました"}: ${title} / 主活動の見届けたい姿 ${dailyPrimaryPreviewObservationHints.length}件 / 予備 ${dailyReservePreviewObservationHints.length}件 / version ${issueVersion}`,
      );
    } catch (e) {
      console.error(e);
      setError(`日案発行エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDailySaving(false);
    }
  }


  function renderCoverageRows(rows: CoverageRow[], className: string) {
    const max = maxScore(rows);

    return (
      <div className={className}>
        {rows.map((row) => {
          const width = `${Math.max(4, Math.round((row.score / max) * 100))}%`;
          const weak = row.score === 0;
          return (
            <div className="coverage-row" key={row.code}>
              <div className="coverage-label">
                <strong>{row.code}</strong>
                <span>{row.label}</span>
              </div>
              <div className="coverage-bar-track">
                <div
                  className={`coverage-bar ${weak ? "coverage-bar-empty" : ""}`}
                  style={{ width }}
                />
              </div>
              <div className="coverage-score">{row.score}</div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderImpactSection() {
    return (
      <div className="impact-section">
        <div className="impact-summary-card">
          <div>
            <strong>起点</strong>
            <span>承認済み月間計画</span>
          </div>
          <div>
            <strong>対象月</strong>
            <span>{impactTargetMonth ? `${impactTargetMonth}月` : "未選択"}</span>
          </div>
          <div>
            <strong>必要Ability</strong>
            <span>{requiredImpactAbilities.length}件 / スコア {impactRequiredTotal}</span>
          </div>
          <div>
            <strong>残り</strong>
            <span className={impactCompleted ? "impact-complete-text" : ""}>
              {impactCompleted ? "完了" : `${impactRemainingTotal}`}
            </span>
          </div>
        </div>

        <div className="impact-plan-selector-card">
          <label>
            <span>月間計画</span>
            <select
              value={impactPlanId}
              disabled={overviewLoading || impactLoading || approvedMonthlyPlans.length === 0}
              onChange={(event) => {
                setImpactPlanId(event.target.value);
                setSelectedImpactPracticeCodes([]);
                setImpactAnalysisId("");
              }}
            >
              {approvedMonthlyPlans.length === 0 ? (
                <option value="">承認済み月間計画なし</option>
              ) : (
                approvedMonthlyPlans.map((item) => (
                  <option key={s(item.plan.id)} value={s(item.plan.id)}>
                    {s(item.plan.title) || "月間計画"} / {s(item.plan.periodStartDate)}〜{s(item.plan.periodEndDate)}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="impact-plan-meta">
            <div>
              <strong>抽出条件</strong>
              <span>対象年齢 {selectedAgeYears ? `${selectedAgeYears}歳` : "未判定"} / 実施月 {impactTargetMonth ? `${impactTargetMonth}月` : "未判定"} / Practiceカテゴリ指定なし</span>
            </div>
            <div>
              <strong>候補Practice</strong>
              <span>{impactLoading ? "読み込み中..." : `${impactCandidateRows.length}件`}</span>
            </div>
            <div>
              <strong>保存状態</strong>
              <span>{impactAnalysisId ? `保存済み: ${impactAnalysisId}` : "未保存"}</span>
            </div>
          </div>
        </div>

        {impactCompleted ? (
          <div className="success-box">
            月間計画から導かれた5領域・10の姿は、選択したPracticeで満たされています。ここで止めても、さらにPracticeを追加しても構いません。
          </div>
        ) : requiredImpactAbilities.length > 0 ? (
          <div className="impact-alert-box">
            残りAbilityスコアは {impactRemainingTotal} です。未充足AbilityにヒットするPracticeを上位に表示しています。
          </div>
        ) : null}

        <div className="impact-two-column">
          <div className="impact-ability-card">
            <div className="overview-card-header">
              <h3>月間計画から導かれる5領域・10の姿</h3>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void loadOverviewPlans();
                  void loadImpactPracticeData();
                }}
                disabled={overviewLoading || impactLoading}
              >
                再読み込み
              </button>
            </div>
            <p className="muted">
              月間計画で選択されたPlanPhraseをAbilityへ展開し、選択済みPracticeのAbilityで消し込んでいます。
            </p>

            {approvedMonthlyPlans.length === 0 ? (
              <p className="muted">承認済み月間計画がありません。先に月間計画を承認してください。</p>
            ) : requiredImpactAbilities.length === 0 ? (
              <p className="muted">選択中の月間計画からAbilityを取得できません。</p>
            ) : (
              <div className="impact-ability-list">
                {impactCoverageRows.map((row) => {
                  const ratio = row.requiredScore <= 0 ? 100 : Math.min(100, Math.round((row.coveredScore / row.requiredScore) * 100));
                  return (
                    <div
                      className={`impact-ability-row ${row.remainingScore === 0 ? "impact-ability-row-complete" : ""}`}
                      key={row.abilityCode}
                    >
                      <div className="impact-ability-head">
                        <div>
                          <strong>{row.abilityCode} {row.label}</strong>
                          <span>{row.areaLabel}</span>
                        </div>
                        <b>{row.remainingScore === 0 ? "OK" : `残 ${row.remainingScore}`}</b>
                      </div>
                      <div className="coverage-bar-track">
                        <div className="coverage-bar" style={{ width: `${Math.max(4, ratio)}%` }} />
                      </div>
                      <small>必要 {row.requiredScore} / 充足 {row.coveredScore}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="impact-selected-card">
            <h3>選択済みPractice</h3>
            {selectedImpactPracticeRows.length === 0 ? (
              <p className="muted">まだPracticeが選択されていません。</p>
            ) : (
              <div className="impact-selected-list">
                {selectedImpactPracticeRows.map((row) => (
                  <div key={`selected-${row.practiceCode}`} className="impact-selected-item">
                    <strong>{s(row.practice.name) || row.practiceCode}</strong>
                    <span>{row.practiceCode}</span>
                    <small>
                      {row.matchedRequiredLabels.length > 0 ? row.matchedRequiredLabels.join("、") : "直接リンクなし"}
                    </small>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveImpactAnalysis}
              disabled={impactSaving || !selectedImpactItem}
            >
              {impactSaving ? "保存中..." : "ImpactAnalysisに保存"}
            </button>
          </div>
        </div>

        <div className="impact-practice-card">
          <div className="overview-card-header">
            <h3>Practice候補一覧</h3>
            <span className="muted">Practiceカテゴリでは絞らず、年齢・実施月だけで抽出しています。</span>
          </div>

          {impactLoading ? (
            <p className="muted">Practice候補を読み込み中...</p>
          ) : impactCandidateRows.length === 0 ? (
            <p className="muted">対象年齢・対象月に合うPracticeがありません。</p>
          ) : (
            <div className="impact-practice-list">
              {impactCandidateRows.map((row) => {
                const checked = selectedImpactPracticeCodeSet.has(row.practiceCode);
                return (
                  <div
                    className={`impact-practice-row ${checked ? "impact-practice-row-selected" : ""}`}
                    key={row.practiceCode}
                  >
                    <label className="impact-practice-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={impactSaving}
                        onChange={(event) => toggleImpactPractice(row.practiceCode, event.target.checked)}
                      />
                      <span>選択</span>
                    </label>

                    <div className="impact-practice-main">
                      <div className="impact-practice-title">
                        <strong>{s(row.practice.name) || row.practiceCode}</strong>
                        <span>{row.practiceCode}</span>
                      </div>
                      <p>{s(row.practice.memo) || s(row.practice.transcriptText) || "説明未登録"}</p>
                      <div className="impact-practice-tags">
                        <span>{practiceCategoryLabel(s(row.practice.practiceCategory) || s(row.practice.category_name))}</span>
                        <span>{practiceTargetAgeLabel(row.practice)}</span>
                        <span>{practiceSeasonalityLabel(row.practice)}</span>
                        <span>未充足ヒット {row.uncoveredScore}</span>
                        <span>関連スコア {row.potentialScore}</span>
                      </div>
                      <div className="phrase-ability-tags">
                        {row.matchedRequiredLabels.length > 0 ? (
                          row.matchedRequiredLabels.map((label) => (
                            <span key={`${row.practiceCode}-${label}`}>{label}</span>
                          ))
                        ) : (
                          <span>月間計画Abilityとの直接リンクなし</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderWeeklySection() {
    return (
      <div className="weekly-section">
        <div className="weekly-summary-card">
          <div>
            <strong>起点</strong>
            <span>承認済み月間計画 + ImpactAnalysis</span>
          </div>
          <div>
            <strong>対象月</strong>
            <span>{weeklyMonthKey || "未選択"}</span>
          </div>
          <div>
            <strong>対象週数</strong>
            <span>{weeklyWeekSummaries.length}週</span>
          </div>
          <div>
            <strong>配置合計</strong>
            <span>主活動 {weeklyMonthPrimaryCount}件 / 予備 {weeklyMonthReserveCount}件</span>
          </div>
        </div>

        <div className="weekly-selector-card weekly-selector-card-two">
          <label>
            <span>月間計画</span>
            <select
              value={weeklyPlanId}
              disabled={overviewLoading || weeklyLoading || approvedMonthlyPlans.length === 0}
              onChange={(event) => {
                setWeeklyPlanId(event.target.value);
                setWeeklyImpactAnalyses([]);
                setWeeklyImpactAnalysisId("");
                setWeeklyPlanRows([]);
                setSelectedWeekStartDate("");
                setWeeklyAssignments({});
                setWeeklyExistingPlanId("");
              }}
            >
              {approvedMonthlyPlans.length === 0 ? (
                <option value="">承認済み月間計画なし</option>
              ) : (
                approvedMonthlyPlans.map((item) => (
                  <option key={s(item.plan.id)} value={s(item.plan.id)}>
                    {s(item.plan.title) || "月間計画"} / {s(item.plan.periodStartDate)}〜{s(item.plan.periodEndDate)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span>ImpactAnalysis</span>
            <select
              value={weeklyImpactAnalysisId}
              disabled={weeklyLoading || weeklyImpactAnalyses.length === 0}
              onChange={(event) => {
                setWeeklyImpactAnalysisId(event.target.value);
                setWeeklyAssignments({});
              }}
            >
              {weeklyImpactAnalyses.length === 0 ? (
                <option value="">保存済みImpactAnalysisなし</option>
              ) : (
                weeklyImpactAnalyses.map((item) => (
                  <option key={s(item.id)} value={s(item.id)}>
                    {s(item.title) || "Practice消込"} / {statusLabel(item.status)} / {s(item.updatedAt || item.createdAt)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="weekly-week-list-card">
          <div className="overview-card-header">
            <h3>対象週一覧</h3>
            <span className="muted">対象月に属するすべての週案を表示します。クリックした週を下で編集します。</span>
          </div>

          {weeklyWeekSummaries.length === 0 ? (
            <p className="muted">対象週がありません。</p>
          ) : (
            <div className="weekly-week-list">
              {weeklyWeekSummaries.map((week) => {
                const selected = week.option.weekStartDate === selectedWeekStartDate;
                return (
                  <button
                    type="button"
                    key={week.option.weekStartDate}
                    className={`weekly-week-item ${selected ? "weekly-week-item-selected" : ""}`}
                    onClick={() => {
                      setSelectedWeekStartDate(week.option.weekStartDate);
                      setWeeklyAssignments({});
                      setWeeklyExistingPlanId("");
                    }}
                    disabled={weeklyLoading}
                  >
                    <span>
                      <strong>対象週</strong>
                      {week.option.weekStartDate}〜{week.option.weekEndDate}
                    </span>
                    <span>
                      <strong>状態</strong>
                      <span className={`status-pill status-${statusClass(week.savedPlan?.status)}`}>
                        {week.statusLabel}
                      </span>
                    </span>
                    <span>
                      <strong>配置</strong>
                      主活動 {week.primaryCount}件 / 予備 {week.reserveCount}件
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="weekly-policy-card">
          <strong>週案ルール</strong>
          <span>
            1日1件を基本に配置します。2件目は予備Practiceです。週単位のAbility偏りは許容し、月単位のPDCAで調整する前提です。
          </span>
          <span>
            週またがりは、月〜金5日間の過半数が属する月を主所属月にします。
          </span>
        </div>

        {weeklyImpactAnalyses.length === 0 && weeklyPlanId ? (
          <div className="impact-alert-box">
            この月間計画に保存済みのImpactAnalysisがありません。先にインパクト分析でPracticeを選択して保存してください。
          </div>
        ) : null}

        <div className="weekly-two-column">
          <div className="weekly-calendar-card">
            <div className="overview-card-header">
              <h3>曜日別Practice配置</h3>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void loadOverviewPlans();
                  void loadImpactPracticeData();
                  if (weeklyPlanId) void loadWeeklyImpactAnalyses(weeklyPlanId);
                }}
                disabled={weeklyLoading || impactLoading}
              >
                再読み込み
              </button>
            </div>
            <p className="muted">
              主活動は日案へ展開する中心Practice、予備は天候やクラス状況に応じた代替候補です。
            </p>

            {weeklyDays.length === 0 ? (
              <p className="muted">対象週を選択してください。</p>
            ) : weeklyPracticeOptions.length === 0 ? (
              <p className="muted">ImpactAnalysisで選択済みのPracticeがありません。</p>
            ) : (
              <div className="weekly-day-list">
                {weeklyDays.map((day) => {
                  const slot = weeklyAssignments[day.date] ?? {};
                  return (
                    <div className="weekly-day-row" key={day.date}>
                      <div className="weekly-day-label">
                        <strong>{day.dayLabel}</strong>
                        <span>主活動1件 + 予備1件まで</span>
                      </div>

                      <label>
                        <span>主活動</span>
                        <select
                          value={s(slot.primaryPracticeCode)}
                          disabled={weeklySaving}
                          onChange={(event) => updateWeeklyAssignment(day.date, "primaryPracticeCode", event.target.value)}
                        >
                          <option value="">未配置</option>
                          {weeklyPracticeOptions.map((practice) => {
                            const code = s(practice.practice_code);
                            return (
                              <option key={`${day.date}-primary-${code}`} value={code}>
                                {s(practice.name) || code}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <label>
                        <span>予備</span>
                        <select
                          value={s(slot.reservePracticeCode)}
                          disabled={weeklySaving}
                          onChange={(event) => updateWeeklyAssignment(day.date, "reservePracticeCode", event.target.value)}
                        >
                          <option value="">未配置</option>
                          {weeklyPracticeOptions.map((practice) => {
                            const code = s(practice.practice_code);
                            return (
                              <option key={`${day.date}-reserve-${code}`} value={code}>
                                {s(practice.name) || code}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="weekly-side-card">
            <h3>選択済みPractice</h3>
            {weeklyPracticeOptions.length === 0 ? (
              <p className="muted">ImpactAnalysisでPracticeを選択してください。</p>
            ) : (
              <div className="weekly-practice-chip-list">
                {weeklyPracticeOptions.map((practice) => {
                  const code = s(practice.practice_code);
                  const assigned = weeklyAssignedPracticeCodes.includes(code);
                  return (
                    <div className={`weekly-practice-chip ${assigned ? "weekly-practice-chip-assigned" : ""}`} key={code}>
                      <strong>{s(practice.name) || code}</strong>
                      <span>{code}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveWeeklyPlan}
              disabled={weeklySaving || !selectedWeeklyOption || !selectedWeeklyImpact || weeklyPrimaryCount === 0}
            >
              {weeklySaving ? "保存中..." : weeklyExistingPlanId ? "週案を更新" : "週案を保存"}
            </button>

            <p className="muted">
              保存先は PlanDocument / SHORT_TERM / WEEKLY です。日案発行は次フェーズで、この週案から日付ごとに展開します。
            </p>

            <div className="weekly-review-card">
              <div className="weekly-review-status-row">
                <strong>承認ステータス</strong>
                <span className={`status-pill status-${statusClass(weeklyCurrentStatus)}`}>
                  {statusLabel(weeklyCurrentStatus)}
                </span>
              </div>

              <label className="review-comment-label weekly-review-comment-label">
                <span>承認コメント / 差し戻し理由</span>
                <input
                  value={weeklyReviewComment}
                  disabled={weeklySaving || weeklyReviewUpdating || !selectedWeeklyPlanRow?.id}
                  onChange={(event) => setWeeklyReviewComment(event.target.value)}
                  placeholder={`例: 週案確認お願いします。 ※名前は自動で追加されます（${reviewerName}）`}
                />
                <small>記録名: {reviewerName}。保存時に「コメント：{reviewerName}」の形で履歴に残します。</small>
              </label>

              <div className="review-button-row weekly-review-button-row">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={weeklySaving || weeklyReviewUpdating || !weeklyCanSubmit}
                  onClick={() => void updateWeeklyPlanStatus("SUBMITTED")}
                >
                  承認依頼を出す
                </button>
                <button
                  type="button"
                  disabled={weeklySaving || weeklyReviewUpdating || !weeklyCanApprove}
                  onClick={() => void updateWeeklyPlanStatus("APPROVED")}
                >
                  承認する
                </button>
                <button
                  type="button"
                  className="danger-button"
                  disabled={weeklySaving || weeklyReviewUpdating || !weeklyCanApprove}
                  onClick={() => void updateWeeklyPlanStatus("REJECTED")}
                >
                  差し戻す
                </button>
              </div>

              {weeklyCurrentReviewHistory.length > 0 ? (
                <div className="review-message-list weekly-review-message-list">
                  {weeklyCurrentReviewHistory.map((item, index) => (
                    <div key={`weekly-${item.action}-${item.at}-${index}`} className="review-message-item">
                      <span className={`status-pill status-${statusClass(item.action)}`}>
                        {reviewActionLabel(item.action)}
                      </span>
                      <strong>{reviewMessageText(item)}</strong>
                      <small>{formatReviewDate(item.at)}</small>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="muted">
                承認済み週案だけを、次フェーズの日案発行対象にします。編集して保存し直すと下書きに戻ります。
              </p>
            </div>
          </div>
        </div>

        <div className="weekly-comparison-card">
          <h3>月間計画と週案配置のカバレッジ（参考）</h3>
          <p className="muted">
            週割り目標との差分判定は行わず、月間計画から導かれる5領域・10の姿と、保存済み週案＋編集中週案に配置した主活動PracticeのAbility積み上げを並べて表示します。予備Practiceはカバレッジには含めません。
          </p>

          <div className="weekly-coverage-grid">
            <div className="weekly-coverage-card">
              <h4>月間計画：5領域カバレッジ</h4>
              {renderCoverageRows(weeklyMonthlyPlanCoverage.areaRows, "coverage-list compact")}
            </div>

            <div className="weekly-coverage-card">
              <h4>Practice配置済み：5領域カバレッジ</h4>
              {renderCoverageRows(weeklyMonthlyPracticeCoverage.areaRows, "coverage-list compact")}
            </div>

            <div className="weekly-coverage-card">
              <h4>月間計画：10の姿カバレッジ</h4>
              {renderCoverageRows(weeklyMonthlyPlanCoverage.postureRows, "coverage-list posture")}
            </div>

            <div className="weekly-coverage-card">
              <h4>Practice配置済み：10の姿カバレッジ</h4>
              {renderCoverageRows(weeklyMonthlyPracticeCoverage.postureRows, "coverage-list posture")}
            </div>
          </div>

          <div className="weekly-current-week-note">
            <strong>編集中の週の主活動Practice</strong>
            <span>
              5領域リンク {weeklyCurrentWeekPracticeCoverage.linkCount}件 /
              月全体の主活動配置 {weeklyMonthlyAssignedPrimaryPracticeCodes.length}件
            </span>
          </div>
        </div>

      </div>
    );
  }


  function renderDailyObservationHintCard(args: {
    title: string;
    practiceName: string;
    practiceCode: string;
    hints: DailyObservationHintRow[];
    emptyMessage: string;
  }) {
    return (
      <div className="daily-hint-card">
        <div className="overview-card-header">
          <div>
            <h3>{args.title}</h3>
            <span className="muted">
              {args.practiceName || "未配置"}
              {args.practiceCode ? ` / ${args.practiceCode}` : ""}
            </span>
          </div>
          <span className="muted">
            PracticeのAbilityから最大{DAILY_OBSERVATION_HINT_LIMIT}件を表示します。episode1/2/3はそれぞれ別々に選びます。
          </span>
        </div>

        {args.hints.length === 0 ? (
          <p className="muted">{args.emptyMessage}</p>
        ) : (
          <div className="daily-hint-list">
            {args.hints.map((hint, index) => (
              <div
                className="daily-hint-row"
                key={`${args.practiceCode}-${hint.abilityCode}-${hint.postureCode}-${index}`}
              >
                <div className="daily-hint-head">
                  <div>
                    <strong>{hint.abilityCode} {hint.abilityName}</strong>
                    <span>{hint.postureCode} {hint.postureName} / score {hint.score} / {hint.startingAge}歳〜</span>
                  </div>
                </div>

                <div className="daily-episode-grid">
                  <div>
                    <strong>行動・姿勢</strong>
                    <p>{hint.episodes.episode1 || "-"}</p>
                  </div>
                  <div>
                    <strong>言葉</strong>
                    <p>{hint.episodes.episode2 || "-"}</p>
                  </div>
                  <div>
                    <strong>しぐさ・表情</strong>
                    <p>{hint.episodes.episode3 || "-"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }


  function renderDailySection() {
    return (
      <div className="daily-section">
        <div className="daily-summary-card">
          <div>
            <strong>起点</strong>
            <span>承認済み週案</span>
          </div>
          <div>
            <strong>対象日</strong>
            <span>{dailyTargetDate || "未選択"}</span>
          </div>
          <div>
            <strong>主活動</strong>
            <span>{s(selectedDailyDay?.primaryPracticeName) || practiceNameByCode(impactPractices, s(selectedDailyDay?.primaryPracticeCode))}</span>
          </div>
          <div>
            <strong>発行状態</strong>
            <span className={dailyExistingPlanId ? "impact-complete-text" : ""}>
              {dailyLoading ? "確認中..." : dailyExistingPlanId ? `発行済み / ${statusLabel(dailyExistingStatus)}` : "未発行"}
            </span>
          </div>
        </div>

        <div className="daily-selector-card">
          <label>
            <span>承認済み週案</span>
            <select
              value={dailyWeeklyPlanId}
              disabled={dailyLoading || approvedWeeklyPlansForDaily.length === 0}
              onChange={(event) => {
                setDailyWeeklyPlanId(event.target.value);
                setDailyTargetDate("");
                setDailyExistingPlanId("");
                setDailyExistingPlanRow(null);
              }}
            >
              {approvedWeeklyPlansForDaily.length === 0 ? (
                <option value="">承認済み週案なし</option>
              ) : (
                approvedWeeklyPlansForDaily.map((plan) => (
                  <option key={s(plan.id)} value={s(plan.id)}>
                    {s(plan.title) || "週案"} / {s(plan.periodStartDate)}〜{s(plan.periodEndDate)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span>対象日</span>
            <select
              value={dailyTargetDate}
              disabled={dailyLoading || dailyWeekDays.length === 0}
              onChange={(event) => {
                setDailyTargetDate(event.target.value);
                setDailyExistingPlanId("");
                setDailyExistingPlanRow(null);
              }}
            >
              {dailyWeekDays.length === 0 ? (
                <option value="">対象日なし</option>
              ) : (
                dailyWeekDays.map((day) => (
                  <option key={day.date} value={day.date}>
                    {day.dayLabel}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void loadDailyIssueData();
              void loadImpactPracticeData();
            }}
            disabled={dailyLoading || impactLoading}
          >
            再読み込み
          </button>
        </div>

        <div className="daily-policy-card">
          <strong>日案発行ルール</strong>
          <span>
            承認済み週案だけを日案発行対象にします。主活動Practiceと予備Practiceのそれぞれから、別々に「見届けたい子どもの姿」を作成します。
          </span>
          <span>
            AbilityObservationHintは対象年齢以下を使い、scoreが高いAbilityを優先しつつ、同じ10の姿に偏りすぎないようPracticeごとに最大4件へ絞ります。
          </span>
        </div>

        {approvedWeeklyPlansForDaily.length === 0 ? (
          <div className="impact-alert-box">
            承認済み週案がありません。先に週案策定で週案を承認してください。
          </div>
        ) : null}

        {selectedDailyDay && !s(selectedDailyDay.primaryPracticeCode) ? (
          <div className="impact-alert-box">
            この日には主活動Practiceが配置されていません。週案策定で主活動Practiceを配置し、週案を再承認してください。
          </div>
        ) : null}

        {dailyObservationHintRows.length === 0 ? (
          <div className="impact-alert-box">
            AbilityObservationHint が未登録です。CSV seedを実行してください。
          </div>
        ) : null}

        <div className="daily-two-column">
          <div className="daily-preview-card">
            <div className="overview-card-header">
              <h3>日案プレビュー</h3>
              <span className={`status-pill status-${statusClass(dailyExistingStatus)}`}>
                {dailyExistingPlanId ? statusLabel(dailyExistingStatus) : "未発行"}
              </span>
            </div>

            {!selectedDailyWeeklyPlan ? (
              <p className="muted">承認済み週案を選択してください。</p>
            ) : !selectedDailyDay ? (
              <p className="muted">対象日を選択してください。</p>
            ) : (
              <div className="daily-preview-list">
                <div className="daily-preview-item">
                  <strong>日付</strong>
                  <span>{selectedDailyDay.dayLabel}</span>
                </div>
                <div className="daily-preview-item">
                  <strong>主活動Practice</strong>
                  <span>{s(dailyPrimaryPractice?.name) || s(selectedDailyDay.primaryPracticeName) || s(selectedDailyDay.primaryPracticeCode) || "未配置"}</span>
                  {s(selectedDailyDay.primaryPracticeCode) ? <small>{s(selectedDailyDay.primaryPracticeCode)}</small> : null}
                  {dailyPrimaryPractice ? <p>{s(dailyPrimaryPractice.memo) || s(dailyPrimaryPractice.transcriptText) || "説明未登録"}</p> : null}
                </div>
                <div className="daily-preview-item">
                  <strong>予備Practice</strong>
                  <span>{s(dailyReservePractice?.name) || s(selectedDailyDay.reservePracticeName) || s(selectedDailyDay.reservePracticeCode) || "未配置"}</span>
                  {s(selectedDailyDay.reservePracticeCode) ? <small>{s(selectedDailyDay.reservePracticeCode)}</small> : null}
                  {dailyReservePractice ? <p>{s(dailyReservePractice.memo) || s(dailyReservePractice.transcriptText) || "説明未登録"}</p> : null}
                </div>
              </div>
            )}
          </div>

          <div className="daily-issue-card">
            <h3>手動発行</h3>
            <p className="muted">
              同じ日付の日案が既にある場合は、現在の承認済み週案から再生成して上書きします。
            </p>

            <dl className="daily-issue-detail">
              <dt>週案</dt>
              <dd>{selectedDailyWeeklyPlan ? s(selectedDailyWeeklyPlan.title) || s(selectedDailyWeeklyPlan.id) : "-"}</dd>
              <dt>日案ID</dt>
              <dd>{dailyExistingPlanId || "未発行"}</dd>
              <dt>主活動の見届けたい姿</dt>
              <dd>{dailyPrimaryPreviewObservationHints.length}件</dd>
              <dt>予備の見届けたい姿</dt>
              <dd>{s(selectedDailyDay?.reservePracticeCode) ? `${dailyReservePreviewObservationHints.length}件` : "予備未配置"}</dd>
            </dl>

            <button
              type="button"
              onClick={handleIssueDailyPlan}
              disabled={
                dailySaving ||
                dailyLoading ||
                !selectedDailyWeeklyPlan ||
                !selectedDailyDay ||
                !s(selectedDailyDay.primaryPracticeCode)
              }
            >
              {dailySaving ? "発行中..." : dailyExistingPlanId ? "日案を再発行" : "日案を発行"}
            </button>
          </div>
        </div>

        {renderDailyObservationHintCard({
          title: "主活動Practiceの見届けたい子どもの姿",
          practiceName:
            s(dailyPrimaryPractice?.name) ||
            s(selectedDailyDay?.primaryPracticeName) ||
            s(selectedDailyDay?.primaryPracticeCode),
          practiceCode: s(selectedDailyDay?.primaryPracticeCode),
          hints: dailyPrimaryPreviewObservationHints,
          emptyMessage:
            "表示できる具体例がありません。主活動PracticeのAbilityリンク、AbilityObservationHintのseed、対象年齢を確認してください。",
        })}

        {renderDailyObservationHintCard({
          title: "予備Practiceの見届けたい子どもの姿",
          practiceName:
            s(dailyReservePractice?.name) ||
            s(selectedDailyDay?.reservePracticeName) ||
            s(selectedDailyDay?.reservePracticeCode),
          practiceCode: s(selectedDailyDay?.reservePracticeCode),
          hints: dailyReservePreviewObservationHints,
          emptyMessage: s(selectedDailyDay?.reservePracticeCode)
            ? "表示できる具体例がありません。予備PracticeのAbilityリンク、AbilityObservationHintのseed、対象年齢を確認してください。"
            : "この日には予備Practiceが配置されていません。",
        })}
      </div>
    );
  }


  const currentCanSubmit = Boolean(existingPlanId) &&
    ["DRAFT", "REJECTED", ""].includes(s(currentPlanStatus).toUpperCase());
  const currentCanApprove = Boolean(isSchoolScope) && s(currentPlanStatus).toUpperCase() === "SUBMITTED";

  const currentReviewHistory = useMemo(() => {
    const content = safeParsePlanContent(existingPlanRow?.contentJson);
    return displayReviewHistory(planContentReview(content));
  }, [existingPlanRow?.contentJson]);

  return (
    <div className="plan-workspace">
      <div className="plan-workspace-header">
        <div>
          <h2>Plan Workspace</h2>
          <p className="muted">
            長期計画・月間計画のアンカーを、クラス年齢に合うPlanPhrase候補から選択して作成します。
            作成後は中長期計画を俯瞰し、5領域・10の姿の偏りを確認して承認につなげます。
          </p>
        </div>
      </div>

      <div className="plan-view-tabs">
        <button
          type="button"
          onClick={() => setWorkspaceView("edit")}
          disabled={workspaceView === "edit"}
        >
          長期計画作成
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceView("overview");
            void loadOverviewPlans();
          }}
          disabled={workspaceView === "overview"}
        >
          中長期計画俯瞰
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceView("impact");
            void loadOverviewPlans();
            void loadImpactPracticeData();
          }}
          disabled={workspaceView === "impact"}
        >
          インパクト分析
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceView("weekly");
            void loadOverviewPlans();
            void loadImpactPracticeData();
          }}
          disabled={workspaceView === "weekly"}
        >
          週案策定
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceView("daily");
            void loadOverviewPlans();
            void loadImpactPracticeData();
            void loadDailyIssueData();
          }}
          disabled={workspaceView === "daily"}
        >
          日案発行
        </button>
      </div>

      <div className="plan-context-card">
        <div>
          <strong>園</strong>
          <span>{tenantName || tenantId}</span>
        </div>
        <div>
          <strong>年度</strong>
          <span>{fiscalYear}</span>
        </div>
        <div>
          <strong>対象クラス</strong>
          <span>
            {selectedClassroom
              ? `${s(selectedClassroom.name)}（${s(selectedClassroom.ageLabel) || "年齢未設定"}）`
              : "未選択"}
          </span>
        </div>
        <div>
          <strong>対象年齢</strong>
          <span>{selectedAgeYears ? `${selectedAgeYears}歳` : "未判定"}</span>
        </div>
      </div>

      <div className="plan-control-grid">
        <label>
          <span>クラス</span>
          <select
            value={selectedClassroomId}
            disabled={loading || classroomSelectionLocked}
            onChange={(event) => setSelectedClassroomId(event.target.value)}
          >
            {classrooms.length === 0 ? (
              <option value="">対象クラスなし</option>
            ) : (
              classrooms.map((classroom) => (
                <option key={s(classroom.id)} value={s(classroom.id)}>
                  {s(classroom.name)}（{s(classroom.ageLabel) || "年齢未設定"}）
                </option>
              ))
            )}
          </select>
        </label>

        {workspaceView === "edit" ? (
          <>
            <label>
              <span>計画種別</span>
              <select
                value={periodType}
                disabled={loading}
                onChange={(event) => {
                  setPeriodType(event.target.value as PlanPeriodType);
                  setSelectedPhraseIds([]);
                }}
              >
                {PLAN_PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {periodType === "MONTH" ? (
              <label>
                <span>対象月</span>
                <input
                  type="month"
                  value={selectedMonth}
                  disabled={loading}
                  onChange={(event) => {
                    setSelectedMonth(event.target.value);
                    setSelectedPhraseIds([]);
                  }}
                />
              </label>
            ) : null}

            {periodType === "TERM" ? (
              <label>
                <span>対象期</span>
                <select
                  value={selectedTerm}
                  disabled={loading}
                  onChange={(event) => {
                    setSelectedTerm(event.target.value as TermKey);
                    setSelectedPhraseIds([]);
                  }}
                >
                  {TERM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span>領域</span>
              <select
                value={selectedDomainCode}
                disabled={loading || domainOptions.length === 0}
                onChange={(event) => {
                  setSelectedDomainCode(event.target.value);
                }}
              >
                {domainOptions.length === 0 ? (
                  <option value="">候補なし</option>
                ) : (
                  domainOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          </>
        ) : (
          <div className="plan-control-note">
            {workspaceView === "overview"
              ? "年間・期・月間計画の保存済みPlanDocumentをまとめて集計します。"
              : workspaceView === "impact"
                ? "承認済み月間計画から必要Abilityを取り出し、Practice選択で消し込みます。"
                : workspaceView === "weekly"
                  ? "ImpactAnalysisで選択したPracticeを曜日へ配置し、週案ドラフトを作成・承認します。"
                  : "承認済み週案から日案を手動発行し、見届けたい子どもの姿を作成します。"}
          </div>
        )}
      </div>

      {error ? <pre className="error-box">{error}</pre> : null}
      {message ? <pre className="success-box">{message}</pre> : null}

      {workspaceView === "edit" ? (
        <>
          <div className="plan-summary-row">
            <div>
              <strong>対象期間</strong>
              <span>
                {selectedPeriodRange.label}（{selectedPeriodRange.startDate}〜
                {selectedPeriodRange.endDate}）
              </span>
            </div>
            <div>
              <strong>保存状態</strong>
              <span>
                {loadingPlan
                  ? "確認中..."
                  : existingPlanId
                    ? `${statusLabel(currentPlanStatus)}: ${existingPlanId}`
                    : "未保存"}
              </span>
            </div>
            <div>
              <strong>候補</strong>
              <span>
                {visiblePhrases.length}件 / 選択 {selectedPhraseIds.length}件
                {periodType === "TERM" ? ` / ${termPhraseType}` : ""}
              </span>
            </div>
            <div>
              <strong>選択文例リンク</strong>
              <span>{selectedPlanCoverage.linkCount}件</span>
            </div>
          </div>

          <div className="current-plan-review-card">
            <div>
              <strong>承認ステータス</strong>
              <span className={`status-pill status-${statusClass(currentPlanStatus)}`}>
                {statusLabel(currentPlanStatus)}
              </span>
            </div>
            <label className="review-comment-label">
              <span>承認コメント / 差し戻し理由</span>
              <input
                value={reviewComment}
                disabled={saving || reviewUpdating || !existingPlanId}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder={`例: 承認お願いします。 ※名前は自動で追加されます（${reviewerName}）`}
              />
              <small>記録名: {reviewerName}。保存時に「コメント：{reviewerName}」の形で履歴に残します。</small>
            </label>
            <div className="review-button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={saving || reviewUpdating || !currentCanSubmit}
                onClick={() => void updateCurrentPlanStatus("SUBMITTED")}
              >
                承認依頼を出す
              </button>
              <button
                type="button"
                disabled={saving || reviewUpdating || !currentCanApprove}
                onClick={() => void updateCurrentPlanStatus("APPROVED")}
              >
                承認する
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={saving || reviewUpdating || !currentCanApprove}
                onClick={() => void updateCurrentPlanStatus("REJECTED")}
              >
                差し戻す
              </button>
            </div>
            {currentReviewHistory.length > 0 ? (
              <div className="review-message-list">
                {currentReviewHistory.map((item, index) => (
                  <div key={`${item.action}-${item.at}-${index}`} className="review-message-item">
                    <span className={`status-pill status-${statusClass(item.action)}`}>
                      {reviewActionLabel(item.action)}
                    </span>
                    <strong>{reviewMessageText(item)}</strong>
                    <small>{formatReviewDate(item.at)}</small>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="muted">
              担任は保存後に承認依頼を出します。園全体スコープのユーザーは、承認依頼中の計画を承認または差し戻しできます。
            </p>
          </div>

          <div className="plan-two-column">
            <div className="phrase-list-card">
              <div className="phrase-list-header">
                <h3>PlanPhrase候補</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void loadInitialData()}
                  disabled={loading || saving}
                >
                  再読み込み
                </button>
              </div>

              {loading ? (
                <p className="muted">読み込み中...</p>
              ) : !selectedAgeYears ? (
                <p className="muted">
                  選択中クラスの年齢を判定できません。Classroom.ageLabelを確認してください。
                </p>
              ) : visiblePhrases.length === 0 ? (
                <p className="muted">条件に合う文例候補がありません。</p>
              ) : (
                <div className="phrase-list">
                  {visiblePhrases.map((phrase) => {
                    const planPhraseId = s(phrase.planPhraseId);
                    const checked = selectedPhraseIds.includes(planPhraseId);
                    const abilityLabels = abilityLabelsForPhrase(
                      linksByPhraseId,
                      planPhraseId,
                    );

                    return (
                      <label
                        key={planPhraseId}
                        className={`phrase-card ${checked ? "phrase-card-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={(event) =>
                            togglePhrase(planPhraseId, event.target.checked)
                          }
                        />

                        <div>
                          <div className="phrase-card-meta">
                            <span>{s(phrase.domain)}</span>
                            <span>{s(phrase.phraseType)}</span>
                            <span>{s(phrase.planPhraseId)}</span>
                          </div>
                          <div className="phrase-card-text">{s(phrase.phraseText)}</div>
                          {abilityLabels.length > 0 ? (
                            <div className="phrase-ability-tags">
                              {abilityLabels.map((label) => (
                                <span key={`${planPhraseId}-${label}`}>{label}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="selected-plan-card">
              <h3>選択中の計画アンカー</h3>
              <p className="muted">
                ここで選んだ文例をPlanDocumentに保存します。次フェーズでは、この内容をインパクト分析と週案作成の参照元にします。
              </p>

              <div className="selected-phrase-list">
                {selectedPhrases.length === 0 ? (
                  <p className="muted">まだ文例が選択されていません。</p>
                ) : (
                  selectedPhrases.map((phrase) => (
                    <div className="selected-phrase-item" key={s(phrase.planPhraseId)}>
                      <strong>{s(phrase.domain)}</strong>
                      <p>{s(phrase.phraseText)}</p>
                      <small>{s(phrase.planPhraseId)}</small>
                    </div>
                  ))
                )}
              </div>

              <div className="mini-coverage-card">
                <h4>選択中文例の5領域</h4>
                {renderCoverageRows(selectedPlanCoverage.areaRows, "coverage-list compact")}
              </div>

              <label className="plan-memo-label">
                <span>メモ</span>
                <textarea
                  value={memo}
                  disabled={saving}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="この月・期・年度の計画意図、園やクラスの状況、次のインパクト分析で見たい観点などをメモできます。"
                />
              </label>

              <button
                type="button"
                onClick={handleSavePlanDocument}
                disabled={
                  saving ||
                  loading ||
                  loadingPlan ||
                  !selectedClassroomId ||
                  selectedPhraseIds.length === 0
                }
              >
                {saving ? "保存中..." : "計画アンカーを保存"}
              </button>
            </div>
          </div>
        </>
      ) : workspaceView === "overview" ? (
        <div className="plan-overview-section">
          <div className="plan-summary-row">
            <div>
              <strong>保存済み計画</strong>
              <span>{overviewLoading ? "読み込み中..." : `${overviewItems.length}件`}</span>
            </div>
            <div>
              <strong>選択文例</strong>
              <span>{overviewPhraseIds.length}件</span>
            </div>
            <div>
              <strong>Abilityリンク</strong>
              <span>{overviewCoverage.linkCount}件</span>
            </div>
            <div>
              <strong>ShortTermへ進める月計画</strong>
              <span>{approvedMonthlyCount}件</span>
            </div>
          </div>

          <div className="overview-grid">
            <div className="overview-card">
              <div className="overview-card-header">
                <h3>5領域カバレッジ</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void loadOverviewPlans()}
                  disabled={overviewLoading}
                >
                  再読み込み
                </button>
              </div>
              <p className="muted">
                保存済みの年間・期・月間計画で選択されたPlanPhraseを集計しています。
              </p>
              {renderCoverageRows(overviewCoverage.areaRows, "coverage-list")}
            </div>

            <div className="overview-card">
              <h3>10の姿カバレッジ</h3>
              <p className="muted">
                保育360のAbilityCode体系では同名でも領域違いのコードを別々に扱います。
              </p>
              {renderCoverageRows(overviewCoverage.postureRows, "coverage-list posture")}
            </div>
          </div>

          <div className="overview-card">
            <h3>中長期計画一覧</h3>
            {overviewItems.length === 0 ? (
              <p className="muted">このクラスの中長期計画はまだ保存されていません。</p>
            ) : (
              <div className="plan-doc-list">
                {overviewItems.map((item) => {
                  const review = planContentReview(item.content);
                  const itemPhrases = item.selectedPhraseIds
                    .map((id) => phraseById.get(id))
                    .filter((phrase): phrase is PlanPhraseRow => Boolean(phrase));

                  return (
                    <div className="plan-doc-card" key={s(item.plan.id)}>
                      <div className="plan-doc-head">
                        <div>
                          <strong>{s(item.plan.title) || planKindLabel(item.plan.planKind)}</strong>
                          <span>
                            {planKindLabel(item.plan.planKind)} / {s(item.plan.periodStartDate)}〜{s(item.plan.periodEndDate)}
                          </span>
                        </div>
                        <span className={`status-pill status-${statusClass(item.plan.status)}`}>
                          {statusLabel(item.plan.status)}
                        </span>
                      </div>
                      <div className="plan-doc-phrases">
                        {itemPhrases.length === 0 ? (
                          <p className="muted">文例情報を取得できません。</p>
                        ) : (
                          itemPhrases.slice(0, 8).map((phrase) => (
                            <div key={`${s(item.plan.id)}-${s(phrase.planPhraseId)}`}>
                              <strong>{s(phrase.domain)}</strong>
                              <span>{s(phrase.phraseText)}</span>
                            </div>
                          ))
                        )}
                        {itemPhrases.length > 8 ? (
                          <p className="muted">他 {itemPhrases.length - 8}件</p>
                        ) : null}
                      </div>
                      {displayReviewHistory(review).length > 0 ? (
                        <div className="review-history">
                          {displayReviewHistory(review).map((item, index) => (
                            <span key={`${item.action}-${item.at}-${index}`}>
                              {reviewActionLabel(item.action)}: {reviewMessageText(item)} / {formatReviewDate(item.at)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : workspaceView === "impact" ? (
        renderImpactSection()
      ) : workspaceView === "weekly" ? (
        renderWeeklySection()
      ) : (
        renderDailySection()
      )}
    </div>
  );
}
