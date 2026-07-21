import type {
  AbilityCodeRow,
  AbilitySummary,
  ChildProgressAbilityComparisonRow,
  ChildProgressAbilityStatus,
  ChildProgressComparisonSummary,
  ChildProgressDomainComparisonRow,
  ChildProgressEvidenceRow,
  ChildProgressPeriodSummary,
  DistributionSummary,
  EpisodeAbilitySummary,
  EpisodeSummary,
  ObservationAbilityLinkRow,
  ObservationRecordRow,
  ObservationReportSourceData,
  PracticeSummary,
} from "./types";

const DOMAIN_ORDER = ["健康", "人間関係", "環境", "言葉", "表現"];

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return s(value).toUpperCase();
}

function observationDate(row: ObservationRecordRow): string {
  return s(row.reportDate) || s(row.observedDate);
}

function episodeText(row: ObservationRecordRow): string {
  return s(row.episodeText) || s(row.body);
}

function inPeriod(value: string, start: string, end: string): boolean {
  return Boolean(value && value >= start && value <= end);
}

function abilityLookup(rows: AbilityCodeRow[]): Map<string, AbilityCodeRow> {
  const map = new Map<string, AbilityCodeRow>();
  for (const row of rows) {
    const code = s(row.code) || s(row.id);
    if (!code) continue;
    map.set(code, row);
    if (s(row.id)) map.set(s(row.id), row);
  }
  return map;
}

function buildEpisodeAbilities(
  links: ObservationAbilityLinkRow[],
  abilityByCode: Map<string, AbilityCodeRow>,
): EpisodeAbilitySummary[] {
  return links
    .map((link) => {
      const code = s(link.abilityCode);
      const master = abilityByCode.get(code);
      return {
        abilityCode: code,
        abilityName: s(link.abilityName) || s(master?.name) || code,
        confidence:
          typeof link.confidence === "number" ? link.confidence : null,
        evidenceText: s(link.evidenceText),
        reason: s(link.reason),
        source: s(link.source),
      };
    })
    .filter((row) => row.abilityCode)
    .sort((a, b) => a.abilityCode.localeCompare(b.abilityCode, "ja"));
}

function buildPeriodSummary(input: {
  source: ObservationReportSourceData;
  childId: string;
  childName: string;
  periodStart: string;
  periodEnd: string;
}): ChildProgressPeriodSummary {
  const abilityByCode = abilityLookup(input.source.abilityCodes);
  const observations = input.source.observations
    .filter((row) => upper(row.status) === "CONFIRMED")
    .filter((row) => s(row.childId) === input.childId)
    .filter((row) => inPeriod(observationDate(row), input.periodStart, input.periodEnd))
    .sort((a, b) => observationDate(a).localeCompare(observationDate(b)));

  const observationIds = new Set(
    observations.map((row) => s(row.id)).filter(Boolean),
  );
  const links = input.source.abilityLinks
    .filter((row) => upper(row.status) === "ACTIVE")
    .filter((row) => s(row.childId) === input.childId)
    .filter((row) => observationIds.has(s(row.observationId)));

  const linksByObservation = new Map<string, ObservationAbilityLinkRow[]>();
  for (const link of links) {
    const observationId = s(link.observationId);
    const bucket = linksByObservation.get(observationId) ?? [];
    bucket.push(link);
    linksByObservation.set(observationId, bucket);
  }

  const episodes: EpisodeSummary[] = observations.map((row) => {
    const observationId = s(row.id);
    return {
      observationId,
      childId: input.childId,
      childName: s(row.childName) || input.childName,
      reportDate: observationDate(row),
      practiceRole: s(row.practiceRole),
      practiceCode: s(row.practiceCode),
      practiceName: s(row.practiceName) || "生活・遊びの場面",
      episodeText: episodeText(row),
      observedByName: s(row.observedByName),
      abilities: buildEpisodeAbilities(
        linksByObservation.get(observationId) ?? [],
        abilityByCode,
      ),
    };
  });

  const abilityObservationIds = new Map<string, Set<string>>();
  const abilityChildIds = new Map<string, Set<string>>();
  for (const link of links) {
    const code = s(link.abilityCode);
    if (!code) continue;
    const obsSet = abilityObservationIds.get(code) ?? new Set<string>();
    obsSet.add(s(link.observationId));
    abilityObservationIds.set(code, obsSet);
    const childSet = abilityChildIds.get(code) ?? new Set<string>();
    childSet.add(input.childId);
    abilityChildIds.set(code, childSet);
  }

  const abilities: AbilitySummary[] = [...abilityObservationIds.entries()]
    .map(([code, ids]) => {
      const master = abilityByCode.get(code);
      const matchingLink = links.find((link) => s(link.abilityCode) === code);
      return {
        abilityCode: code,
        abilityName: s(matchingLink?.abilityName) || s(master?.name) || code,
        domain: s(master?.domain) || "未分類",
        category: s(master?.category) || "未分類",
        sortOrder:
          typeof master?.sort_order === "number" ? master.sort_order : 999999,
        observationCount: ids.size,
        childCount: abilityChildIds.get(code)?.size ?? 0,
      };
    })
    .sort((a, b) =>
      a.sortOrder - b.sortOrder ||
      a.abilityCode.localeCompare(b.abilityCode, "ja"),
    );

  const domainCounts = new Map<string, { observations: Set<string>; children: Set<string> }>();
  const postureCounts = new Map<string, { observations: Set<string>; children: Set<string> }>();
  for (const ability of abilities) {
    const ids = abilityObservationIds.get(ability.abilityCode) ?? new Set<string>();
    const domainBucket = domainCounts.get(ability.domain) ?? {
      observations: new Set<string>(),
      children: new Set<string>(),
    };
    ids.forEach((id) => domainBucket.observations.add(id));
    domainBucket.children.add(input.childId);
    domainCounts.set(ability.domain, domainBucket);

    const categoryBucket = postureCounts.get(ability.category) ?? {
      observations: new Set<string>(),
      children: new Set<string>(),
    };
    ids.forEach((id) => categoryBucket.observations.add(id));
    categoryBucket.children.add(input.childId);
    postureCounts.set(ability.category, categoryBucket);
  }

  const domains: DistributionSummary[] = DOMAIN_ORDER.map((label) => ({
    key: label,
    label,
    observationCount: domainCounts.get(label)?.observations.size ?? 0,
    childCount: domainCounts.get(label)?.children.size ?? 0,
  }));

  const categoryOrder = [...new Set(
    input.source.abilityCodes
      .filter((row) => upper(row.status) === "ACTIVE")
      .map((row) => s(row.category))
      .filter(Boolean),
  )];
  const postures: DistributionSummary[] = categoryOrder.map((label) => ({
    key: label,
    label,
    observationCount: postureCounts.get(label)?.observations.size ?? 0,
    childCount: postureCounts.get(label)?.children.size ?? 0,
  }));

  const practiceMap = new Map<string, {
    role: string;
    code: string;
    name: string;
    dates: Set<string>;
    observations: Set<string>;
  }>();
  for (const episode of episodes) {
    const key = episode.practiceCode || episode.practiceName;
    const bucket = practiceMap.get(key) ?? {
      role: episode.practiceRole,
      code: episode.practiceCode,
      name: episode.practiceName,
      dates: new Set<string>(),
      observations: new Set<string>(),
    };
    bucket.dates.add(episode.reportDate);
    bucket.observations.add(episode.observationId);
    practiceMap.set(key, bucket);
  }
  const practices: PracticeSummary[] = [...practiceMap.entries()]
    .map(([key, value]) => ({
      key,
      practiceRole: value.role,
      practiceCode: value.code,
      practiceName: value.name,
      performedDateCount: value.dates.size,
      observationCount: value.observations.size,
      childCount: value.observations.size > 0 ? 1 : 0,
    }))
    .sort((a, b) =>
      b.observationCount - a.observationCount ||
      a.practiceName.localeCompare(b.practiceName, "ja"),
    );

  const observationWithAbilityCount = episodes.filter(
    (episode) => episode.abilities.length > 0,
  ).length;

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    observationCount: episodes.length,
    observationDayCount: new Set(episodes.map((row) => row.reportDate)).size,
    practiceCount: practices.length,
    abilityLinkCount: links.length,
    observationWithAbilityCount,
    observationWithoutAbilityCount: episodes.length - observationWithAbilityCount,
    observedAbilityCount: abilities.length,
    domains,
    postures,
    abilities,
    practices,
    episodes,
  };
}

function abilityStatus(currentCount: number, previousCount: number): ChildProgressAbilityStatus {
  if (currentCount > 0 && previousCount === 0) return "NEW";
  if (currentCount === 0 && previousCount > 0) return "PREVIOUS_ONLY";
  if (currentCount > previousCount) return "MORE_RECORDED";
  if (currentCount < previousCount) return "LESS_RECORDED";
  return "CONTINUED";
}

function selectEvidenceRows(
  current: ChildProgressPeriodSummary,
  abilityRows: ChildProgressAbilityComparisonRow[],
): ChildProgressEvidenceRow[] {
  const newCodes = new Set(
    abilityRows.filter((row) => row.status === "NEW").map((row) => row.abilityCode),
  );
  const moreCodes = new Set(
    abilityRows
      .filter((row) => row.status === "MORE_RECORDED")
      .map((row) => row.abilityCode),
  );

  const candidates = current.episodes.map((episode) => {
    const reasons: string[] = [];
    const episodeCodes = new Set(episode.abilities.map((row) => row.abilityCode));
    const newCount = [...episodeCodes].filter((code) => newCodes.has(code)).length;
    const moreCount = [...episodeCodes].filter((code) => moreCodes.has(code)).length;
    const evidenceCount = episode.abilities.filter(
      (row) => row.evidenceText || row.reason,
    ).length;
    if (newCount > 0) reasons.push("新たに記録された姿の根拠");
    if (moreCount > 0) reasons.push("記録場面が増えた姿の根拠");
    if (episode.abilities.length >= 2) reasons.push("複数の育ちの観点を含む");
    if (episode.practiceName) reasons.push("遊び・生活場面が明確");
    const score =
      newCount * 10 +
      moreCount * 5 +
      episode.abilities.length * 2 +
      evidenceCount * 2 +
      (episode.practiceName ? 1 : 0);
    return { ...episode, selectionScore: score, selectionReasons: reasons };
  });

  candidates.sort((a, b) =>
    b.selectionScore - a.selectionScore ||
    b.reportDate.localeCompare(a.reportDate),
  );

  const selected: ChildProgressEvidenceRow[] = [];
  const usedDates = new Set<string>();
  const usedPractices = new Set<string>();

  for (const row of candidates) {
    if (selected.length >= 12) break;
    const practiceKey = row.practiceCode || row.practiceName;
    if (!usedDates.has(row.reportDate) || !usedPractices.has(practiceKey)) {
      selected.push(row);
      usedDates.add(row.reportDate);
      usedPractices.add(practiceKey);
    }
  }
  for (const row of candidates) {
    if (selected.length >= 12) break;
    if (!selected.some((item) => item.observationId === row.observationId)) {
      selected.push(row);
    }
  }

  return selected;
}

export function buildChildProgressComparison(input: {
  source: ObservationReportSourceData;
  childId: string;
  currentStart: string;
  currentEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
}): ChildProgressComparisonSummary {
  const child = input.source.enrolledChildren.find(
    (row) => s(row.id) === input.childId,
  );
  const childName = s(child?.displayName) || input.childId;
  const current = buildPeriodSummary({
    source: input.source,
    childId: input.childId,
    childName,
    periodStart: input.currentStart,
    periodEnd: input.currentEnd,
  });
  const previous = buildPeriodSummary({
    source: input.source,
    childId: input.childId,
    childName,
    periodStart: input.comparisonStart,
    periodEnd: input.comparisonEnd,
  });

  const domainRows: ChildProgressDomainComparisonRow[] = DOMAIN_ORDER.map((label) => {
    const currentCount = current.domains.find((row) => row.key === label)?.observationCount ?? 0;
    const previousCount = previous.domains.find((row) => row.key === label)?.observationCount ?? 0;
    return {
      key: label,
      label,
      currentCount,
      previousCount,
      difference: currentCount - previousCount,
    };
  });

  const abilityCodes = new Set([
    ...current.abilities.map((row) => row.abilityCode),
    ...previous.abilities.map((row) => row.abilityCode),
  ]);
  const abilityRows: ChildProgressAbilityComparisonRow[] = [...abilityCodes]
    .map((abilityCode) => {
      const currentRow = current.abilities.find((row) => row.abilityCode === abilityCode);
      const previousRow = previous.abilities.find((row) => row.abilityCode === abilityCode);
      const sourceRow = currentRow ?? previousRow;
      const currentCount = currentRow?.observationCount ?? 0;
      const previousCount = previousRow?.observationCount ?? 0;
      return {
        abilityCode,
        abilityName: sourceRow?.abilityName ?? abilityCode,
        domain: sourceRow?.domain ?? "未分類",
        category: sourceRow?.category ?? "未分類",
        currentCount,
        previousCount,
        difference: currentCount - previousCount,
        status: abilityStatus(currentCount, previousCount),
      };
    })
    .sort((a, b) =>
      a.domain.localeCompare(b.domain, "ja") ||
      a.category.localeCompare(b.category, "ja") ||
      a.abilityName.localeCompare(b.abilityName, "ja"),
    );

  const evidenceRows = selectEvidenceRows(current, abilityRows);
  const sourceObservationIds = [...new Set([
    ...current.episodes.map((row) => row.observationId),
    ...previous.episodes.map((row) => row.observationId),
  ])].filter(Boolean).sort();
  const sourceAbilityCodes = [...abilityCodes].sort();

  const warnings: string[] = [];
  if (current.observationCount === 0) {
    warnings.push("現在期間に確認済みの観察記録がありません。");
  }
  if (previous.observationCount === 0) {
    warnings.push("比較期間に確認済みの観察記録がありません。比較表現は限定的になります。");
  }
  if (current.observationWithoutAbilityCount > 0) {
    warnings.push("Abilityが付いていないエピソードも根拠として保持しています。");
  }

  return {
    childId: input.childId,
    childName,
    kana: s(child?.kana),
    current,
    previous,
    domainRows,
    abilityRows,
    newAbilities: abilityRows.filter((row) => row.status === "NEW"),
    continuedAbilities: abilityRows.filter((row) => row.status === "CONTINUED"),
    moreRecordedAbilities: abilityRows.filter((row) => row.status === "MORE_RECORDED"),
    lessRecordedAbilities: abilityRows.filter((row) => row.status === "LESS_RECORDED"),
    previousOnlyAbilities: abilityRows.filter((row) => row.status === "PREVIOUS_ONLY"),
    evidenceRows,
    sourceObservationIds,
    sourceAbilityCodes,
    warnings,
  };
}
