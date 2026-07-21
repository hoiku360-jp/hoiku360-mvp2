import { monthContexts } from "./reportPeriod";
import type {
  AbilityCodeRow,
  PlanAnchorPhraseSummary,
  PlanAnchorSummary,
  PlanDistributionSummary,
  PlanDocumentRow,
  PlanMonthStatusSummary,
  PlanPhraseRow,
  PlanReportSummary,
  ReportAggregationContext,
  ObservationReportSourceData,
} from "./types";

const DOMAIN_ORDER = ["健康", "人間関係", "環境", "言葉", "表現"];

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function upper(value: unknown): string {
  return s(value).toUpperCase();
}

function activeLike(value: unknown): boolean {
  const status = upper(value);
  return !status || status === "ACTIVE";
}

function parseContent(value: unknown): Record<string, unknown> {
  const text = s(value);
  if (!text) return {};

  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function selectedPhraseIds(row: PlanDocumentRow): string[] {
  const content = parseContent(row.contentJson);
  const ids = content.selectedPhraseIds;
  if (!Array.isArray(ids)) return [];

  return ids
    .map((item) => s(item))
    .filter(Boolean)
    .filter((id, index, rows) => rows.indexOf(id) === index);
}

function overlaps(
  row: Pick<PlanDocumentRow, "periodStartDate" | "periodEndDate">,
  context: ReportAggregationContext,
): boolean {
  const start = s(row.periodStartDate);
  const end = s(row.periodEndDate);
  return Boolean(start && end && start <= context.periodEnd && end >= context.periodStart);
}

function newest(rows: PlanDocumentRow[]): PlanDocumentRow | null {
  return [...rows].sort((a, b) =>
    s(b.updatedAt || b.createdAt).localeCompare(s(a.updatedAt || a.createdAt)),
  )[0] ?? null;
}

function exactPeriodPlan(
  rows: PlanDocumentRow[],
  planKind: string,
  start: string,
  end: string,
): PlanDocumentRow | null {
  return newest(rows.filter((row) =>
    upper(row.planKind) === planKind &&
    s(row.periodStartDate) === start &&
    s(row.periodEndDate) === end &&
    upper(row.status) !== "ARCHIVED",
  ));
}

function monthKey(value: unknown): string {
  const text = s(value);
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
}

function monthLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[1])}年${Number(match[2])}月`;
}

function planPhraseMap(rows: PlanPhraseRow[]): Map<string, PlanPhraseRow> {
  return new Map(
    rows
      .filter((row) => activeLike(row.status))
      .map((row) => [s(row.planPhraseId), row] as const)
      .filter(([id]) => Boolean(id)),
  );
}

function abilityMap(rows: AbilityCodeRow[]): Map<string, AbilityCodeRow> {
  return new Map(
    rows
      .filter((row) => activeLike(row.status))
      .map((row) => [s(row.code) || s(row.id), row] as const)
      .filter(([code]) => Boolean(code)),
  );
}

function phrasesFromContent(
  row: PlanDocumentRow,
  master: Map<string, PlanPhraseRow>,
): PlanAnchorPhraseSummary[] {
  const content = parseContent(row.contentJson);
  const snapshots = content.selectedPhrases;

  if (Array.isArray(snapshots)) {
    const parsed = snapshots
      .map((item): PlanAnchorPhraseSummary | null => {
        if (typeof item !== "object" || item === null) return null;
        const record = item as Record<string, unknown>;
        const text = s(record.phraseText);
        if (!text) return null;
        return {
          planPhraseId: s(record.planPhraseId),
          phraseType: s(record.phraseType),
          phraseText: text,
        };
      })
      .filter((item): item is PlanAnchorPhraseSummary => Boolean(item));

    if (parsed.length > 0) return parsed;
  }

  return selectedPhraseIds(row)
    .map((id) => master.get(id))
    .filter((phrase): phrase is PlanPhraseRow => Boolean(phrase))
    .map((phrase) => ({
      planPhraseId: s(phrase.planPhraseId),
      phraseType: s(phrase.phraseType),
      phraseText: s(phrase.phraseText),
    }));
}

function anchorSummary(
  row: PlanDocumentRow,
  master: Map<string, PlanPhraseRow>,
): PlanAnchorSummary {
  const content = parseContent(row.contentJson);
  return {
    planId: s(row.id),
    planKind: upper(row.planKind),
    title: s(row.title) || `${s(row.periodStartDate)}〜${s(row.periodEndDate)}`,
    status: upper(row.status),
    periodStart: s(row.periodStartDate),
    periodEnd: s(row.periodEndDate),
    memo: s(content.memo),
    phrases: phrasesFromContent(row, master),
  };
}

function anchorPlans(
  context: ReportAggregationContext,
  rows: PlanDocumentRow[],
): PlanDocumentRow[] {
  if (context.periodType === "MONTH") {
    const plan = exactPeriodPlan(
      rows,
      "MONTHLY",
      context.periodStart,
      context.periodEnd,
    );
    return plan ? [plan] : [];
  }

  if (context.periodType === "TERM") {
    const term = exactPeriodPlan(rows, "TERM", context.periodStart, context.periodEnd);
    const monthly = monthContexts(context)
      .map((month) => exactPeriodPlan(
        rows,
        "MONTHLY",
        month.periodStart,
        month.periodEnd,
      ))
      .filter((row): row is PlanDocumentRow => Boolean(row));
    return [...(term ? [term] : []), ...monthly];
  }

  if (context.periodType === "YEAR") {
    const annual = exactPeriodPlan(rows, "ANNUAL", context.periodStart, context.periodEnd);
    const terms = rows
      .filter((row) =>
        upper(row.planKind) === "TERM" &&
        upper(row.status) !== "ARCHIVED" &&
        overlaps(row, context),
      )
      .sort((a, b) => s(a.periodStartDate).localeCompare(s(b.periodStartDate)));
    return [...(annual ? [annual] : []), ...terms];
  }

  return [];
}

export function aggregatePlanReport(
  context: ReportAggregationContext,
  source: ObservationReportSourceData,
): PlanReportSummary {
  const warnings: string[] = [];
  const phraseById = planPhraseMap(source.planPhrases);
  const abilityByCode = abilityMap(source.abilityCodes);

  const longTermPlans = source.planDocuments
    .filter((row) => s(row.tenantId) === context.tenantId)
    .filter((row) => s(row.classroomId) === s(context.classroomId))
    .filter((row) => row.fiscalYear == null || n(row.fiscalYear) === context.fiscalYear)
    .filter((row) => upper(row.planLevel) === "LONG_TERM")
    .filter((row) => upper(row.status) !== "ARCHIVED");

  const monthRows = monthContexts(context);
  const monthStatuses: PlanMonthStatusSummary[] = monthRows.map((month) => {
    const plan = exactPeriodPlan(
      longTermPlans,
      "MONTHLY",
      month.periodStart,
      month.periodEnd,
    );

    return {
      monthKey: monthKey(month.periodStart),
      label: monthLabel(monthKey(month.periodStart)),
      planId: s(plan?.id),
      status: upper(plan?.status) || "NOT_CREATED",
      approved: upper(plan?.status) === "APPROVED",
      phraseCount: plan ? selectedPhraseIds(plan).length : 0,
    };
  });

  const approvedMonthlyPlans = monthRows
    .map((month) => exactPeriodPlan(
      longTermPlans,
      "MONTHLY",
      month.periodStart,
      month.periodEnd,
    ))
    .filter((row): row is PlanDocumentRow => Boolean(row))
    .filter((row) => upper(row.status) === "APPROVED");

  const domainAcc = new Map<string, { score: number; count: number }>();
  for (const domain of DOMAIN_ORDER) {
    domainAcc.set(domain, { score: 0, count: 0 });
  }

  const postureLabels = source.abilityCodes
    .filter((row) => activeLike(row.status))
    .filter((row) => row.is_leaf === true || n(row.level) === 3)
    .map((row) => s(row.category))
    .filter(Boolean)
    .filter((label, index, rows) => rows.indexOf(label) === index);
  const postureAcc = new Map<string, { score: number; count: number }>();
  for (const posture of postureLabels) {
    postureAcc.set(posture, { score: 0, count: 0 });
  }

  let planLinkCount = 0;

  for (const plan of approvedMonthlyPlans) {
    const ids = new Set(selectedPhraseIds(plan));

    for (const link of source.planPhraseAbilityLinks) {
      if (!activeLike(link.status)) continue;
      if (!ids.has(s(link.planPhraseId))) continue;

      const ability = abilityByCode.get(s(link.abilityCode));
      const domain = s(link.abilityDomain) || s(ability?.domain) || "未分類";
      const posture = s(link.categoryName) || s(ability?.category) || "未分類";
      const weight = Math.max(1, n(link.weight, 1));

      const domainRow = domainAcc.get(domain) ?? { score: 0, count: 0 };
      domainRow.score += weight;
      domainRow.count += 1;
      domainAcc.set(domain, domainRow);

      const postureRow = postureAcc.get(posture) ?? { score: 0, count: 0 };
      postureRow.score += weight;
      postureRow.count += 1;
      postureAcc.set(posture, postureRow);

      planLinkCount += 1;
    }
  }

  const domains: PlanDistributionSummary[] = [...domainAcc.entries()].map(
    ([key, row]) => ({
      key,
      label: key,
      planScore: row.score,
      phraseLinkCount: row.count,
    }),
  );

  const postures: PlanDistributionSummary[] = [...postureAcc.entries()].map(
    ([key, row]) => ({
      key,
      label: key,
      planScore: row.score,
      phraseLinkCount: row.count,
    }),
  );

  const missingMonthKeys = monthStatuses
    .filter((row) => !row.approved)
    .map((row) => row.monthKey);

  if (context.periodType !== "WEEK" && missingMonthKeys.length > 0) {
    warnings.push(
      `承認済み月間計画がない月: ${missingMonthKeys.map(monthLabel).join("、")}`,
    );
  }

  if (approvedMonthlyPlans.length > 0 && planLinkCount === 0) {
    warnings.push("承認済み月間計画はありますが、PlanPhraseAbilityLinkを集計できませんでした。");
  }

  return {
    context,
    anchors: anchorPlans(context, longTermPlans).map((row) =>
      anchorSummary(row, phraseById),
    ),
    monthStatuses,
    requiredMonthCount: monthStatuses.length,
    approvedMonthlyCount: monthStatuses.filter((row) => row.approved).length,
    missingMonthKeys,
    planLinkCount,
    domains,
    postures,
    warnings,
  };
}
