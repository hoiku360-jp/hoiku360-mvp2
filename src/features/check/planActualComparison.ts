import { aggregateObservationReport } from "./observationAggregation";
import { aggregatePlanReport } from "./planAggregation";
import { monthContexts } from "./reportPeriod";
import type {
  DistributionSummary,
  MonthlyTrendSummary,
  ObservationReportSourceData,
  PlanActualComparisonRow,
  PlanActualComparisonStatus,
  PlanActualComparisonSummary,
  PlanDistributionSummary,
  ReportAggregationContext,
} from "./types";

const DOMAIN_ORDER = ["健康", "人間関係", "環境", "言葉", "表現"];

function comparisonStatus(
  gapPoints: number,
  hasPlan: boolean,
): PlanActualComparisonStatus {
  if (!hasPlan) return "NO_PLAN";
  if (gapPoints <= -5) return "UNDER";
  if (gapPoints >= 5) return "OVER";
  return "BALANCED";
}

export function comparePlanActual(
  planRows: PlanDistributionSummary[],
  actualRows: DistributionSummary[],
  preferredOrder?: string[],
): PlanActualComparisonSummary {
  const planByKey = new Map(planRows.map((row) => [row.key, row] as const));
  const actualByKey = new Map(actualRows.map((row) => [row.key, row] as const));
  const keys = Array.from(new Set([
    ...(preferredOrder ?? []),
    ...planRows.map((row) => row.key),
    ...actualRows.map((row) => row.key),
  ]));

  const planTotal = planRows.reduce((sum, row) => sum + row.planScore, 0);
  const actualTotal = actualRows.reduce((sum, row) => sum + row.observationCount, 0);

  const rows: PlanActualComparisonRow[] = keys.map((key) => {
    const plan = planByKey.get(key);
    const actual = actualByKey.get(key);
    const planScore = plan?.planScore ?? 0;
    const actualCount = actual?.observationCount ?? 0;
    const planShare = planTotal > 0 ? planScore / planTotal : 0;
    const actualShare = actualTotal > 0 ? actualCount / actualTotal : 0;
    const gapPoints = (actualShare - planShare) * 100;

    return {
      key,
      label: plan?.label || actual?.label || key,
      planScore,
      actualCount,
      planShare,
      actualShare,
      gapPoints,
      status: comparisonStatus(gapPoints, planTotal > 0),
    };
  });

  return {
    planTotal,
    actualTotal,
    rows,
    underRows: rows
      .filter((row) => row.status === "UNDER")
      .sort((a, b) => a.gapPoints - b.gapPoints),
    overRows: rows
      .filter((row) => row.status === "OVER")
      .sort((a, b) => b.gapPoints - a.gapPoints),
  };
}

export function compareDomains(
  planRows: PlanDistributionSummary[],
  actualRows: DistributionSummary[],
): PlanActualComparisonSummary {
  return comparePlanActual(planRows, actualRows, DOMAIN_ORDER);
}

export function buildMonthlyTrendSummaries(
  context: ReportAggregationContext,
  source: ObservationReportSourceData,
): MonthlyTrendSummary[] {
  if (context.periodType !== "TERM" && context.periodType !== "YEAR") {
    return [];
  }

  return monthContexts(context).map((monthContext) => {
    const actual = aggregateObservationReport(monthContext, source);
    const plan = aggregatePlanReport(monthContext, source);
    return {
      monthKey: monthContext.periodStart.slice(0, 7),
      label: `${Number(monthContext.periodStart.slice(0, 4))}年${Number(monthContext.periodStart.slice(5, 7))}月`,
      context: monthContext,
      planApproved: plan.approvedMonthlyCount === 1,
      observationCount: actual.observationCount,
      abilityLinkCount: actual.abilityLinkCount,
      domainComparison: compareDomains(plan.domains, actual.domains),
    };
  });
}
