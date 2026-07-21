import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import {
  aggregateChildWeeklyRecord,
  childWeeklyComparisonClass,
  childWeeklyComparisonLabel,
} from "./childWeeklyAggregation";
import {
  loadObservationReportData,
  loadReportClassrooms,
  type ObservationReportClient,
} from "./loadObservationReportData";
import {
  addDateOnlyDays,
  createWeekContext,
  formatDateLabel,
  formatPeriodLabel,
  todayJstDateOnly,
} from "./reportPeriod";
import {
  buildChildWeekendLetterSourceSnapshot,
  buildParentLetterText,
  childWeeklyReportId,
  emptyChildWeekendLetterDraft,
  parseSelectedWeekendPlayId,
  weekendPlaySelectionSnapshot,
} from "./childWeekendLetter";
import {
  selectWeekendPlayCandidates,
  weekendPlayCatalogStats,
  weekendPlayMatchLevelLabel,
  weekendPlayRelationLabel,
} from "./weekendPlayCatalog";
import {
  appendChildWeeklyWorkflowEntry,
  canEditChildWeeklyReport,
  canReviewChildWeeklyReport,
  childWeeklyStatusClass,
  childWeeklyStatusLabel,
  childWeeklyWorkflowActionLabel,
  formatWorkflowTimestamp,
  normalizedChildWeeklyStatus,
  parseChildWeeklyWorkflowHistory,
} from "./childWeeklyWorkflow";
import type {
  ClassroomRow,
  ChildRow,
  ChildWeekendLetterDraft,
  ChildWeeklyRecordSummary,
  ChildWeeklyReportRow,
  ChildWeeklyWorkflowEntry,
  GenerateChildWeekendLetterResponse,
  ObservationReportSourceData,
  WeekendPlayCandidate,
} from "./types";

type Props = {
  owner: string;
  ownerName?: string | null;
  ownerRole?: string | null;
  tenantId: string;
  tenantName?: string | null;
  fiscalYear: number;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
};

type DataError = { message?: string | null };

type DataResult<T> = Promise<{
  data?: T | null;
  errors?: ReadonlyArray<DataError> | null;
}>;

type ChildWeeklyReportModel = {
  get: (input: { id: string }) => DataResult<ChildWeeklyReportRow>;
  create: (input: Record<string, unknown>) => DataResult<ChildWeeklyReportRow>;
  update: (input: Record<string, unknown> & { id: string }) => DataResult<ChildWeeklyReportRow>;
};

type ChildWeekendLetterApi = {
  models: {
    ChildWeeklyReport: ChildWeeklyReportModel;
  };
  mutations: {
    generateChildWeekendLetter: (input: { childWeeklyReportId: string }) =>
      DataResult<GenerateChildWeekendLetterResponse>;
  };
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function percentage(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function practiceRoleLabel(value: string): string {
  return value.toUpperCase() === "RESERVE" ? "予備活動" : "主活動";
}

function sortedChildren(source: ObservationReportSourceData | null): ChildRow[] {
  if (!source) return [];
  return [...source.enrolledChildren]
    .filter((child) => Boolean(s(child.id)))
    .sort((a, b) => s(a.displayName).localeCompare(s(b.displayName), "ja"));
}

function resultErrorText(
  errors: ReadonlyArray<DataError> | null | undefined,
  fallback: string,
): string {
  return (errors ?? []).map((error) => s(error.message)).filter(Boolean).join("\n") || fallback;
}

function letterDraftFromReport(report: ChildWeeklyReportRow | null): ChildWeekendLetterDraft {
  if (!report) return emptyChildWeekendLetterDraft();
  return {
    title: s(report.title),
    weeklyEpisodeText: s(report.weeklyEpisodeText),
    growthText: s(report.growthText),
    comparisonText: s(report.comparisonText),
    weekendPlayText: s(report.weekendPlayText),
  };
}

function aiStatusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "GENERATING") return "生成中";
  if (status === "GENERATED") return "下書き生成済み";
  if (status === "STALE") return "再生成が必要";
  if (status === "ERROR") return "生成エラー";
  return "未生成";
}

function aiStatusClass(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "GENERATED") return "child-weekly-ai-status-generated";
  if (status === "GENERATING") return "child-weekly-ai-status-generating";
  if (status === "ERROR") return "child-weekly-ai-status-error";
  if (status === "STALE") return "child-weekly-ai-status-stale";
  return "";
}

export default function ChildWeeklyWorkspacePanel(props: Props) {
  const {
    owner,
    ownerName,
    ownerRole,
    tenantId,
    tenantName,
    fiscalYear,
    currentClassroomId,
    allowedClassroomIds,
    isSchoolScope,
  } = props;

  const client = useMemo(() => generateClient<Schema>(), []);
  const reportClient = useMemo<ObservationReportClient>(() => ({
    Classroom: client.models.Classroom as unknown as ObservationReportClient["Classroom"],
    Child: client.models.Child as unknown as ObservationReportClient["Child"],
    ChildClassroomEnrollment: client.models.ChildClassroomEnrollment as unknown as ObservationReportClient["ChildClassroomEnrollment"],
    ObservationRecord: client.models.ObservationRecord as unknown as ObservationReportClient["ObservationRecord"],
    ObservationAbilityLink: client.models.ObservationAbilityLink as unknown as ObservationReportClient["ObservationAbilityLink"],
    AbilityCode: client.models.AbilityCode as unknown as ObservationReportClient["AbilityCode"],
    DailyPracticeRecord: client.models.DailyPracticeRecord as unknown as ObservationReportClient["DailyPracticeRecord"],
    PlanDocument: client.models.PlanDocument as unknown as ObservationReportClient["PlanDocument"],
    PlanPhrase: client.models.PlanPhrase as unknown as ObservationReportClient["PlanPhrase"],
    PlanPhraseAbilityLink: client.models.PlanPhraseAbilityLink as unknown as ObservationReportClient["PlanPhraseAbilityLink"],
  }), [client]);
  const letterApi = useMemo(
    () => client as unknown as ChildWeekendLetterApi,
    [client],
  );

  const [anchorDate, setAnchorDate] = useState(() => todayJstDateOnly());
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [source, setSource] = useState<ObservationReportSourceData | null>(null);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [selectedWeekendPlayId, setSelectedWeekendPlayId] = useState("");
  const [weeklyReport, setWeeklyReport] = useState<ChildWeeklyReportRow | null>(null);
  const [letterDraft, setLetterDraft] = useState<ChildWeekendLetterDraft>(() => emptyChildWeekendLetterDraft());
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [savingLetter, setSavingLetter] = useState(false);
  const [workflowWorking, setWorkflowWorking] = useState(false);
  const [workflowComment, setWorkflowComment] = useState("");
  const [letterMessage, setLetterMessage] = useState("");
  const [error, setError] = useState("");

  const classContext = useMemo(() => createWeekContext({
    anchorDate,
    tenantId,
    fiscalYear,
    classroomId: selectedClassroomId,
  }), [anchorDate, fiscalYear, selectedClassroomId, tenantId]);

  const childContext = useMemo(() => selectedChildId ? createWeekContext({
    anchorDate,
    tenantId,
    fiscalYear,
    classroomId: selectedClassroomId,
    childId: selectedChildId,
  }) : null, [anchorDate, fiscalYear, selectedChildId, selectedClassroomId, tenantId]);

  const children = useMemo(() => sortedChildren(source), [source]);
  const selectedClassroom = useMemo(
    () => classrooms.find((row) => s(row.id) === selectedClassroomId) ?? null,
    [classrooms, selectedClassroomId],
  );
  const selectedChild = useMemo(
    () => children.find((row) => s(row.id) === selectedChildId) ?? null,
    [children, selectedChildId],
  );
  const summary = useMemo<ChildWeeklyRecordSummary | null>(() => {
    if (!source || !childContext) return null;
    return aggregateChildWeeklyRecord(childContext, source);
  }, [childContext, source]);
  const weekendPlayCandidates = useMemo<WeekendPlayCandidate[]>(
    () => selectWeekendPlayCandidates(summary?.abilities ?? [], 3),
    [summary],
  );
  const selectedWeekendPlay = useMemo(
    () => weekendPlayCandidates.find((candidate) => candidate.playId === selectedWeekendPlayId)
      ?? weekendPlayCandidates[0]
      ?? null,
    [selectedWeekendPlayId, weekendPlayCandidates],
  );
  const currentWeeklyReportId = useMemo(() => {
    if (!childContext?.classroomId || !childContext.childId) return "";
    return childWeeklyReportId({
      classroomId: childContext.classroomId,
      childId: childContext.childId,
      weekStartDate: childContext.periodStart,
    });
  }, [childContext]);
  const letterSourceSnapshot = useMemo(() => {
    if (!childContext || !source || !summary || !selectedWeekendPlay) return null;
    return buildChildWeekendLetterSourceSnapshot({
      context: childContext,
      source,
      summary,
      selectedWeekendPlay,
    });
  }, [childContext, selectedWeekendPlay, source, summary]);
  const letterSourceSnapshotJson = useMemo(
    () => letterSourceSnapshot ? JSON.stringify(letterSourceSnapshot) : "",
    [letterSourceSnapshot],
  );
  const selectedWeekendPlayJson = useMemo(
    () => selectedWeekendPlay ? JSON.stringify(weekendPlaySelectionSnapshot(selectedWeekendPlay)) : "",
    [selectedWeekendPlay],
  );
  const letterInputStale = Boolean(weeklyReport?.id && (
    s(weeklyReport.sourceSnapshotJson) !== letterSourceSnapshotJson
    || s(weeklyReport.selectedWeekendPlayJson) !== selectedWeekendPlayJson
  ));
  const letterPreviewText = useMemo(
    () => buildParentLetterText(letterDraft),
    [letterDraft],
  );
  const reportStatus = normalizedChildWeeklyStatus(weeklyReport?.status);
  const displayedAiStatus = reportStatus === "CONFIRMED"
    ? weeklyReport?.aiStatus
    : letterInputStale ? "STALE" : weeklyReport?.aiStatus;
  const reportEditable = canEditChildWeeklyReport(weeklyReport);
  const reviewer = canReviewChildWeeklyReport(ownerRole);
  const normalizedOwnerRole = s(ownerRole).toUpperCase();
  const workflowHistory = useMemo<ChildWeeklyWorkflowEntry[]>(
    () => parseChildWeeklyWorkflowHistory(weeklyReport?.reviewHistoryJson),
    [weeklyReport?.reviewHistoryJson],
  );
  const completionMissing = useMemo(() => {
    const rows: string[] = [];
    if (!weeklyReport?.id) rows.push("Claude下書きが保存されていません");
    if (s(displayedAiStatus).toUpperCase() !== "GENERATED") rows.push("Claude下書きが生成済みではありません");
    if (letterInputStale) rows.push("Observationまたは週末遊びの変更後に再生成されていません");
    if (!s(letterDraft.title)) rows.push("タイトルが未入力です");
    if (!s(letterDraft.weeklyEpisodeText)) rows.push("今週のエピソードが未入力です");
    if (!s(letterDraft.growthText)) rows.push("育ちのまなざしが未入力です");
    if (!s(letterDraft.weekendPlayText)) rows.push("週末の遊びのヒントが未入力です");
    if (!selectedWeekendPlay) rows.push("週末遊びが選択されていません");
    return rows;
  }, [displayedAiStatus, letterDraft, letterInputStale, selectedWeekendPlay, weeklyReport?.id]);
  const reportReadyToComplete = completionMissing.length === 0;
  const deliveryReady = reportStatus === "CONFIRMED"
    && s(weeklyReport?.deliveryStatus).toUpperCase() === "READY"
    && Boolean(s(weeklyReport?.finalParentLetterText));

  const classroomSelectionLocked = !isSchoolScope && (allowedClassroomIds?.length ?? 0) <= 1;
  const maxDomainCount = Math.max(0, ...(summary?.domains.map((row) => row.observationCount) ?? []));
  const maxPostureCount = Math.max(0, ...(summary?.postures.map((row) => row.observationCount) ?? []));

  useEffect(() => {
    let cancelled = false;
    setLoadingClassrooms(true);
    setError("");

    void loadReportClassrooms({
      client: reportClient,
      tenantId,
      fiscalYear,
      allowedClassroomIds,
      isSchoolScope,
    })
      .then((rows) => {
        if (cancelled) return;
        setClassrooms(rows);
        setSelectedClassroomId((current) => {
          if (current && rows.some((row) => s(row.id) === current)) return current;
          if (currentClassroomId && rows.some((row) => s(row.id) === currentClassroomId)) {
            return currentClassroomId;
          }
          return s(rows[0]?.id);
        });
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error(cause);
        setError(`子ども週次記録 クラス読み込みエラー: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingClassrooms(false);
      });

    return () => {
      cancelled = true;
    };
  }, [allowedClassroomIds, currentClassroomId, fiscalYear, isSchoolScope, reportClient, tenantId]);

  useEffect(() => {
    if (!selectedClassroomId) {
      setSource(null);
      setSelectedChildId("");
      return;
    }

    let cancelled = false;
    setLoadingRecord(true);
    setError("");

    void loadObservationReportData({ client: reportClient, context: classContext })
      .then((loadedSource) => {
        if (cancelled) return;
        setSource(loadedSource);
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error(cause);
        setSource(null);
        setError(`子ども週次記録 読み込みエラー: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecord(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classContext, reportClient, selectedClassroomId]);

  useEffect(() => {
    setSelectedChildId((current) => {
      if (current && children.some((child) => s(child.id) === current)) return current;
      return s(children[0]?.id);
    });
  }, [children]);

  useEffect(() => {
    setSelectedWeekendPlayId((current) => {
      if (current && weekendPlayCandidates.some((candidate) => candidate.playId === current)) {
        return current;
      }
      return weekendPlayCandidates[0]?.playId ?? "";
    });
  }, [weekendPlayCandidates]);

  useEffect(() => {
    if (!currentWeeklyReportId) {
      setWeeklyReport(null);
      setLetterDraft(emptyChildWeekendLetterDraft());
      setWorkflowComment("");
      setLetterMessage("");
      return;
    }

    let cancelled = false;
    setLoadingLetter(true);
    setLetterMessage("");

    void letterApi.models.ChildWeeklyReport.get({ id: currentWeeklyReportId })
      .then((result) => {
        if (cancelled) return;
        if (result.errors?.length) {
          throw new Error(resultErrorText(result.errors, "週末こどもだより下書きの取得に失敗しました。"));
        }
        const report = result.data ?? null;
        setWeeklyReport(report);
        setLetterDraft(letterDraftFromReport(report));
        setWorkflowComment("");

        const savedPlayId = parseSelectedWeekendPlayId(report?.selectedWeekendPlayJson);
        if (savedPlayId && weekendPlayCandidates.some((candidate) => candidate.playId === savedPlayId)) {
          setSelectedWeekendPlayId(savedPlayId);
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error(cause);
        setWeeklyReport(null);
        setLetterDraft(emptyChildWeekendLetterDraft());
        setLetterMessage(`下書き取得エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingLetter(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentWeeklyReportId, letterApi, weekendPlayCandidates]);

  async function reloadWeeklyReport(): Promise<ChildWeeklyReportRow | null> {
    if (!currentWeeklyReportId) return null;
    const result = await letterApi.models.ChildWeeklyReport.get({ id: currentWeeklyReportId });
    if (result.errors?.length) {
      throw new Error(resultErrorText(result.errors, "週末こどもだより下書きの再読み込みに失敗しました。"));
    }
    const report = result.data ?? null;
    setWeeklyReport(report);
    setLetterDraft(letterDraftFromReport(report));
    return report;
  }

  async function upsertWeeklyReport(aiStatus: string): Promise<ChildWeeklyReportRow> {
    if (!currentWeeklyReportId || !childContext || !summary || !letterSourceSnapshot || !selectedWeekendPlay) {
      throw new Error("週末こどもだより生成に必要な対象児童・エピソード・遊び候補が不足しています。");
    }

    const user = await getCurrentUser().catch(() => null);
    const userId = s(user?.userId) || "child-weekly-workspace";
    const input: Record<string, unknown> = {
      id: currentWeeklyReportId,
      tenantId,
      fiscalYear,
      classroomId: s(childContext.classroomId),
      childId: summary.childId,
      childName: summary.childName,
      weekStartDate: childContext.periodStart,
      weekEndDate: childContext.periodEnd,
      status: s(weeklyReport?.status) || "DRAFT",
      sourceSnapshotJson: letterSourceSnapshotJson,
      comparisonSnapshotJson: JSON.stringify(summary.comparison),
      weekendPlayCandidatesJson: JSON.stringify(weekendPlayCandidates),
      selectedWeekendPlayJson,
      sourceObservationIdsJson: JSON.stringify(letterSourceSnapshot.episodes.map((episode) => episode.observationId)),
      sourceAbilityCodesJson: JSON.stringify(letterSourceSnapshot.abilities.map((ability) => ability.abilityCode)),
      aiStatus,
      promptVersion: letterSourceSnapshot.promptVersion,
      generationErrorMessage: "",
      updatedByUserId: userId,
    };

    if (!weeklyReport?.id) input.createdByUserId = userId;
    const result = weeklyReport?.id
      ? await letterApi.models.ChildWeeklyReport.update({ ...input, id: currentWeeklyReportId })
      : await letterApi.models.ChildWeeklyReport.create(input);

    if (result.errors?.length || !result.data) {
      throw new Error(resultErrorText(result.errors, "ChildWeeklyReportの保存に失敗しました。"));
    }
    setWeeklyReport(result.data);
    return result.data;
  }

  async function handleGenerateLetter() {
    if (!reportEditable) {
      setLetterMessage("記録完了後または確認済みの週末こどもだよりは再生成できません。差し戻し後に修正してください。");
      return;
    }
    if (!letterSourceSnapshot || !selectedWeekendPlay || summary?.observationCount === 0) {
      setLetterMessage("確認済みエピソードと週末遊びを確認してから生成してください。");
      return;
    }

    setGeneratingLetter(true);
    setLetterMessage("");
    try {
      await upsertWeeklyReport("GENERATING");
      const result = await letterApi.mutations.generateChildWeekendLetter({
        childWeeklyReportId: currentWeeklyReportId,
      });
      if (result.errors?.length) {
        throw new Error(resultErrorText(result.errors, "Claudeによる下書き生成に失敗しました。"));
      }
      await reloadWeeklyReport();
      setLetterMessage("Claudeによる週末こどもだより下書きを生成し、保存しました。");
    } catch (cause) {
      console.error(cause);
      setLetterMessage(`下書き生成エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
      await reloadWeeklyReport().catch(() => null);
    } finally {
      setGeneratingLetter(false);
    }
  }

  async function handleSaveLetter() {
    if (!weeklyReport?.id) return;
    if (!reportEditable) {
      setLetterMessage("記録完了後または確認済みの週末こどもだよりは編集保存できません。");
      return;
    }
    setSavingLetter(true);
    setLetterMessage("");
    try {
      const result = await letterApi.models.ChildWeeklyReport.update({
        id: weeklyReport.id,
        title: letterDraft.title,
        weeklyEpisodeText: letterDraft.weeklyEpisodeText,
        growthText: letterDraft.growthText,
        comparisonText: letterDraft.comparisonText,
        weekendPlayText: letterDraft.weekendPlayText,
        parentLetterText: letterPreviewText,
        updatedByUserId: owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(resultErrorText(result.errors, "編集した下書きの保存に失敗しました。"));
      }
      setWeeklyReport(result.data);
      setLetterMessage("編集した週末こどもだより下書きを保存しました。");
    } catch (cause) {
      console.error(cause);
      setLetterMessage(`下書き保存エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setSavingLetter(false);
    }
  }

  async function handleCompleteReport() {
    if (!weeklyReport?.id || !reportEditable) {
      setLetterMessage("下書きまたは差し戻し中の週末こどもだよりだけを記録完了にできます。");
      return;
    }
    if (!reportReadyToComplete || !letterSourceSnapshot || !selectedWeekendPlay) {
      setLetterMessage(`記録完了できません: ${completionMissing.join(" / ")}`);
      return;
    }

    setWorkflowWorking(true);
    setLetterMessage("");
    try {
      const nowIso = new Date().toISOString();
      const entry: ChildWeeklyWorkflowEntry = {
        action: "COMPLETE",
        status: "COMPLETED",
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: nowIso,
        comment: workflowComment.trim(),
      };
      const result = await letterApi.models.ChildWeeklyReport.update({
        id: weeklyReport.id,
        status: "COMPLETED",
        sourceSnapshotJson: letterSourceSnapshotJson,
        comparisonSnapshotJson: JSON.stringify(summary?.comparison ?? {}),
        weekendPlayCandidatesJson: JSON.stringify(weekendPlayCandidates),
        selectedWeekendPlayJson,
        sourceObservationIdsJson: JSON.stringify(letterSourceSnapshot.episodes.map((episode) => episode.observationId)),
        sourceAbilityCodesJson: JSON.stringify(letterSourceSnapshot.abilities.map((ability) => ability.abilityCode)),
        title: letterDraft.title,
        weeklyEpisodeText: letterDraft.weeklyEpisodeText,
        growthText: letterDraft.growthText,
        comparisonText: letterDraft.comparisonText,
        weekendPlayText: letterDraft.weekendPlayText,
        parentLetterText: letterPreviewText,
        recordedByUserId: owner,
        recordedByName: s(ownerName) || owner,
        recordedAt: nowIso,
        reviewHistoryJson: appendChildWeeklyWorkflowEntry(weeklyReport.reviewHistoryJson, entry),
        deliveryStatus: "NOT_READY",
        finalParentLetterText: "",
        updatedByUserId: owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(resultErrorText(result.errors, "週末こどもだよりの記録完了に失敗しました。"));
      }
      setWeeklyReport(result.data);
      setLetterDraft(letterDraftFromReport(result.data));
      setWorkflowComment("");
      setLetterMessage("週末こどもだよりを記録完了にしました。園長・主任の確認待ちです。");
    } catch (cause) {
      console.error(cause);
      setLetterMessage(`記録完了エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleConfirmReport() {
    if (!reviewer) {
      setLetterMessage("園長・主任権限のユーザーだけが確認できます。");
      return;
    }
    if (!weeklyReport?.id || reportStatus !== "COMPLETED") {
      setLetterMessage("記録完了の週末こどもだよりだけを確認できます。");
      return;
    }
    if (letterInputStale) {
      setLetterMessage("記録完了後に元データが変わっています。確認せず、差し戻して再生成してください。");
      return;
    }
    if (!s(letterPreviewText)) {
      setLetterMessage("保護者向け最終文が空のため確認できません。");
      return;
    }

    setWorkflowWorking(true);
    setLetterMessage("");
    try {
      const nowIso = new Date().toISOString();
      const entry: ChildWeeklyWorkflowEntry = {
        action: "CONFIRM",
        status: "CONFIRMED",
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: nowIso,
        comment: workflowComment.trim(),
      };
      const result = await letterApi.models.ChildWeeklyReport.update({
        id: weeklyReport.id,
        status: "CONFIRMED",
        confirmedByUserId: owner,
        confirmedByName: s(ownerName) || owner,
        confirmedAt: nowIso,
        reviewHistoryJson: appendChildWeeklyWorkflowEntry(weeklyReport.reviewHistoryJson, entry),
        deliveryStatus: "READY",
        finalParentLetterText: letterPreviewText,
        deliveryPreparedByUserId: owner,
        deliveryPreparedByName: s(ownerName) || owner,
        deliveryPreparedAt: nowIso,
        updatedByUserId: owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(resultErrorText(result.errors, "週末こどもだよりの確認に失敗しました。"));
      }
      setWeeklyReport(result.data);
      setWorkflowComment("");
      setLetterMessage("週末こどもだよりを確認済みにし、保護者への発信準備を完了しました。");
    } catch (cause) {
      console.error(cause);
      setLetterMessage(`確認エラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleReturnReport() {
    if (!reviewer) {
      setLetterMessage("園長・主任権限のユーザーだけが差し戻しできます。");
      return;
    }
    if (!weeklyReport?.id || reportStatus !== "COMPLETED") {
      setLetterMessage("記録完了の週末こどもだよりだけを差し戻しできます。");
      return;
    }
    if (!workflowComment.trim()) {
      setLetterMessage("差し戻し理由を入力してください。");
      return;
    }

    setWorkflowWorking(true);
    setLetterMessage("");
    try {
      const nowIso = new Date().toISOString();
      const entry: ChildWeeklyWorkflowEntry = {
        action: "RETURN",
        status: "RETURNED",
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: nowIso,
        comment: workflowComment.trim(),
      };
      const result = await letterApi.models.ChildWeeklyReport.update({
        id: weeklyReport.id,
        status: "RETURNED",
        reviewHistoryJson: appendChildWeeklyWorkflowEntry(weeklyReport.reviewHistoryJson, entry),
        deliveryStatus: "NOT_READY",
        finalParentLetterText: "",
        updatedByUserId: owner,
      });
      if (result.errors?.length || !result.data) {
        throw new Error(resultErrorText(result.errors, "週末こどもだよりの差し戻しに失敗しました。"));
      }
      setWeeklyReport(result.data);
      setLetterDraft(letterDraftFromReport(result.data));
      setWorkflowComment("");
      setLetterMessage("週末こどもだよりを差し戻しました。担任が修正・再生成できます。");
    } catch (cause) {
      console.error(cause);
      setLetterMessage(`差し戻しエラー: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setWorkflowWorking(false);
    }
  }

  function updateLetterDraft(
    key: keyof ChildWeekendLetterDraft,
    value: string,
  ) {
    setLetterDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="child-weekly-workspace">
      <header className="check-workspace-header">
        <div>
          <p className="eyebrow">Check / Child Weekly Record</p>
          <h2>子ども別週次記録</h2>
          <p className="muted">
            保育士向けに、確認済みObservationから一人ひとりの1週間のエピソードと、記録に現れた5領域・10の姿を確認します。
          </p>
        </div>
        <span className="child-weekly-staff-badge">保育士向け</span>
      </header>

      <div className="check-context-card">
        <div><strong>園</strong><span>{tenantName || tenantId}</span></div>
        <div><strong>集計期間</strong><span>週</span></div>
        <div><strong>集計対象</strong><span>子ども</span></div>
        <div><strong>年度</strong><span>{fiscalYear}年度</span></div>
      </div>

      <section className="child-weekly-selector-card">
        <label>
          <span>対象週に含まれる日</span>
          <input
            type="date"
            value={anchorDate}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAnchorDate(event.target.value || todayJstDateOnly())}
          />
        </label>

        <label>
          <span>対象クラス</span>
          <select
            value={selectedClassroomId}
            disabled={classroomSelectionLocked || loadingClassrooms}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedClassroomId(event.target.value)}
          >
            {classrooms.map((classroom) => (
              <option value={s(classroom.id)} key={s(classroom.id)}>
                {s(classroom.name)}{classroom.ageLabel ? `（${classroom.ageLabel}）` : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>対象児童</span>
          <select
            value={selectedChildId}
            disabled={loadingRecord || children.length === 0}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedChildId(event.target.value)}
          >
            {children.map((child) => (
              <option value={s(child.id)} key={s(child.id)}>
                {s(child.displayName)}{child.kana ? `（${child.kana}）` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="check-week-actions">
          <button type="button" className="secondary-button" onClick={() => setAnchorDate((current) => addDateOnlyDays(current, -7))}>
            前の週
          </button>
          <button type="button" className="secondary-button" onClick={() => setAnchorDate(todayJstDateOnly())}>
            今週
          </button>
          <button type="button" className="secondary-button" onClick={() => setAnchorDate((current) => addDateOnlyDays(current, 7))}>
            次の週
          </button>
        </div>
      </section>

      <div className="check-period-banner">
        <strong>{selectedChild?.displayName || "対象児童未選択"}</strong>
        <span>{selectedClassroom?.name || "対象クラス未選択"}</span>
        <span>{formatPeriodLabel(classContext)}</span>
        <small>CONFIRMED Observationのみ集計</small>
      </div>

      <div className="child-weekly-workflow-status-banner">
        <span className={`status-pill status-${childWeeklyStatusClass(reportStatus)}`}>
          {childWeeklyStatusLabel(reportStatus)}
        </span>
        <span>ログイン権限: {normalizedOwnerRole || "未設定"}</span>
        {reportStatus === "COMPLETED" ? <strong>園長・主任の確認待ちです。</strong> : null}
        {deliveryReady ? <strong>保護者への発信準備完了</strong> : null}
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {loadingRecord ? <p className="muted">子どもの週次記録を読み込んでいます...</p> : null}
      {!loadingRecord && selectedClassroomId && children.length === 0 ? (
        <div className="check-empty-card">
          <strong>対象週に在籍する子どもが見つかりません。</strong>
          <span>クラス所属期間と対象週を確認してください。</span>
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="check-summary-grid">
            <div><strong>確認済みObservation</strong><span>{summary.observationCount}件</span></div>
            <div><strong>観察日数</strong><span>{summary.observationDayCount}日</span></div>
            <div><strong>実施Practice</strong><span>{summary.practiceCount}件</span></div>
            <div><strong>Abilityリンク</strong><span>{summary.abilityLinkCount}件</span></div>
            <div><strong>AbilityなしObservation</strong><span>{summary.observationWithoutAbilityCount}件</span></div>
            <div><strong>観察されたAbility</strong><span>{summary.observedAbilityCount}件</span></div>
          </section>

          <p className="child-weekly-evaluation-note">
            ここで表示する件数は、その週に記録として確認された回数です。子どもの能力や達成度を評価する点数ではありません。
          </p>

          {summary.observationCount === 0 ? (
            <div className="check-empty-card">
              <strong>この週には確認済みの観察記録がありません。</strong>
              <span>記録がないことは、育ちや活動がなかったことを意味しません。</span>
            </div>
          ) : null}

          <section className="check-two-column">
            <article className="check-card">
              <div className="check-card-header"><h3>5領域別分布</h3><span>今週の記録</span></div>
              <div className="check-distribution-list">
                {summary.domains.map((row) => (
                  <div className="check-distribution-row" key={row.key}>
                    <div><strong>{row.label}</strong><small>{row.observationCount > 0 ? "記録あり" : "今週は未観察"}</small></div>
                    <div className="check-bar-track">
                      <span
                        className={row.observationCount === 0 ? "check-bar check-bar-empty" : "check-bar"}
                        style={{ width: percentage(row.observationCount, maxDomainCount) }}
                      />
                    </div>
                    <b>{row.observationCount}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="check-card">
              <div className="check-card-header"><h3>10の姿別分布</h3><span>今週の記録</span></div>
              <div className="check-distribution-list check-distribution-scroll">
                {summary.postures.map((row) => (
                  <div className="check-distribution-row" key={row.key}>
                    <div><strong>{row.label}</strong><small>{row.observationCount > 0 ? "記録あり" : "今週は未観察"}</small></div>
                    <div className="check-bar-track">
                      <span
                        className={row.observationCount === 0 ? "check-bar check-bar-empty" : "check-bar"}
                        style={{ width: percentage(row.observationCount, maxPostureCount) }}
                      />
                    </div>
                    <b>{row.observationCount}</b>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="check-card">
            <div className="check-card-header">
              <h3>直前4週間とのつながり</h3>
              <span>{formatDateLabel(summary.comparison.periodStart)} ～ {formatDateLabel(summary.comparison.periodEnd)}</span>
            </div>
            <p className="muted">
              比較期間の具体的な記録と照合し、今週初めて記録に現れた姿、継続して現れた姿、今週は記録されなかった姿を整理します。
            </p>
            <div className="child-weekly-comparison-summary">
              <div><strong>今週新たに観察</strong><span>{summary.comparison.newAbilities.length}件</span></div>
              <div><strong>継続して観察</strong><span>{summary.comparison.continuingAbilities.length}件</span></div>
              <div><strong>今週は未観察</strong><span>{summary.comparison.previousOnlyAbilities.length}件</span></div>
              <div><strong>比較期間Observation</strong><span>{summary.comparison.observationCount}件</span></div>
            </div>

            {summary.comparison.rows.length > 0 ? (
              <div className="child-weekly-comparison-list">
                {summary.comparison.rows.map((row) => (
                  <div className={`child-weekly-comparison-row ${childWeeklyComparisonClass(row.status)}`} key={row.abilityCode}>
                    <div>
                      <strong>{row.abilityCode} {row.abilityName}</strong>
                      <small>{row.domain} / {row.category}</small>
                    </div>
                    <span className="check-status-pill">{childWeeklyComparisonLabel(row.status)}</span>
                    <b>今週 {row.currentObservationCount}件</b>
                    <small>直前4週間 {row.previousObservationCount}件</small>
                  </div>
                ))}
              </div>
            ) : <p className="muted">今週と直前4週間にAbilityリンクのある記録はありません。</p>}

            <p className="child-weekly-comparison-note">
              「今週は未観察」は後退や未達成を示すものではありません。今週の活動や記録機会には現れなかった、という意味です。
            </p>
          </section>

          <section className="check-card child-weekly-weekend-play-card">
            <div className="check-card-header">
              <h3>週末の遊び候補</h3>
              <span>候補 {weekendPlayCandidates.length}件 / カタログ {weekendPlayCatalogStats.playCount}件</span>
            </div>
            <p className="muted">
              今週のAbilityから遊びカタログを逆引きしています。Ability完全一致を優先し、候補が不足する場合は同じ10の姿、同じ5領域へ広げます。
            </p>

            {weekendPlayCandidates.length > 0 ? (
              <>
                <div className="child-weekly-weekend-play-list">
                  {weekendPlayCandidates.map((candidate, index) => (
                    <label
                      className={candidate.playId === selectedWeekendPlay?.playId
                        ? "child-weekly-weekend-play-option child-weekly-weekend-play-option-selected"
                        : "child-weekly-weekend-play-option"}
                      key={candidate.playId}
                    >
                      <input
                        type="radio"
                        name="weekend-play-candidate"
                        value={candidate.playId}
                        checked={candidate.playId === selectedWeekendPlay?.playId}
                        disabled={!reportEditable}
                        onChange={() => setSelectedWeekendPlayId(candidate.playId)}
                      />
                      <span className="child-weekly-weekend-play-main">
                        <span className="child-weekly-weekend-play-title">
                          <b>候補{index + 1}</b>
                          <strong>{candidate.playTitle}</strong>
                        </span>
                        <small>{candidate.playType} / {candidate.setting}</small>
                        <span className="child-weekly-weekend-play-tags">
                          {candidate.matches.slice(0, 3).map((match) => (
                            <em key={`${candidate.playId}-${match.observedAbilityCode}-${match.matchLevel}`}>
                              {weekendPlayMatchLevelLabel(match.matchLevel)}：{match.observedAbilityName}
                            </em>
                          ))}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {selectedWeekendPlay ? (
                  <div className="child-weekly-weekend-play-detail">
                    <div className="child-weekly-weekend-play-detail-head">
                      <div>
                        <strong>選択中：{selectedWeekendPlay.playTitle}</strong>
                        <span>{selectedWeekendPlay.setting} / {selectedWeekendPlay.playType}</span>
                      </div>
                      <span className="check-status-pill check-status-ok">遊び候補選択</span>
                    </div>

                    <div className="child-weekly-weekend-play-copy">
                      <div>
                        <strong>遊びの内容</strong>
                        <p>{selectedWeekendPlay.playDescriptionDraft}</p>
                      </div>
                      <div>
                        <strong>保護者向けヒント原文</strong>
                        <p>{selectedWeekendPlay.parentHint}</p>
                      </div>
                    </div>

                    <div className="child-weekly-weekend-play-reasons">
                      <strong>選定根拠</strong>
                      {selectedWeekendPlay.matches.slice(0, 5).map((match) => (
                        <div key={`${selectedWeekendPlay.playId}-${match.observedAbilityCode}-${match.linkedAbilityCode}`}>
                          <span>{weekendPlayMatchLevelLabel(match.matchLevel)}</span>
                          <b>{match.observedAbilityCode} {match.observedAbilityName}</b>
                          <small>
                            {weekendPlayRelationLabel(match.relationType)} / weight {match.weight}
                            {match.reason ? ` / ${match.reason}` : ""}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <p className="child-weekly-weekend-play-note">
                  {reportEditable
                    ? "選択した遊びと確認済みエピソードは、下のClaude生成時に同じ子ども・同じ週の下書きへ保存されます。"
                    : "記録完了後は遊び候補を変更できません。差し戻し後に再選択できます。"}
                </p>
              </>
            ) : (
              <div className="check-empty-card">
                <strong>今週のAbilityに基づく遊び候補はありません。</strong>
                <span>AbilityリンクのあるObservationが確認されると、遊びカタログから候補を表示します。</span>
              </div>
            )}
          </section>

          <section className="check-card child-weekly-ai-letter-card">
            <div className="check-card-header">
              <h3>Claudeによる週末こどもだより下書き</h3>
              <span className={`child-weekly-ai-status ${aiStatusClass(displayedAiStatus)}`}>
                {loadingLetter ? "下書き確認中" : aiStatusLabel(displayedAiStatus)}
              </span>
            </div>
            <p className="muted">
              確認済みエピソード、記録に現れた育ち、選択済みの週末遊びだけを使います。Abilityコード、件数、confidenceなどの内部数値は保護者向け文章に出しません。
            </p>

            {letterSourceSnapshot ? (
              <div className="child-weekly-ai-source-grid">
                <div><strong>今週の根拠</strong><span>{letterSourceSnapshot.episodes.length}エピソード</span></div>
                <div><strong>育ちの観点</strong><span>{letterSourceSnapshot.abilities.length}件</span></div>
                <div><strong>比較候補</strong><span>{letterSourceSnapshot.previousEpisodes.length}エピソード</span></div>
                <div><strong>週末遊び</strong><span>{letterSourceSnapshot.selectedWeekendPlay.playTitle}</span></div>
              </div>
            ) : null}

            {letterInputStale ? (
              <p className="child-weekly-ai-stale-note">
                {reportStatus === "CONFIRMED"
                  ? "確認後にObservationまたは遊び候補が変わりました。発信準備済みの最終文は保持されています。新しい内容を反映する場合は、別途再編集の運用が必要です。"
                  : reportStatus === "COMPLETED"
                    ? "記録完了後に元データが変わりました。園長・主任は確認せず、差し戻して再生成してください。"
                    : "Observationまたは選択した週末遊びが前回生成時から変わっています。現在のデータで再生成してください。"}
              </p>
            ) : null}

            {s(weeklyReport?.generationErrorMessage) ? (
              <p className="do-ai-error-text">{s(weeklyReport?.generationErrorMessage)}</p>
            ) : null}
            {letterMessage ? (
              <p className={letterMessage.includes("エラー") || letterMessage.includes("できません") || letterMessage.includes("してください") ? "error-box" : "success-box"}>{letterMessage}</p>
            ) : null}

            <div className="child-weekly-ai-actions">
              <button
                type="button"
                disabled={!reportEditable || generatingLetter || loadingLetter || !letterSourceSnapshot || summary.observationCount === 0}
                onClick={() => void handleGenerateLetter()}
              >
                {generatingLetter ? "Claudeで生成中..." : weeklyReport?.aiStatus === "GENERATED" ? "現在の記録で再生成" : "Claudeで下書きを生成"}
              </button>
              <small>同じ子ども・同じ週は固定IDで更新され、生成のたびにレコードが増えることはありません。</small>
            </div>

            {weeklyReport?.aiStatus === "GENERATED" || letterPreviewText ? (
              <>
                <div className="child-weekly-letter-editor">
                  <label>
                    <span>タイトル</span>
                    <input
                      value={letterDraft.title}
                      disabled={!reportEditable}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => updateLetterDraft("title", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>今週のエピソード</span>
                    <textarea
                      value={letterDraft.weeklyEpisodeText}
                      disabled={!reportEditable}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateLetterDraft("weeklyEpisodeText", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>育ちのまなざし</span>
                    <textarea
                      value={letterDraft.growthText}
                      disabled={!reportEditable}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateLetterDraft("growthText", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>これまでとのつながり</span>
                    <textarea
                      value={letterDraft.comparisonText}
                      placeholder="比較根拠がない場合は空欄のままです。"
                      disabled={!reportEditable}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateLetterDraft("comparisonText", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>週末の遊びのヒント</span>
                    <textarea
                      value={letterDraft.weekendPlayText}
                      disabled={!reportEditable}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateLetterDraft("weekendPlayText", event.target.value)}
                    />
                  </label>
                </div>

                {!reportEditable ? (
                  <p className="child-weekly-editor-locked-note">
                    記録完了後は文章を固定しています。修正が必要な場合は、園長・主任が差し戻してください。
                  </p>
                ) : null}

                <div className="child-weekly-ai-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!reportEditable || savingLetter || !weeklyReport?.id}
                    onClick={() => void handleSaveLetter()}
                  >
                    {savingLetter ? "保存中..." : "編集内容を保存"}
                  </button>
                  {weeklyReport?.aiModel ? <small>model: {weeklyReport.aiModel}</small> : null}
                  {weeklyReport?.inputTokenCount != null || weeklyReport?.outputTokenCount != null ? (
                    <small>token: input {weeklyReport?.inputTokenCount ?? 0} / output {weeklyReport?.outputTokenCount ?? 0}</small>
                  ) : null}
                </div>

                <div className="child-weekly-letter-preview">
                  <strong>保護者向け表示プレビュー</strong>
                  <pre>{letterPreviewText}</pre>
                </div>
              </>
            ) : (
              <div className="check-empty-card">
                <strong>保護者向け下書きはまだ生成されていません。</strong>
                <span>今週の確認済みエピソードと週末遊びを確認し、Claudeで下書きを生成してください。</span>
              </div>
            )}
          </section>

          <section className="check-card child-weekly-workflow-card">
            <div className="child-weekly-workflow-header">
              <div>
                <h3>確認・承認・発信準備</h3>
                <p className="muted">
                  担任が記録を完了し、園長・主任が内容を確認します。確認時点の保護者向け文章を最終版として固定します。
                </p>
              </div>
              <span className={`status-pill status-${childWeeklyStatusClass(reportStatus)}`}>
                {childWeeklyStatusLabel(reportStatus)}
              </span>
            </div>

            {reportEditable ? (
              <div className="child-weekly-completion-check">
                <strong>記録完了チェック</strong>
                {completionMissing.length > 0 ? (
                  <ul>{completionMissing.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : (
                  <p>Claude下書き、選択した遊び、保護者向け文章を確認できます。記録完了に進めます。</p>
                )}
              </div>
            ) : null}

            {reportStatus !== "CONFIRMED" ? (
              <label className="child-weekly-workflow-comment">
                <span>{reportStatus === "COMPLETED" ? "確認コメント / 差し戻し理由" : "記録完了コメント（任意）"}</span>
                <textarea
                  value={workflowComment}
                  placeholder={reportStatus === "COMPLETED"
                    ? "差し戻す場合は、修正してほしい内容を入力してください。"
                    : "園長・主任へ伝えることがあれば入力してください。"}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setWorkflowComment(event.target.value)}
                />
              </label>
            ) : null}

            <div className="child-weekly-workflow-actions">
              {reportEditable ? (
                <button
                  type="button"
                  disabled={workflowWorking || savingLetter || generatingLetter || !reportReadyToComplete}
                  onClick={() => void handleCompleteReport()}
                >
                  {workflowWorking
                    ? "処理中..."
                    : reportStatus === "RETURNED" ? "修正後、記録を再完了" : "記録を完了"}
                </button>
              ) : null}

              {reportStatus === "COMPLETED" && reviewer ? (
                <>
                  <button
                    type="button"
                    disabled={workflowWorking || letterInputStale}
                    onClick={() => void handleConfirmReport()}
                  >
                    {workflowWorking ? "処理中..." : "確認して発信準備を完了"}
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

              {reportStatus === "COMPLETED" && !reviewer ? (
                <span className="muted">園長・主任の確認待ちです。</span>
              ) : null}

              {reportStatus === "CONFIRMED" ? (
                <span className="child-weekly-delivery-ready-note">確認済み・保護者への発信準備完了</span>
              ) : null}
            </div>

            <div className="child-weekly-workflow-role-note">
              ログイン権限: {normalizedOwnerRole || "未設定"}
              {reviewer ? "（確認・差し戻し可能）" : "（記録担当）"}
            </div>

            {weeklyReport?.recordedAt || weeklyReport?.confirmedAt ? (
              <div className="child-weekly-workflow-metadata">
                {weeklyReport.recordedAt ? (
                  <div><strong>記録完了</strong><span>{s(weeklyReport.recordedByName) || s(weeklyReport.recordedByUserId)}</span><small>{formatWorkflowTimestamp(weeklyReport.recordedAt)}</small></div>
                ) : null}
                {weeklyReport.confirmedAt ? (
                  <div><strong>確認</strong><span>{s(weeklyReport.confirmedByName) || s(weeklyReport.confirmedByUserId)}</span><small>{formatWorkflowTimestamp(weeklyReport.confirmedAt)}</small></div>
                ) : null}
              </div>
            ) : null}

            {workflowHistory.length > 0 ? (
              <div className="child-weekly-workflow-history">
                <strong>履歴</strong>
                {workflowHistory.map((entry, index) => (
                  <div className="child-weekly-workflow-history-item" key={`${entry.at}-${entry.action}-${index}`}>
                    <span className={`status-pill status-${childWeeklyStatusClass(entry.status)}`}>
                      {childWeeklyWorkflowActionLabel(entry.action)}
                    </span>
                    <div>
                      <strong>{entry.actorName || entry.actorUserId}</strong>
                      {entry.comment ? <p>{entry.comment}</p> : <p className="muted">コメントなし</p>}
                    </div>
                    <small>{formatWorkflowTimestamp(entry.at)}</small>
                  </div>
                ))}
              </div>
            ) : null}

            {deliveryReady ? (
              <div className="child-weekly-delivery-card">
                <div className="child-weekly-delivery-card-header">
                  <div>
                    <strong>保護者向け最終文</strong>
                    <span>確認時点の文章を固定しています。</span>
                  </div>
                  <span className="check-status-pill check-status-ok">発信準備完了</span>
                </div>
                <pre>{s(weeklyReport?.finalParentLetterText)}</pre>
                <small>
                  準備者 {s(weeklyReport?.deliveryPreparedByName) || s(weeklyReport?.deliveryPreparedByUserId)} / {formatWorkflowTimestamp(weeklyReport?.deliveryPreparedAt)}
                </small>
                <p>メール送信、保護者向けURL公開、送信履歴管理は次の保護者連携フェーズで接続します。</p>
              </div>
            ) : null}
          </section>

          <section className="check-two-column">
            <article className="check-card">
              <div className="check-card-header"><h3>Ability別観察記録</h3><span>{summary.abilities.length}件</span></div>
              {summary.abilities.length > 0 ? (
                <div className="check-ability-list">
                  {summary.abilities.map((ability) => (
                    <div className="check-ability-row" key={ability.abilityCode}>
                      <div>
                        <strong>{ability.abilityCode} {ability.abilityName}</strong>
                        <small>{ability.domain} / {ability.category}</small>
                      </div>
                      <span>今週</span>
                      <b>{ability.observationCount}件</b>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">AbilityリンクのあるObservationはありません。</p>}
            </article>

            <article className="check-card">
              <div className="check-card-header"><h3>関わったPractice</h3><span>{summary.practices.length}件</span></div>
              {summary.practices.length > 0 ? (
                <div className="child-weekly-practice-list">
                  {summary.practices.map((practice) => (
                    <div className="child-weekly-practice-row" key={practice.key}>
                      <div>
                        <strong>{practice.practiceName}</strong>
                        <small>{practiceRoleLabel(practice.practiceRole)} / {practice.practiceCode}</small>
                      </div>
                      <span>{practice.performedDateCount}日</span>
                      <b>{practice.observationCount}件</b>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">確認済みObservationに紐づくPracticeはありません。</p>}
            </article>
          </section>

          <section className="check-card">
            <div className="check-card-header"><h3>今週のエピソード</h3><span>{summary.episodes.length}件</span></div>
            {summary.episodes.length > 0 ? (
              <div className="check-episode-list">
                {summary.episodes.map((episode) => (
                  <article className="check-episode-card" key={episode.observationId}>
                    <div className="check-episode-meta">
                      <strong>{formatDateLabel(episode.reportDate, false)}</strong>
                      <span>{practiceRoleLabel(episode.practiceRole)}</span>
                      <span>{episode.practiceName}</span>
                      {episode.observedByName ? <span>記録者 {episode.observedByName}</span> : null}
                    </div>
                    <p>{episode.episodeText}</p>
                    {episode.abilities.length > 0 ? (
                      <div className="child-weekly-episode-ability-list">
                        {episode.abilities.map((ability) => (
                          <div key={`${episode.observationId}-${ability.abilityCode}`}>
                            <strong>{ability.abilityCode} {ability.abilityName}</strong>
                            {ability.evidenceText ? <span><b>根拠</b>{ability.evidenceText}</span> : null}
                            {ability.reason ? <span><b>理由</b>{ability.reason}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : <small className="check-no-ability">Abilityなし（エピソード記録として正常に表示しています）</small>}
                  </article>
                ))}
              </div>
            ) : <p className="muted">表示できる確認済みエピソードはありません。</p>}
          </section>

          {summary.warnings.length > 0 ? (
            <details className="check-warning-details">
              <summary>集計上の注意 {summary.warnings.length}件</summary>
              <ul>{summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
