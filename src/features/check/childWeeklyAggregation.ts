import { addDateOnlyDays } from "./reportPeriod";
import type {
  AbilityCodeRow,
  AbilitySummary,
  ChildWeeklyAbilityComparisonRow,
  ChildWeeklyAbilityComparisonStatus,
  ChildWeeklyRecordSummary,
  DistributionSummary,
  EpisodeAbilitySummary,
  EpisodeSummary,
  ObservationAbilityLinkRow,
  ObservationRecordRow,
  ObservationReportSourceData,
  PracticeSummary,
  ReportAggregationContext,
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

function isActiveLike(value: unknown): boolean {
  const status = upper(value);
  return !status || status === "ACTIVE";
}

function abilityMasterIsUsable(row: AbilityCodeRow): boolean {
  if (!isActiveLike(row.status)) return false;
  return row.is_leaf === true || n(row.level) === 3;
}

function observationDate(row: ObservationRecordRow): string {
  return s(row.reportDate) || s(row.observedDate);
}

function observationMatches(
  row: ObservationRecordRow,
  context: ReportAggregationContext,
  periodStart: string,
  periodEnd: string,
  enforceFiscalYear: boolean,
): boolean {
  const date = observationDate(row);
  if (s(row.tenantId) !== context.tenantId) return false;
  if (context.classroomId && s(row.classroomId) !== context.classroomId) return false;
  if (context.childId && s(row.childId) !== context.childId) return false;
  if (enforceFiscalYear && row.fiscalYear != null && n(row.fiscalYear) !== context.fiscalYear) return false;
  if (upper(row.status) !== "CONFIRMED") return false;
  return Boolean(s(row.id) && s(row.childId) && date >= periodStart && date <= periodEnd);
}

function uniqueObservations(rows: ObservationRecordRow[]): ObservationRecordRow[] {
  return rows.filter(
    (row, index, allRows) =>
      allRows.findIndex((candidate) => s(candidate.id) === s(row.id)) === index,
  );
}

function activeLinksForObservations(
  source: ObservationReportSourceData,
  tenantId: string,
  observationIds: Set<string>,
): ObservationAbilityLinkRow[] {
  return source.abilityLinks
    .filter((row) => s(row.tenantId) === tenantId)
    .filter((row) => isActiveLike(row.status))
    .filter((row) => observationIds.has(s(row.observationId)))
    .filter((row) => Boolean(s(row.abilityCode)))
    .filter((row, index, rows) => {
      const key = `${s(row.observationId)}::${s(row.abilityCode)}`;
      return rows.findIndex(
        (candidate) => `${s(candidate.observationId)}::${s(candidate.abilityCode)}` === key,
      ) === index;
    });
}

function linksByObservation(
  links: ObservationAbilityLinkRow[],
): Map<string, ObservationAbilityLinkRow[]> {
  const map = new Map<string, ObservationAbilityLinkRow[]>();
  for (const link of links) {
    const observationId = s(link.observationId);
    const current = map.get(observationId) ?? [];
    current.push(link);
    map.set(observationId, current);
  }
  return map;
}

function practiceKey(role: unknown, code: unknown): string {
  return `${upper(role) || "PRIMARY"}::${s(code) || "UNKNOWN"}`;
}

function buildPractices(observations: ObservationRecordRow[]): PracticeSummary[] {
  const acc = new Map<string, {
    practiceRole: string;
    practiceCode: string;
    practiceName: string;
    dates: Set<string>;
    observations: Set<string>;
  }>();

  for (const observation of observations) {
    const role = upper(observation.practiceRole) || "PRIMARY";
    const code = s(observation.practiceCode) || "UNKNOWN";
    const key = practiceKey(role, code);
    const current = acc.get(key) ?? {
      practiceRole: role,
      practiceCode: code,
      practiceName: s(observation.practiceName) || code,
      dates: new Set<string>(),
      observations: new Set<string>(),
    };
    const date = observationDate(observation);
    if (date) current.dates.add(date);
    current.observations.add(s(observation.id));
    acc.set(key, current);
  }

  return [...acc.entries()]
    .map(([key, row]) => ({
      key,
      practiceRole: row.practiceRole,
      practiceCode: row.practiceCode,
      practiceName: row.practiceName,
      performedDateCount: row.dates.size,
      observationCount: row.observations.size,
      childCount: observations.length > 0 ? 1 : 0,
    }))
    .sort((a, b) => a.practiceRole.localeCompare(b.practiceRole) || a.practiceName.localeCompare(b.practiceName, "ja"));
}

function buildAbilitySummaries(input: {
  links: ObservationAbilityLinkRow[];
  observations: ObservationRecordRow[];
  abilityCodeMap: Map<string, AbilityCodeRow>;
}): AbilitySummary[] {
  const observationById = new Map(
    input.observations.map((row) => [s(row.id), row] as const),
  );
  const acc = new Map<string, {
    abilityCode: string;
    abilityName: string;
    domain: string;
    category: string;
    sortOrder: number;
    observations: Set<string>;
  }>();

  for (const link of input.links) {
    const abilityCode = s(link.abilityCode);
    const master = input.abilityCodeMap.get(abilityCode);
    const observationId = s(link.observationId);
    if (!observationById.has(observationId)) continue;

    const current = acc.get(abilityCode) ?? {
      abilityCode,
      abilityName: s(link.abilityName) || s(master?.name) || abilityCode,
      domain: s(master?.domain) || "未分類",
      category: s(master?.category) || "未分類",
      sortOrder: n(master?.sort_order, Number.MAX_SAFE_INTEGER),
      observations: new Set<string>(),
    };
    current.observations.add(observationId);
    acc.set(abilityCode, current);
  }

  return [...acc.values()]
    .map((row) => ({
      abilityCode: row.abilityCode,
      abilityName: row.abilityName,
      domain: row.domain,
      category: row.category,
      sortOrder: row.sortOrder,
      observationCount: row.observations.size,
      childCount: row.observations.size > 0 ? 1 : 0,
    }))
    .sort((a, b) => b.observationCount - a.observationCount || a.sortOrder - b.sortOrder);
}

function buildDistributions(input: {
  links: ObservationAbilityLinkRow[];
  abilityCodeMap: Map<string, AbilityCodeRow>;
  allLeafAbilities: Array<{ category: string }>;
}): { domains: DistributionSummary[]; postures: DistributionSummary[] } {
  const domainCounts = new Map<string, number>(DOMAIN_ORDER.map((label) => [label, 0]));
  const postureLabels = input.allLeafAbilities
    .map((row) => row.category)
    .filter(Boolean)
    .filter((label, index, labels) => labels.indexOf(label) === index);
  const postureCounts = new Map<string, number>(postureLabels.map((label) => [label, 0]));

  for (const link of input.links) {
    const master = input.abilityCodeMap.get(s(link.abilityCode));
    const domain = s(master?.domain) || "未分類";
    const category = s(master?.category) || "未分類";
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    postureCounts.set(category, (postureCounts.get(category) ?? 0) + 1);
  }

  return {
    domains: [...domainCounts.entries()].map(([key, observationCount]) => ({
      key,
      label: key,
      observationCount,
      childCount: observationCount > 0 ? 1 : 0,
    })),
    postures: [...postureCounts.entries()].map(([key, observationCount]) => ({
      key,
      label: key,
      observationCount,
      childCount: observationCount > 0 ? 1 : 0,
    })),
  };
}

function buildEpisodes(input: {
  observations: ObservationRecordRow[];
  links: ObservationAbilityLinkRow[];
  abilityCodeMap: Map<string, AbilityCodeRow>;
  childName: string;
}): EpisodeSummary[] {
  const groupedLinks = linksByObservation(input.links);

  return input.observations
    .map((observation) => {
      const observationId = s(observation.id);
      const abilities: EpisodeAbilitySummary[] = (groupedLinks.get(observationId) ?? []).map((link) => {
        const abilityCode = s(link.abilityCode);
        const master = input.abilityCodeMap.get(abilityCode);
        return {
          abilityCode,
          abilityName: s(link.abilityName) || s(master?.name) || abilityCode,
          confidence: typeof link.confidence === "number" ? link.confidence : null,
          evidenceText: s(link.evidenceText),
          reason: s(link.reason),
          source: upper(link.source) || "AI",
        };
      });

      return {
        observationId,
        childId: s(observation.childId),
        childName: s(observation.childName) || input.childName,
        reportDate: observationDate(observation),
        practiceRole: upper(observation.practiceRole) || "PRIMARY",
        practiceCode: s(observation.practiceCode),
        practiceName: s(observation.practiceName) || s(observation.practiceCode) || "Practice名未取得",
        episodeText: s(observation.episodeText) || s(observation.body),
        observedByName: s(observation.observedByName),
        abilities,
      };
    })
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.practiceName.localeCompare(b.practiceName, "ja"));
}

function comparisonStatus(
  currentObservationCount: number,
  previousObservationCount: number,
): ChildWeeklyAbilityComparisonStatus {
  if (currentObservationCount > 0 && previousObservationCount === 0) return "NEW_THIS_WEEK";
  if (currentObservationCount > 0 && previousObservationCount > 0) return "CONTINUING";
  return "NOT_OBSERVED_THIS_WEEK";
}

export function aggregateChildWeeklyRecord(
  context: ReportAggregationContext,
  source: ObservationReportSourceData,
): ChildWeeklyRecordSummary {
  if (!context.childId) {
    throw new Error("対象児童が指定されていません。");
  }

  const warnings: string[] = [];
  const comparisonStart = addDateOnlyDays(context.periodStart, -28);
  const comparisonEnd = addDateOnlyDays(context.periodStart, -1);

  const abilityCodeMap = new Map(
    source.abilityCodes
      .filter(abilityMasterIsUsable)
      .map((row) => [s(row.code) || s(row.id), row] as const)
      .filter(([code]) => Boolean(code)),
  );
  const allLeafAbilities = [...abilityCodeMap.entries()]
    .map(([abilityCode, row]) => ({
      abilityCode,
      abilityName: s(row.name) || abilityCode,
      domain: s(row.domain) || "未分類",
      category: s(row.category) || "未分類",
      sortOrder: n(row.sort_order, Number.MAX_SAFE_INTEGER),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.abilityCode.localeCompare(b.abilityCode));

  const currentObservations = uniqueObservations(
    source.observations.filter((row) => observationMatches(
      row,
      context,
      context.periodStart,
      context.periodEnd,
      true,
    )),
  );
  const previousObservations = uniqueObservations(
    source.observations.filter((row) => observationMatches(
      row,
      context,
      comparisonStart,
      comparisonEnd,
      false,
    )),
  );

  const currentObservationIds = new Set(currentObservations.map((row) => s(row.id)));
  const previousObservationIds = new Set(previousObservations.map((row) => s(row.id)));
  const currentLinks = activeLinksForObservations(source, context.tenantId, currentObservationIds);
  const previousLinks = activeLinksForObservations(source, context.tenantId, previousObservationIds);

  const enrolledChild = source.enrolledChildren.find((row) => s(row.id) === context.childId);
  const observedChildName = currentObservations.map((row) => s(row.childName)).find(Boolean)
    || previousObservations.map((row) => s(row.childName)).find(Boolean);
  const childName = s(enrolledChild?.displayName) || observedChildName || context.childId;
  const kana = s(enrolledChild?.kana);
  if (!enrolledChild && (currentObservations.length > 0 || previousObservations.length > 0)) {
    warnings.push(`${childName}さんは対象週の在籍一覧にありませんが、確認済みObservationがあるため表示しています。`);
  }

  const currentAbilities = buildAbilitySummaries({
    links: currentLinks,
    observations: currentObservations,
    abilityCodeMap,
  });
  const previousAbilities = buildAbilitySummaries({
    links: previousLinks,
    observations: previousObservations,
    abilityCodeMap,
  });
  const currentAbilityMap = new Map(currentAbilities.map((row) => [row.abilityCode, row] as const));
  const previousAbilityMap = new Map(previousAbilities.map((row) => [row.abilityCode, row] as const));
  const comparisonCodes = [...new Set([
    ...currentAbilityMap.keys(),
    ...previousAbilityMap.keys(),
  ])];

  const comparisonRows: ChildWeeklyAbilityComparisonRow[] = comparisonCodes
    .map((abilityCode) => {
      const current = currentAbilityMap.get(abilityCode);
      const previous = previousAbilityMap.get(abilityCode);
      const master = abilityCodeMap.get(abilityCode);
      const currentObservationCount = current?.observationCount ?? 0;
      const previousObservationCount = previous?.observationCount ?? 0;
      return {
        abilityCode,
        abilityName: current?.abilityName || previous?.abilityName || s(master?.name) || abilityCode,
        domain: current?.domain || previous?.domain || s(master?.domain) || "未分類",
        category: current?.category || previous?.category || s(master?.category) || "未分類",
        currentObservationCount,
        previousObservationCount,
        status: comparisonStatus(currentObservationCount, previousObservationCount),
      };
    })
    .sort((a, b) => {
      const rank: Record<ChildWeeklyAbilityComparisonStatus, number> = {
        NEW_THIS_WEEK: 0,
        CONTINUING: 1,
        NOT_OBSERVED_THIS_WEEK: 2,
      };
      return rank[a.status] - rank[b.status]
        || b.currentObservationCount - a.currentObservationCount
        || b.previousObservationCount - a.previousObservationCount
        || a.abilityCode.localeCompare(b.abilityCode);
    });

  const groupedLinks = linksByObservation(currentLinks);
  const observationWithAbilityCount = currentObservations.filter(
    (row) => (groupedLinks.get(s(row.id)) ?? []).length > 0,
  ).length;
  const distributions = buildDistributions({
    links: currentLinks,
    abilityCodeMap,
    allLeafAbilities,
  });
  const practices = buildPractices(currentObservations);

  return {
    context,
    childId: context.childId,
    childName,
    kana,
    observationCount: currentObservations.length,
    observationDayCount: new Set(currentObservations.map(observationDate).filter(Boolean)).size,
    practiceCount: practices.length,
    abilityLinkCount: currentLinks.length,
    observationWithAbilityCount,
    observationWithoutAbilityCount: currentObservations.length - observationWithAbilityCount,
    observedAbilityCount: currentAbilities.length,
    practices,
    abilities: currentAbilities,
    domains: distributions.domains,
    postures: distributions.postures,
    episodes: buildEpisodes({
      observations: currentObservations,
      links: currentLinks,
      abilityCodeMap,
      childName,
    }),
    comparison: {
      periodStart: comparisonStart,
      periodEnd: comparisonEnd,
      observationCount: previousObservations.length,
      abilityLinkCount: previousLinks.length,
      rows: comparisonRows,
      newAbilities: comparisonRows.filter((row) => row.status === "NEW_THIS_WEEK"),
      continuingAbilities: comparisonRows.filter((row) => row.status === "CONTINUING"),
      previousOnlyAbilities: comparisonRows.filter((row) => row.status === "NOT_OBSERVED_THIS_WEEK"),
    },
    warnings,
  };
}

export function childWeeklyComparisonLabel(status: ChildWeeklyAbilityComparisonStatus): string {
  if (status === "NEW_THIS_WEEK") return "今週新たに観察";
  if (status === "CONTINUING") return "継続して観察";
  return "今週は未観察";
}

export function childWeeklyComparisonClass(status: ChildWeeklyAbilityComparisonStatus): string {
  if (status === "NEW_THIS_WEEK") return "child-weekly-comparison-new";
  if (status === "CONTINUING") return "child-weekly-comparison-continuing";
  return "child-weekly-comparison-previous";
}
