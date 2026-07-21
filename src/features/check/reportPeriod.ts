import type {
  ReportAggregationContext,
  ReportPeriodType,
  ReportProgressSummary,
} from "./types";

function parseDateOnly(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`日付形式が不正です: ${value}`);
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDateOnly(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function addDateOnlyDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

function addDateOnlyMonths(value: string, months: number): string {
  const date = parseDateOnly(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return formatDateOnly(date);
}

export function todayJstDateOnly(now = new Date()): string {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function mondayOfWeek(value: string): string {
  const date = parseDateOnly(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return formatDateOnly(date);
}

function monthRange(value: string): { start: string; end: string } {
  const date = parseDateOnly(value);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

function fiscalYearRange(fiscalYear: number): { start: string; end: string } {
  return {
    start: `${fiscalYear}-04-01`,
    end: `${fiscalYear + 1}-03-31`,
  };
}

export function fiscalTermForDate(
  value: string,
  fiscalYear: number,
): { termNo: number; start: string; end: string; label: string } {
  const date = parseDateOnly(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (year === fiscalYear && month >= 4 && month <= 6) {
    return { termNo: 1, start: `${fiscalYear}-04-01`, end: `${fiscalYear}-06-30`, label: "第1期（4〜6月）" };
  }
  if (year === fiscalYear && month >= 7 && month <= 9) {
    return { termNo: 2, start: `${fiscalYear}-07-01`, end: `${fiscalYear}-09-30`, label: "第2期（7〜9月）" };
  }
  if (year === fiscalYear && month >= 10 && month <= 12) {
    return { termNo: 3, start: `${fiscalYear}-10-01`, end: `${fiscalYear}-12-31`, label: "第3期（10〜12月）" };
  }
  if (year === fiscalYear + 1 && month >= 1 && month <= 3) {
    const endDay = new Date(Date.UTC(fiscalYear + 1, 3, 0)).getUTCDate();
    return {
      termNo: 4,
      start: `${fiscalYear + 1}-01-01`,
      end: `${fiscalYear + 1}-03-${String(endDay).padStart(2, "0")}`,
      label: "第4期（1〜3月）",
    };
  }

  return { termNo: 1, start: `${fiscalYear}-04-01`, end: `${fiscalYear}-06-30`, label: "第1期（4〜6月）" };
}

export function createReportContext(input: {
  periodType: ReportPeriodType;
  anchorDate: string;
  tenantId: string;
  fiscalYear: number;
  classroomId: string;
  childId?: string;
}): ReportAggregationContext {
  let periodStart = "";
  let periodEnd = "";

  if (input.periodType === "WEEK") {
    periodStart = mondayOfWeek(input.anchorDate);
    periodEnd = addDateOnlyDays(periodStart, 6);
  } else if (input.periodType === "MONTH") {
    const range = monthRange(input.anchorDate);
    periodStart = range.start;
    periodEnd = range.end;
  } else if (input.periodType === "TERM") {
    const term = fiscalTermForDate(input.anchorDate, input.fiscalYear);
    periodStart = term.start;
    periodEnd = term.end;
  } else if (input.periodType === "YEAR") {
    const range = fiscalYearRange(input.fiscalYear);
    periodStart = range.start;
    periodEnd = range.end;
  } else {
    throw new Error("CUSTOM期間は createCustomReportContext で作成してください。");
  }

  return {
    periodType: input.periodType,
    scopeType: input.childId ? "CHILD" : "CLASS",
    periodStart,
    periodEnd,
    tenantId: input.tenantId,
    fiscalYear: input.fiscalYear,
    classroomId: input.classroomId,
    childId: input.childId,
  };
}



export function createCustomReportContext(input: {
  periodStart: string;
  periodEnd: string;
  tenantId: string;
  fiscalYear: number;
  classroomId: string;
  childId?: string;
}): ReportAggregationContext {
  parseDateOnly(input.periodStart);
  parseDateOnly(input.periodEnd);
  if (input.periodStart > input.periodEnd) {
    throw new Error("期間の開始日は終了日以前にしてください。");
  }

  return {
    periodType: "CUSTOM",
    scopeType: input.childId ? "CHILD" : "CLASS",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    tenantId: input.tenantId,
    fiscalYear: input.fiscalYear,
    classroomId: input.classroomId,
    childId: input.childId,
  };
}

export function createDefaultChildProgressPeriods(
  asOfDate = todayJstDateOnly(),
): {
  currentStart: string;
  currentEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
} {
  const currentEnd = asOfDate;
  const currentStart = addDateOnlyDays(currentEnd, -29);
  const comparisonEnd = addDateOnlyDays(currentStart, -1);
  const comparisonStart = addDateOnlyDays(comparisonEnd, -29);
  return { currentStart, currentEnd, comparisonStart, comparisonEnd };
}

export function createWeekContext(input: {
  anchorDate: string;
  tenantId: string;
  fiscalYear: number;
  classroomId: string;
  childId?: string;
}): ReportAggregationContext {
  return createReportContext({ ...input, periodType: "WEEK" });
}

export function shiftReportAnchor(
  anchorDate: string,
  periodType: ReportPeriodType,
  delta: number,
): string {
  if (periodType === "WEEK") return addDateOnlyDays(anchorDate, delta * 7);
  if (periodType === "MONTH") return addDateOnlyMonths(anchorDate, delta);
  if (periodType === "TERM") return addDateOnlyMonths(anchorDate, delta * 3);
  return anchorDate;
}

export function anchorForFiscalTerm(fiscalYear: number, termNo: number): string {
  if (termNo === 2) return `${fiscalYear}-07-01`;
  if (termNo === 3) return `${fiscalYear}-10-01`;
  if (termNo === 4) return `${fiscalYear + 1}-01-01`;
  return `${fiscalYear}-04-01`;
}

export function monthContexts(
  context: ReportAggregationContext,
): ReportAggregationContext[] {
  if (context.periodType === "WEEK") return [];

  const rows: ReportAggregationContext[] = [];
  let cursor = monthRange(context.periodStart).start;

  while (cursor <= context.periodEnd) {
    const range = monthRange(cursor);
    rows.push({
      ...context,
      periodType: "MONTH",
      periodStart: range.start,
      periodEnd: range.end,
    });
    cursor = addDateOnlyMonths(cursor, 1);
  }

  return rows;
}

export function inclusiveDayCount(start: string, end: string): number {
  return Math.max(0, Math.round(
    (parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / 86400000,
  ) + 1);
}

function monthWeekUnits(context: ReportAggregationContext): Array<{ start: string; end: string }> {
  const first = parseDateOnly(context.periodStart);
  const firstMonday = parseDateOnly(mondayOfWeek(context.periodStart));
  const rows: Array<{ start: string; end: string }> = [];

  for (
    let cursor = firstMonday;
    cursor <= parseDateOnly(context.periodEnd);
    cursor = new Date(cursor.getTime() + 7 * 86400000)
  ) {
    let inMonthWeekdays = 0;
    for (let day = 0; day < 5; day += 1) {
      const candidate = new Date(cursor.getTime() + day * 86400000);
      if (
        candidate.getUTCFullYear() === first.getUTCFullYear() &&
        candidate.getUTCMonth() === first.getUTCMonth()
      ) {
        inMonthWeekdays += 1;
      }
    }

    if (inMonthWeekdays >= 3) {
      rows.push({
        start: formatDateOnly(cursor),
        end: formatDateOnly(new Date(cursor.getTime() + 4 * 86400000)),
      });
    }
  }

  return rows;
}

export function buildReportProgress(
  context: ReportAggregationContext,
  asOfDate = todayJstDateOnly(),
): ReportProgressSummary {
  const totalDays = inclusiveDayCount(context.periodStart, context.periodEnd);
  let elapsedDays = 0;

  if (asOfDate >= context.periodStart) {
    const capped = asOfDate > context.periodEnd ? context.periodEnd : asOfDate;
    elapsedDays = inclusiveDayCount(context.periodStart, capped);
  }

  let completedUnits = elapsedDays;
  let totalUnits = totalDays;
  let unitLabel = "日";

  if (context.periodType === "MONTH") {
    const weeks = monthWeekUnits(context);
    totalUnits = weeks.length;
    completedUnits = weeks.filter((week) => week.end <= asOfDate).length;
    unitLabel = "週";
  } else if (context.periodType === "TERM" || context.periodType === "YEAR") {
    const months = monthContexts(context);
    totalUnits = months.length;
    completedUnits = months.filter((month) => month.periodEnd <= asOfDate).length;
    unitLabel = "か月";
  }

  return {
    asOfDate,
    elapsedDays,
    totalDays,
    percentage: totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0,
    completedUnits,
    totalUnits,
    unitLabel,
  };
}

export function formatDateLabel(value: string, includeYear = true): string {
  const date = parseDateOnly(value);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "UTC",
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatPeriodLabel(context: ReportAggregationContext): string {
  if (context.periodType === "MONTH") {
    const date = parseDateOnly(context.periodStart);
    return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
  }
  if (context.periodType === "TERM") {
    const term = fiscalTermForDate(context.periodStart, context.fiscalYear);
    return `${context.fiscalYear}年度 ${term.label}`;
  }
  if (context.periodType === "YEAR") {
    return `${context.fiscalYear}年度（${context.periodStart}〜${context.periodEnd}）`;
  }
  return `${formatDateLabel(context.periodStart)} ～ ${formatDateLabel(context.periodEnd)}`;
}
