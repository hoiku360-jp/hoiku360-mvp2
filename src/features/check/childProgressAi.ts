import type {
  ChildProgressAiDomainSource,
  ChildProgressAiDraft,
  ChildProgressAiEpisode,
  ChildProgressAiSourceSnapshot,
  ChildProgressComparisonSummary,
  ObservationReportSourceData,
} from "./types";

export const CHILD_PROGRESS_PROMPT_VERSION = "child-progress-record-v3-teacher-voice";

const DOMAIN_ORDER = ["健康", "人間関係", "環境", "言葉", "表現"] as const;

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function withSan(name: string): string {
  const trimmed = s(name);
  if (!trimmed) return "";
  return trimmed.endsWith("さん") ? trimmed : `${trimmed}さん`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOtherChildNames(
  text: string,
  subjectName: string,
  otherChildNames: string[],
): string {
  let result = text;
  const names = otherChildNames
    .map(s)
    .filter((name) => name && name !== subjectName && name.length >= 2)
    .sort((a, b) => b.length - a.length);

  for (const name of names) {
    const pattern = new RegExp(`${escapeRegExp(name)}(?:さん|ちゃん|くん)?`, "g");
    result = result.replace(pattern, "友だち");
  }

  return result;
}

function toEpisode(input: {
  observationId: string;
  reportDate: string;
  practiceName: string;
  episodeText: string;
  abilityCodes: string[];
  subjectName: string;
  otherChildNames: string[];
}): ChildProgressAiEpisode {
  return {
    observationId: input.observationId,
    reportDate: input.reportDate,
    practiceName: input.practiceName || "生活や遊び",
    episodeText: replaceOtherChildNames(
      input.episodeText,
      input.subjectName,
      input.otherChildNames,
    ).slice(0, 900),
    abilityCodes: input.abilityCodes,
  };
}

function uniqueByObservationId(rows: ChildProgressAiEpisode[]): ChildProgressAiEpisode[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.observationId || seen.has(row.observationId)) return false;
    seen.add(row.observationId);
    return Boolean(row.episodeText);
  });
}

function domainSource(input: {
  domain: string;
  summary: ChildProgressComparisonSummary;
  currentEpisodes: ChildProgressAiEpisode[];
  previousEpisodes: ChildProgressAiEpisode[];
}): ChildProgressAiDomainSource {
  // Use every Ability code in the domain to assign episodes.
  // Only the descriptive Ability rows sent to Claude are limited to five.
  // Limiting domainCodes first could incorrectly remove valid domain evidence.
  const allDomainAbilityRows = input.summary.abilityRows
    .filter((row) => row.domain === input.domain)
    .sort((a, b) => b.currentCount - a.currentCount || b.previousCount - a.previousCount);

  const abilityRows = allDomainAbilityRows
    .slice(0, 5)
    .map((row) => ({
      abilityCode: row.abilityCode,
      abilityName: row.abilityName,
      domain: row.domain,
      category: row.category,
      currentCount: row.currentCount,
      previousCount: row.previousCount,
      status: row.status,
    }));

  const domainCodes = new Set(allDomainAbilityRows.map((row) => row.abilityCode));
  const current = input.currentEpisodes
    .filter((episode) => episode.abilityCodes.some((code) => domainCodes.has(code)))
    .slice(0, 3);
  const previous = input.previousEpisodes
    .filter((episode) => episode.abilityCodes.some((code) => domainCodes.has(code)))
    .slice(0, 2);

  const practices = [...new Set(current.map((episode) => episode.practiceName).filter(Boolean))]
    .slice(0, 3);

  return {
    domain: input.domain,
    abilities: abilityRows,
    currentEpisodes: current,
    previousEpisodes: previous,
    practices,
  };
}

export function buildChildProgressAiSourceSnapshot(input: {
  summary: ChildProgressComparisonSummary;
  source: ObservationReportSourceData;
  classroomId: string;
}): ChildProgressAiSourceSnapshot {
  const otherChildNames = input.source.enrolledChildren
    .map((child) => s(child.displayName))
    .filter(Boolean);

  const currentEpisodes = uniqueByObservationId(
    input.summary.current.episodes.map((episode) => toEpisode({
      observationId: episode.observationId,
      reportDate: episode.reportDate,
      practiceName: episode.practiceName,
      episodeText: episode.episodeText,
      abilityCodes: episode.abilities.map((ability) => ability.abilityCode),
      subjectName: input.summary.childName,
      otherChildNames,
    })),
  );

  const previousEpisodes = uniqueByObservationId(
    input.summary.previous.episodes.map((episode) => toEpisode({
      observationId: episode.observationId,
      reportDate: episode.reportDate,
      practiceName: episode.practiceName,
      episodeText: episode.episodeText,
      abilityCodes: episode.abilities.map((ability) => ability.abilityCode),
      subjectName: input.summary.childName,
      otherChildNames,
    })),
  );

  const representativeCurrentIds = new Set(
    input.summary.evidenceRows.slice(0, 5).map((episode) => episode.observationId),
  );
  const overallCurrentEpisodes = [
    ...currentEpisodes.filter((episode) => representativeCurrentIds.has(episode.observationId)),
    ...currentEpisodes.filter((episode) => !representativeCurrentIds.has(episode.observationId)),
  ].slice(0, 5);

  const domains = DOMAIN_ORDER.map((domain) => domainSource({
    domain,
    summary: input.summary,
    currentEpisodes,
    previousEpisodes,
  }));

  const usedObservationIds = new Set<string>();
  for (const episode of overallCurrentEpisodes) usedObservationIds.add(episode.observationId);
  for (const episode of previousEpisodes.slice(0, 3)) usedObservationIds.add(episode.observationId);
  for (const domain of domains) {
    for (const episode of domain.currentEpisodes) usedObservationIds.add(episode.observationId);
    for (const episode of domain.previousEpisodes) usedObservationIds.add(episode.observationId);
  }

  return {
    promptVersion: CHILD_PROGRESS_PROMPT_VERSION,
    childId: input.summary.childId,
    childName: input.summary.childName,
    classroomId: input.classroomId,
    currentPeriodStart: input.summary.current.periodStart,
    currentPeriodEnd: input.summary.current.periodEnd,
    comparisonPeriodStart: input.summary.previous.periodStart,
    comparisonPeriodEnd: input.summary.previous.periodEnd,
    overallCurrentEpisodes,
    overallPreviousEpisodes: previousEpisodes.slice(0, 3),
    domains,
    newAbilityNames: input.summary.newAbilities.slice(0, 5).map((row) => row.abilityName),
    continuingAbilityNames: [
      ...input.summary.continuedAbilities,
      ...input.summary.moreRecordedAbilities,
      ...input.summary.lessRecordedAbilities,
    ].slice(0, 5).map((row) => row.abilityName),
    sourceObservationIds: [...usedObservationIds].sort(),
    sourceAbilityCodes: [...new Set(input.summary.sourceAbilityCodes)].sort(),
  };
}

export function emptyChildProgressAiDraft(): ChildProgressAiDraft {
  return {
    centralThemes: [],
    interpretationNotes: [],
    overviewText: "",
    healthText: "",
    relationshipText: "",
    environmentText: "",
    languageText: "",
    expressionText: "",
    continuityText: "",
    nextPerspectiveText: "",
    needsTeacherInputDomains: [],
    sourceObservationIds: [],
    warnings: [],
  };
}

export function parseChildProgressAiDraft(value: unknown): ChildProgressAiDraft {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyChildProgressAiDraft();
    }
    const row = parsed as Record<string, unknown>;
    const strings = (candidate: unknown): string[] =>
      Array.isArray(candidate) ? candidate.map(s).filter(Boolean) : [];
    return {
      centralThemes: strings(row.centralThemes),
      interpretationNotes: strings(row.interpretationNotes),
      overviewText: s(row.overviewText),
      healthText: s(row.healthText),
      relationshipText: s(row.relationshipText),
      environmentText: s(row.environmentText),
      languageText: s(row.languageText),
      expressionText: s(row.expressionText),
      continuityText: s(row.continuityText),
      nextPerspectiveText: s(row.nextPerspectiveText),
      needsTeacherInputDomains: strings(row.needsTeacherInputDomains),
      sourceObservationIds: strings(row.sourceObservationIds),
      warnings: strings(row.warnings),
    };
  } catch {
    return emptyChildProgressAiDraft();
  }
}

export function buildChildProgressAiDraftText(input: {
  childName: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  comparisonPeriodStart: string;
  comparisonPeriodEnd: string;
  draft: ChildProgressAiDraft;
}): string {
  const rows: Array<[string, string]> = [
    ["期間を通した育ち", input.draft.overviewText],
    ["健康の視点から見た育ち", input.draft.healthText],
    ["人間関係の視点から見た育ち", input.draft.relationshipText],
    ["環境の視点から見た育ち", input.draft.environmentText],
    ["言葉の視点から見た育ち", input.draft.languageText],
    ["表現の視点から見た育ち", input.draft.expressionText],
    ["比較期間からのつながり", input.draft.continuityText],
    ["今後見届けたい視点", input.draft.nextPerspectiveText],
  ];

  const lines = [
    `【保育経過記録支援：${withSan(input.childName)}】`,
    `対象期間：${input.currentPeriodStart}〜${input.currentPeriodEnd}`,
    `比較期間：${input.comparisonPeriodStart}〜${input.comparisonPeriodEnd}`,
    "",
    "※この内容は、保育士が日々の保育で入力した観察エピソードをもとにAIが作成した確認前の下書きです。児童票へ転記する前に、具体的な姿を振り返り、必要に応じて修正・追記してください。",
    "",
  ];

  for (const [title, text] of rows) {
    lines.push(`■ ${title}`);
    lines.push(text || "（この領域については、対象期間に入力したエピソードだけでは具体的な文章を作成できません。必要に応じて追記してください。）");
    lines.push("");
  }

  return lines.join("\n").trim();
}
