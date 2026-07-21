import weekendPlayDescriptionCsv from "../../seed/data/WeekendPlay_description.csv?raw";
import weekendPlayAbilityLinkCsv from "../../seed/data/WeekendPlayAbilityLink.csv?raw";
import type {
  AbilitySummary,
  WeekendPlayAbilityLinkRow,
  WeekendPlayCandidate,
  WeekendPlayCandidateMatch,
  WeekendPlayMatchLevel,
  WeekendPlayRow,
} from "./types";

type CsvRow = Record<string, string>;

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

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, "").trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = s(values[index]);
    });
    return row;
  });
}

function loadPlayRows(): WeekendPlayRow[] {
  return parseCsv(weekendPlayDescriptionCsv)
    .map((row) => ({
      playId: s(row.playId),
      playTitle: s(row.playTitle),
      playType: s(row.playType),
      setting: s(row.setting),
      status: s(row.status),
      parentHint: s(row.parentHint),
      sourceFile: s(row.sourceFile),
      playDescriptionDraft: s(row.playDescriptionDraft),
    }))
    .filter((row) => row.playId && row.playTitle && upper(row.status) === "ACTIVE");
}

function loadLinkRows(): WeekendPlayAbilityLinkRow[] {
  return parseCsv(weekendPlayAbilityLinkCsv)
    .map((row) => ({
      linkId: s(row.linkId),
      playId: s(row.playId),
      playTitle: s(row.playTitle),
      sortOrder: n(row.sortOrder, Number.MAX_SAFE_INTEGER),
      relationType: upper(row.relationType) || "RELATED",
      weight: n(row.weight, 1),
      abilityCode: s(row.abilityCode),
      domain: s(row.domain),
      category: s(row.category),
      abilityName: s(row.abilityName),
      reason: s(row.reason),
    }))
    .filter((row) => row.playId && row.abilityCode);
}

const ACTIVE_PLAYS = loadPlayRows();
const ACTIVE_LINKS = loadLinkRows();

function matchLevelForAbility(
  ability: AbilitySummary,
  links: WeekendPlayAbilityLinkRow[],
): { level: WeekendPlayMatchLevel; link: WeekendPlayAbilityLinkRow } | null {
  const exact = links
    .filter((link) => link.abilityCode === ability.abilityCode)
    .sort((a, b) => b.weight - a.weight || a.sortOrder - b.sortOrder)[0];
  if (exact) return { level: "EXACT", link: exact };

  const category = links
    .filter((link) => link.category && link.category === ability.category)
    .sort((a, b) => b.weight - a.weight || a.sortOrder - b.sortOrder)[0];
  if (category) return { level: "CATEGORY", link: category };

  const domain = links
    .filter((link) => link.domain && link.domain === ability.domain)
    .sort((a, b) => b.weight - a.weight || a.sortOrder - b.sortOrder)[0];
  if (domain) return { level: "DOMAIN", link: domain };

  return null;
}

function scoreMatch(
  level: WeekendPlayMatchLevel,
  weight: number,
  observationCount: number,
): number {
  const observationFactor = Math.max(1, Math.min(2, observationCount));
  const levelFactor = level === "EXACT" ? 100 : level === "CATEGORY" ? 10 : 1;
  return levelFactor * Math.max(1, weight) * observationFactor;
}

function candidateForPlay(
  play: WeekendPlayRow,
  playLinks: WeekendPlayAbilityLinkRow[],
  abilities: AbilitySummary[],
): WeekendPlayCandidate | null {
  const matches: WeekendPlayCandidateMatch[] = [];

  for (const ability of abilities) {
    const match = matchLevelForAbility(ability, playLinks);
    if (!match) continue;
    const matchScore = scoreMatch(match.level, match.link.weight, ability.observationCount);
    matches.push({
      matchLevel: match.level,
      observedAbilityCode: ability.abilityCode,
      observedAbilityName: ability.abilityName,
      observedDomain: ability.domain,
      observedCategory: ability.category,
      observedCount: ability.observationCount,
      linkedAbilityCode: match.link.abilityCode,
      linkedAbilityName: match.link.abilityName,
      relationType: match.link.relationType,
      weight: match.link.weight,
      reason: match.link.reason,
      score: matchScore,
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const rank: Record<WeekendPlayMatchLevel, number> = { EXACT: 0, CATEGORY: 1, DOMAIN: 2 };
    return rank[a.matchLevel] - rank[b.matchLevel]
      || b.score - a.score
      || a.observedAbilityCode.localeCompare(b.observedAbilityCode);
  });

  return {
    ...play,
    score: matches.reduce((sum, match) => sum + match.score, 0),
    exactMatchCount: matches.filter((match) => match.matchLevel === "EXACT").length,
    categoryMatchCount: matches.filter((match) => match.matchLevel === "CATEGORY").length,
    domainMatchCount: matches.filter((match) => match.matchLevel === "DOMAIN").length,
    primaryMatchCount: matches.filter((match) => match.relationType === "PRIMARY").length,
    matches,
  };
}

export function selectWeekendPlayCandidates(
  abilities: AbilitySummary[],
  limit = 3,
): WeekendPlayCandidate[] {
  if (abilities.length === 0 || limit <= 0) return [];

  const linksByPlay = new Map<string, WeekendPlayAbilityLinkRow[]>();
  for (const link of ACTIVE_LINKS) {
    const current = linksByPlay.get(link.playId) ?? [];
    current.push(link);
    linksByPlay.set(link.playId, current);
  }

  return ACTIVE_PLAYS
    .map((play) => candidateForPlay(play, linksByPlay.get(play.playId) ?? [], abilities))
    .filter((candidate): candidate is WeekendPlayCandidate => candidate !== null)
    .sort((a, b) => b.exactMatchCount - a.exactMatchCount
      || b.primaryMatchCount - a.primaryMatchCount
      || b.score - a.score
      || a.playTitle.localeCompare(b.playTitle, "ja"))
    .slice(0, limit);
}

export function weekendPlayMatchLevelLabel(level: WeekendPlayMatchLevel): string {
  if (level === "EXACT") return "Ability完全一致";
  if (level === "CATEGORY") return "10の姿一致";
  return "5領域一致";
}

export function weekendPlayRelationLabel(relationType: string): string {
  return upper(relationType) === "PRIMARY" ? "主Ability" : "関連Ability";
}

export const weekendPlayCatalogStats = {
  playCount: ACTIVE_PLAYS.length,
  linkCount: ACTIVE_LINKS.length,
};
