import type {
  AbilityCodeRow,
  AbilitySummary,
  ChildObservationSummary,
  DistributionSummary,
  EpisodeAbilitySummary,
  EpisodeSummary,
  ExpectedAbilitySummary,
  ObservationReportSourceData,
  ObservationReportSummary,
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

function inPeriod(value: unknown, context: ReportAggregationContext): boolean {
  const date = s(value);
  return Boolean(date && date >= context.periodStart && date <= context.periodEnd);
}

function matchesContext(
  row: {
    tenantId?: string | null;
    fiscalYear?: number | null;
    classroomId?: string | null;
    childId?: string | null;
  },
  context: ReportAggregationContext,
  includeChildScope = true,
): boolean {
  if (s(row.tenantId) !== context.tenantId) return false;
  if (context.classroomId && s(row.classroomId) !== context.classroomId) return false;
  if (row.fiscalYear != null && n(row.fiscalYear) !== context.fiscalYear) return false;
  if (includeChildScope && context.scopeType === "CHILD" && context.childId && s(row.childId) !== context.childId) {
    return false;
  }
  return true;
}

function practiceRoleLabel(value: unknown): string {
  return upper(value) === "RESERVE" ? "予備活動" : "主活動";
}

function practiceKey(role: unknown, code: unknown): string {
  return `${upper(role) || "PRIMARY"}::${s(code) || "UNKNOWN"}`;
}

function parseObservationHintCodes(value: unknown): string[] {
  const text = s(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray(
          (parsed as Record<string, unknown>).observationHints,
        )
        ? (parsed as Record<string, unknown>).observationHints as unknown[]
        : [];

    return rows
      .map((item) => {
        if (typeof item !== "object" || item === null) return "";
        return s((item as Record<string, unknown>).abilityCode);
      })
      .filter(Boolean)
      .filter((code, index, codes) => codes.indexOf(code) === index);
  } catch {
    return [];
  }
}

function abilityMasterIsUsable(row: AbilityCodeRow): boolean {
  if (!isActiveLike(row.status)) return false;
  return row.is_leaf === true || n(row.level) === 3;
}

function createChildSummary(input: {
  childId: string;
  childName: string;
  kana?: string;
}): ChildObservationSummary {
  return {
    childId: input.childId,
    childName: input.childName || input.childId,
    kana: input.kana ?? "",
    observationCount: 0,
    abilityLinkCount: 0,
    latestObservationDate: "",
    episodes: [],
  };
}

export function aggregateObservationReport(
  context: ReportAggregationContext,
  source: ObservationReportSourceData,
): ObservationReportSummary {
  const warnings: string[] = [];

  const abilityCodeMap = new Map(
    source.abilityCodes
      .filter(abilityMasterIsUsable)
      .map((row) => [s(row.code) || s(row.id), row] as const)
      .filter(([code]) => Boolean(code)),
  );

  const allLeafAbilities = [...abilityCodeMap.entries()]
    .map(([code, row]) => ({
      abilityCode: code,
      abilityName: s(row.name) || code,
      domain: s(row.domain) || "未分類",
      category: s(row.category) || "未分類",
      sortOrder: n(row.sort_order, Number.MAX_SAFE_INTEGER),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.abilityCode.localeCompare(b.abilityCode));

  const observations = source.observations
    .filter((row) => matchesContext(row, context))
    .filter((row) => upper(row.status) === "CONFIRMED")
    .filter((row) => inPeriod(row.reportDate || row.observedDate, context))
    .filter((row) => Boolean(s(row.id) && s(row.childId)))
    .filter((row, index, rows) => rows.findIndex((candidate) => s(candidate.id) === s(row.id)) === index);

  const observationIds = new Set(observations.map((row) => s(row.id)));
  const abilityLinks = source.abilityLinks
    .filter((row) => s(row.tenantId) === context.tenantId)
    .filter((row) => isActiveLike(row.status))
    .filter((row) => observationIds.has(s(row.observationId)))
    .filter((row) => Boolean(s(row.abilityCode)))
    .filter((row, index, rows) => {
      const key = `${s(row.observationId)}::${s(row.abilityCode)}`;
      return rows.findIndex((candidate) => `${s(candidate.observationId)}::${s(candidate.abilityCode)}` === key) === index;
    });

  const linksByObservationId = new Map<string, typeof abilityLinks>();
  for (const link of abilityLinks) {
    const observationId = s(link.observationId);
    const current = linksByObservationId.get(observationId) ?? [];
    current.push(link);
    linksByObservationId.set(observationId, current);
  }

  const practiceRecords = source.practiceRecords
    .filter((row) => matchesContext(row, context, false))
    .filter((row) => upper(row.status) === "CONFIRMED")
    .filter((row) => row.isPerformed === true)
    .filter((row) => inPeriod(row.reportDate, context))
    .filter((row) => Boolean(s(row.id) && s(row.practiceCode)))
    .filter((row, index, rows) => rows.findIndex((candidate) => s(candidate.id) === s(row.id)) === index);

  const enrolledChildIds = new Set(
    source.enrolledChildren.map((child) => s(child.id)).filter(Boolean),
  );
  const childMap = new Map<string, ChildObservationSummary>();
  for (const child of source.enrolledChildren) {
    const childId = s(child.id);
    if (!childId) continue;
    if (context.scopeType === "CHILD" && context.childId && childId !== context.childId) continue;
    childMap.set(childId, createChildSummary({
      childId,
      childName: s(child.displayName) || childId,
      kana: s(child.kana),
    }));
  }

  const practiceAcc = new Map<string, {
    practiceRole: string;
    practiceCode: string;
    practiceName: string;
    dates: Set<string>;
    observations: Set<string>;
    children: Set<string>;
  }>();

  const ensurePractice = (input: {
    practiceRole: string;
    practiceCode: string;
    practiceName: string;
  }) => {
    const key = practiceKey(input.practiceRole, input.practiceCode);
    const existing = practiceAcc.get(key);
    if (existing) return existing;
    const created = {
      practiceRole: upper(input.practiceRole) || "PRIMARY",
      practiceCode: input.practiceCode,
      practiceName: input.practiceName || input.practiceCode,
      dates: new Set<string>(),
      observations: new Set<string>(),
      children: new Set<string>(),
    };
    practiceAcc.set(key, created);
    return created;
  };

  for (const record of practiceRecords) {
    const practice = ensurePractice({
      practiceRole: s(record.practiceRole),
      practiceCode: s(record.practiceCode),
      practiceName: s(record.practiceName),
    });
    if (s(record.reportDate)) practice.dates.add(s(record.reportDate));
  }

  const abilityAcc = new Map<string, {
    abilityCode: string;
    abilityName: string;
    domain: string;
    category: string;
    sortOrder: number;
    observations: Set<string>;
    children: Set<string>;
  }>();

  const episodes: EpisodeSummary[] = [];
  let observationWithAbilityCount = 0;
  let observationWithoutAbilityCount = 0;

  for (const observation of observations) {
    const observationId = s(observation.id);
    const childId = s(observation.childId);
    const childName = s(observation.childName) || childMap.get(childId)?.childName || childId;
    const reportDate = s(observation.reportDate) || s(observation.observedDate);
    const links = linksByObservationId.get(observationId) ?? [];

    if (!childMap.has(childId)) {
      childMap.set(childId, createChildSummary({ childId, childName }));
      warnings.push(`${childName}さんは対象期間の在籍一覧にありませんが、確認済みObservationがあるため表示しました。`);
    }

    const child = childMap.get(childId)!;
    child.observationCount += 1;
    child.abilityLinkCount += links.length;
    if (!child.latestObservationDate || reportDate > child.latestObservationDate) {
      child.latestObservationDate = reportDate;
    }

    if (links.length > 0) observationWithAbilityCount += 1;
    else observationWithoutAbilityCount += 1;

    const episodeAbilities: EpisodeAbilitySummary[] = links.map((link) => {
      const abilityCode = s(link.abilityCode);
      const master = abilityCodeMap.get(abilityCode);
      if (!master) {
        warnings.push(`AbilityCode ${abilityCode} のマスターが見つかりません。`);
      }

      const abilityName = s(link.abilityName) || s(master?.name) || abilityCode;
      const domain = s(master?.domain) || "未分類";
      const category = s(master?.category) || "未分類";
      const current = abilityAcc.get(abilityCode) ?? {
        abilityCode,
        abilityName,
        domain,
        category,
        sortOrder: n(master?.sort_order, Number.MAX_SAFE_INTEGER),
        observations: new Set<string>(),
        children: new Set<string>(),
      };
      current.observations.add(observationId);
      current.children.add(childId);
      abilityAcc.set(abilityCode, current);

      return {
        abilityCode,
        abilityName,
        confidence: typeof link.confidence === "number" ? link.confidence : null,
        evidenceText: s(link.evidenceText),
        reason: s(link.reason),
        source: upper(link.source) || "AI",
      };
    });

    const episode: EpisodeSummary = {
      observationId,
      childId,
      childName,
      reportDate,
      practiceRole: upper(observation.practiceRole) || "PRIMARY",
      practiceCode: s(observation.practiceCode),
      practiceName: s(observation.practiceName) || s(observation.practiceCode) || "Practice名未取得",
      episodeText: s(observation.episodeText) || s(observation.body),
      observedByName: s(observation.observedByName),
      abilities: episodeAbilities,
    };
    child.episodes.push(episode);
    episodes.push(episode);

    const practice = ensurePractice({
      practiceRole: episode.practiceRole,
      practiceCode: episode.practiceCode,
      practiceName: episode.practiceName,
    });
    if (reportDate) practice.dates.add(reportDate);
    practice.observations.add(observationId);
    practice.children.add(childId);
  }

  const abilities: AbilitySummary[] = [...abilityAcc.values()]
    .map((row) => ({
      abilityCode: row.abilityCode,
      abilityName: row.abilityName,
      domain: row.domain,
      category: row.category,
      sortOrder: row.sortOrder,
      observationCount: row.observations.size,
      childCount: row.children.size,
    }))
    .sort((a, b) => b.observationCount - a.observationCount || a.sortOrder - b.sortOrder);

  const domainAcc = new Map<string, { linkCount: number; children: Set<string> }>();
  for (const domain of DOMAIN_ORDER) {
    domainAcc.set(domain, { linkCount: 0, children: new Set<string>() });
  }

  const postureLabels = allLeafAbilities
    .map((ability) => ability.category)
    .filter(Boolean)
    .filter((label, index, labels) => labels.indexOf(label) === index);
  const postureAcc = new Map<string, { linkCount: number; children: Set<string> }>();
  for (const label of postureLabels) {
    postureAcc.set(label, { linkCount: 0, children: new Set<string>() });
  }

  for (const link of abilityLinks) {
    const abilityCode = s(link.abilityCode);
    const master = abilityCodeMap.get(abilityCode);
    const observationId = s(link.observationId);
    const childId = s(link.childId) || s(observations.find((row) => s(row.id) === observationId)?.childId);
    const domain = s(master?.domain) || "未分類";
    const category = s(master?.category) || "未分類";

    const domainRow = domainAcc.get(domain) ?? { linkCount: 0, children: new Set<string>() };
    domainRow.linkCount += 1;
    if (childId) domainRow.children.add(childId);
    domainAcc.set(domain, domainRow);

    const postureRow = postureAcc.get(category) ?? { linkCount: 0, children: new Set<string>() };
    postureRow.linkCount += 1;
    if (childId) postureRow.children.add(childId);
    postureAcc.set(category, postureRow);
  }

  const domains: DistributionSummary[] = [...domainAcc.entries()].map(([key, value]) => ({
    key,
    label: key,
    observationCount: value.linkCount,
    childCount: value.children.size,
  }));

  const postures: DistributionSummary[] = [...postureAcc.entries()].map(([key, value]) => ({
    key,
    label: key,
    observationCount: value.linkCount,
    childCount: value.children.size,
  }));

  const expectedAcc = new Map<string, number>();
  for (const record of practiceRecords) {
    const codes = parseObservationHintCodes(record.observationHintsJson);
    for (const code of codes) {
      expectedAcc.set(code, (expectedAcc.get(code) ?? 0) + 1);
    }
  }

  const observedAbilityByCode = new Map(abilities.map((ability) => [ability.abilityCode, ability] as const));
  const expectedAbilities: ExpectedAbilitySummary[] = [...expectedAcc.entries()]
    .map(([abilityCode, expectedPracticeCount]) => {
      const master = abilityCodeMap.get(abilityCode);
      const observed = observedAbilityByCode.get(abilityCode);
      const observationCount = observed?.observationCount ?? 0;
      const status: ExpectedAbilitySummary["status"] =
        observationCount === 0
          ? "UNOBSERVED"
          : observationCount === 1
            ? "LOW"
            : "OBSERVED";
      return {
        abilityCode,
        abilityName: s(master?.name) || observed?.abilityName || abilityCode,
        domain: s(master?.domain) || observed?.domain || "未分類",
        category: s(master?.category) || observed?.category || "未分類",
        expectedPracticeCount,
        observationCount,
        childCount: observed?.childCount ?? 0,
        status,
      };
    })
    .sort((a, b) => {
      const rank = { UNOBSERVED: 0, LOW: 1, OBSERVED: 2 } as const;
      return rank[a.status] - rank[b.status] || a.observationCount - b.observationCount || a.abilityCode.localeCompare(b.abilityCode);
    });

  const practices: PracticeSummary[] = [...practiceAcc.entries()]
    .map(([key, row]) => ({
      key,
      practiceRole: row.practiceRole,
      practiceCode: row.practiceCode,
      practiceName: row.practiceName,
      performedDateCount: row.dates.size,
      observationCount: row.observations.size,
      childCount: row.children.size,
    }))
    .sort((a, b) => a.practiceRole.localeCompare(b.practiceRole) || a.practiceName.localeCompare(b.practiceName, "ja"));

  const children = [...childMap.values()]
    .map((child) => ({
      ...child,
      episodes: [...child.episodes].sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.practiceRole.localeCompare(b.practiceRole)),
    }))
    .sort((a, b) => a.childName.localeCompare(b.childName, "ja"));

  episodes.sort((a, b) => b.reportDate.localeCompare(a.reportDate) || a.childName.localeCompare(b.childName, "ja"));

  const unobservedChildren = children.filter(
    (child) => enrolledChildIds.has(child.childId) && child.observationCount === 0,
  );
  const lowObservationChildren = children.filter(
    (child) => enrolledChildIds.has(child.childId) && child.observationCount === 1,
  );
  const observedAbilityCodes = new Set(abilities.map((ability) => ability.abilityCode));

  return {
    context,
    observationCount: observations.length,
    observedChildCount: children.filter((child) => child.observationCount > 0).length,
    enrolledChildCount: enrolledChildIds.size,
    practiceCount: practices.length,
    abilityLinkCount: abilityLinks.length,
    observationWithAbilityCount,
    observationWithoutAbilityCount,
    observedAbilityCount: observedAbilityCodes.size,
    unobservedAbilityCount: Math.max(0, allLeafAbilities.length - observedAbilityCodes.size),
    practices,
    children,
    abilities,
    domains,
    postures,
    expectedAbilities,
    episodes,
    unobservedChildren,
    lowObservationChildren,
    warnings: warnings.filter((warning, index, rows) => rows.indexOf(warning) === index),
  };
}

export function practiceRoleLabelForReport(value: string): string {
  return practiceRoleLabel(value);
}
