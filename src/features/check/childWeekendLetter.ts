import { addDateOnlyDays } from "./reportPeriod";
import type {
  ChildWeekendLetterDraft,
  ChildWeekendLetterSourceAbility,
  ChildWeekendLetterSourceEpisode,
  ChildWeekendLetterSourceSnapshot,
  ChildWeeklyRecordSummary,
  ObservationRecordRow,
  ObservationReportSourceData,
  ReportAggregationContext,
  WeekendPlayCandidate,
  WeekendPlaySelectionSnapshot,
} from "./types";

export const CHILD_WEEKEND_PROMPT_VERSION = "child-weekend-letter-v1";

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return s(value).toUpperCase();
}

function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
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

function observationDate(row: ObservationRecordRow): string {
  return s(row.reportDate) || s(row.observedDate);
}

function inRange(value: string, start: string, end: string): boolean {
  return Boolean(value && value >= start && value <= end);
}

function previousEpisodeCandidates(input: {
  context: ReportAggregationContext;
  source: ObservationReportSourceData;
  summary: ChildWeeklyRecordSummary;
  otherChildNames: string[];
}): ChildWeekendLetterSourceEpisode[] {
  const comparisonStart = addDateOnlyDays(input.context.periodStart, -28);
  const comparisonEnd = addDateOnlyDays(input.context.periodStart, -1);
  const continuingCodes = new Set(
    input.summary.comparison.continuingAbilities.map((row) => row.abilityCode),
  );

  const observationRows = input.source.observations
    .filter((row) => s(row.tenantId) === input.context.tenantId)
    .filter((row) => s(row.classroomId) === s(input.context.classroomId))
    .filter((row) => s(row.childId) === s(input.context.childId))
    .filter((row) => upper(row.status) === "CONFIRMED")
    .filter((row) => inRange(observationDate(row), comparisonStart, comparisonEnd))
    .filter((row) => Boolean(s(row.id)))
    .filter((row, index, rows) => rows.findIndex((candidate) => s(candidate.id) === s(row.id)) === index);

  const activeLinks = input.source.abilityLinks
    .filter((row) => s(row.tenantId) === input.context.tenantId)
    .filter((row) => !upper(row.status) || upper(row.status) === "ACTIVE");
  const codesByObservationId = new Map<string, Set<string>>();

  for (const link of activeLinks) {
    const observationId = s(link.observationId);
    if (!observationId) continue;
    const current = codesByObservationId.get(observationId) ?? new Set<string>();
    if (s(link.abilityCode)) current.add(s(link.abilityCode));
    codesByObservationId.set(observationId, current);
  }

  return observationRows
    .map((row) => {
      const observationId = s(row.id);
      const abilityCodes = [...(codesByObservationId.get(observationId) ?? new Set<string>())];
      const overlapCount = abilityCodes.filter((code) => continuingCodes.has(code)).length;
      return {
        observationId,
        reportDate: observationDate(row),
        practiceName: s(row.practiceName) || s(row.practiceCode) || "遊び・活動",
        episodeText: replaceOtherChildNames(
          s(row.episodeText) || s(row.body),
          input.summary.childName,
          input.otherChildNames,
        ).slice(0, 700),
        abilityCodes,
        overlapCount,
      };
    })
    .filter((row) => Boolean(row.episodeText))
    .sort((a, b) => b.overlapCount - a.overlapCount || b.reportDate.localeCompare(a.reportDate))
    .slice(0, 2)
    .map(({ overlapCount: _overlapCount, ...row }) => row);
}

function currentEpisodes(input: {
  summary: ChildWeeklyRecordSummary;
  otherChildNames: string[];
}): ChildWeekendLetterSourceEpisode[] {
  return input.summary.episodes
    .slice(0, 5)
    .map((episode) => ({
      observationId: episode.observationId,
      reportDate: episode.reportDate,
      practiceName: episode.practiceName,
      episodeText: replaceOtherChildNames(
        episode.episodeText,
        input.summary.childName,
        input.otherChildNames,
      ).slice(0, 700),
      abilityCodes: episode.abilities.map((ability) => ability.abilityCode),
    }))
    .filter((row) => Boolean(row.episodeText));
}

function currentAbilities(summary: ChildWeeklyRecordSummary): ChildWeekendLetterSourceAbility[] {
  return summary.abilities.slice(0, 5).map((ability) => ({
    abilityCode: ability.abilityCode,
    abilityName: ability.abilityName,
    domain: ability.domain,
    category: ability.category,
  }));
}

export function childWeeklyReportId(input: {
  classroomId: string;
  childId: string;
  weekStartDate: string;
}): string {
  return [
    "child-weekly",
    safeIdPart(input.classroomId),
    safeIdPart(input.childId),
    safeIdPart(input.weekStartDate),
  ].join("-");
}

export function weekendPlaySelectionSnapshot(
  candidate: WeekendPlayCandidate,
): WeekendPlaySelectionSnapshot {
  return {
    playId: candidate.playId,
    playTitle: candidate.playTitle,
    playType: candidate.playType,
    setting: candidate.setting,
    parentHint: candidate.parentHint,
    playDescriptionDraft: candidate.playDescriptionDraft,
    matchReasons: candidate.matches.slice(0, 5).map((match) => ({
      observedAbilityCode: match.observedAbilityCode,
      observedAbilityName: match.observedAbilityName,
      matchLevel: match.matchLevel,
      relationType: match.relationType,
      reason: match.reason,
    })),
  };
}

export function buildChildWeekendLetterSourceSnapshot(input: {
  context: ReportAggregationContext;
  source: ObservationReportSourceData;
  summary: ChildWeeklyRecordSummary;
  selectedWeekendPlay: WeekendPlayCandidate;
}): ChildWeekendLetterSourceSnapshot {
  const otherChildNames = input.source.enrolledChildren
    .map((child) => s(child.displayName))
    .filter(Boolean);

  const selection = weekendPlaySelectionSnapshot(input.selectedWeekendPlay);

  return {
    promptVersion: CHILD_WEEKEND_PROMPT_VERSION,
    childId: input.summary.childId,
    childName: input.summary.childName,
    weekStartDate: input.context.periodStart,
    weekEndDate: input.context.periodEnd,
    episodes: currentEpisodes({
      summary: input.summary,
      otherChildNames,
    }),
    abilities: currentAbilities(input.summary),
    previousEpisodes: previousEpisodeCandidates({
      context: input.context,
      source: input.source,
      summary: input.summary,
      otherChildNames,
    }),
    newAbilityNames: input.summary.comparison.newAbilities
      .slice(0, 3)
      .map((row) => row.abilityName),
    continuingAbilityNames: input.summary.comparison.continuingAbilities
      .slice(0, 3)
      .map((row) => row.abilityName),
    selectedWeekendPlay: selection,
  };
}

export function buildParentLetterText(draft: ChildWeekendLetterDraft): string {
  return [
    s(draft.title),
    s(draft.weeklyEpisodeText),
    s(draft.growthText),
    s(draft.comparisonText),
    s(draft.weekendPlayText) ? `週末の遊びのヒント\n${s(draft.weekendPlayText)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function emptyChildWeekendLetterDraft(): ChildWeekendLetterDraft {
  return {
    title: "",
    weeklyEpisodeText: "",
    growthText: "",
    comparisonText: "",
    weekendPlayText: "",
  };
}

export function parseSelectedWeekendPlayId(value: unknown): string {
  try {
    const parsed = JSON.parse(s(value)) as { playId?: unknown };
    return s(parsed.playId);
  } catch {
    return "";
  }
}
