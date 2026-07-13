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

type PlanPeriodType = "YEAR" | "TERM" | "MONTH";
type TermKey = "Q1" | "Q2" | "Q3" | "Q4";
type WorkspaceView = "edit" | "overview" | "impact";

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
    default:
      return status || "未保存";
  }
}

function statusClass(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "APPROVED") return "approved";
  if (status === "SUBMITTED") return "submitted";
  if (status === "REJECTED") return "rejected";
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
              : "承認済み月間計画から必要Abilityを取り出し、Practice選択で消し込みます。"}
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
      ) : (
        renderImpactSection()
      )}
    </div>
  );
}
