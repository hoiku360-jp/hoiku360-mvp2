import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type Props = {
  tenantId: string;
  tenantName?: string | null;
  owner: string;
  ownerName?: string | null;
  ownerRole?: string | null;
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

type DailyReportRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  dailyPlanId?: string | null;
  reportDate?: string | null;
  actualPracticeRole?: string | null;
  actualPracticeCode?: string | null;
  actualPracticeName?: string | null;
  rawTranscriptText?: string | null;
  cleanedOverallText?: string | null;
  status?: string | null;
  recordedByUserId?: string | null;
  recordedByName?: string | null;
  recordedAt?: string | null;
  confirmedByUserId?: string | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  contentJson?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type DailyPracticeRecordRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  dailyReportId?: string | null;
  dailyPlanId?: string | null;
  reportDate?: string | null;
  practiceRole?: string | null;
  practiceCode?: string | null;
  practiceName?: string | null;
  isPerformed?: boolean | null;
  observationHintsJson?: string | null;
  rawTranscriptText?: string | null;
  cleanedTranscriptText?: string | null;
  cleanupStatus?: string | null;
  cleanupMessage?: string | null;
  cleanedAt?: string | null;
  cleanedOverallText?: string | null;
  analysisStatus?: string | null;
  analysisJson?: string | null;
  aiModel?: string | null;
  analyzedAt?: string | null;
  analysisErrorMessage?: string | null;
  observationSaveStatus?: string | null;
  observationSavedAt?: string | null;
  observationRecordCount?: number | null;
  observationAbilityLinkCount?: number | null;
  observationSaveErrorMessage?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ClassroomModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<ClassroomRow>>;
};

type PlanDocumentModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<PlanDocumentRow>>;
};

type DailyReportModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<DailyReportRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<DailyReportRow>>;
  update: (
    input: Record<string, unknown> & { id: string },
  ) => Promise<OperationResult<DailyReportRow>>;
};

type DailyPracticeRecordModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<DailyPracticeRecordRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<DailyPracticeRecordRow>>;
  update: (
    input: Record<string, unknown> & { id: string },
  ) => Promise<OperationResult<DailyPracticeRecordRow>>;
};

type ObservationRecordRow = {
  id?: string | null;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  childId?: string | null;
  childName?: string | null;
  observedDate?: string | null;
  observerUserId?: string | null;
  sourceType?: string | null;
  body?: string | null;
  dailyPlanId?: string | null;
  dailyReportId?: string | null;
  dailyPracticeRecordId?: string | null;
  reportDate?: string | null;
  practiceRole?: string | null;
  practiceCode?: string | null;
  practiceName?: string | null;
  episodeText?: string | null;
  status?: string | null;
  observedByUserId?: string | null;
  observedByName?: string | null;
  observedAt?: string | null;
  aiGenerated?: boolean | null;
  sourceAnalysisJson?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ObservationAbilityLinkRow = {
  id?: string | null;
  tenantId?: string | null;
  observationId?: string | null;
  childId?: string | null;
  abilityCode?: string | null;
  abilityName?: string | null;
  confidence?: number | null;
  evidenceText?: string | null;
  reason?: string | null;
  source?: string | null;
  status?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ObservationRecordModelClient = {
  get: (input: { id: string }) => Promise<OperationResult<ObservationRecordRow>>;
  list: (input?: Record<string, unknown>) => Promise<ListResult<ObservationRecordRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<ObservationRecordRow>>;
  update: (input: Record<string, unknown> & { id: string }) => Promise<OperationResult<ObservationRecordRow>>;
  delete: (input: { id: string }) => Promise<OperationResult<ObservationRecordRow>>;
};

type ObservationAbilityLinkModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<ObservationAbilityLinkRow>>;
  create: (input: Record<string, unknown>) => Promise<OperationResult<ObservationAbilityLinkRow>>;
  delete: (input: { id: string }) => Promise<OperationResult<ObservationAbilityLinkRow>>;
};


type CleanupTranscriptTextResponse = {
  originalText?: string | null;
  cleanedText?: string | null;
  status?: string | null;
  message?: string | null;
};

type AnalyzeDailyPracticeObservationResponse = {
  dailyPracticeRecordId?: string | null;
  cleanedOverallText?: string | null;
  analysisJson?: string | null;
  status?: string | null;
  aiModel?: string | null;
  message?: string | null;
};

type CleanupTranscriptMutation = (input: {
  practiceCode?: string;
  childNames?: string[];
  transcriptText: string;
}) => Promise<OperationResult<CleanupTranscriptTextResponse>>;

type AnalyzeDailyPracticeObservationMutation = (input: {
  dailyPracticeRecordId: string;
  cleanedTranscriptText: string;
}) => Promise<OperationResult<AnalyzeDailyPracticeObservationResponse>>;

type ObservationHintRow = {
  abilityCode: string;
  abilityName: string;
  postureCode: string;
  postureName: string;
  score: number;
  startingAge: number;
  episodes: {
    episode1: string;
    episode2: string;
    episode3: string;
  };
};

type PracticeSnapshot = {
  practiceCode: string;
  name: string;
  memo: string;
  practiceCategory: string;
  practiceCategoryLabel: string;
  observationHints: ObservationHintRow[];
};

type DailyReportWorkflowEntry = {
  action: "COMPLETE" | "CONFIRM" | "RETURN";
  status: "COMPLETED" | "CONFIRMED" | "RETURNED";
  actorUserId: string;
  actorName: string;
  actorRole: string;
  at: string;
  comment: string;
};

type DailyReportWorkflow = {
  currentStatus: string;
  history: DailyReportWorkflowEntry[];
};

type DailyPlanContent = {
  schemaVersion: number;
  sourceWeeklyPlanId: string;
  sourceWeeklyPlanTitle: string;
  classroomId: string;
  classroomName: string;
  ageYears: number | null;
  targetDate: string;
  dayLabel: string;
  primaryPractice: PracticeSnapshot;
  reservePractice: PracticeSnapshot;
};

type PracticeRole = "PRIMARY" | "RESERVE";

type PracticeDraft = {
  isPerformed: boolean;
  rawTranscriptText: string;
  cleanedTranscriptText: string;
  cleanupStatus: string;
  cleanupMessage: string;
  cleanedOverallText: string;
  analysisStatus: string;
  analysisJson: string;
  aiModel: string;
  analysisErrorMessage: string;
  observationSaveStatus: string;
  observationSavedAt: string;
  observationRecordCount: number;
  observationAbilityLinkCount: number;
  observationSaveErrorMessage: string;
  record: DailyPracticeRecordRow | null;
};

type PracticeDraftState = Record<PracticeRole, PracticeDraft>;

const PRACTICE_ROLES: PracticeRole[] = ["PRIMARY", "RESERVE"];

function createEmptyPracticeDrafts(): PracticeDraftState {
  const empty = (): PracticeDraft => ({
    isPerformed: false,
    rawTranscriptText: "",
    cleanedTranscriptText: "",
    cleanupStatus: "NOT_CLEANED",
    cleanupMessage: "",
    cleanedOverallText: "",
    analysisStatus: "NOT_ANALYZED",
    analysisJson: "",
    aiModel: "",
    analysisErrorMessage: "",
    observationSaveStatus: "NOT_SAVED",
    observationSavedAt: "",
    observationRecordCount: 0,
    observationAbilityLinkCount: 0,
    observationSaveErrorMessage: "",
    record: null,
  });

  return {
    PRIMARY: empty(),
    RESERVE: empty(),
  };
}

function practiceForRole(
  content: DailyPlanContent | null,
  role: PracticeRole,
): PracticeSnapshot | null {
  if (!content) return null;
  return role === "PRIMARY" ? content.primaryPractice : content.reservePractice;
}

function practiceRoleLabel(role: PracticeRole): string {
  return role === "PRIMARY" ? "主活動" : "予備活動";
}

function practiceTimeLabel(role: PracticeRole): string {
  return role === "PRIMARY"
    ? "主な実施時間帯：午前"
    : "主な実施時間帯：午後";
}

function practiceSequenceLabel(role: PracticeRole): string {
  return role === "PRIMARY" ? "1" : "2";
}

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
    .map((error) => error.message ?? "")
    .filter(Boolean)
    .join("\n");

  return message || fallback;
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

function parseDailyReportWorkflow(value: unknown): DailyReportWorkflow {
  const content = parseJsonRecord(value);
  const workflowRaw = content?.workflow;
  const workflow = typeof workflowRaw === "object" && workflowRaw !== null
    ? workflowRaw as Record<string, unknown>
    : {};
  const historyRaw = Array.isArray(workflow.history) ? workflow.history : [];

  const history = historyRaw
    .map((item): DailyReportWorkflowEntry | null => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const action = s(row.action).toUpperCase();
      const status = s(row.status).toUpperCase();
      if (!["COMPLETE", "CONFIRM", "RETURN"].includes(action)) return null;
      if (!["COMPLETED", "CONFIRMED", "RETURNED"].includes(status)) return null;
      return {
        action: action as DailyReportWorkflowEntry["action"],
        status: status as DailyReportWorkflowEntry["status"],
        actorUserId: s(row.actorUserId),
        actorName: s(row.actorName),
        actorRole: s(row.actorRole),
        at: s(row.at),
        comment: s(row.comment),
      };
    })
    .filter((item): item is DailyReportWorkflowEntry => Boolean(item));

  return {
    currentStatus: s(workflow.currentStatus),
    history,
  };
}

function appendDailyReportWorkflowEntry(
  contentJson: unknown,
  entry: DailyReportWorkflowEntry,
): string {
  const content = parseJsonRecord(contentJson) ?? {};
  const workflow = parseDailyReportWorkflow(contentJson);

  return JSON.stringify({
    ...content,
    schemaVersion: Math.max(4, n(content.schemaVersion, 4)),
    workflow: {
      currentStatus: entry.status,
      history: [...workflow.history, entry],
    },
  });
}

function workflowActionLabel(action: DailyReportWorkflowEntry["action"]): string {
  switch (action) {
    case "COMPLETE":
      return "記録完了";
    case "CONFIRM":
      return "確認";
    case "RETURN":
      return "差し戻し";
  }
}

function canReviewByRole(value: unknown): boolean {
  return [
    "DIRECTOR",
    "VICE_DIRECTOR",
    "DEPUTY_DIRECTOR",
    "LEAD_TEACHER",
    "SENIOR_TEACHER",
    "OWNER",
    "LEAD",
    "LEADER",
    "HEAD_TEACHER",
    "CHIEF",
    "MANAGER",
    "ADMIN",
  ].includes(s(value).toUpperCase());
}

type AnalysisAbilityCandidate = {
  abilityCode: string;
  confidence: number;
  evidenceText: string;
  reason: string;
};

type AnalysisChildEpisode = {
  childId: string;
  childName: string;
  episodeText: string;
  abilityCandidates: AnalysisAbilityCandidate[];
};

function parseChildEpisodes(value: unknown): AnalysisChildEpisode[] {
  const parsed = parseJsonRecord(value);
  const rows = parsed?.childEpisodes;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((item): AnalysisChildEpisode | null => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const candidates = Array.isArray(row.abilityCandidates)
        ? row.abilityCandidates
            .map((candidate): AnalysisAbilityCandidate | null => {
              if (typeof candidate !== "object" || candidate === null) return null;
              const c = candidate as Record<string, unknown>;
              return {
                abilityCode: s(c.abilityCode),
                confidence: Math.max(0, Math.min(1, n(c.confidence))),
                evidenceText: s(c.evidenceText),
                reason: s(c.reason),
              };
            })
            .filter((candidate): candidate is AnalysisAbilityCandidate =>
              Boolean(candidate?.abilityCode),
            )
        : [];

      const childId = s(row.childId);
      const childName = s(row.childName);
      const episodeText = s(row.episodeText);
      if (!childId || !childName || !episodeText) return null;

      return {
        childId,
        childName,
        episodeText,
        abilityCandidates: candidates,
      };
    })
    .filter((item): item is AnalysisChildEpisode => Boolean(item));
}

type ObservationEditAbility = {
  abilityCode: string;
  abilityName: string;
  selected: boolean;
  confidence: number | null;
  evidenceText: string;
  reason: string;
  source: "AI" | "MANUAL";
};

type ObservationEditChild = {
  childId: string;
  childName: string;
  episodeText: string;
  abilities: ObservationEditAbility[];
};

type ObservationEditState = Record<PracticeRole, ObservationEditChild[]>;

function createEmptyObservationEdits(): ObservationEditState {
  return {
    PRIMARY: [],
    RESERVE: [],
  };
}

function buildObservationEditsFromAnalysis(
  analysisJson: unknown,
  observationHints: ObservationHintRow[],
): ObservationEditChild[] {
  const allowedHints = observationHints.filter((hint) => hint.abilityCode);

  return parseChildEpisodes(analysisJson).map((episode) => {
    const candidateByCode = new Map(
      episode.abilityCandidates.map((candidate) => [candidate.abilityCode, candidate] as const),
    );

    return {
      childId: episode.childId,
      childName: episode.childName,
      episodeText: episode.episodeText,
      abilities: allowedHints.map((hint) => {
        const candidate = candidateByCode.get(hint.abilityCode);
        return {
          abilityCode: hint.abilityCode,
          abilityName: hint.abilityName,
          selected: Boolean(candidate),
          confidence: candidate ? candidate.confidence : null,
          evidenceText: candidate?.evidenceText ?? "",
          reason: candidate?.reason ?? "",
          source: candidate ? "AI" : "MANUAL",
        };
      }),
    };
  });
}

function parseAnalysisHintCodes(value: unknown): string[] {
  const parsed = parseJsonRecord(value);
  const rows = parsed?.observationHintAbilityCodes;
  return Array.isArray(rows)
    ? rows.map((item) => s(item)).filter(Boolean)
    : [];
}

function parseAnalysisHintSource(value: unknown): string {
  const parsed = parseJsonRecord(value);
  return s(parsed?.observationHintSource);
}

function aiStatusLabel(value: unknown): string {
  switch (s(value).toUpperCase()) {
    case "CLEANED":
      return "クリーンアップ済み";
    case "ANALYZED":
      return "解析済み";
    case "STALE":
      return "再実行が必要";
    case "ERROR":
      return "エラー";
    case "NOT_CLEANED":
      return "未クリーンアップ";
    case "NOT_ANALYZED":
      return "未解析";
    default:
      return s(value) || "未実行";
  }
}

function observationSaveStatusLabel(value: unknown): string {
  switch (s(value).toUpperCase()) {
    case "SAVED":
      return "正式保存済み";
    case "STALE":
      return "再保存が必要";
    case "ERROR":
      return "保存エラー";
    case "NOT_SAVED":
      return "未保存";
    default:
      return s(value) || "未保存";
  }
}

function observationRecordStableId(
  dailyPracticeRecordId: string,
  childId: string,
): string {
  return `observation-${dailyPracticeRecordId}-${childId}`;
}

function observationAbilityLinkStableId(
  observationRecordId: string,
  abilityCode: string,
): string {
  return `observation-link-${observationRecordId}-${abilityCode}`;
}

function todayJstDateOnly(now = new Date()): string {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function formatDateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "-";

  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function statusLabel(value: unknown): string {
  switch (s(value).toUpperCase()) {
    case "DRAFT":
      return "下書き";
    case "COMPLETED":
      return "記録完了";
    case "CONFIRMED":
      return "確認済み";
    case "RETURNED":
      return "差し戻し";
    case "ISSUED":
      return "発行済み";
    default:
      return s(value) || "未作成";
  }
}

function statusClass(value: unknown): string {
  switch (s(value).toUpperCase()) {
    case "CONFIRMED":
      return "approved";
    case "COMPLETED":
      return "submitted";
    case "RETURNED":
      return "rejected";
    case "ISSUED":
      return "issued";
    default:
      return "draft";
  }
}

function asObservationHints(value: unknown): ObservationHintRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): ObservationHintRow | null => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as Record<string, unknown>;
      const episodesRaw = typeof row.episodes === "object" && row.episodes !== null
        ? row.episodes as Record<string, unknown>
        : {};

      return {
        abilityCode: s(row.abilityCode),
        abilityName: s(row.abilityName),
        postureCode: s(row.postureCode),
        postureName: s(row.postureName),
        score: n(row.score),
        startingAge: n(row.startingAge),
        episodes: {
          episode1: s(episodesRaw.episode1),
          episode2: s(episodesRaw.episode2),
          episode3: s(episodesRaw.episode3),
        },
      };
    })
    .filter((item): item is ObservationHintRow => Boolean(item));
}

function asPracticeSnapshot(value: unknown): PracticeSnapshot {
  const row = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};

  return {
    practiceCode: s(row.practiceCode),
    name: s(row.name),
    memo: s(row.memo),
    practiceCategory: s(row.practiceCategory),
    practiceCategoryLabel: s(row.practiceCategoryLabel),
    observationHints: asObservationHints(row.observationHints),
  };
}

function parseDailyPlanContent(value: unknown): DailyPlanContent | null {
  const row = parseJsonRecord(value);
  if (!row) return null;

  const primaryPractice = asPracticeSnapshot(row.primaryPractice);
  const reservePractice = asPracticeSnapshot(row.reservePractice);

  // Compatibility with Phase 7-B daily plans. Those plans stored only the
  // primary observation hints at the top level.
  if (primaryPractice.observationHints.length === 0) {
    primaryPractice.observationHints = asObservationHints(row.observationHints);
  }

  return {
    schemaVersion: n(row.schemaVersion, 1),
    sourceWeeklyPlanId: s(row.sourceWeeklyPlanId),
    sourceWeeklyPlanTitle: s(row.sourceWeeklyPlanTitle),
    classroomId: s(row.classroomId),
    classroomName: s(row.classroomName),
    ageYears: n(row.ageYears) || null,
    targetDate: s(row.targetDate),
    dayLabel: s(row.dayLabel),
    primaryPractice,
    reservePractice,
  };
}

function sortClassrooms(rows: ClassroomRow[]): ClassroomRow[] {
  return [...rows].sort((a, b) => s(a.name).localeCompare(s(b.name), "ja"));
}

function sortNewest<T extends { updatedAt?: string | null; createdAt?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) =>
    s(b.updatedAt || b.createdAt).localeCompare(s(a.updatedAt || a.createdAt)),
  );
}

export default function DoWorkspacePanel(props: Props) {
  const {
    tenantId,
    tenantName,
    owner,
    ownerName,
    ownerRole,
    fiscalYear,
    currentClassroomId,
    allowedClassroomIds,
    isSchoolScope,
  } = props;

  const client = useMemo(() => generateClient<Schema>(), []);
  const classroomModel = client.models.Classroom as unknown as ClassroomModelClient;
  const planDocumentModel = client.models.PlanDocument as unknown as PlanDocumentModelClient;
  const dailyReportModel = client.models.DailyReport as unknown as DailyReportModelClient;
  const dailyPracticeRecordModel = client.models
    .DailyPracticeRecord as unknown as DailyPracticeRecordModelClient;
  const observationRecordModel = client.models
    .ObservationRecord as unknown as ObservationRecordModelClient;
  const observationAbilityLinkModel = client.models
    .ObservationAbilityLink as unknown as ObservationAbilityLinkModelClient;
  const cleanupTranscriptText = client.mutations
    .cleanupTranscriptText as unknown as CleanupTranscriptMutation;
  const analyzeDailyPracticeObservation = client.mutations
    .analyzeDailyPracticeObservation as unknown as AnalyzeDailyPracticeObservationMutation;

  const [targetDate, setTargetDate] = useState(() => todayJstDateOnly());
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [dailyPlans, setDailyPlans] = useState<PlanDocumentRow[]>([]);
  const [selectedDailyPlanId, setSelectedDailyPlanId] = useState("");
  const [dailyReport, setDailyReport] = useState<DailyReportRow | null>(null);
  const [practiceDrafts, setPracticeDrafts] = useState<PracticeDraftState>(() =>
    createEmptyPracticeDrafts(),
  );
  const [observationEdits, setObservationEdits] = useState<ObservationEditState>(() =>
    createEmptyObservationEdits(),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cleanupWorkingRole, setCleanupWorkingRole] = useState<PracticeRole | null>(null);
  const [analysisWorkingRole, setAnalysisWorkingRole] = useState<PracticeRole | null>(null);
  const [observationSavingRole, setObservationSavingRole] = useState<PracticeRole | null>(null);
  const [workflowWorking, setWorkflowWorking] = useState(false);
  const [workflowComment, setWorkflowComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const allowedClassroomIdSet = useMemo(
    () => new Set((allowedClassroomIds ?? []).map((id) => s(id)).filter(Boolean)),
    [allowedClassroomIds],
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((row) => s(row.id) === selectedClassroomId) ?? null,
    [classrooms, selectedClassroomId],
  );

  const selectedDailyPlan = useMemo(
    () => dailyPlans.find((row) => s(row.id) === selectedDailyPlanId) ?? null,
    [dailyPlans, selectedDailyPlanId],
  );

  const dailyPlanContent = useMemo(
    () => parseDailyPlanContent(selectedDailyPlan?.contentJson),
    [selectedDailyPlan?.contentJson],
  );

  const performedRoles = useMemo(
    () =>
      PRACTICE_ROLES.filter((role) => {
        const practice = practiceForRole(dailyPlanContent, role);
        return Boolean(practice?.practiceCode && practiceDrafts[role].isPerformed);
      }),
    [dailyPlanContent, practiceDrafts],
  );

  const allPerformedDraftsHaveText = useMemo(
    () =>
      performedRoles.length > 0 &&
      performedRoles.every((role) => practiceDrafts[role].rawTranscriptText.trim().length > 0),
    [performedRoles, practiceDrafts],
  );

  const classroomSelectionLocked =
    !isSchoolScope && (allowedClassroomIds?.length ?? 0) <= 1;

  const reportEditable = !dailyReport || ["DRAFT", "RETURNED"].includes(
    s(dailyReport.status).toUpperCase(),
  );


  const normalizedOwnerRole = s(ownerRole).toUpperCase();
  const canReviewReport = canReviewByRole(normalizedOwnerRole);
  const reportWorkflow = useMemo(
    () => parseDailyReportWorkflow(dailyReport?.contentJson),
    [dailyReport?.contentJson],
  );

  const completionProblems = useMemo(() => {
    const problems: string[] = [];
    if (performedRoles.length === 0) {
      problems.push("実際に行ったPracticeが選択されていません。");
      return problems;
    }

    for (const role of performedRoles) {
      const label = practiceRoleLabel(role);
      const draft = practiceDrafts[role];
      if (!draft.rawTranscriptText.trim()) {
        problems.push(`${label}の音声入力テキストがありません。`);
      }
      if (s(draft.cleanupStatus).toUpperCase() !== "CLEANED") {
        problems.push(`${label}のAIクリーンアップが完了していません。`);
      }
      if (s(draft.analysisStatus).toUpperCase() !== "ANALYZED") {
        problems.push(`${label}の子ども別・Ability解析が完了していません。`);
      }
      if (s(draft.observationSaveStatus).toUpperCase() !== "SAVED") {
        problems.push(`${label}の観察記録が正式保存されていません。`);
      }
    }

    return problems;
  }, [performedRoles, practiceDrafts]);

  const reportReadyToComplete = completionProblems.length === 0;

  const loadClassrooms = useCallback(async () => {
    if (!tenantId) {
      setClassrooms([]);
      setSelectedClassroomId("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await listAll<ClassroomRow>(classroomModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          status: { eq: "ACTIVE" },
        },
      });

      const visible = sortClassrooms(
        rows.filter((row) => {
          const classroomId = s(row.id);
          if (!classroomId) return false;
          return isSchoolScope || allowedClassroomIdSet.has(classroomId);
        }),
      );

      setClassrooms(visible);
      setSelectedClassroomId((current) => {
        if (current && visible.some((row) => s(row.id) === current)) return current;
        if (
          currentClassroomId &&
          visible.some((row) => s(row.id) === currentClassroomId)
        ) {
          return currentClassroomId;
        }
        return s(visible[0]?.id);
      });
    } catch (cause) {
      console.error(cause);
      setError(
        `Do Workspace クラス読み込みエラー: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, [
    allowedClassroomIdSet,
    classroomModel.list,
    currentClassroomId,
    fiscalYear,
    isSchoolScope,
    tenantId,
  ]);

  const loadDailyPlans = useCallback(async () => {
    if (!tenantId || !selectedClassroomId || !targetDate) {
      setDailyPlans([]);
      setSelectedDailyPlanId("");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const rows = await listAll<PlanDocumentRow>(planDocumentModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          fiscalYear: { eq: fiscalYear },
          classroomId: { eq: selectedClassroomId },
          planLevel: { eq: "SHORT_TERM" },
          planKind: { eq: "DAILY" },
          periodStartDate: { eq: targetDate },
        },
      });

      const visible = sortNewest(
        rows.filter((row) =>
          s(row.status).toUpperCase() === "ISSUED" &&
          s(row.periodEndDate) === targetDate,
        ),
      );

      setDailyPlans(visible);
      setSelectedDailyPlanId((current) => {
        if (current && visible.some((row) => s(row.id) === current)) return current;
        return s(visible[0]?.id);
      });
    } catch (cause) {
      console.error(cause);
      setError(
        `発行済み日案読み込みエラー: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      setDailyPlans([]);
      setSelectedDailyPlanId("");
    } finally {
      setLoading(false);
    }
  }, [
    fiscalYear,
    planDocumentModel.list,
    selectedClassroomId,
    targetDate,
    tenantId,
  ]);

  const loadDailyReport = useCallback(async () => {
    if (!tenantId || !selectedDailyPlanId) {
      setDailyReport(null);
      setPracticeDrafts(createEmptyPracticeDrafts());
      setObservationEdits(createEmptyObservationEdits());
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await listAll<DailyReportRow>(dailyReportModel.list, {
        filter: {
          tenantId: { eq: tenantId },
          dailyPlanId: { eq: selectedDailyPlanId },
        },
      });

      const latest = sortNewest(
        rows.filter((row) => s(row.status).toUpperCase() !== "ARCHIVED"),
      )[0] ?? null;

      const practiceRecords = latest?.id
        ? await listAll<DailyPracticeRecordRow>(dailyPracticeRecordModel.list, {
            filter: {
              tenantId: { eq: tenantId },
              dailyReportId: { eq: s(latest.id) },
            },
          })
        : [];

      const latestByRole = new Map<PracticeRole, DailyPracticeRecordRow>();
      for (const row of sortNewest(practiceRecords)) {
        const role = s(row.practiceRole).toUpperCase();
        if ((role === "PRIMARY" || role === "RESERVE") && !latestByRole.has(role)) {
          latestByRole.set(role, row);
        }
      }

      const nextDrafts = createEmptyPracticeDrafts();

      if (latestByRole.size > 0) {
        for (const role of PRACTICE_ROLES) {
          const record = latestByRole.get(role) ?? null;
          nextDrafts[role] = {
            isPerformed: record?.isPerformed === true,
            rawTranscriptText: s(record?.rawTranscriptText),
            cleanedTranscriptText: s(record?.cleanedTranscriptText),
            cleanupStatus: s(record?.cleanupStatus) || (s(record?.cleanedTranscriptText) ? "CLEANED" : "NOT_CLEANED"),
            cleanupMessage: s(record?.cleanupMessage),
            cleanedOverallText: s(record?.cleanedOverallText),
            analysisStatus: s(record?.analysisStatus) || (s(record?.analysisJson) ? "ANALYZED" : "NOT_ANALYZED"),
            analysisJson: s(record?.analysisJson),
            aiModel: s(record?.aiModel),
            analysisErrorMessage: s(record?.analysisErrorMessage),
            observationSaveStatus: s(record?.observationSaveStatus) || "NOT_SAVED",
            observationSavedAt: s(record?.observationSavedAt),
            observationRecordCount: n(record?.observationRecordCount),
            observationAbilityLinkCount: n(record?.observationAbilityLinkCount),
            observationSaveErrorMessage: s(record?.observationSaveErrorMessage),
            record,
          };
        }
      } else if (latest) {
        // Compatibility with the first Phase 8-A model, which stored a single
        // Practice and transcript directly on DailyReport.
        const legacyRole = s(latest.actualPracticeRole).toUpperCase() === "RESERVE"
          ? "RESERVE"
          : "PRIMARY";
        nextDrafts[legacyRole] = {
          ...nextDrafts[legacyRole],
          isPerformed: true,
          rawTranscriptText: s(latest.rawTranscriptText),
          cleanedOverallText: s(latest.cleanedOverallText),
          record: null,
        };
      } else if (dailyPlanContent?.primaryPractice.practiceCode) {
        nextDrafts.PRIMARY.isPerformed = true;
      } else if (dailyPlanContent?.reservePractice.practiceCode) {
        nextDrafts.RESERVE.isPerformed = true;
      }

      const nextObservationEdits = createEmptyObservationEdits();

      for (const role of PRACTICE_ROLES) {
        const practiceRecord = nextDrafts[role].record;
        const practice = practiceForRole(dailyPlanContent, role);
        const hints = practice?.observationHints ?? [];
        const analysisEdits = buildObservationEditsFromAnalysis(
          nextDrafts[role].analysisJson,
          hints,
        );

        if (!practiceRecord?.id) {
          nextObservationEdits[role] = analysisEdits;
          continue;
        }

        const savedObservations = await listAll<ObservationRecordRow>(
          observationRecordModel.list,
          {
            filter: {
              tenantId: { eq: tenantId },
              dailyPracticeRecordId: { eq: s(practiceRecord.id) },
            },
          },
        );

        if (savedObservations.length === 0) {
          nextObservationEdits[role] = analysisEdits;
          continue;
        }

        const savedEdits: ObservationEditChild[] = [];
        for (const observation of savedObservations) {
          const observationId = s(observation.id);
          if (!observationId) continue;

          const savedLinks = await listAll<ObservationAbilityLinkRow>(
            observationAbilityLinkModel.list,
            {
              filter: {
                tenantId: { eq: tenantId },
                observationId: { eq: observationId },
              },
            },
          );
          const linkByCode = new Map(
            savedLinks
              .filter((link) => s(link.abilityCode))
              .map((link) => [s(link.abilityCode), link] as const),
          );

          savedEdits.push({
            childId: s(observation.childId),
            childName: s(observation.childName) || s(observation.childId),
            episodeText: s(observation.episodeText) || s(observation.body),
            abilities: hints
              .filter((hint) => hint.abilityCode)
              .map((hint) => {
                const link = linkByCode.get(hint.abilityCode);
                const confidence = link?.confidence;
                return {
                  abilityCode: hint.abilityCode,
                  abilityName: hint.abilityName,
                  selected: Boolean(link),
                  confidence: typeof confidence === "number" ? confidence : null,
                  evidenceText: s(link?.evidenceText),
                  reason: s(link?.reason),
                  source: s(link?.source).toUpperCase() === "AI" ? "AI" : "MANUAL",
                };
              }),
          });
        }

        nextObservationEdits[role] = savedEdits.sort((a, b) =>
          a.childName.localeCompare(b.childName, "ja"),
        );
      }

      setDailyReport(latest);
      setPracticeDrafts(nextDrafts);
      setObservationEdits(nextObservationEdits);
    } catch (cause) {
      console.error(cause);
      setError(
        `日報下書き読み込みエラー: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      setDailyReport(null);
      setPracticeDrafts(createEmptyPracticeDrafts());
      setObservationEdits(createEmptyObservationEdits());
    } finally {
      setLoading(false);
    }
  }, [
    dailyPlanContent?.primaryPractice.practiceCode,
    dailyPlanContent?.reservePractice.practiceCode,
    dailyPlanContent,
    dailyPracticeRecordModel.list,
    dailyReportModel.list,
    observationAbilityLinkModel.list,
    observationRecordModel.list,
    selectedDailyPlanId,
    tenantId,
  ]);

  useEffect(() => {
    void loadClassrooms();
  }, [loadClassrooms]);

  useEffect(() => {
    setDailyPlans([]);
    setSelectedDailyPlanId("");
    setDailyReport(null);
    setPracticeDrafts(createEmptyPracticeDrafts());
    setObservationEdits(createEmptyObservationEdits());
    void loadDailyPlans();
  }, [loadDailyPlans]);

  useEffect(() => {
    setDailyReport(null);
    setPracticeDrafts(createEmptyPracticeDrafts());
    setObservationEdits(createEmptyObservationEdits());
    void loadDailyReport();
  }, [loadDailyReport]);

  async function saveDraftCore(options?: {
    silent?: boolean;
    requiredRole?: PracticeRole;
  }): Promise<PracticeDraftState | null> {
    const silent = options?.silent === true;

    if (!tenantId) {
      setError("tenantId が未取得です。");
      return null;
    }

    if (!selectedClassroomId || !selectedClassroom) {
      setError("対象クラスを選択してください。");
      return null;
    }

    if (!selectedDailyPlan?.id || !dailyPlanContent) {
      setError("発行済み日案を選択してください。");
      return null;
    }

    if (performedRoles.length === 0) {
      setError("実際に行ったPracticeを1件以上選択してください。");
      return null;
    }

    const rolesToValidate = options?.requiredRole
      ? [options.requiredRole]
      : performedRoles;
    const emptyRole = rolesToValidate.find(
      (role) => !practiceDrafts[role].rawTranscriptText.trim(),
    );
    if (emptyRole) {
      setError(`${practiceRoleLabel(emptyRole)}の子どもの様子・実践記録を入力してください。`);
      return null;
    }

    if (!reportEditable) {
      setError("この日報は記録完了または確認済みのため、Phase 8-B画面では編集できません。");
      return null;
    }

    setSaving(true);
    setError("");
    if (!silent) setMessage("");

    try {
      const nowIso = new Date().toISOString();
      const practiced = performedRoles.map((role) => {
        const practice = practiceForRole(dailyPlanContent, role);
        return {
          role,
          roleLabel: practiceRoleLabel(role),
          practiceCode: s(practice?.practiceCode),
          practiceName: s(practice?.name),
        };
      });

      const combinedTranscript = performedRoles
        .map((role) => {
          const practice = practiceForRole(dailyPlanContent, role);
          return `【${practiceRoleLabel(role)}：${s(practice?.name) || s(practice?.practiceCode)}】\n${practiceDrafts[role].rawTranscriptText.trim()}`;
        })
        .join("\n\n");

      const existingContent = parseJsonRecord(dailyReport?.contentJson) ?? {};
      const existingWorkflow = parseDailyReportWorkflow(dailyReport?.contentJson);
      const currentReportStatus = s(dailyReport?.status).toUpperCase();
      const editableReportStatus = currentReportStatus === "RETURNED" ? "RETURNED" : "DRAFT";

      const content = {
        ...existingContent,
        schemaVersion: 4,
        reportType: "DAILY_PRACTICE_REPORT",
        practiceRecordModel: "DailyPracticeRecord",
        aiFlow: "RAW_TRANSCRIPT -> CLEANUP_REQUIRED -> CHILD_ABILITY_ANALYSIS",
        sourceDailyPlanId: s(selectedDailyPlan.id),
        sourceDailyPlanTitle: s(selectedDailyPlan.title),
        sourceWeeklyPlanId: dailyPlanContent.sourceWeeklyPlanId,
        sourceWeeklyPlanTitle: dailyPlanContent.sourceWeeklyPlanTitle,
        classroomId: selectedClassroomId,
        classroomName: s(selectedClassroom.name) || dailyPlanContent.classroomName,
        practicedRoles: practiced,
        workflow: {
          currentStatus: existingWorkflow.currentStatus || editableReportStatus,
          history: existingWorkflow.history,
        },
        draft: {
          savedAt: nowIso,
          savedByUserId: owner,
          savedByName: s(ownerName) || owner,
        },
      };

      const singleRole = performedRoles.length === 1 ? performedRoles[0] : null;
      const singlePractice = singleRole
        ? practiceForRole(dailyPlanContent, singleRole)
        : null;

      const headerPayload = {
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        dailyPlanId: s(selectedDailyPlan.id),
        reportDate: targetDate,
        actualPracticeRole: singleRole ?? "MULTIPLE",
        actualPracticeCode: singlePractice?.practiceCode ?? "",
        actualPracticeName: singlePractice?.name ?? "複数Practice",
        rawTranscriptText: combinedTranscript,
        cleanedOverallText: dailyReport?.cleanedOverallText ?? undefined,
        status: editableReportStatus,
        contentJson: JSON.stringify(content),
        createdByUserId: dailyReport?.id ? undefined : owner,
        updatedByUserId: owner,
      };

      const headerResult = dailyReport?.id
        ? await dailyReportModel.update({ id: s(dailyReport.id), ...headerPayload })
        : await dailyReportModel.create(headerPayload);

      if (headerResult.errors?.length) {
        throw new Error(errorText(headerResult.errors, "日報下書き保存に失敗しました。"));
      }

      const savedHeader = headerResult.data ?? null;
      const dailyReportId = s(savedHeader?.id) || s(dailyReport?.id);
      if (!dailyReportId) {
        throw new Error("DailyReport.idを取得できませんでした。");
      }

      const nextDrafts: PracticeDraftState = {
        PRIMARY: { ...practiceDrafts.PRIMARY },
        RESERVE: { ...practiceDrafts.RESERVE },
      };

      for (const role of PRACTICE_ROLES) {
        const practice = practiceForRole(dailyPlanContent, role);
        if (!practice?.practiceCode) continue;

        const draft = practiceDrafts[role];
        const existingRecord = draft.record;

        if (!existingRecord?.id && !draft.isPerformed && !draft.rawTranscriptText.trim()) {
          continue;
        }

        const nextRawText = draft.rawTranscriptText.trim();
        const rawChanged = Boolean(existingRecord?.id) &&
          s(existingRecord?.rawTranscriptText) !== nextRawText;
        const cleanupStatus = rawChanged
          ? (draft.cleanedTranscriptText ? "STALE" : "NOT_CLEANED")
          : (draft.cleanupStatus || (draft.cleanedTranscriptText ? "CLEANED" : "NOT_CLEANED"));
        const analysisStatus = rawChanged
          ? (draft.analysisJson ? "STALE" : "NOT_ANALYZED")
          : (draft.analysisStatus || (draft.analysisJson ? "ANALYZED" : "NOT_ANALYZED"));
        const observationSaveStatus = rawChanged || analysisStatus === "STALE"
          ? (draft.observationSaveStatus === "SAVED" ? "STALE" : draft.observationSaveStatus || "NOT_SAVED")
          : (draft.observationSaveStatus || "NOT_SAVED");

        const recordPayload = {
          tenantId,
          fiscalYear,
          classroomId: selectedClassroomId,
          dailyReportId,
          dailyPlanId: s(selectedDailyPlan.id),
          reportDate: targetDate,
          practiceRole: role,
          practiceCode: practice.practiceCode,
          practiceName: practice.name || practice.practiceCode,
          isPerformed: draft.isPerformed,
          observationHintsJson: JSON.stringify(practice.observationHints),
          rawTranscriptText: nextRawText,
          cleanedTranscriptText: draft.cleanedTranscriptText.trim() || undefined,
          cleanupStatus,
          cleanupMessage: draft.cleanupMessage || undefined,
          cleanedAt: existingRecord?.cleanedAt ?? undefined,
          cleanedOverallText: draft.cleanedOverallText.trim() || undefined,
          analysisStatus,
          analysisJson: draft.analysisJson || undefined,
          aiModel: draft.aiModel || undefined,
          analyzedAt: existingRecord?.analyzedAt ?? undefined,
          analysisErrorMessage: draft.analysisErrorMessage || undefined,
          observationSaveStatus,
          observationSavedAt: draft.observationSavedAt || existingRecord?.observationSavedAt || undefined,
          observationRecordCount: draft.observationRecordCount,
          observationAbilityLinkCount: draft.observationAbilityLinkCount,
          observationSaveErrorMessage: draft.observationSaveErrorMessage || undefined,
          status: editableReportStatus,
          sortOrder: role === "PRIMARY" ? 1 : 2,
          createdByUserId: existingRecord?.id ? undefined : owner,
          updatedByUserId: owner,
        };

        const recordResult = existingRecord?.id
          ? await dailyPracticeRecordModel.update({
              id: s(existingRecord.id),
              ...recordPayload,
            })
          : await dailyPracticeRecordModel.create(recordPayload);

        if (recordResult.errors?.length) {
          throw new Error(
            errorText(
              recordResult.errors,
              `${practiceRoleLabel(role)}のPractice記録保存に失敗しました。`,
            ),
          );
        }

        const savedRecord = recordResult.data ?? {
          ...existingRecord,
          ...recordPayload,
          id: s(existingRecord?.id),
          updatedAt: nowIso,
        };

        nextDrafts[role] = {
          ...draft,
          cleanupStatus,
          analysisStatus,
          observationSaveStatus,
          record: savedRecord,
        };
      }

      setDailyReport(
        savedHeader ?? {
          ...dailyReport,
          id: dailyReportId,
          ...headerPayload,
          updatedAt: nowIso,
        },
      );
      setPracticeDrafts(nextDrafts);
      if (!silent) {
        setMessage(
          `${formatDateLabel(targetDate)}の日報下書きを保存しました。Practice ${performedRoles.length}件 / 記録者候補: ${s(ownerName) || owner}`,
        );
      }
      return nextDrafts;
    } catch (cause) {
      console.error(cause);
      setError(
        `日報下書き保存エラー: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    await saveDraftCore();
  }

  async function handleCleanupTranscript(role: PracticeRole) {
    const practice = practiceForRole(dailyPlanContent, role);
    const draft = practiceDrafts[role];
    if (!practice?.practiceCode || !draft.isPerformed) {
      setError(`${practiceRoleLabel(role)}を「実際に行った」にしてください。`);
      return;
    }
    if (!draft.rawTranscriptText.trim()) {
      setError(`${practiceRoleLabel(role)}の音声入力テキストを入力してください。`);
      return;
    }

    setCleanupWorkingRole(role);
    setError("");
    setMessage("");

    try {
      const savedDrafts = await saveDraftCore({ silent: true, requiredRole: role });
      const saved = savedDrafts?.[role];
      const recordId = s(saved?.record?.id);
      if (!saved || !recordId) {
        throw new Error("先にDailyPracticeRecordを保存できませんでした。");
      }

      const result = await cleanupTranscriptText({
        practiceCode: practice.practiceCode,
        childNames: [],
        transcriptText: saved.rawTranscriptText,
      });
      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "AIクリーンアップに失敗しました。"));
      }

      const cleanedText = s(result.data?.cleanedText);
      if (!cleanedText) {
        throw new Error("AIクリーンアップ結果が空です。");
      }

      const cleanedAt = new Date().toISOString();
      const nextAnalysisStatus = saved.analysisJson ? "STALE" : "NOT_ANALYZED";
      const nextObservationSaveStatus = saved.observationSaveStatus === "SAVED"
        ? "STALE"
        : saved.observationSaveStatus || "NOT_SAVED";
      const updateResult = await dailyPracticeRecordModel.update({
        id: recordId,
        cleanedTranscriptText: cleanedText,
        cleanupStatus: "CLEANED",
        cleanupMessage: s(result.data?.message),
        cleanedAt,
        analysisStatus: nextAnalysisStatus,
        analysisErrorMessage: "",
        observationSaveStatus: nextObservationSaveStatus,
        observationSaveErrorMessage: "",
        updatedByUserId: owner,
      });
      if (updateResult.errors?.length) {
        throw new Error(errorText(updateResult.errors, "クリーンアップ結果保存に失敗しました。"));
      }

      setPracticeDrafts((current) => ({
        ...current,
        [role]: {
          ...current[role],
          cleanedTranscriptText: cleanedText,
          cleanupStatus: "CLEANED",
          cleanupMessage: s(result.data?.message),
          analysisStatus: nextAnalysisStatus,
          analysisErrorMessage: "",
          observationSaveStatus: nextObservationSaveStatus,
          observationSaveErrorMessage: "",
          record: updateResult.data ?? {
            ...current[role].record,
            cleanedTranscriptText: cleanedText,
            cleanupStatus: "CLEANED",
            cleanupMessage: s(result.data?.message),
            cleanedAt,
            analysisStatus: nextAnalysisStatus,
          },
        },
      }));
      setMessage(`${practiceRoleLabel(role)}の音声入力テキストをAIでクリーンアップしました。内容を確認・修正してから解析してください。`);
    } catch (cause) {
      console.error(cause);
      setError(`AIクリーンアップエラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setCleanupWorkingRole(null);
    }
  }

  async function handleAnalyzeObservation(role: PracticeRole) {
    const practice = practiceForRole(dailyPlanContent, role);
    const draft = practiceDrafts[role];
    if (!practice?.practiceCode || !draft.isPerformed) {
      setError(`${practiceRoleLabel(role)}を「実際に行った」にしてください。`);
      return;
    }
    if (draft.cleanupStatus !== "CLEANED" || !draft.cleanedTranscriptText.trim()) {
      setError(`${practiceRoleLabel(role)}は、先にAIクリーンアップを実行してください。`);
      return;
    }

    setAnalysisWorkingRole(role);
    setError("");
    setMessage("");

    try {
      const savedDrafts = await saveDraftCore({ silent: true, requiredRole: role });
      const saved = savedDrafts?.[role];
      const recordId = s(saved?.record?.id);
      if (!saved || !recordId) {
        throw new Error("DailyPracticeRecordを保存できませんでした。");
      }
      if (saved.cleanupStatus !== "CLEANED") {
        throw new Error("音声入力テキストが変更されています。AIクリーンアップを再実行してください。");
      }

      const result = await analyzeDailyPracticeObservation({
        dailyPracticeRecordId: recordId,
        cleanedTranscriptText: saved.cleanedTranscriptText.trim(),
      });
      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "子ども別・Ability解析に失敗しました。"));
      }

      const cleanedOverallText = s(result.data?.cleanedOverallText);
      const analysisJson = s(result.data?.analysisJson);
      if (!cleanedOverallText || !analysisJson) {
        throw new Error("解析結果が空または不正です。");
      }

      const analyzedAt = new Date().toISOString();
      setPracticeDrafts((current) => ({
        ...current,
        [role]: {
          ...current[role],
          cleanedOverallText,
          analysisStatus: "ANALYZED",
          analysisJson,
          aiModel: s(result.data?.aiModel),
          analysisErrorMessage: "",
          observationSaveStatus: current[role].observationSaveStatus === "SAVED" ? "STALE" : "NOT_SAVED",
          observationSaveErrorMessage: "",
          record: {
            ...current[role].record,
            cleanedTranscriptText: current[role].cleanedTranscriptText,
            cleanedOverallText,
            analysisStatus: "ANALYZED",
            analysisJson,
            aiModel: s(result.data?.aiModel),
            analyzedAt,
            analysisErrorMessage: "",
            observationSaveStatus: current[role].observationSaveStatus === "SAVED" ? "STALE" : "NOT_SAVED",
            observationSaveErrorMessage: "",
          },
        },
      }));
      setObservationEdits((current) => ({
        ...current,
        [role]: buildObservationEditsFromAnalysis(
          analysisJson,
          practice.observationHints,
        ),
      }));
      setMessage(`${practiceRoleLabel(role)}の子ども別エピソード・Ability解析が完了しました。${s(result.data?.message)}`);
    } catch (cause) {
      console.error(cause);
      setPracticeDrafts((current) => ({
        ...current,
        [role]: {
          ...current[role],
          analysisStatus: "ERROR",
          analysisErrorMessage: cause instanceof Error ? cause.message : String(cause),
        },
      }));
      setError(`子ども別・Ability解析エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setAnalysisWorkingRole(null);
    }
  }

  function markFormalObservationStale(role: PracticeRole) {
    setPracticeDrafts((current) => ({
      ...current,
      [role]: {
        ...current[role],
        observationSaveStatus:
          current[role].observationSaveStatus === "SAVED"
            ? "STALE"
            : current[role].observationSaveStatus,
        observationSaveErrorMessage: "",
      },
    }));
  }

  function handleChangeFormalEpisode(
    role: PracticeRole,
    childId: string,
    episodeText: string,
  ) {
    setObservationEdits((current) => ({
      ...current,
      [role]: current[role].map((episode) =>
        episode.childId === childId ? { ...episode, episodeText } : episode,
      ),
    }));
    markFormalObservationStale(role);
  }

  function handleToggleFormalAbility(
    role: PracticeRole,
    childId: string,
    abilityCode: string,
    selected: boolean,
  ) {
    const child = observationEdits[role].find((episode) => episode.childId === childId);
    if (!child) return;

    const selectedCount = child.abilities.filter((ability) => ability.selected).length;
    if (selected && selectedCount >= 2) {
      setError("Abilityは子ども1人につき最大2件です。別の候補を外してから選択してください。");
      return;
    }

    setError("");
    setObservationEdits((current) => ({
      ...current,
      [role]: current[role].map((episode) =>
        episode.childId !== childId
          ? episode
          : {
              ...episode,
              abilities: episode.abilities.map((ability) =>
                ability.abilityCode !== abilityCode
                  ? ability
                  : {
                      ...ability,
                      selected,
                      source: selected && !ability.selected ? "MANUAL" : ability.source,
                    },
              ),
            },
      ),
    }));
    markFormalObservationStale(role);
  }

  async function handleSaveObservationRecords(role: PracticeRole) {
    const practice = practiceForRole(dailyPlanContent, role);
    const draft = practiceDrafts[role];

    if (!practice?.practiceCode || !draft.isPerformed) {
      setError(`${practiceRoleLabel(role)}を「実際に行った」にしてください。`);
      return;
    }
    if (!reportEditable) {
      setError("この日報は編集できません。");
      return;
    }
    if (draft.analysisStatus !== "ANALYZED" || !draft.analysisJson) {
      setError(`${practiceRoleLabel(role)}は、先に子ども別・Ability解析を完了してください。`);
      return;
    }

    setObservationSavingRole(role);
    setError("");
    setMessage("");

    let targetRecordId = s(draft.record?.id);

    try {
      const savedDrafts = await saveDraftCore({ silent: true, requiredRole: role });
      const saved = savedDrafts?.[role];
      targetRecordId = s(saved?.record?.id);
      const dailyReportId = s(saved?.record?.dailyReportId) || s(dailyReport?.id);

      if (!saved || !targetRecordId || !dailyReportId) {
        throw new Error("正式保存に必要な日報・Practice記録IDを取得できませんでした。");
      }
      if (saved.analysisStatus !== "ANALYZED" || !saved.analysisJson) {
        throw new Error("解析結果が変更されています。子ども別・Ability解析を再実行してください。");
      }

      const episodes = observationEdits[role];
      if (episodes.length === 0) {
        throw new Error("正式保存する子ども別エピソードがありません。");
      }
      const emptyEpisode = episodes.find((episode) => !episode.episodeText.trim());
      if (emptyEpisode) {
        throw new Error(`${emptyEpisode.childName}さんのエピソードを入力してください。`);
      }

      const allowedAbilityMap = new Map(
        practice.observationHints
          .filter((hint) => hint.abilityCode)
          .map((hint) => [hint.abilityCode, hint] as const),
      );

      const existingObservations = await listAll<ObservationRecordRow>(
        observationRecordModel.list,
        {
          filter: {
            tenantId: { eq: tenantId },
            dailyPracticeRecordId: { eq: targetRecordId },
          },
        },
      );
      const existingById = new Map(
        existingObservations
          .filter((row) => s(row.id))
          .map((row) => [s(row.id), row] as const),
      );

      const nowIso = new Date().toISOString();
      const desiredObservationIds = new Set<string>();
      let savedObservationCount = 0;
      let savedAbilityLinkCount = 0;

      for (const episode of episodes) {
        const observationId = observationRecordStableId(
          targetRecordId,
          episode.childId,
        );
        desiredObservationIds.add(observationId);

        const selectedCandidates = episode.abilities
          .filter(
            (candidate) =>
              candidate.selected && allowedAbilityMap.has(candidate.abilityCode),
          )
          .filter(
            (candidate, index, rows) =>
              rows.findIndex(
                (row) => row.abilityCode === candidate.abilityCode,
              ) === index,
          )
          .slice(0, 2);

        const observationPayload = {
          tenantId,
          fiscalYear,
          classroomId: selectedClassroomId,
          childId: episode.childId,
          childName: episode.childName,
          observedDate: targetDate,
          observerUserId: owner,
          sourceType: "AI",
          body: episode.episodeText,
          dailyPlanId: s(selectedDailyPlan?.id),
          dailyReportId,
          dailyPracticeRecordId: targetRecordId,
          reportDate: targetDate,
          practiceRole: role,
          practiceCode: practice.practiceCode,
          practiceName: practice.name || practice.practiceCode,
          episodeText: episode.episodeText,
          status: "DRAFT",
          observedByUserId: owner,
          observedByName: s(ownerName) || owner,
          observedAt: nowIso,
          aiGenerated: true,
          sourceAnalysisJson: JSON.stringify({
            childId: episode.childId,
            childName: episode.childName,
            episodeText: episode.episodeText,
            abilityCandidates: selectedCandidates,
          }),
          createdByUserId: existingById.has(observationId) ? undefined : owner,
          updatedByUserId: owner,
        };

        const observationResult = existingById.has(observationId)
          ? await observationRecordModel.update({
              id: observationId,
              ...observationPayload,
            })
          : await observationRecordModel.create({
              id: observationId,
              ...observationPayload,
            });

        if (observationResult.errors?.length) {
          throw new Error(
            errorText(
              observationResult.errors,
              `${episode.childName}さんの観察記録保存に失敗しました。`,
            ),
          );
        }
        savedObservationCount += 1;

        const oldLinks = await listAll<ObservationAbilityLinkRow>(
          observationAbilityLinkModel.list,
          {
            filter: {
              tenantId: { eq: tenantId },
              observationId: { eq: observationId },
            },
          },
        );
        for (const oldLink of oldLinks) {
          const oldLinkId = s(oldLink.id);
          if (!oldLinkId) continue;
          const deleted = await observationAbilityLinkModel.delete({ id: oldLinkId });
          if (deleted.errors?.length) {
            throw new Error(
              errorText(
                deleted.errors,
                `${episode.childName}さんの旧Abilityリンク削除に失敗しました。`,
              ),
            );
          }
        }

        for (const candidate of selectedCandidates) {
          const hint = allowedAbilityMap.get(candidate.abilityCode);
          const linkResult = await observationAbilityLinkModel.create({
            id: observationAbilityLinkStableId(
              observationId,
              candidate.abilityCode,
            ),
            tenantId,
            observationId: observationId,
            childId: episode.childId,
            abilityCode: candidate.abilityCode,
            abilityName: hint?.abilityName || undefined,
            confidence: candidate.confidence ?? undefined,
            evidenceText: candidate.evidenceText || undefined,
            reason: candidate.reason || undefined,
            source: candidate.source,
            status: "ACTIVE",
            createdByUserId: owner,
            updatedByUserId: owner,
          });
          if (linkResult.errors?.length) {
            throw new Error(
              errorText(
                linkResult.errors,
                `${episode.childName}さんのAbilityリンク保存に失敗しました。`,
              ),
            );
          }
          savedAbilityLinkCount += 1;
        }
      }

      for (const staleObservation of existingObservations) {
        const staleObservationId = s(staleObservation.id);
        if (!staleObservationId || desiredObservationIds.has(staleObservationId)) {
          continue;
        }

        const staleLinks = await listAll<ObservationAbilityLinkRow>(
          observationAbilityLinkModel.list,
          {
            filter: {
              tenantId: { eq: tenantId },
              observationId: { eq: staleObservationId },
            },
          },
        );
        for (const staleLink of staleLinks) {
          const staleLinkId = s(staleLink.id);
          if (!staleLinkId) continue;
          const deletedLink = await observationAbilityLinkModel.delete({
            id: staleLinkId,
          });
          if (deletedLink.errors?.length) {
            throw new Error(
              errorText(
                deletedLink.errors,
                "旧Abilityリンクの整理に失敗しました。",
              ),
            );
          }
        }

        const deletedObservation = await observationRecordModel.delete({
          id: staleObservationId,
        });
        if (deletedObservation.errors?.length) {
          throw new Error(
            errorText(
              deletedObservation.errors,
              "旧観察記録の整理に失敗しました。",
            ),
          );
        }
      }

      const practiceUpdate = await dailyPracticeRecordModel.update({
        id: targetRecordId,
        observationSaveStatus: "SAVED",
        observationSavedAt: nowIso,
        observationRecordCount: savedObservationCount,
        observationAbilityLinkCount: savedAbilityLinkCount,
        observationSaveErrorMessage: "",
        updatedByUserId: owner,
      });
      if (practiceUpdate.errors?.length) {
        throw new Error(
          errorText(
            practiceUpdate.errors,
            "正式保存結果をPractice記録へ反映できませんでした。",
          ),
        );
      }

      setPracticeDrafts((current) => ({
        ...current,
        [role]: {
          ...current[role],
          observationSaveStatus: "SAVED",
          observationSavedAt: nowIso,
          observationRecordCount: savedObservationCount,
          observationAbilityLinkCount: savedAbilityLinkCount,
          observationSaveErrorMessage: "",
          record: practiceUpdate.data ?? {
            ...current[role].record,
            observationSaveStatus: "SAVED",
            observationSavedAt: nowIso,
            observationRecordCount: savedObservationCount,
            observationAbilityLinkCount: savedAbilityLinkCount,
            observationSaveErrorMessage: "",
          },
        },
      }));

      setMessage(
        `${practiceRoleLabel(role)}の解析結果を正式な観察記録として保存しました。` +
          ` ObservationRecord=${savedObservationCount}件 / AbilityLink=${savedAbilityLinkCount}件`,
      );
    } catch (cause) {
      console.error(cause);
      const errorMessage = cause instanceof Error ? cause.message : String(cause);

      if (targetRecordId) {
        const failedUpdate = await dailyPracticeRecordModel.update({
          id: targetRecordId,
          observationSaveStatus: "ERROR",
          observationSaveErrorMessage: errorMessage,
          updatedByUserId: owner,
        });
        if (failedUpdate.errors?.length) {
          console.error(failedUpdate.errors);
        }
      }

      setPracticeDrafts((current) => ({
        ...current,
        [role]: {
          ...current[role],
          observationSaveStatus: "ERROR",
          observationSaveErrorMessage: errorMessage,
        },
      }));
      setError(`観察記録の正式保存エラー: ${errorMessage}`);
    } finally {
      setObservationSavingRole(null);
    }
  }

  async function updateRelatedWorkflowStatuses(
    dailyReportId: string,
    status: "COMPLETED" | "CONFIRMED" | "RETURNED",
  ) {
    const practiceRows = await listAll<DailyPracticeRecordRow>(
      dailyPracticeRecordModel.list,
      {
        filter: {
          tenantId: { eq: tenantId },
          dailyReportId: { eq: dailyReportId },
        },
      },
    );

    for (const row of practiceRows) {
      const id = s(row.id);
      if (!id || row.isPerformed !== true) continue;
      const result = await dailyPracticeRecordModel.update({
        id,
        status,
        updatedByUserId: owner,
      });
      if (result.errors?.length) {
        throw new Error(
          errorText(result.errors, "Practice記録の状態更新に失敗しました。"),
        );
      }
    }

    const observations = await listAll<ObservationRecordRow>(
      observationRecordModel.list,
      {
        filter: {
          tenantId: { eq: tenantId },
          dailyReportId: { eq: dailyReportId },
        },
      },
    );

    for (const row of observations) {
      const id = s(row.id);
      if (!id) continue;
      const result = await observationRecordModel.update({
        id,
        status,
        updatedByUserId: owner,
      });
      if (result.errors?.length) {
        throw new Error(
          errorText(result.errors, "子ども別観察記録の状態更新に失敗しました。"),
        );
      }
    }
  }

  async function handleCompleteReport() {
    if (!reportEditable) {
      setError("この日報は現在、記録完了できる状態ではありません。");
      return;
    }

    if (!reportReadyToComplete) {
      setError(`記録完了できません。\n${completionProblems.join("\n")}`);
      return;
    }

    setWorkflowWorking(true);
    setError("");
    setMessage("");

    try {
      const savedDrafts = await saveDraftCore({ silent: true });
      if (!savedDrafts) return;

      const invalidAfterSave = performedRoles.filter((role) => {
        const draft = savedDrafts[role];
        return (
          s(draft.cleanupStatus).toUpperCase() !== "CLEANED" ||
          s(draft.analysisStatus).toUpperCase() !== "ANALYZED" ||
          s(draft.observationSaveStatus).toUpperCase() !== "SAVED"
        );
      });
      if (invalidAfterSave.length > 0) {
        throw new Error("保存後の状態確認で未完了のPracticeが見つかりました。");
      }

      const reportId = s(dailyReport?.id) || s(savedDrafts.PRIMARY.record?.dailyReportId) || s(savedDrafts.RESERVE.record?.dailyReportId);
      if (!reportId) throw new Error("DailyReport.idを取得できませんでした。");

      const nowIso = new Date().toISOString();
      const entry: DailyReportWorkflowEntry = {
        action: "COMPLETE",
        status: "COMPLETED",
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole || "TEACHER",
        at: nowIso,
        comment: workflowComment.trim(),
      };
      const contentJson = appendDailyReportWorkflowEntry(
        dailyReport?.contentJson,
        entry,
      );

      const result = await dailyReportModel.update({
        id: reportId,
        status: "COMPLETED",
        recordedByUserId: owner,
        recordedByName: s(ownerName) || owner,
        recordedAt: nowIso,
        contentJson,
        updatedByUserId: owner,
      });
      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "日報の記録完了に失敗しました。"));
      }

      await updateRelatedWorkflowStatuses(reportId, "COMPLETED");
      setDailyReport(result.data ?? {
        ...dailyReport,
        id: reportId,
        status: "COMPLETED",
        recordedByUserId: owner,
        recordedByName: s(ownerName) || owner,
        recordedAt: nowIso,
        contentJson,
      });
      setWorkflowComment("");
      setMessage("日報を記録完了にしました。園長・主任の確認待ちです。");
    } catch (cause) {
      console.error(cause);
      setError(`記録完了エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleConfirmReport() {
    if (!canReviewReport) {
      setError("園長・主任権限のユーザーだけが確認できます。");
      return;
    }
    if (s(dailyReport?.status).toUpperCase() !== "COMPLETED" || !dailyReport?.id) {
      setError("記録完了の日報だけを確認できます。");
      return;
    }

    setWorkflowWorking(true);
    setError("");
    setMessage("");
    try {
      const reportId = s(dailyReport.id);
      const nowIso = new Date().toISOString();
      const entry: DailyReportWorkflowEntry = {
        action: "CONFIRM",
        status: "CONFIRMED",
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: nowIso,
        comment: workflowComment.trim(),
      };
      const contentJson = appendDailyReportWorkflowEntry(dailyReport.contentJson, entry);
      const result = await dailyReportModel.update({
        id: reportId,
        status: "CONFIRMED",
        confirmedByUserId: owner,
        confirmedByName: s(ownerName) || owner,
        confirmedAt: nowIso,
        contentJson,
        updatedByUserId: owner,
      });
      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "日報確認に失敗しました。"));
      }
      await updateRelatedWorkflowStatuses(reportId, "CONFIRMED");
      setDailyReport(result.data ?? {
        ...dailyReport,
        status: "CONFIRMED",
        confirmedByUserId: owner,
        confirmedByName: s(ownerName) || owner,
        confirmedAt: nowIso,
        contentJson,
      });
      setWorkflowComment("");
      setMessage("日報を確認済みにしました。");
    } catch (cause) {
      console.error(cause);
      setError(`日報確認エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleReturnReport() {
    if (!canReviewReport) {
      setError("園長・主任権限のユーザーだけが差し戻しできます。");
      return;
    }
    if (s(dailyReport?.status).toUpperCase() !== "COMPLETED" || !dailyReport?.id) {
      setError("記録完了の日報だけを差し戻しできます。");
      return;
    }
    if (!workflowComment.trim()) {
      setError("差し戻し理由を入力してください。");
      return;
    }

    setWorkflowWorking(true);
    setError("");
    setMessage("");
    try {
      const reportId = s(dailyReport.id);
      const nowIso = new Date().toISOString();
      const entry: DailyReportWorkflowEntry = {
        action: "RETURN",
        status: "RETURNED",
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: nowIso,
        comment: workflowComment.trim(),
      };
      const contentJson = appendDailyReportWorkflowEntry(dailyReport.contentJson, entry);
      const result = await dailyReportModel.update({
        id: reportId,
        status: "RETURNED",
        contentJson,
        updatedByUserId: owner,
      });
      if (result.errors?.length) {
        throw new Error(errorText(result.errors, "日報差し戻しに失敗しました。"));
      }
      await updateRelatedWorkflowStatuses(reportId, "RETURNED");
      setDailyReport(result.data ?? {
        ...dailyReport,
        status: "RETURNED",
        contentJson,
      });
      setWorkflowComment("");
      setMessage("日報を差し戻しました。担任が修正・再完了できます。");
    } catch (cause) {
      console.error(cause);
      setError(`日報差し戻しエラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  function renderObservationHints(
    role: PracticeRole,
    practice: PracticeSnapshot,
  ) {
    const draft = practiceDrafts[role];
    const selected = draft.isPerformed;
    const label = practiceRoleLabel(role);
    const childEpisodes = parseChildEpisodes(draft.analysisJson);
    const formalObservationEdits = observationEdits[role];
    const analyzedHintCodes = parseAnalysisHintCodes(draft.analysisJson);
    const analyzedHintSource = parseAnalysisHintSource(draft.analysisJson);
    const observationHintByAbilityCode = new Map(
      practice.observationHints
        .filter((hint) => hint.abilityCode)
        .map((hint) => [hint.abilityCode, hint] as const),
    );
    const analyzedHintLabels = analyzedHintCodes.map((abilityCode) => {
      const abilityName = observationHintByAbilityCode.get(abilityCode)?.abilityName;
      return abilityName ? `${abilityCode} ${abilityName}` : abilityCode;
    });

    return (
      <section
        id={`do-practice-${role.toLowerCase()}`}
        className={`do-practice-card do-practice-card-${role.toLowerCase()} ${
          selected ? "do-practice-card-selected" : ""
        }`}
      >
        <div className="do-practice-card-header">
          <div className="do-practice-heading">
            <div className="do-practice-time-row">
              <span className="do-practice-sequence">
                {practiceSequenceLabel(role)}
              </span>
              <span className="do-practice-role">{label}</span>
              <span className="do-practice-time-label">
                {practiceTimeLabel(role)}
              </span>
            </div>
            <h3>{practice.name || "未配置"}</h3>
            {practice.practiceCode ? <small>{practice.practiceCode}</small> : null}
          </div>
          {practice.practiceCode ? (
            <label className="do-practice-radio">
              <input
                type="checkbox"
                checked={selected}
                disabled={!reportEditable || saving}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setPracticeDrafts((current) => ({
                    ...current,
                    [role]: {
                      ...current[role],
                      isPerformed: checked,
                      observationSaveStatus:
                        current[role].observationSaveStatus === "SAVED"
                          ? "STALE"
                          : current[role].observationSaveStatus,
                    },
                  }));
                }}
              />
              <span>実際に行った</span>
            </label>
          ) : null}
        </div>

        {practice.memo ? <p className="do-practice-memo">{practice.memo}</p> : null}

        <div className="do-hint-title-row">
          <strong>見届けたい子どもの姿</strong>
          <span>{practice.observationHints.length}件</span>
        </div>

        {practice.observationHints.length === 0 ? (
          <p className="muted">このPracticeの見届けたい姿は登録されていません。</p>
        ) : (
          <div className="do-hint-list">
            {practice.observationHints.map((hint, index) => (
              <div
                className="do-hint-row"
                key={`${role}-${hint.abilityCode}-${hint.postureCode}-${index}`}
              >
                <div className="do-hint-meta">
                  <strong>{hint.abilityCode} {hint.abilityName}</strong>
                  <span>
                    {hint.postureCode} {hint.postureName} / score {hint.score} / {hint.startingAge}歳〜
                  </span>
                </div>
                <div className="do-hint-episodes">
                  <p><b>行動・姿勢</b>{hint.episodes.episode1 || "-"}</p>
                  <p><b>言葉</b>{hint.episodes.episode2 || "-"}</p>
                  <p><b>しぐさ・表情</b>{hint.episodes.episode3 || "-"}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {selected ? (
          <div className="do-ai-workflow">
            <label className="do-practice-transcript-label">
              <span>{label}の音声入力テキスト</span>
              <textarea
                value={draft.rawTranscriptText}
                disabled={!reportEditable || saving || cleanupWorkingRole === role || analysisWorkingRole === role}
                onChange={(event) => {
                  const value = event.target.value;
                  setPracticeDrafts((current) => ({
                    ...current,
                    [role]: {
                      ...current[role],
                      rawTranscriptText: value,
                      cleanupStatus: current[role].cleanedTranscriptText ? "STALE" : "NOT_CLEANED",
                      analysisStatus: current[role].analysisJson ? "STALE" : "NOT_ANALYZED",
                      observationSaveStatus:
                        current[role].observationSaveStatus === "SAVED"
                          ? "STALE"
                          : current[role].observationSaveStatus,
                    },
                  }));
                }}
                placeholder={
                  role === "PRIMARY"
                    ? "例：色水遊びを始めると、はなさんは青と黄色を混ぜて……"
                    : "例：予備活動では、たろうさんが新聞紙を細長く丸めて……"
                }
              />
              <small>
                この入力欄は{label}専用です。まず音声入力し、必ずAIクリーンアップを実行します。
              </small>
            </label>

            <div className="do-ai-step-card">
              <div className="do-ai-step-head">
                <div>
                  <span className="do-ai-step-number">1</span>
                  <strong>AIクリーンアップ（必須）</strong>
                </div>
                <span className={`do-ai-status do-ai-status-${s(draft.cleanupStatus).toLowerCase()}`}>
                  {aiStatusLabel(draft.cleanupStatus)}
                </span>
              </div>
              <p className="muted">
                フィラーワードや言い直しを除き、子どもの名前・行動・発話・時系列を保持した読みやすい文章に整えます。
              </p>
              <button
                type="button"
                className="secondary-button"
                disabled={
                  !reportEditable ||
                  saving ||
                  cleanupWorkingRole !== null ||
                  analysisWorkingRole !== null ||
                  !draft.rawTranscriptText.trim()
                }
                onClick={() => void handleCleanupTranscript(role)}
              >
                {cleanupWorkingRole === role ? "クリーンアップ中..." : draft.cleanupStatus === "CLEANED" ? "AIクリーンアップを再実行" : "AIクリーンアップ"}
              </button>

              {draft.cleanedTranscriptText ? (
                <label className="do-cleaned-transcript-label">
                  <span>クリーンアップ済みテキスト（確認・修正可）</span>
                  <textarea
                    value={draft.cleanedTranscriptText}
                    disabled={!reportEditable || saving || cleanupWorkingRole === role || analysisWorkingRole === role}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPracticeDrafts((current) => ({
                        ...current,
                        [role]: {
                          ...current[role],
                          cleanedTranscriptText: value,
                          cleanupStatus: "CLEANED",
                          analysisStatus: current[role].analysisJson ? "STALE" : "NOT_ANALYZED",
                          observationSaveStatus:
                            current[role].observationSaveStatus === "SAVED"
                              ? "STALE"
                              : current[role].observationSaveStatus,
                        },
                      }));
                    }}
                  />
                  {draft.cleanupMessage ? <small>{draft.cleanupMessage}</small> : null}
                </label>
              ) : null}
            </div>

            <div className="do-ai-step-card">
              <div className="do-ai-step-head">
                <div>
                  <span className="do-ai-step-number">2</span>
                  <strong>子ども別エピソード・Ability解析</strong>
                </div>
                <span className={`do-ai-status do-ai-status-${s(draft.analysisStatus).toLowerCase()}`}>
                  {aiStatusLabel(draft.analysisStatus)}
                </span>
              </div>
              <p className="muted">
                クリーンアップ済み文章から、全体記録、子ども別エピソード、Ability候補とconfidenceを生成します。
              </p>
              <button
                type="button"
                disabled={
                  !reportEditable ||
                  saving ||
                  cleanupWorkingRole !== null ||
                  analysisWorkingRole !== null ||
                  draft.cleanupStatus !== "CLEANED" ||
                  !draft.cleanedTranscriptText.trim()
                }
                onClick={() => void handleAnalyzeObservation(role)}
              >
                {analysisWorkingRole === role ? "解析中..." : draft.analysisStatus === "ANALYZED" ? "子ども別・Ability解析を再実行" : "子ども別・Ability解析"}
              </button>
              {draft.cleanupStatus !== "CLEANED" ? (
                <small className="do-ai-required-note">先にAIクリーンアップを完了してください。</small>
              ) : null}
              {draft.analysisErrorMessage ? (
                <p className="do-ai-error-text">{draft.analysisErrorMessage}</p>
              ) : null}
              {draft.analysisStatus === "ANALYZED" ? (
                <small className="do-ai-required-note">
                  解析対象の見届けたい姿Ability: {analyzedHintLabels.length > 0 ? analyzedHintLabels.join("、") : "取得なし"}
                  {analyzedHintSource ? ` / source=${analyzedHintSource}` : ""}
                </small>
              ) : null}

              {draft.cleanedOverallText ? (
                <label className="do-overall-record-label">
                  <span>Practice全体の記録</span>
                  <textarea
                    value={draft.cleanedOverallText}
                    disabled={!reportEditable || saving || analysisWorkingRole === role}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPracticeDrafts((current) => ({
                        ...current,
                        [role]: {
                          ...current[role],
                          cleanedOverallText: value,
                        },
                      }));
                    }}
                  />
                </label>
              ) : null}

              {childEpisodes.length > 0 ? (
                <div className="do-child-analysis-list">
                  <div className="do-child-analysis-title">
                    <strong>子ども別エピソード</strong>
                    <span>{childEpisodes.length}人</span>
                  </div>
                  {childEpisodes.map((episode) => (
                    <article className="do-child-analysis-card" key={`${role}-${episode.childId}`}>
                      <div className="do-child-analysis-head">
                        <strong>{episode.childName}</strong>
                        <small>{episode.childId}</small>
                      </div>
                      <p>{episode.episodeText}</p>
                      <div className="do-ability-candidate-list">
                        {episode.abilityCandidates.length === 0 ? (
                          <span className="muted">Ability候補なし（エピソードは保持します）</span>
                        ) : (
                          episode.abilityCandidates.map((candidate) => {
                            const abilityName = observationHintByAbilityCode.get(
                              candidate.abilityCode,
                            )?.abilityName;

                            return (
                              <div className="do-ability-candidate" key={`${episode.childId}-${candidate.abilityCode}`}>
                                <div>
                                  <strong>
                                    {candidate.abilityCode}
                                    {abilityName ? ` ${abilityName}` : ""}
                                  </strong>
                                  <span>confidence {candidate.confidence.toFixed(3)}</span>
                                </div>
                                {candidate.evidenceText ? <p><b>根拠</b>{candidate.evidenceText}</p> : null}
                                {candidate.reason ? <p><b>理由</b>{candidate.reason}</p> : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : draft.analysisStatus === "ANALYZED" ? (
                <p className="muted">子ども別エピソードは抽出されませんでした。全体記録は保存されています。</p>
              ) : null}
            </div>

            <div className="do-ai-step-card do-observation-save-card">
              <div className="do-ai-step-head">
                <div>
                  <span className="do-ai-step-number">3</span>
                  <strong>観察記録として正式保存</strong>
                </div>
                <span
                  className={`do-observation-save-status do-observation-save-status-${s(
                    draft.observationSaveStatus,
                  ).toLowerCase().replaceAll("_", "-")}`}
                >
                  {observationSaveStatusLabel(draft.observationSaveStatus)}
                </span>
              </div>
              <p className="muted">
                子ども別エピソードを確認・修正し、見届けたい姿のAbilityから0～2件を選択して正式保存します。
                同じ子どもの再保存は新規追加ではなく更新されます。
              </p>

              {formalObservationEdits.length > 0 ? (
                <div className="do-formal-observation-list">
                  {formalObservationEdits.map((episode) => {
                    const selectedAbilityCount = episode.abilities.filter(
                      (ability) => ability.selected,
                    ).length;

                    return (
                      <article
                        className="do-formal-observation-card"
                        key={`${role}-formal-${episode.childId}`}
                      >
                        <div className="do-formal-observation-head">
                          <div>
                            <strong>{episode.childName}</strong>
                            <small>{episode.childId}</small>
                          </div>
                          <span>{selectedAbilityCount}/2 Ability</span>
                        </div>

                        <label className="do-formal-episode-label">
                          <span>正式保存するエピソード</span>
                          <textarea
                            value={episode.episodeText}
                            disabled={
                              !reportEditable ||
                              saving ||
                              observationSavingRole === role
                            }
                            onChange={(event) =>
                              handleChangeFormalEpisode(
                                role,
                                episode.childId,
                                event.target.value,
                              )
                            }
                          />
                        </label>

                        <div className="do-formal-ability-list">
                          <div className="do-formal-ability-title">
                            <strong>見届けたい姿のAbility</strong>
                            <small>選択なしでも保存できます。最大2件です。</small>
                          </div>

                          {episode.abilities.length > 0 ? (
                            episode.abilities.map((ability) => (
                              <label
                                className={`do-formal-ability-option ${
                                  ability.selected
                                    ? "do-formal-ability-option-selected"
                                    : ""
                                }`}
                                key={`${episode.childId}-${ability.abilityCode}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={ability.selected}
                                  disabled={
                                    !reportEditable ||
                                    saving ||
                                    observationSavingRole === role
                                  }
                                  onChange={(event) =>
                                    handleToggleFormalAbility(
                                      role,
                                      episode.childId,
                                      ability.abilityCode,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>
                                  <b>{ability.abilityCode}</b>
                                  <strong>{ability.abilityName || "Ability名未取得"}</strong>
                                  <small>
                                    {ability.source === "AI" && ability.confidence !== null
                                      ? `AI候補 / confidence ${ability.confidence.toFixed(3)}`
                                      : ability.selected
                                        ? "保育士が選択"
                                        : "見届けたい姿から選択可能"}
                                  </small>
                                  {ability.selected && ability.evidenceText ? (
                                    <em>根拠：{ability.evidenceText}</em>
                                  ) : null}
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="muted">
                              このPracticeには見届けたい姿のAbilityがありません。
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : draft.analysisStatus === "ANALYZED" ? (
                <p className="do-observation-save-warning">
                  正式保存する子ども別エピソードがありません。解析を確認してください。
                </p>
              ) : null}

              {draft.observationSaveStatus === "SAVED" ? (
                <div className="do-observation-save-summary">
                  <span>観察記録 {draft.observationRecordCount}件</span>
                  <span>Abilityリンク {draft.observationAbilityLinkCount}件</span>
                  {draft.observationSavedAt ? (
                    <span>{new Date(draft.observationSavedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
                  ) : null}
                </div>
              ) : null}

              {draft.observationSaveStatus === "STALE" ? (
                <p className="do-observation-save-warning">
                  エピソードまたはAbility選択が変更されています。正式な観察記録を再保存してください。
                </p>
              ) : null}
              {draft.observationSaveErrorMessage ? (
                <p className="do-ai-error-text">{draft.observationSaveErrorMessage}</p>
              ) : null}

              <button
                type="button"
                disabled={
                  !reportEditable ||
                  saving ||
                  cleanupWorkingRole !== null ||
                  analysisWorkingRole !== null ||
                  observationSavingRole !== null ||
                  draft.analysisStatus !== "ANALYZED" ||
                  !draft.analysisJson ||
                  formalObservationEdits.length === 0
                }
                onClick={() => void handleSaveObservationRecords(role)}
              >
                {observationSavingRole === role
                  ? "観察記録を保存中..."
                  : draft.observationSaveStatus === "SAVED"
                    ? "観察記録を再保存"
                    : draft.observationSaveStatus === "STALE"
                      ? "修正内容を観察記録へ再保存"
                      : "解析結果を観察記録として保存"}
              </button>
              {draft.analysisStatus !== "ANALYZED" ? (
                <small className="do-ai-required-note">
                  先に子ども別・Ability解析を完了してください。
                </small>
              ) : null}
            </div>
          </div>
        ) : draft.rawTranscriptText ? (
          <p className="do-practice-preserved-note">
            入力済みの文章は保持されています。「実際に行った」を再度チェックすると表示されます。
          </p>
        ) : null}
      </section>
    );
  }


  return (
    <div className="do-workspace">
      <header className="do-workspace-header">
        <div>
          <p className="eyebrow">Do / Daily Report</p>
          <h2>今日の日案</h2>
          <p className="muted">
            発行済み日案を確認し、Practice別に音声入力、必須クリーンアップ、子ども別・Ability解析、観察記録保存を行います。
          </p>
        </div>
        <span className={`status-pill status-${statusClass(dailyReport?.status)}`}>
          日報: {statusLabel(dailyReport?.status)}
        </span>
      </header>

      <div className="do-context-card">
        <div>
          <strong>園</strong>
          <span>{tenantName || tenantId}</span>
        </div>
        <div>
          <strong>日付</strong>
          <span>{formatDateLabel(targetDate)}</span>
        </div>
        <div>
          <strong>クラス</strong>
          <span>{s(selectedClassroom?.name) || "未選択"}</span>
        </div>
        <div>
          <strong>記録者候補</strong>
          <span>{s(ownerName) || owner}</span>
        </div>
      </div>

      <div className="do-selector-card">
        <label>
          <span>対象日</span>
          <input
            type="date"
            value={targetDate}
            disabled={loading || saving}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>

        <label>
          <span>クラス</span>
          <select
            value={selectedClassroomId}
            disabled={loading || saving || classroomSelectionLocked}
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

        <label>
          <span>発行済み日案</span>
          <select
            value={selectedDailyPlanId}
            disabled={loading || saving || dailyPlans.length === 0}
            onChange={(event) => setSelectedDailyPlanId(event.target.value)}
          >
            {dailyPlans.length === 0 ? (
              <option value="">発行済み日案なし</option>
            ) : (
              dailyPlans.map((plan) => (
                <option key={s(plan.id)} value={s(plan.id)}>
                  {s(plan.title) || s(plan.id)}
                </option>
              ))
            )}
          </select>
        </label>

        <button
          type="button"
          className="secondary-button"
          disabled={loading || saving}
          onClick={() => {
            void loadClassrooms();
            void loadDailyPlans();
            void loadDailyReport();
          }}
        >
          再読み込み
        </button>
      </div>

      {error ? <pre className="error-box">{error}</pre> : null}
      {message ? <pre className="success-box">{message}</pre> : null}

      {dailyPlans.length === 0 && !loading ? (
        <div className="impact-alert-box">
          {formatDateLabel(targetDate)}の発行済み日案がありません。Plan Workspaceの日案発行で、対象日の日案を発行してください。
        </div>
      ) : null}

      {selectedDailyPlan && !dailyPlanContent ? (
        <div className="error-box">
          日案のcontentJsonを読み込めません。日案を再発行してください。
        </div>
      ) : null}

      {dailyPlanContent ? (
        <>
          <div className="do-plan-summary-card">
            <div>
              <strong>日案</strong>
              <span>{s(selectedDailyPlan?.title) || s(selectedDailyPlan?.id)}</span>
            </div>
            <div>
              <strong>元週案</strong>
              <span>{dailyPlanContent.sourceWeeklyPlanTitle || dailyPlanContent.sourceWeeklyPlanId || "-"}</span>
            </div>
            <div>
              <strong>日案状態</strong>
              <span className="status-pill status-issued">{statusLabel(selectedDailyPlan?.status)}</span>
            </div>
            <div>
              <strong>日報ID</strong>
              <span>{s(dailyReport?.id) || "未作成"}</span>
            </div>
          </div>

          <nav className="do-day-navigation" aria-label="今日の日案内">
            <a href="#do-practice-primary">
              <span>1</span>
              主活動へ
            </a>
            <a href="#do-practice-reserve">
              <span>2</span>
              予備活動へ
            </a>
            <a href="#do-report-workflow">
              <span>3</span>
              記録完了へ
            </a>
          </nav>

          <div className="do-practice-grid">
            {renderObservationHints("PRIMARY", dailyPlanContent.primaryPractice)}
            {renderObservationHints("RESERVE", dailyPlanContent.reservePractice)}
          </div>

          <section className="do-report-card">
            <div className="do-report-card-header">
              <div>
                <h3>子どもの様子・実践記録</h3>
                <p className="muted">
                  実施したPracticeごとに音声入力し、AIクリーンアップと子ども別・Ability解析を行い、解析結果を正式な観察記録として保存します。
                </p>
              </div>
              <span className={`status-pill status-${statusClass(dailyReport?.status)}`}>
                {statusLabel(dailyReport?.status)}
              </span>
            </div>

            <div className="do-selected-practice-box">
              <strong>実際に行ったPractice</strong>
              <div className="do-selected-practice-list">
                {performedRoles.length === 0 ? (
                  <span>未選択</span>
                ) : (
                  performedRoles.map((role) => {
                    const practice = practiceForRole(dailyPlanContent, role);
                    return (
                      <span key={`summary-${role}`}>
                        {practiceRoleLabel(role)}：{practice?.name || practice?.practiceCode}
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            <p className="do-report-guidance">
              各Practiceカード内の専用テキストボックスへ音声入力してください。ポジティブな姿だけでなく、眠そうだった、集中が続かなかった、他児への働きかけがあった、など観察した事実をそのまま記録します。
            </p>

            {!reportEditable ? (
              <div className="impact-alert-box">
                この日報は{statusLabel(dailyReport?.status)}です。内容を確認し、下のワークフロー操作を行ってください。
              </div>
            ) : null}

            <div className="do-report-actions">
              <button
                type="button"
                disabled={
                  saving ||
                  loading ||
                  !reportEditable ||
                  !allPerformedDraftsHaveText
                }
                onClick={() => void handleSaveDraft()}
              >
                {saving ? "保存中..." : dailyReport?.id ? "日報下書きを更新" : "日報下書きを保存"}
              </button>
              <span className="muted">
                保存先: DailyReport + DailyPracticeRecord / 下書き・差し戻し中のみ編集可能
              </span>
            </div>

            <section id="do-report-workflow" className="do-workflow-card">
              <div className="do-workflow-header">
                <div>
                  <h3>記録完了・確認</h3>
                  <p className="muted">
                    担任が記録を完了し、園長・主任が確認または差し戻しを行います。
                  </p>
                </div>
                <span className={`status-pill status-${statusClass(dailyReport?.status)}`}>
                  {statusLabel(dailyReport?.status)}
                </span>
              </div>

              {(reportEditable || s(dailyReport?.status).toUpperCase() === "COMPLETED") ? (
                <label className="do-workflow-comment-label">
                  <span>完了コメント／確認コメント／差し戻し理由</span>
                  <textarea
                    value={workflowComment}
                    disabled={workflowWorking}
                    placeholder={
                      s(dailyReport?.status).toUpperCase() === "COMPLETED"
                        ? "確認コメントは任意です。差し戻す場合は理由を入力してください。"
                        : "記録完了時の申し送りがあれば入力してください。"
                    }
                    onChange={(event) => setWorkflowComment(event.target.value)}
                  />
                </label>
              ) : null}

              {reportEditable ? (
                <div className="do-completion-check-card">
                  <strong>記録完了チェック</strong>
                  {completionProblems.length === 0 ? (
                    <p className="do-completion-ready">
                      実施した全Practiceのクリーンアップ、解析、観察記録保存が完了しています。
                    </p>
                  ) : (
                    <ul>
                      {completionProblems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <div className="do-workflow-actions">
                {reportEditable ? (
                  <button
                    type="button"
                    disabled={workflowWorking || saving || !reportReadyToComplete}
                    onClick={() => void handleCompleteReport()}
                  >
                    {workflowWorking
                      ? "処理中..."
                      : s(dailyReport?.status).toUpperCase() === "RETURNED"
                        ? "修正後、記録を再完了"
                        : "記録を完了"}
                  </button>
                ) : null}

                {s(dailyReport?.status).toUpperCase() === "COMPLETED" && canReviewReport ? (
                  <>
                    <button
                      type="button"
                      disabled={workflowWorking}
                      onClick={() => void handleConfirmReport()}
                    >
                      {workflowWorking ? "処理中..." : "確認する"}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={workflowWorking || !workflowComment.trim()}
                      onClick={() => void handleReturnReport()}
                    >
                      差し戻す
                    </button>
                  </>
                ) : null}

                {s(dailyReport?.status).toUpperCase() === "COMPLETED" && !canReviewReport ? (
                  <span className="muted">園長・主任の確認待ちです。</span>
                ) : null}

                {s(dailyReport?.status).toUpperCase() === "CONFIRMED" ? (
                  <span className="do-confirmed-note">この日報は確認済みです。</span>
                ) : null}
              </div>

              <div className="do-workflow-role-note">
                ログイン権限: {normalizedOwnerRole || "未設定"}
                {canReviewReport ? "（確認・差し戻し可能）" : "（記録担当）"}
              </div>

              {reportWorkflow.history.length > 0 ? (
                <div className="do-workflow-history">
                  <strong>履歴</strong>
                  {reportWorkflow.history.map((entry, index) => (
                    <div className="do-workflow-history-item" key={`${entry.at}-${entry.action}-${index}`}>
                      <span className={`status-pill status-${statusClass(entry.status)}`}>
                        {workflowActionLabel(entry.action)}
                      </span>
                      <div>
                        <strong>{entry.actorName || entry.actorUserId}</strong>
                        {entry.comment ? <p>{entry.comment}</p> : <p className="muted">コメントなし</p>}
                      </div>
                      <small>
                        {entry.at
                          ? new Date(entry.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                          : "-"}
                      </small>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </section>
        </>
      ) : null}
    </div>
  );
}
