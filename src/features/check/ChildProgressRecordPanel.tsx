import { useEffect, useMemo, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import {
  createCustomReportContext,
  createDefaultChildProgressPeriods,
  inclusiveDayCount,
  todayJstDateOnly,
} from "./reportPeriod";
import {
  loadObservationReportData,
  loadReportClassrooms,
  type ObservationReportClient,
} from "./loadObservationReportData";
import { buildChildProgressComparison } from "./childProgressAggregation";
import {
  buildChildProgressDraft,
  buildChildProgressSnapshot,
  childProgressSourceSignature,
} from "./childProgressDraft";
import {
  CHILD_PROGRESS_PROMPT_VERSION,
  buildChildProgressAiDraftText,
  buildChildProgressAiSourceSnapshot,
  emptyChildProgressAiDraft,
  parseChildProgressAiDraft,
} from "./childProgressAi";
import type {
  ChildProgressAbilityComparisonRow,
  ChildProgressAiDraft,
  ChildProgressRecordRow,
  ClassroomRow,
  GenerateChildProgressRecordResponse,
  ObservationReportSourceData,
} from "./types";

type ModelError = { message?: string | null };
type ModelResult<T> = Promise<{
  data?: T | null;
  errors?: ReadonlyArray<ModelError> | null;
}>;
type ChildProgressRecordModel = {
  get(input: { id: string }): ModelResult<ChildProgressRecordRow>;
  create(input: Record<string, unknown>): ModelResult<ChildProgressRecordRow>;
  update(input: Record<string, unknown>): ModelResult<ChildProgressRecordRow>;
};

type ChildProgressApi = {
  models: {
    ChildProgressRecord: ChildProgressRecordModel;
  };
  mutations: {
    generateChildProgressRecord(input: {
      childProgressRecordId: string;
    }): ModelResult<GenerateChildProgressRecordResponse>;
  };
};


type ChildProgressWorkflowAction = "COMPLETE" | "CONFIRM" | "RETURN";

type ChildProgressWorkflowEntry = {
  action: ChildProgressWorkflowAction;
  status: "COMPLETED" | "CONFIRMED" | "RETURNED";
  actorUserId: string;
  actorName: string;
  actorRole: string;
  at: string;
  comment: string;
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExecutionTimeoutError(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("execution timed out")
    || message.includes("execution timeout")
    || message.includes("request timed out")
    || message.includes("request timeout")
    || message.includes("task timed out")
  );
}

function modelErrorText(
  errors: ReadonlyArray<ModelError> | null | undefined,
): string {
  return (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean)
    .join("\n");
}

function recordId(input: {
  classroomId: string;
  childId: string;
  currentStart: string;
  currentEnd: string;
}): string {
  return [
    "child-progress",
    input.classroomId,
    input.childId,
    input.currentStart,
    input.currentEnd,
  ].join("-");
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "下書き",
    COMPLETED: "記録完了",
    CONFIRMED: "確認済み",
    RETURNED: "差し戻し",
    ARCHIVED: "アーカイブ",
  };
  return labels[status] ?? (status || "未保存");
}


function workflowActionLabel(action: ChildProgressWorkflowAction): string {
  const labels: Record<ChildProgressWorkflowAction, string> = {
    COMPLETE: "記録完了",
    CONFIRM: "確認",
    RETURN: "差し戻し",
  };
  return labels[action];
}

function normalizeRole(value: unknown): string {
  return s(value).toUpperCase();
}

function parseWorkflowHistory(value: unknown): ChildProgressWorkflowEntry[] {
  if (!value) return [];
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): ChildProgressWorkflowEntry[] => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
      const row = candidate as Record<string, unknown>;
      const action = s(row.action).toUpperCase();
      const status = s(row.status).toUpperCase();
      if (
        !["COMPLETE", "CONFIRM", "RETURN"].includes(action)
        || !["COMPLETED", "CONFIRMED", "RETURNED"].includes(status)
      ) {
        return [];
      }
      return [{
        action: action as ChildProgressWorkflowAction,
        status: status as ChildProgressWorkflowEntry["status"],
        actorUserId: s(row.actorUserId),
        actorName: s(row.actorName),
        actorRole: s(row.actorRole),
        at: s(row.at),
        comment: s(row.comment),
      }];
    });
  } catch {
    return [];
  }
}

function appendWorkflowHistory(
  current: unknown,
  entry: ChildProgressWorkflowEntry,
): string {
  return JSON.stringify([...parseWorkflowHistory(current), entry]);
}

function formatWorkflowDateTime(value: unknown): string {
  const raw = s(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeFileName(value: string): string {
  return value.replace(/[\/:*?"<>|]/g, "_");
}

function aiStatusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "GENERATING") return "生成中";
  if (status === "GENERATED") return "自然文生成済み";
  if (status === "STALE") return "再生成が必要";
  if (status === "ERROR") return "生成エラー";
  return "未生成";
}

function aiStatusClass(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "GENERATED") return "child-progress-ai-status-generated";
  if (status === "GENERATING") return "child-progress-ai-status-generating";
  if (status === "STALE") return "child-progress-ai-status-stale";
  if (status === "ERROR") return "child-progress-ai-status-error";
  return "";
}

function abilityStatusLabel(row: ChildProgressAbilityComparisonRow): string {
  const labels: Record<ChildProgressAbilityComparisonRow["status"], string> = {
    NEW: "新たに記録",
    CONTINUED: "継続して記録",
    MORE_RECORDED: "記録場面が多い",
    LESS_RECORDED: "記録場面が少ない",
    PREVIOUS_ONLY: "現在期間は未観察",
  };
  return labels[row.status];
}

function safeJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(s).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("このブラウザではクリップボードを利用できません。"));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function hasStructuredAiDraft(draft: ChildProgressAiDraft): boolean {
  return Boolean(
    draft.overviewText.trim()
    || draft.nextPerspectiveText.trim()
    || draft.centralThemes.length > 0
    || draft.interpretationNotes.length > 0,
  );
}

export default function ChildProgressRecordPanel(props: {
  owner: string;
  ownerName?: string | null;
  ownerRole?: string | null;
  tenantId: string;
  tenantName?: string | null;
  fiscalYear: number;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
}) {
  // Amplify.configure() is executed by the application bootstrap before the
  // component is rendered. Delay Data client generation until render so this
  // module can be imported safely during application startup.
  const rawClient = useMemo(() => generateClient<Schema>(), []);
  const reportClient = useMemo(
    () => rawClient.models as unknown as ObservationReportClient,
    [rawClient],
  );
  const progressApi = useMemo(
    () => rawClient as unknown as ChildProgressApi,
    [rawClient],
  );
  const progressRecordModel = progressApi.models.ChildProgressRecord;

  const defaults = useMemo(() => createDefaultChildProgressPeriods(), []);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [classroomId, setClassroomId] = useState(props.currentClassroomId ?? "");
  const [childId, setChildId] = useState("");
  const [currentStart, setCurrentStart] = useState(defaults.currentStart);
  const [currentEnd, setCurrentEnd] = useState(defaults.currentEnd);
  const [comparisonStart, setComparisonStart] = useState(defaults.comparisonStart);
  const [comparisonEnd, setComparisonEnd] = useState(defaults.comparisonEnd);
  const [source, setSource] = useState<ObservationReportSourceData | null>(null);
  const [record, setRecord] = useState<ChildProgressRecordRow | null>(null);
  const [templateDraftText, setTemplateDraftText] = useState("");
  const [aiDraftText, setAiDraftText] = useState("");
  const [aiDraft, setAiDraft] = useState<ChildProgressAiDraft>(() => emptyChildProgressAiDraft());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [workflowWorking, setWorkflowWorking] = useState(false);
  const [workflowComment, setWorkflowComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recordLoadRequestRef = useRef(0);

  const dateWarnings = useMemo(() => {
    const warnings: string[] = [];
    const today = todayJstDateOnly();
    if (currentStart > currentEnd) warnings.push("現在期間の開始日が終了日より後です。");
    if (comparisonStart > comparisonEnd) warnings.push("比較期間の開始日が終了日より後です。");
    if (!(comparisonEnd < currentStart || currentEnd < comparisonStart)) {
      warnings.push("現在期間と比較期間が重複しています。");
    }
    if (currentEnd > today || comparisonEnd > today) {
      warnings.push("未来の日付が含まれています。");
    }
    if (currentStart <= currentEnd && comparisonStart <= comparisonEnd) {
      const currentDays = inclusiveDayCount(currentStart, currentEnd);
      const comparisonDays = inclusiveDayCount(comparisonStart, comparisonEnd);
      if (currentDays !== comparisonDays) {
        warnings.push(
          `期間日数が異なります（現在${currentDays}日／比較${comparisonDays}日）。件数差には観察機会の差が含まれる可能性があります。`,
        );
      }
    }
    return warnings;
  }, [comparisonEnd, comparisonStart, currentEnd, currentStart]);

  const children = useMemo(
    () =>
      [...(source?.enrolledChildren ?? [])].sort((a, b) =>
        s(a.displayName).localeCompare(s(b.displayName), "ja"),
      ),
    [source],
  );

  const summary = useMemo(() => {
    if (!source || !childId || dateWarnings.some((row) => row.includes("開始日"))) {
      return null;
    }
    return buildChildProgressComparison({
      source,
      childId,
      currentStart,
      currentEnd,
      comparisonStart,
      comparisonEnd,
    });
  }, [childId, comparisonEnd, comparisonStart, currentEnd, currentStart, dateWarnings, source]);

  const currentRecordId = useMemo(() => {
    if (!classroomId || !childId) return "";
    return recordId({ classroomId, childId, currentStart, currentEnd });
  }, [childId, classroomId, currentEnd, currentStart]);

  const isSourceStale = useMemo(() => {
    if (!record || !summary) return false;
    const saved = childProgressSourceSignature({
      observationIds: safeJsonArray(record.sourceObservationIdsJson),
      abilityCodes: safeJsonArray(record.sourceAbilityCodesJson),
    });
    const current = childProgressSourceSignature({
      observationIds: summary.sourceObservationIds,
      abilityCodes: summary.sourceAbilityCodes,
    });
    return saved !== current;
  }, [record, summary]);

  const isPromptOutdated = Boolean(
    s(record?.aiDraftJson)
    && s(record?.promptVersion)
    && s(record?.promptVersion) !== CHILD_PROGRESS_PROMPT_VERSION,
  );

  const aiSourceSnapshot = useMemo(() => {
    if (!summary || !source || !classroomId) return null;
    return buildChildProgressAiSourceSnapshot({ summary, source, classroomId });
  }, [classroomId, source, summary]);

  const hasAiStructuredContent = useMemo(
    () => hasStructuredAiDraft(aiDraft),
    [aiDraft],
  );

  const aiPreviewText = useMemo(() => {
    if (!summary) return "";
    if (!hasStructuredAiDraft(aiDraft) && aiDraftText.trim()) {
      return aiDraftText.trim();
    }
    return buildChildProgressAiDraftText({
      childName: summary.childName,
      currentPeriodStart: currentStart,
      currentPeriodEnd: currentEnd,
      comparisonPeriodStart: comparisonStart,
      comparisonPeriodEnd: comparisonEnd,
      draft: aiDraft,
    });
  }, [aiDraft, aiDraftText, comparisonEnd, comparisonStart, currentEnd, currentStart, summary]);


  const normalizedOwnerRole = normalizeRole(props.ownerRole);
  const workflowStatus = s(record?.status).toUpperCase() || "DRAFT";
  const canReview = normalizedOwnerRole === "DIRECTOR" || normalizedOwnerRole === "LEAD";
  const isWorkflowEditable = workflowStatus === "DRAFT" || workflowStatus === "RETURNED";
  const isWorkflowCompleted = workflowStatus === "COMPLETED";
  const isWorkflowConfirmed = workflowStatus === "CONFIRMED";
  const workflowHistory = useMemo(
    () => parseWorkflowHistory(record?.reviewHistoryJson).slice().reverse(),
    [record?.reviewHistoryJson],
  );
  const finalTransferText = s(record?.finalText);

  async function loadClassrooms() {
    const rows = await loadReportClassrooms({
      client: reportClient,
      tenantId: props.tenantId,
      fiscalYear: props.fiscalYear,
      allowedClassroomIds: props.allowedClassroomIds,
      isSchoolScope: props.isSchoolScope,
    });
    setClassrooms(rows);
    setClassroomId((current) => {
      if (current && rows.some((row) => s(row.id) === current)) return current;
      return s(rows[0]?.id);
    });
  }

  async function loadSourceData() {
    if (!classroomId || dateWarnings.some((row) => row.includes("開始日"))) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const overallStart = comparisonStart < currentStart ? comparisonStart : currentStart;
      const overallEnd = comparisonEnd > currentEnd ? comparisonEnd : currentEnd;
      const context = createCustomReportContext({
        periodStart: overallStart,
        periodEnd: overallEnd,
        tenantId: props.tenantId,
        fiscalYear: props.fiscalYear,
        classroomId,
      });
      const loaded = await loadObservationReportData({
        client: reportClient,
        context,
      });
      setSource(loaded);
      const childIds = new Set(loaded.enrolledChildren.map((row) => s(row.id)));
      setChildId((current) =>
        current && childIds.has(current) ? current : s(loaded.enrolledChildren[0]?.id),
      );
    } catch (caught) {
      setSource(null);
      setError(`根拠データの取得でエラーが発生しました: ${errorMessage(caught)}`);
    } finally {
      setLoading(false);
    }
  }

  function applyLoadedRecord(loaded: ChildProgressRecordRow | null): boolean {
    setRecord(loaded);

    // Phase 9-D3a migration compatibility:
    // - New records read templateDraftText and aiDraftText directly.
    // - Existing AI-generated records used draftText for the AI full text;
    //   rebuild the missing template from the current deterministic summary.
    // - Existing non-AI records used draftText for the template draft.
    const hasAiDraft = Boolean(s(loaded?.aiDraftJson));
    const loadedTemplate = s(loaded?.templateDraftText)
      || (hasAiDraft ? (summary ? buildChildProgressDraft(summary) : "") : s(loaded?.draftText));
    const loadedAiText = s(loaded?.aiDraftText)
      || (hasAiDraft ? s(loaded?.draftText) : "");
    const loadedDraft = parseChildProgressAiDraft(loaded?.aiDraftJson);

    setTemplateDraftText(loadedTemplate);
    setAiDraftText(loadedAiText);
    setAiDraft(loadedDraft);
    setWorkflowComment("");
    return hasStructuredAiDraft(loadedDraft);
  }

  async function loadExistingRecord() {
    const requestId = ++recordLoadRequestRef.current;
    if (!currentRecordId) {
      setRecord(null);
      setTemplateDraftText("");
      setAiDraftText("");
      setAiDraft(emptyChildProgressAiDraft());
      return;
    }
    try {
      const result = await progressRecordModel.get({ id: currentRecordId });
      if (requestId !== recordLoadRequestRef.current) return;
      if (result.errors?.length) {
        throw new Error(modelErrorText(result.errors));
      }
      applyLoadedRecord(result.data ?? null);
    } catch (caught) {
      if (requestId !== recordLoadRequestRef.current) return;
      setRecord(null);
      setTemplateDraftText("");
      setAiDraftText("");
      setAiDraft(emptyChildProgressAiDraft());
      setError(`保存済み下書きの取得でエラーが発生しました: ${errorMessage(caught)}`);
    }
  }

  async function waitForGeneratedRecord(input: {
    id: string;
    previousGeneratedAt?: string | null;
    previousAiDraftJson?: string | null;
    maxAttempts?: number;
    delayMs?: number;
  }): Promise<ChildProgressRecordRow | null> {
    const previousGeneratedAt = s(input.previousGeneratedAt);
    const previousAiDraftJson = s(input.previousAiDraftJson);
    const maxAttempts = input.maxAttempts ?? 16;
    const delayMs = input.delayMs ?? 600;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = await progressRecordModel.get({ id: input.id });
      if (result.errors?.length) {
        throw new Error(modelErrorText(result.errors));
      }

      const loaded = result.data ?? null;
      const loadedGeneratedAt = s(loaded?.generatedAt);
      const loadedAiDraftJson = s(loaded?.aiDraftJson);
      const draft = parseChildProgressAiDraft(loadedAiDraftJson);

      // A previously generated record can still be returned briefly after the
      // new Lambda invocation finishes. Never accept it as the current result.
      // At least one generation marker must differ from the values captured
      // before this invocation.
      const isNewGeneration = Boolean(
        (loadedGeneratedAt && loadedGeneratedAt !== previousGeneratedAt)
        || (loadedAiDraftJson && loadedAiDraftJson !== previousAiDraftJson),
      );

      const loadedStatus = s(loaded?.aiStatus).toUpperCase();

      if (
        loaded
        && loadedStatus === "ERROR"
        && isNewGeneration
      ) {
        throw new Error(
          s(loaded.generationErrorMessage)
          || "Claude自然文生成がLambda内でエラー終了しました。",
        );
      }

      if (
        loaded
        && loadedStatus === "GENERATED"
        && s(loaded.promptVersion) === CHILD_PROGRESS_PROMPT_VERSION
        && isNewGeneration
        && hasStructuredAiDraft(draft)
      ) {
        return loaded;
      }

      await wait(delayMs);
    }

    return null;
  }

  function createTemplateDraft() {
    if (!isWorkflowEditable) {
      setError("記録完了後は定型下書きを変更できません。差し戻し後に修正してください。");
      return;
    }
    if (!summary) return;
    setTemplateDraftText(buildChildProgressDraft(summary));
    setMessage("現在の根拠データから定型下書きを作成しました。Claude文章とは別に保存されます。");
  }

  async function saveTemplateDraft() {
    if (!isWorkflowEditable) {
      setError("記録完了後は定型下書きを保存できません。差し戻し後に修正してください。");
      return;
    }
    if (!summary || !currentRecordId || !classroomId || !templateDraftText.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const now = new Date().toISOString();
      const snapshot = buildChildProgressSnapshot({
        summary,
        classroomId,
        generatedAt: now,
      });
      const input: Record<string, unknown> = {
        id: currentRecordId,
        tenantId: props.tenantId,
        fiscalYear: props.fiscalYear,
        classroomId,
        childId: summary.childId,
        childName: summary.childName,
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        comparisonPeriodStart: comparisonStart,
        comparisonPeriodEnd: comparisonEnd,
        status: s(record?.status) || "DRAFT",
        evidenceSnapshotJson: JSON.stringify(snapshot),
        sourceObservationIdsJson: JSON.stringify(summary.sourceObservationIds),
        sourceAbilityCodesJson: JSON.stringify(summary.sourceAbilityCodes),
        templateDraftText: templateDraftText.trim(),
        aiSourceSnapshotJson: s(record?.aiSourceSnapshotJson) || undefined,
        aiDraftJson: s(record?.aiDraftJson) || undefined,
        aiDraftText: s(record?.aiDraftText) || aiDraftText || undefined,
        draftText: s(record?.draftText) || aiDraftText || undefined,
        finalText: s(record?.finalText) || undefined,
        aiStatus: isSourceStale && s(record?.aiStatus) === "GENERATED" ? "STALE" : (s(record?.aiStatus) || "NOT_GENERATED"),
        aiModel: s(record?.aiModel) || undefined,
        promptVersion: s(record?.promptVersion) || undefined,
        inputTokenCount: record?.inputTokenCount ?? undefined,
        outputTokenCount: record?.outputTokenCount ?? undefined,
        generatedAt: record?.generatedAt ?? undefined,
        generationErrorMessage: s(record?.generationErrorMessage) || undefined,
        aiRawJson: s(record?.aiRawJson) || undefined,
        recordedByUserId: record?.recordedByUserId ?? undefined,
        recordedByName: record?.recordedByName ?? undefined,
        recordedAt: record?.recordedAt ?? undefined,
        confirmedByUserId: record?.confirmedByUserId ?? undefined,
        confirmedByName: record?.confirmedByName ?? undefined,
        confirmedAt: record?.confirmedAt ?? undefined,
        reviewHistoryJson: s(record?.reviewHistoryJson) || "[]",
        createdByUserId: record?.createdByUserId ?? props.owner,
        updatedByUserId: props.owner,
      };
      const result = record
        ? await progressRecordModel.update(input)
        : await progressRecordModel.create(input);
      if (result.errors?.length) {
        throw new Error(modelErrorText(result.errors));
      }
      setRecord(result.data ?? ({ ...input } as ChildProgressRecordRow));
      setMessage("定型下書きと根拠スナップショットを、Claude文章とは別に保存しました。");
    } catch (caught) {
      setError(`下書き保存でエラーが発生しました: ${errorMessage(caught)}`);
    } finally {
      setSaving(false);
    }
  }

  function updateAiDraftField(
    field: keyof Pick<ChildProgressAiDraft,
      | "overviewText"
      | "healthText"
      | "relationshipText"
      | "environmentText"
      | "languageText"
      | "expressionText"
      | "continuityText"
      | "nextPerspectiveText"
    >,
    value: string,
  ) {
    if (!isWorkflowEditable) return;
    setAiDraft((current) => ({ ...current, [field]: value }));
  }

  async function generateAiDraft() {
    if (!isWorkflowEditable) {
      setError("記録完了後はClaude下書きを再生成できません。差し戻し後に修正してください。");
      return;
    }
    if (!summary || !source || !aiSourceSnapshot || !currentRecordId || !classroomId) return;
    if (summary.current.observationCount === 0) {
      setError("現在期間に確認済みの根拠エピソードがないため、Claude下書きを生成できません。");
      return;
    }

    setGeneratingAi(true);
    setError("");
    setMessage("");

    const previousGeneratedAt = s(record?.generatedAt);
    const previousAiDraftJson = s(record?.aiDraftJson);

    // Invalidate any record read that started before this generation.
    // A late response from that request must not overwrite the generated draft.
    recordLoadRequestRef.current += 1;
    try {
      const now = new Date().toISOString();
      const evidenceSnapshot = buildChildProgressSnapshot({
        summary,
        classroomId,
        generatedAt: now,
      });
      const templateText = templateDraftText.trim() || buildChildProgressDraft(summary);
      const input: Record<string, unknown> = {
        id: currentRecordId,
        tenantId: props.tenantId,
        fiscalYear: props.fiscalYear,
        classroomId,
        childId: summary.childId,
        childName: summary.childName,
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        comparisonPeriodStart: comparisonStart,
        comparisonPeriodEnd: comparisonEnd,
        status: s(record?.status) || "DRAFT",
        evidenceSnapshotJson: JSON.stringify(evidenceSnapshot),
        sourceObservationIdsJson: JSON.stringify(summary.sourceObservationIds),
        sourceAbilityCodesJson: JSON.stringify(summary.sourceAbilityCodes),
        templateDraftText: templateText,
        aiSourceSnapshotJson: JSON.stringify(aiSourceSnapshot),
        aiDraftJson: s(record?.aiDraftJson) || undefined,
        aiDraftText: s(record?.aiDraftText) || aiDraftText || undefined,
        draftText: s(record?.draftText) || aiDraftText || undefined,
        finalText: s(record?.finalText) || undefined,
        aiStatus: "GENERATING",
        aiModel: s(record?.aiModel) || undefined,
        promptVersion: CHILD_PROGRESS_PROMPT_VERSION,
        inputTokenCount: record?.inputTokenCount ?? undefined,
        outputTokenCount: record?.outputTokenCount ?? undefined,
        generatedAt: record?.generatedAt ?? undefined,
        generationErrorMessage: "",
        aiRawJson: s(record?.aiRawJson) || undefined,
        recordedByUserId: record?.recordedByUserId ?? undefined,
        recordedByName: record?.recordedByName ?? undefined,
        recordedAt: record?.recordedAt ?? undefined,
        confirmedByUserId: record?.confirmedByUserId ?? undefined,
        confirmedByName: record?.confirmedByName ?? undefined,
        confirmedAt: record?.confirmedAt ?? undefined,
        reviewHistoryJson: s(record?.reviewHistoryJson) || "[]",
        createdByUserId: record?.createdByUserId ?? props.owner,
        updatedByUserId: props.owner,
      };

      const upsertResult = record
        ? await progressRecordModel.update(input)
        : await progressRecordModel.create(input);
      if (upsertResult.errors?.length || !upsertResult.data) {
        throw new Error(modelErrorText(upsertResult.errors) || "Claude生成前の根拠保存に失敗しました。");
      }
      setRecord(upsertResult.data);

      const result = await progressApi.mutations.generateChildProgressRecord({
        childProgressRecordId: currentRecordId,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(modelErrorText(result.errors) || "Claudeによる自然文生成に失敗しました。");
      }

      const generatedDraft = parseChildProgressAiDraft(result.data.aiDraftJson);
      const generatedText = s(result.data.aiDraftText);
      const responseHasStructuredDraft = hasStructuredAiDraft(generatedDraft);

      const responseRecord: ChildProgressRecordRow = {
        ...(upsertResult.data ?? record ?? {}),
        id: currentRecordId,
        aiDraftJson: s(result.data.aiDraftJson),
        aiDraftText: generatedText,
        draftText: generatedText,
        aiStatus: s(result.data.status) || "GENERATED",
        aiModel: s(result.data.aiModel),
        promptVersion: CHILD_PROGRESS_PROMPT_VERSION,
        inputTokenCount: result.data.inputTokenCount ?? undefined,
        outputTokenCount: result.data.outputTokenCount ?? undefined,
        generatedAt: result.data.generatedAt ?? undefined,
        generationErrorMessage: "",
      };

      if (responseHasStructuredDraft) {
        // The custom mutation response is the result of this exact invocation.
        // Apply it atomically and do not immediately replace it with a model
        // read, because that read can briefly return the previous GENERATED
        // version.
        setRecord(responseRecord);
        setAiDraft(generatedDraft);
        setAiDraftText(generatedText);
        setMessage("ベテラン保育士型プロンプトで、中心テーマと5領域別の保育経過記録下書きを生成しました。");
      } else {
        // Only fall back to model polling when the mutation response did not
        // contain usable structured JSON. The polling function rejects the
        // previous generation by comparing generatedAt and aiDraftJson.
        setRecord((current) => ({
          ...(current ?? upsertResult.data ?? {}),
          id: currentRecordId,
          aiStatus: "GENERATING",
          promptVersion: CHILD_PROGRESS_PROMPT_VERSION,
          generationErrorMessage: "",
        }));
        setMessage("Claude生成は完了しました。保存された今回の生成結果を確認しています。");

        const persistedRecord = await waitForGeneratedRecord({
          id: currentRecordId,
          previousGeneratedAt,
          previousAiDraftJson,
        });
        if (!persistedRecord) {
          throw new Error(
            "Claude生成結果は保存されましたが、今回の構造化下書きを画面へ反映できませんでした。以前の生成結果を誤表示しないため、今回分を確認できるまで画面更新を保留しました。",
          );
        }
        applyLoadedRecord(persistedRecord);
        setMessage("ベテラン保育士型プロンプトで、中心テーマと5領域別の保育経過記録下書きを生成しました。");
      }
    } catch (caught) {
      if (isExecutionTimeoutError(caught)) {
        // AWS AppSync ends a synchronous request after its request-execution
        // limit, while the Lambda invocation can continue running. Keep the
        // current screen in a generating state and follow the persisted model
        // until this invocation writes either GENERATED or ERROR.
        setError("");
        setRecord((current) => ({
          ...(current ?? record ?? {}),
          id: currentRecordId,
          aiStatus: "GENERATING",
          promptVersion: CHILD_PROGRESS_PROMPT_VERSION,
          generationErrorMessage: "",
        }));
        setMessage(
          "Claudeは生成処理を継続しています。ブラウザを更新せず、このまま生成結果の保存完了を確認しています。",
        );

        try {
          const persistedRecord = await waitForGeneratedRecord({
            id: currentRecordId,
            previousGeneratedAt,
            previousAiDraftJson,
            maxAttempts: 90,
            delayMs: 1000,
          });

          if (!persistedRecord) {
            throw new Error(
              "Claude生成の開始後、所定時間内に保存完了を確認できませんでした。処理状態を再読込してから、必要に応じて再生成してください。",
            );
          }

          applyLoadedRecord(persistedRecord);
          setMessage(
            "Claudeの生成と保存が完了しました。中心テーマと5領域別の下書きを最新結果へ更新しました。",
          );
        } catch (followUpError) {
          setError(
            `Claude自然文生成の完了確認でエラーが発生しました: ${errorMessage(followUpError)}`,
          );
        }
      } else {
        setError(`Claude自然文生成でエラーが発生しました: ${errorMessage(caught)}`);
        await loadExistingRecord().catch(() => undefined);
      }
    } finally {
      setGeneratingAi(false);
    }
  }

  async function saveAiDraft() {
    if (!isWorkflowEditable) {
      setError("記録完了後は自然文下書きを変更できません。差し戻し後に修正してください。");
      return;
    }
    if (!record?.id || !summary) {
      setError("先にClaudeで自然文下書きを生成してください。");
      return;
    }
    setSavingAi(true);
    setError("");
    setMessage("");
    try {
      const combinedText = buildChildProgressAiDraftText({
        childName: summary.childName,
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        comparisonPeriodStart: comparisonStart,
        comparisonPeriodEnd: comparisonEnd,
        draft: aiDraft,
      });
      const result = await progressRecordModel.update({
        id: record.id,
        aiDraftJson: JSON.stringify(aiDraft),
        aiDraftText: combinedText,
        draftText: combinedText,
        aiStatus: isSourceStale ? "STALE" : "GENERATED",
        updatedByUserId: props.owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(modelErrorText(result.errors) || "編集したClaude下書きの保存に失敗しました。");
      }
      setRecord(result.data);
      setAiDraftText(combinedText);
      setMessage("編集したClaude自然文を保存しました。定型下書きは変更していません。");
    } catch (caught) {
      setError(`Claude下書き保存でエラーが発生しました: ${errorMessage(caught)}`);
    } finally {
      setSavingAi(false);
    }
  }


  function workflowEntry(
    action: ChildProgressWorkflowAction,
    status: ChildProgressWorkflowEntry["status"],
    at: string,
  ): ChildProgressWorkflowEntry {
    return {
      action,
      status,
      actorUserId: props.owner,
      actorName: s(props.ownerName) || props.owner,
      actorRole: normalizedOwnerRole || "STAFF",
      at,
      comment: workflowComment.trim(),
    };
  }

  function validateBeforeCompletion(): string {
    if (!record?.id) return "先にClaude自然文下書きを生成・保存してください。";
    if (!aiPreviewText.trim()) return "児童票転記前の全文が空です。自然文下書きを確認してください。";
    if (s(record.aiStatus).toUpperCase() !== "GENERATED") {
      return "Claude自然文下書きが生成済みではありません。";
    }
    if (isPromptOutdated) return "旧プロンプトの文章です。現行プロンプトで再生成してください。";
    if (isSourceStale) return "根拠ObservationまたはAbilityが更新されています。再生成してから記録完了してください。";
    return "";
  }

  async function handleCompleteRecord() {
    if (!isWorkflowEditable) {
      setError("下書きまたは差し戻し状態の記録だけを記録完了にできます。");
      return;
    }
    const validation = validateBeforeCompletion();
    if (validation) {
      setError(validation);
      return;
    }

    setWorkflowWorking(true);
    setError("");
    setMessage("");
    try {
      const now = new Date().toISOString();
      const combinedText = aiPreviewText.trim();
      const entry = workflowEntry("COMPLETE", "COMPLETED", now);
      const result = await progressRecordModel.update({
        id: s(record?.id),
        status: "COMPLETED",
        aiDraftJson: JSON.stringify(aiDraft),
        aiDraftText: combinedText,
        draftText: combinedText,
        finalText: null,
        aiStatus: "GENERATED",
        recordedByUserId: props.owner,
        recordedByName: s(props.ownerName) || props.owner,
        recordedAt: now,
        confirmedByUserId: null,
        confirmedByName: null,
        confirmedAt: null,
        reviewHistoryJson: appendWorkflowHistory(record?.reviewHistoryJson, entry),
        updatedByUserId: props.owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(modelErrorText(result.errors) || "保育経過記録の記録完了に失敗しました。");
      }
      setRecord(result.data);
      setAiDraftText(combinedText);
      setWorkflowComment("");
      setMessage("保育経過記録を記録完了にしました。園長・主任の確認待ちです。");
    } catch (caught) {
      setError(`記録完了でエラーが発生しました: ${errorMessage(caught)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleConfirmRecord() {
    if (!canReview) {
      setError("園長・主任権限のユーザーだけが確認できます。");
      return;
    }
    if (!isWorkflowCompleted || !record?.id) {
      setError("記録完了状態の保育経過記録だけを確認できます。");
      return;
    }
    if (isSourceStale) {
      setError("記録完了後に根拠が変更されています。確認せず、担任へ差し戻してください。");
      return;
    }
    if (!aiPreviewText.trim()) {
      setError("確認対象の全文が空です。");
      return;
    }

    setWorkflowWorking(true);
    setError("");
    setMessage("");
    try {
      const now = new Date().toISOString();
      const finalText = aiPreviewText.trim();
      const entry = workflowEntry("CONFIRM", "CONFIRMED", now);
      const result = await progressRecordModel.update({
        id: record.id,
        status: "CONFIRMED",
        finalText,
        confirmedByUserId: props.owner,
        confirmedByName: s(props.ownerName) || props.owner,
        confirmedAt: now,
        reviewHistoryJson: appendWorkflowHistory(record.reviewHistoryJson, entry),
        updatedByUserId: props.owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(modelErrorText(result.errors) || "保育経過記録の確認に失敗しました。");
      }
      setRecord(result.data);
      setWorkflowComment("");
      setMessage("保育経過記録を確認済みにしました。転記用の最終本文を固定しました。");
    } catch (caught) {
      setError(`確認処理でエラーが発生しました: ${errorMessage(caught)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleReturnRecord() {
    if (!canReview) {
      setError("園長・主任権限のユーザーだけが差し戻しできます。");
      return;
    }
    if (!isWorkflowCompleted || !record?.id) {
      setError("記録完了状態の保育経過記録だけを差し戻しできます。");
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
      const now = new Date().toISOString();
      const entry = workflowEntry("RETURN", "RETURNED", now);
      const result = await progressRecordModel.update({
        id: record.id,
        status: "RETURNED",
        finalText: null,
        confirmedByUserId: null,
        confirmedByName: null,
        confirmedAt: null,
        reviewHistoryJson: appendWorkflowHistory(record.reviewHistoryJson, entry),
        updatedByUserId: props.owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(modelErrorText(result.errors) || "保育経過記録の差し戻しに失敗しました。");
      }
      setRecord(result.data);
      setWorkflowComment("");
      setMessage("保育経過記録を差し戻しました。担任が再編集できます。");
    } catch (caught) {
      setError(`差し戻しでエラーが発生しました: ${errorMessage(caught)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  function downloadFinalText() {
    if (!finalTransferText || !summary) return;
    const filename = safeFileName(
      `${summary.childName}_保育経過記録_${currentStart}_${currentEnd}.txt`,
    );
    const blob = new Blob([finalTransferText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setMessage("確認済みの転記用本文をテキストファイルとして保存しました。");
  }

  useEffect(() => {
    loadClassrooms().catch((caught) => {
      setError(`クラス一覧の取得でエラーが発生しました: ${errorMessage(caught)}`);
    });
  }, [props.tenantId, props.fiscalYear]);

  useEffect(() => {
    loadSourceData();
  }, [classroomId, currentStart, currentEnd, comparisonStart, comparisonEnd]);

  useEffect(() => {
    loadExistingRecord();
  }, [currentRecordId]);

  const maxDomainCount = Math.max(
    1,
    ...(summary?.domainRows.flatMap((row) => [row.currentCount, row.previousCount]) ?? [1]),
  );

  const groupedAbilities = useMemo(() => {
    const groups: Array<{
      key: string;
      title: string;
      rows: ChildProgressAbilityComparisonRow[];
    }> = [];
    if (!summary) return groups;
    const definitions: Array<{
      key: ChildProgressAbilityComparisonRow["status"];
      title: string;
    }> = [
      { key: "NEW", title: "新たに記録された姿" },
      { key: "MORE_RECORDED", title: "比較期間より記録場面が多かった姿" },
      { key: "CONTINUED", title: "継続して記録された姿" },
      { key: "LESS_RECORDED", title: "比較期間より記録場面が少なかった姿" },
      { key: "PREVIOUS_ONLY", title: "現在期間には記録されなかった姿" },
    ];
    for (const definition of definitions) {
      const rows = summary.abilityRows.filter((row) => row.status === definition.key);
      if (rows.length > 0) groups.push({ ...definition, rows });
    }
    return groups;
  }, [summary]);

  return (
    <div className="child-progress-workspace">
      <header className="child-progress-header">
        <div>
          <p className="eyebrow">Phase 9-D4 / Check</p>
          <h2>保育経過記録支援</h2>
          <p className="muted">
            確認済みの日々の記録から自然文下書きを作成し、担任の記録完了、園長・主任の確認・差し戻し、児童票への転記準備までを支援します。
          </p>
        </div>
        <span className="child-progress-staff-badge">
          {props.ownerName ?? props.owner} / {props.ownerRole ?? "STAFF"}
        </span>
      </header>

      <p className="child-progress-important-note">
        この機能は保育士の判断を支援するものであり、子どもの発達を診断・評価したり、児童票を自動完成させたりするものではありません。担任が根拠と文章を確認して記録完了とし、園長・主任が確認した本文だけを転記用として固定します。
      </p>

      <section className="child-progress-selector-card">
        <label>
          <span>対象クラス</span>
          <select value={classroomId} onChange={(event: { target: { value: string } }) => setClassroomId(event.target.value)}>
            {classrooms.map((classroom) => (
              <option key={s(classroom.id)} value={s(classroom.id)}>
                {s(classroom.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>対象児童</span>
          <select value={childId} onChange={(event: { target: { value: string } }) => setChildId(event.target.value)}>
            {children.map((child) => (
              <option key={s(child.id)} value={s(child.id)}>
                {s(child.displayName)}{s(child.kana) ? `（${s(child.kana)}）` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>現在期間 From</span>
          <input type="date" value={currentStart} onChange={(event: { target: { value: string } }) => setCurrentStart(event.target.value)} />
        </label>
        <label>
          <span>現在期間 To</span>
          <input type="date" value={currentEnd} onChange={(event: { target: { value: string } }) => setCurrentEnd(event.target.value)} />
        </label>
        <label>
          <span>比較期間 From</span>
          <input type="date" value={comparisonStart} onChange={(event: { target: { value: string } }) => setComparisonStart(event.target.value)} />
        </label>
        <label>
          <span>比較期間 To</span>
          <input type="date" value={comparisonEnd} onChange={(event: { target: { value: string } }) => setComparisonEnd(event.target.value)} />
        </label>
        <button type="button" onClick={loadSourceData} disabled={loading || !classroomId}>
          {loading ? "読込中..." : "根拠を再読込"}
        </button>
      </section>

      {dateWarnings.length > 0 && (
        <div className="child-progress-warning-list">
          {dateWarnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
      {error && <p className="error-box">{error}</p>}
      {message && <p className="success-box">{message}</p>}

      {summary && (
        <>
          <section className="child-progress-summary-grid">
            <div>
              <strong>現在期間</strong>
              <span>{summary.current.periodStart}〜{summary.current.periodEnd}</span>
              <small>{summary.current.observationCount}件 / {summary.current.observationDayCount}日</small>
            </div>
            <div>
              <strong>比較期間</strong>
              <span>{summary.previous.periodStart}〜{summary.previous.periodEnd}</span>
              <small>{summary.previous.observationCount}件 / {summary.previous.observationDayCount}日</small>
            </div>
            <div>
              <strong>現在期間のPractice</strong>
              <span>{summary.current.practiceCount}</span>
              <small>異なる遊び・生活場面</small>
            </div>
            <div>
              <strong>現在期間のAbility</strong>
              <span>{summary.current.observedAbilityCount}</span>
              <small>観察記録に現れた種類</small>
            </div>
          </section>

          {isSourceStale && (
            <p className="child-progress-stale-note">
              保存後に根拠ObservationまたはAbilityが変わっています。定型下書きを作り直し、再保存してください。
            </p>
          )}

          <section className={`child-progress-workflow-summary child-progress-workflow-${workflowStatus.toLowerCase()}`}>
            <div>
              <strong>確認フロー</strong>
              <span>{statusLabel(workflowStatus)}</span>
            </div>
            <div>
              <strong>記録完了</strong>
              <span>{s(record?.recordedByName) || "-"}</span>
              <small>{formatWorkflowDateTime(record?.recordedAt)}</small>
            </div>
            <div>
              <strong>確認</strong>
              <span>{s(record?.confirmedByName) || "-"}</span>
              <small>{formatWorkflowDateTime(record?.confirmedAt)}</small>
            </div>
            <div>
              <strong>現在の操作権限</strong>
              <span>{canReview ? "園長・主任確認可" : "担任・職員"}</span>
              <small>{normalizedOwnerRole || "STAFF"}</small>
            </div>
          </section>

          <section className="child-progress-two-column">
            <article className="child-progress-card">
              <div className="child-progress-card-header">
                <h3>5領域の記録比較</h3>
                <span>記録に現れたObservation数</span>
              </div>
              <div className="child-progress-domain-list">
                {summary.domainRows.map((row) => (
                  <div className="child-progress-domain-row" key={row.key}>
                    <strong>{row.label}</strong>
                    <div>
                      <small>比較 {row.previousCount}</small>
                      <span className="child-progress-bar-track"><i className="child-progress-bar-previous" style={{ width: `${(row.previousCount / maxDomainCount) * 100}%` }} /></span>
                    </div>
                    <div>
                      <small>現在 {row.currentCount}</small>
                      <span className="child-progress-bar-track"><i className="child-progress-bar-current" style={{ width: `${(row.currentCount / maxDomainCount) * 100}%` }} /></span>
                    </div>
                    <b>{row.difference > 0 ? `+${row.difference}` : row.difference}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="child-progress-card">
              <div className="child-progress-card-header">
                <h3>集計の確認</h3>
                <span>保育士向け根拠</span>
              </div>
              <dl className="child-progress-metric-list">
                <div><dt>Abilityリンク</dt><dd>{summary.previous.abilityLinkCount} → {summary.current.abilityLinkCount}</dd></div>
                <div><dt>Abilityなし記録</dt><dd>{summary.previous.observationWithoutAbilityCount} → {summary.current.observationWithoutAbilityCount}</dd></div>
                <div><dt>新たに記録</dt><dd>{summary.newAbilities.length}</dd></div>
                <div><dt>継続・増減あり</dt><dd>{summary.continuedAbilities.length + summary.moreRecordedAbilities.length + summary.lessRecordedAbilities.length}</dd></div>
                <div><dt>現在期間は未観察</dt><dd>{summary.previousOnlyAbilities.length}</dd></div>
              </dl>
              <p className="child-progress-small-note">
                「少ない」「未観察」は、育ちの後退や未達成を意味しません。活動内容・出席・観察機会・記録量の影響を含みます。
              </p>
            </article>
          </section>

          <section className="child-progress-card">
            <div className="child-progress-card-header">
              <h3>10の姿・Abilityの比較</h3>
              <span>{summary.abilityRows.length}種類</span>
            </div>
            <div className="child-progress-ability-groups">
              {groupedAbilities.length === 0 ? (
                <p className="muted">比較できるAbility記録はありません。</p>
              ) : groupedAbilities.map((group) => (
                <div key={group.key}>
                  <h4>{group.title}</h4>
                  <div className="child-progress-ability-list">
                    {group.rows.map((row) => (
                      <div className={`child-progress-ability-row child-progress-ability-${row.status.toLowerCase().replaceAll("_", "-")}`} key={row.abilityCode}>
                        <div>
                          <strong>{row.abilityName}</strong>
                          <small>{row.domain} / {row.category}</small>
                        </div>
                        <span>比較 {row.previousCount}</span>
                        <span>現在 {row.currentCount}</span>
                        <b>{abilityStatusLabel(row)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="child-progress-two-column">
            <article className="child-progress-card">
              <div className="child-progress-card-header">
                <h3>Practiceとのつながり</h3>
                <span>現在期間</span>
              </div>
              <div className="child-progress-practice-list">
                {summary.current.practices.length === 0 ? <p className="muted">記録はありません。</p> : summary.current.practices.map((practice) => (
                  <div key={practice.key}>
                    <strong>{practice.practiceName}</strong>
                    <span>{practice.performedDateCount}日</span>
                    <span>{practice.observationCount}エピソード</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="child-progress-card">
              <div className="child-progress-card-header">
                <h3>注意・確認事項</h3>
                <span>{summary.warnings.length}件</span>
              </div>
              {summary.warnings.length === 0 ? <p className="muted">特記事項はありません。</p> : (
                <ul className="child-progress-warning-items">
                  {summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </article>
          </section>

          <section className="child-progress-card">
            <div className="child-progress-card-header">
              <h3>代表的な根拠エピソード</h3>
              <span>最大12件</span>
            </div>
            <div className="child-progress-evidence-list">
              {summary.evidenceRows.length === 0 ? <p className="muted">現在期間の根拠エピソードはありません。</p> : summary.evidenceRows.map((episode) => (
                <article key={episode.observationId}>
                  <div className="child-progress-evidence-meta">
                    <span>{episode.reportDate}</span>
                    <span>{episode.practiceName}</span>
                    {episode.observedByName && <span>{episode.observedByName}</span>}
                  </div>
                  <p>{episode.episodeText}</p>
                  <div className="child-progress-evidence-abilities">
                    {episode.abilities.map((ability) => (
                      <span key={`${episode.observationId}-${ability.abilityCode}`}>{ability.abilityName}</span>
                    ))}
                  </div>
                  {episode.selectionReasons.length > 0 && <small>選定理由：{episode.selectionReasons.join(" / ")}</small>}
                </article>
              ))}
            </div>
          </section>

          <section className="child-progress-card child-progress-draft-card">
            <div className="child-progress-card-header">
              <div>
                <h3>保育経過記録・定型下書き</h3>
                <small>保存状態：{statusLabel(s(record?.status))}</small>
              </div>
              <div className="child-progress-draft-actions">
                <button type="button" onClick={createTemplateDraft} disabled={!isWorkflowEditable}>現在の根拠から定型下書きを作成</button>
                <button type="button" className="secondary-button" onClick={() => copyText(templateDraftText).then(() => setMessage("定型下書きをクリップボードへコピーしました。"), (caught) => setError(errorMessage(caught)))} disabled={!templateDraftText.trim()}>コピー</button>
                <button type="button" onClick={saveTemplateDraft} disabled={saving || !templateDraftText.trim() || !isWorkflowEditable}>{saving ? "保存中..." : "定型下書きと根拠を保存"}</button>
              </div>
            </div>
            <div className="child-progress-draft-separation-banner">
              <strong>AI非依存の根拠整理</strong>
              <span>Claudeを生成・再生成しても、この定型下書きは上書きされません。</span>
            </div>
            <textarea value={templateDraftText} onChange={(event: { target: { value: string } }) => setTemplateDraftText(event.target.value)} placeholder="「現在の根拠から定型下書きを作成」を押してください。" readOnly={!isWorkflowEditable} />
            <p className="child-progress-small-note">
              Phase 9-D3bでも、定型下書きはClaudeの入力には使用しません。Claudeは元のObservationエピソードと構造化されたAbility・5領域・Practice情報から、独立して育ちの意味を解釈・統合します。
            </p>
          </section>

          <section className="child-progress-card child-progress-ai-card">
            <div className="child-progress-card-header">
              <div>
                <h3>Claudeによる保育経過記録・自然文下書き</h3>
                <small>中心的な育ちのテーマを抽出し、全体・5領域・比較・今後の視点へ統合します。</small>
              </div>
              <span className={`child-progress-ai-status ${aiStatusClass(isSourceStale && s(record?.aiStatus) === "GENERATED" ? "STALE" : record?.aiStatus)}`}>
                {aiStatusLabel(isSourceStale && s(record?.aiStatus) === "GENERATED" ? "STALE" : record?.aiStatus)}
              </span>
            </div>

            <div className="child-progress-ai-source-grid">
              <div><strong>現在期間の根拠</strong><span>{aiSourceSnapshot?.overallCurrentEpisodes.length ?? 0}件</span></div>
              <div><strong>比較期間の根拠</strong><span>{aiSourceSnapshot?.overallPreviousEpisodes.length ?? 0}件</span></div>
              <div><strong>AIモデル</strong><span>{s(record?.aiModel) || "未生成"}</span></div>
              <div><strong>トークン</strong><span>{record?.inputTokenCount ?? 0} / {record?.outputTokenCount ?? 0}</span></div>
            </div>

            <div className="child-progress-ai-domain-source-list">
              <strong>Claudeへ渡す5領域別の現在期間根拠</strong>
              <div>
                {(aiSourceSnapshot?.domains ?? []).map((domain) => (
                  <span key={domain.domain}>
                    {domain.domain} {domain.currentEpisodes.length}件
                  </span>
                ))}
              </div>
              <small>ここが0件の領域だけ、AI本文を空欄にして保育士の追記確認対象とします。</small>
            </div>

            <div className="child-progress-ai-separation-banner">
              <strong>Claude文章は別保存</strong>
              <span>{aiDraftText.trim() ? "AI全文を保存済み" : "AI全文は未生成"}</span>
              <small>生成・編集時はaiDraftJson / aiDraftText / draftTextだけを更新し、templateDraftTextは変更しません。</small>
            </div>

            <div className="child-progress-ai-expert-banner">
              <strong>ベテラン保育士型の解釈・統合</strong>
              <span>活動の列挙ではなく、異なる記録に共通する関心・試行・表現・関係性を中心テーマとして捉え直します。</span>
              <small>定型下書き全文は入力せず、確認済みObservationを最優先の根拠として使用します。</small>
            </div>

            {!isWorkflowEditable && (
              <div className="child-progress-editor-lock-note">
                <strong>{isWorkflowConfirmed ? "確認済み本文を固定しています" : "園長・主任の確認待ちです"}</strong>
                <span>{isWorkflowConfirmed ? "最終本文は下の転記準備欄からコピーできます。" : "修正が必要な場合は、園長・主任が差し戻してください。"}</span>
              </div>
            )}

            {isPromptOutdated && (
              <p className="child-progress-ai-stale-note">
                現在保存されている文章は旧プロンプトで生成されています。「新プロンプトで再生成」を実行すると、中心テーマを軸にした文章へ更新できます。
              </p>
            )}

            {isSourceStale && (
              <p className="child-progress-ai-stale-note">
                Claude生成後に根拠ObservationまたはAbilityが変更されています。現在の根拠で再生成してください。
              </p>
            )}

            {s(record?.generationErrorMessage) && s(record?.aiStatus) === "ERROR" && (
              <p className="error-box">{s(record?.generationErrorMessage)}</p>
            )}

            <div className="child-progress-ai-actions">
              <button
                type="button"
                onClick={generateAiDraft}
                disabled={generatingAi || !aiSourceSnapshot || summary.current.observationCount === 0 || !isWorkflowEditable}
              >
                {generatingAi
                  ? "Claude生成中..."
                  : isPromptOutdated
                    ? "新プロンプトで再生成"
                    : s(record?.aiStatus) === "GENERATED"
                      ? "現在の根拠で再生成"
                      : "Claudeで自然文下書きを生成"}
              </button>
              <button
                type="button"
                onClick={saveAiDraft}
                disabled={savingAi || !record?.id || !aiDraft.overviewText.trim() || !isWorkflowEditable}
              >
                {savingAi ? "保存中..." : "編集した自然文を保存"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => copyText(aiPreviewText).then(
                  () => setMessage("Claude自然文下書きをクリップボードへコピーしました。"),
                  (caught) => setError(errorMessage(caught)),
                )}
                disabled={!aiDraft.overviewText.trim()}
              >
                全文をコピー
              </button>
            </div>

            {(aiDraft.centralThemes.length > 0 || aiDraft.interpretationNotes.length > 0) && (
              <div className="child-progress-ai-interpretation-card">
                {aiDraft.centralThemes.length > 0 && (
                  <div>
                    <strong>中心的な育ちのテーマ</strong>
                    <div className="child-progress-ai-theme-list">
                      {aiDraft.centralThemes.map((theme) => <span key={theme}>{theme}</span>)}
                    </div>
                  </div>
                )}
                {aiDraft.interpretationNotes.length > 0 && (
                  <div>
                    <strong>AIの解釈ポイント（保育士確認用）</strong>
                    <ul>
                      {aiDraft.interpretationNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                    <small>この欄は児童票転記用全文には含まれません。AIが複数記録をどのようにつないだかを確認するための説明です。</small>
                  </div>
                )}
              </div>
            )}

            {aiDraft.needsTeacherInputDomains.length > 0 && (
              <div className="child-progress-ai-needs-input">
                <strong>保育士の追記確認が必要な領域</strong>
                <div>{aiDraft.needsTeacherInputDomains.map((domain) => <span key={domain}>{domain}</span>)}</div>
                <p>対象期間の登録記録から、自然文に使用できる具体的な根拠を確認できなかった領域です。育ちが見られないという意味ではありません。</p>
              </div>
            )}

            <div className="child-progress-ai-editor">
              <label className="child-progress-ai-editor-wide">
                <span>期間を通した育ち</span>
                <textarea value={aiDraft.overviewText} onChange={(event: { target: { value: string } }) => updateAiDraftField("overviewText", event.target.value)} readOnly={!isWorkflowEditable} />
              </label>
              <label><span>健康の視点から見た育ち</span><textarea value={aiDraft.healthText} onChange={(event: { target: { value: string } }) => updateAiDraftField("healthText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
              <label><span>人間関係の視点から見た育ち</span><textarea value={aiDraft.relationshipText} onChange={(event: { target: { value: string } }) => updateAiDraftField("relationshipText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
              <label><span>環境の視点から見た育ち</span><textarea value={aiDraft.environmentText} onChange={(event: { target: { value: string } }) => updateAiDraftField("environmentText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
              <label><span>言葉の視点から見た育ち</span><textarea value={aiDraft.languageText} onChange={(event: { target: { value: string } }) => updateAiDraftField("languageText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
              <label><span>表現の視点から見た育ち</span><textarea value={aiDraft.expressionText} onChange={(event: { target: { value: string } }) => updateAiDraftField("expressionText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
              <label><span>比較期間からのつながり</span><textarea value={aiDraft.continuityText} onChange={(event: { target: { value: string } }) => updateAiDraftField("continuityText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
              <label className="child-progress-ai-editor-wide"><span>今後見届けたい視点</span><textarea value={aiDraft.nextPerspectiveText} onChange={(event: { target: { value: string } }) => updateAiDraftField("nextPerspectiveText", event.target.value)} readOnly={!isWorkflowEditable} /></label>
            </div>

            {aiDraft.warnings.length > 0 && (
              <ul className="child-progress-warning-items">
                {aiDraft.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}

            {hasAiStructuredContent || aiDraftText.trim() ? (
              <div className="child-progress-ai-preview">
                <strong>児童票転記前の全文プレビュー</strong>
                <pre>{aiPreviewText}</pre>
              </div>
            ) : generatingAi ? (
              <div className="child-progress-ai-preview child-progress-ai-preview-loading">
                <strong>生成結果を画面へ反映しています</strong>
                <p>Claudeの生成結果を保存済みレコードから確認しています。根拠なしの定型メッセージは表示しません。</p>
              </div>
            ) : null}
          </section>

          <section className="child-progress-card child-progress-workflow-card">
            <div className="child-progress-card-header">
              <div>
                <h3>確認・承認</h3>
                <small>担任の記録完了後、園長・主任が確認または差し戻します。</small>
              </div>
              <span className={`child-progress-workflow-status child-progress-workflow-status-${workflowStatus.toLowerCase()}`}>
                {statusLabel(workflowStatus)}
              </span>
            </div>

            {isWorkflowEditable && (
              <p className="child-progress-workflow-guidance">
                文章と根拠を確認し、必要な修正を保存してから「担任の記録完了」を押してください。根拠が更新された場合や旧プロンプトの場合は記録完了できません。
              </p>
            )}
            {isWorkflowCompleted && !canReview && (
              <p className="child-progress-workflow-guidance">
                記録完了済みです。園長・主任の確認を待っています。
              </p>
            )}
            {isWorkflowCompleted && canReview && (
              <p className="child-progress-workflow-guidance">
                根拠エピソードと全文を確認し、問題がなければ確認、修正が必要なら理由を入力して差し戻してください。
              </p>
            )}
            {isWorkflowConfirmed && (
              <p className="child-progress-workflow-guidance child-progress-workflow-guidance-confirmed">
                確認時点の全文を最終本文として固定しました。後から根拠やAI下書きが変わっても、転記用本文は自動変更されません。
              </p>
            )}

            {!isWorkflowConfirmed && (
              <label className="child-progress-workflow-comment">
                <span>{isWorkflowCompleted ? "確認コメント / 差し戻し理由" : "記録完了コメント（任意）"}</span>
                <textarea
                  value={workflowComment}
                  onChange={(event: { target: { value: string } }) => setWorkflowComment(event.target.value)}
                  placeholder={isWorkflowCompleted ? "差し戻す場合は理由を必ず入力してください。" : "園長・主任へ伝える補足があれば入力してください。"}
                  disabled={workflowWorking || (isWorkflowCompleted && !canReview)}
                />
              </label>
            )}

            <div className="child-progress-workflow-actions">
              {isWorkflowEditable && (
                <button type="button" onClick={handleCompleteRecord} disabled={workflowWorking || savingAi || generatingAi || !aiPreviewText.trim()}>
                  {workflowWorking ? "処理中..." : "担任の記録完了"}
                </button>
              )}
              {isWorkflowCompleted && canReview && (
                <>
                  <button type="button" onClick={handleConfirmRecord} disabled={workflowWorking}>
                    {workflowWorking ? "処理中..." : "園長・主任が確認"}
                  </button>
                  <button type="button" className="secondary-button child-progress-return-button" onClick={handleReturnRecord} disabled={workflowWorking || !workflowComment.trim()}>
                    差し戻し
                  </button>
                </>
              )}
            </div>

            <div className="child-progress-workflow-history">
              <strong>確認履歴</strong>
              {workflowHistory.length === 0 ? (
                <p>履歴はまだありません。</p>
              ) : (
                <div>
                  {workflowHistory.map((entry, index) => (
                    <article key={`${entry.at}-${entry.action}-${index}`}>
                      <div>
                        <b>{workflowActionLabel(entry.action)}</b>
                        <span>{entry.actorName || entry.actorUserId} / {entry.actorRole || "STAFF"}</span>
                        <time>{formatWorkflowDateTime(entry.at)}</time>
                      </div>
                      {entry.comment && <p>{entry.comment}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {isWorkflowConfirmed && (
            <section className="child-progress-card child-progress-transfer-card">
              <div className="child-progress-card-header">
                <div>
                  <h3>児童票への転記準備</h3>
                  <small>園長・主任が確認した時点の最終本文です。</small>
                </div>
                <span className="child-progress-transfer-ready">転記準備完了</span>
              </div>

              <div className="child-progress-transfer-meta">
                <div><strong>対象児童</strong><span>{summary.childName}さん</span></div>
                <div><strong>現在期間</strong><span>{currentStart}〜{currentEnd}</span></div>
                <div><strong>記録完了</strong><span>{s(record?.recordedByName) || "-"}</span><small>{formatWorkflowDateTime(record?.recordedAt)}</small></div>
                <div><strong>確認</strong><span>{s(record?.confirmedByName) || "-"}</span><small>{formatWorkflowDateTime(record?.confirmedAt)}</small></div>
              </div>

              {isSourceStale && (
                <p className="child-progress-transfer-warning">
                  確認後に根拠データが変更されています。ただし、下記の確認済み最終本文は自動変更していません。
                </p>
              )}

              <div className="child-progress-transfer-actions">
                <button
                  type="button"
                  onClick={() => copyText(finalTransferText).then(
                    () => setMessage("確認済みの転記用本文をクリップボードへコピーしました。"),
                    (caught) => setError(errorMessage(caught)),
                  )}
                  disabled={!finalTransferText}
                >
                  転記用本文をコピー
                </button>
                <button type="button" className="secondary-button" onClick={downloadFinalText} disabled={!finalTransferText}>
                  テキスト保存
                </button>
              </div>

              <pre className="child-progress-transfer-text">{finalTransferText || "確認済み本文がありません。"}</pre>
              <p className="child-progress-small-note">
                保育360は転記を支援します。実際の児童票への登録内容と提出判断は、園の運用に従って保育士・確認者が行ってください。
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
