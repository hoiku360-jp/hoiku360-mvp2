import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type ModelError = {
  message?: string | null;
};

type ModelResponse<TRow> = {
  data?: TRow | null;
  errors?: ModelError[] | null;
};

type ListResponse<TRow> = {
  data?: TRow[] | null;
  nextToken?: string | null;
  errors?: ModelError[] | null;
};

type ModelApi<TRow> = {
  get(input: Record<string, unknown>): Promise<ModelResponse<TRow>>;
  list(options?: Record<string, unknown>): Promise<ListResponse<TRow>>;
  create(input: Record<string, unknown>): Promise<ModelResponse<TRow>>;
  update(input: Record<string, unknown>): Promise<ModelResponse<TRow>>;
};

type ClassroomRow = Schema["Classroom"]["type"];
type ChildRow = Schema["Child"]["type"];
type EnrollmentRow = Schema["ChildClassroomEnrollment"]["type"];
type GuardianContactRow = Schema["ChildGuardianContact"]["type"];
type ParentNotebookSheetRow = Schema["ParentNotebookSheet"]["type"];
type ParentNotebookEntryRow = Schema["ParentNotebookEntry"]["type"];
type ChildWeeklyReportRow = Schema["ChildWeeklyReport"]["type"];

type SendParentNotebookEmailsArgs = {
  parentNotebookSheetId: string;
  baseUrl?: string | null;
};

type GenerateParentNotebookNoticeArgs = {
  parentNotebookSheetId: string;
  manualNote?: string | null;
};

type GenerateParentNotebookNoticeResult = {
  parentNotebookSheetId?: string | null;
  sourceDailyPlanId?: string | null;
  draftText?: string | null;
  sourceJson?: string | null;
  status?: string | null;
  aiModel?: string | null;
  generatedAt?: string | null;
  message?: string | null;
};

type ParentNotebookEmailSendResult = {
  parentNotebookEntryId?: string | null;
  childId?: string | null;
  childName?: string | null;
  email?: string | null;
  status?: string | null;
  message?: string | null;
};

type SendParentNotebookEmailsResult = {
  parentNotebookSheetId?: string | null;
  sentCount?: number | null;
  failedCount?: number | null;
  skippedCount?: number | null;
  status?: string | null;
  message?: string | null;
  results?: (ParentNotebookEmailSendResult | null)[] | null;
};

type OperationEnvelope<TData> = {
  data?: TData | null;
  errors?: ModelError[] | null;
};

type OperationRunner<TArgs, TData> = (
  args: TArgs | { input: TArgs },
) => Promise<OperationEnvelope<TData> | TData>;

type ParentNotebookClient = {
  models: {
    Classroom: ModelApi<ClassroomRow>;
    Child: ModelApi<ChildRow>;
    ChildClassroomEnrollment: ModelApi<EnrollmentRow>;
    ChildGuardianContact: ModelApi<GuardianContactRow>;
    ParentNotebookSheet: ModelApi<ParentNotebookSheetRow>;
    ParentNotebookEntry: ModelApi<ParentNotebookEntryRow>;
    ChildWeeklyReport: ModelApi<ChildWeeklyReportRow>;
  };
  mutations?: {
    generateParentNotebookNotice?: OperationRunner<
      GenerateParentNotebookNoticeArgs,
      GenerateParentNotebookNoticeResult
    >;
    sendParentNotebookEmails?: OperationRunner<
      SendParentNotebookEmailsArgs,
      SendParentNotebookEmailsResult
    >;
  };
};

type ContactDraft = {
  contactId: string;
  relation: string;
  guardianName: string;
  email: string;
};

type ChildWorkspaceRow = {
  child: ChildRow;
  enrollment: EnrollmentRow;
  contact: GuardianContactRow | null;
  entry: ParentNotebookEntryRow | null;
};

type ResponseFilter = "ALL" | "NOT_SUBMITTED" | "SUBMITTED" | "CONFIRMED";

const DEFAULT_RELATION = "母";

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function tomorrowYYYYMMDD(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value?: string | null): string {
  const text = s(value);
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("ja-JP");
}

function formatErrors(
  errors?: ModelError[] | null,
  fallback = "処理に失敗しました。",
): string {
  const messages = (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean);
  return messages.length > 0 ? messages.join("\n") : fallback;
}

function getOperationErrors<TData>(
  response: OperationEnvelope<TData> | TData,
): ModelError[] | null {
  if (!response || typeof response !== "object" || !("errors" in response)) {
    return null;
  }
  return (response as OperationEnvelope<TData>).errors ?? null;
}

function getOperationData<TData>(
  response: OperationEnvelope<TData> | TData,
): TData {
  if (!response || typeof response !== "object" || !("data" in response)) {
    return response as TData;
  }
  return ((response as OperationEnvelope<TData>).data ?? response) as TData;
}

async function runOperation<TArgs, TData>(
  runner: OperationRunner<TArgs, TData>,
  args: TArgs,
): Promise<TData> {
  let response: OperationEnvelope<TData> | TData;

  try {
    response = await runner(args);
  } catch {
    response = await runner({ input: args });
  }

  const errors = getOperationErrors(response);
  if (errors?.length) {
    throw new Error(formatErrors(errors));
  }

  return getOperationData(response);
}

function isEnrollmentActiveOnDate(
  enrollment: EnrollmentRow,
  targetDate: string,
): boolean {
  if (s(enrollment.status).toUpperCase() !== "ACTIVE") return false;
  if (s(enrollment.startDate) && s(enrollment.startDate) > targetDate) {
    return false;
  }
  if (s(enrollment.endDate) && s(enrollment.endDate) < targetDate) {
    return false;
  }
  return true;
}

function choosePrimaryContact(
  contacts: GuardianContactRow[],
): GuardianContactRow | null {
  const available = contacts
    .filter((row) => s(row.status).toUpperCase() === "ACTIVE")
    .filter((row) => row.receiveParentNotebook !== false)
    .sort((left, right) => {
      const primaryDiff = Number(right.isPrimary === true) - Number(left.isPrimary === true);
      if (primaryDiff !== 0) return primaryDiff;
      return s(left.id).localeCompare(s(right.id));
    });

  return available[0] ?? null;
}

function sheetIdFor(
  tenantId: string,
  classroomId: string,
  targetDate: string,
): string {
  return `parent-notebook-sheet-${tenantId}-${classroomId}-${targetDate}`;
}

function entryIdFor(sheetId: string, childId: string): string {
  return `parent-notebook-entry-${sheetId}-${childId}`;
}

function primaryContactIdFor(childId: string): string {
  return `child-guardian-contact-${childId}-primary`;
}

function deliveryStatusLabel(value?: string | null): string {
  switch (s(value).toUpperCase()) {
    case "NOT_SENT":
      return "未送信";
    case "PENDING":
      return "送信中";
    case "SENT":
      return "送信済み";
    case "FAILED":
      return "送信失敗";
    case "SKIPPED":
      return "連絡先未登録";
    default:
      return "未発行";
  }
}

function responseStatusLabel(value?: string | null): string {
  switch (s(value).toUpperCase()) {
    case "NOT_SUBMITTED":
      return "未回答";
    case "SUBMITTED":
      return "回答あり";
    case "CONFIRMED":
      return "園確認済み";
    default:
      return "未回答";
  }
}

function attendancePlanTypeLabel(value?: string | null): string {
  switch (s(value).toUpperCase()) {
    case "NORMAL":
      return "通常登園";
    case "ABSENT":
      return "欠席";
    case "LATE":
      return "遅刻";
    case "EARLY_DEPARTURE":
      return "早退";
    case "OTHER":
      return "その他";
    default:
      return "未回答";
  }
}

function responseFilterLabel(value: ResponseFilter): string {
  switch (value) {
    case "NOT_SUBMITTED":
      return "未回答";
    case "SUBMITTED":
      return "回答あり";
    case "CONFIRMED":
      return "園確認済み";
    default:
      return "すべて";
  }
}

function isEntryDeliveryLocked(entry?: ParentNotebookEntryRow | null): boolean {
  const deliveryStatus = s(entry?.deliveryStatus).toUpperCase();
  const responseStatus = s(entry?.responseStatus).toUpperCase();
  return (
    deliveryStatus === "SENT" ||
    responseStatus === "SUBMITTED" ||
    responseStatus === "CONFIRMED"
  );
}

function isSelectableWeeklyReport(
  report: ChildWeeklyReportRow,
  args: {
    tenantId: string;
    fiscalYear: number;
    classroomId: string;
    childId: string;
  },
): boolean {
  return (
    s(report.id) !== "" &&
    s(report.tenantId) === args.tenantId &&
    Number(report.fiscalYear ?? 0) === args.fiscalYear &&
    s(report.classroomId) === args.classroomId &&
    s(report.childId) === args.childId &&
    s(report.status).toUpperCase() === "CONFIRMED" &&
    s(report.deliveryStatus).toUpperCase() === "READY" &&
    Boolean(s(report.finalParentLetterText))
  );
}

function photoSnapshotCount(value: unknown): number {
  const text = s(value);
  if (!text) return 0;
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function formatDateOnlyLabel(value?: string | null): string {
  const text = s(value);
  if (!text) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return text;
  return `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`;
}

function weeklyReportOptionLabel(report: ChildWeeklyReportRow): string {
  const period = `${formatDateOnlyLabel(report.weekStartDate)}～${formatDateOnlyLabel(report.weekEndDate)}`;
  const title = s(report.title) || "週末こどもだより";
  const photoCount = photoSnapshotCount(report.finalPhotoSnapshotJson);
  return `${period}「${title}」写真${photoCount}枚`;
}

function sheetStatusLabel(value?: string | null): string {
  switch (s(value).toUpperCase()) {
    case "DRAFT":
      return "下書き";
    case "ISSUED":
      return "発行済み";
    case "CLOSED":
      return "締切済み";
    case "ARCHIVED":
      return "アーカイブ";
    default:
      return "未作成";
  }
}

export default function ParentNotebookWorkspacePanel(props: {
  userId: string;
  userName?: string | null;
  userRole?: string | null;
  tenantId: string;
  tenantName?: string | null;
  fiscalYear: number;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[];
  isSchoolScope?: boolean;
}) {
  const {
    userId,
    userName,
    userRole,
    tenantId,
    tenantName,
    fiscalYear,
    currentClassroomId = null,
    allowedClassroomIds = [],
    isSchoolScope = false,
  } = props;

  const client = useMemo(
    () =>
      generateClient<Schema>({
        authMode: "userPool",
      }) as unknown as ParentNotebookClient,
    [],
  );

  const [targetDate, setTargetDate] = useState(tomorrowYYYYMMDD);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState(
    currentClassroomId ?? "",
  );
  const [workspaceRows, setWorkspaceRows] = useState<ChildWorkspaceRow[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<ChildWeeklyReportRow[]>([]);
  const [weeklyReportSelections, setWeeklyReportSelections] = useState<
    Record<string, string>
  >({});
  const [sheet, setSheet] = useState<ParentNotebookSheetRow | null>(null);
  const [noticeDraft, setNoticeDraft] = useState("");
  const [aiManualNote, setAiManualNote] = useState("");
  const [contactDrafts, setContactDrafts] = useState<
    Record<string, ContactDraft>
  >({});
  const [message, setMessage] = useState("");
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatingNotice, setGeneratingNotice] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [savingContactChildId, setSavingContactChildId] = useState("");
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL");
  const [updatingResponseEntryId, setUpdatingResponseEntryId] = useState("");

  const currentSheetId = selectedClassroomId
    ? sheetIdFor(tenantId, selectedClassroomId, targetDate)
    : "";

  const issuedEntryCount = workspaceRows.filter((row) => row.entry).length;
  const contactCount = workspaceRows.filter((row) => row.contact).length;
  const sentCount = workspaceRows.filter(
    (row) => s(row.entry?.deliveryStatus).toUpperCase() === "SENT",
  ).length;
  const failedCount = workspaceRows.filter(
    (row) => s(row.entry?.deliveryStatus).toUpperCase() === "FAILED",
  ).length;
  const notIssuedCount = workspaceRows.filter((row) => !row.entry).length;
  const unansweredCount = workspaceRows.filter(
    (row) =>
      row.entry &&
      s(row.entry.responseStatus).toUpperCase() === "NOT_SUBMITTED",
  ).length;
  const submittedCount = workspaceRows.filter(
    (row) => s(row.entry?.responseStatus).toUpperCase() === "SUBMITTED",
  ).length;
  const confirmedCount = workspaceRows.filter(
    (row) => s(row.entry?.responseStatus).toUpperCase() === "CONFIRMED",
  ).length;
  const responseRows = workspaceRows.filter(
    (row): row is ChildWorkspaceRow & { entry: ParentNotebookEntryRow } =>
      row.entry !== null,
  );
  const filteredResponseRows = responseRows.filter((row) => {
    if (responseFilter === "ALL") return true;
    return s(row.entry.responseStatus).toUpperCase() === responseFilter;
  });
  const unansweredChildNames = responseRows
    .filter(
      (row) =>
        s(row.entry.responseStatus).toUpperCase() === "NOT_SUBMITTED",
    )
    .map((row) => s(row.child.displayName))
    .filter(Boolean);
  const lockedEntryCount = workspaceRows.filter((row) =>
    isEntryDeliveryLocked(row.entry),
  ).length;
  const linkedWeeklyReportCount = workspaceRows.filter((row) =>
    Boolean(s(row.entry?.childWeeklyReportId)),
  ).length;
  const weeklyReportsById = useMemo(
    () => new Map(weeklyReports.map((report) => [s(report.id), report])),
    [weeklyReports],
  );
  const selectableWeeklyReportsByChildId = useMemo(() => {
    const buckets = new Map<string, ChildWeeklyReportRow[]>();
    for (const report of weeklyReports) {
      const childId = s(report.childId);
      if (!childId) continue;
      if (!isSelectableWeeklyReport(report, {
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        childId,
      })) continue;
      const bucket = buckets.get(childId) ?? [];
      bucket.push(report);
      buckets.set(childId, bucket);
    }
    for (const bucket of buckets.values()) {
      bucket.sort((left, right) => {
        const startDiff = s(right.weekStartDate).localeCompare(s(left.weekStartDate));
        if (startDiff !== 0) return startDiff;
        return s(right.id).localeCompare(s(left.id));
      });
    }
    return buckets;
  }, [fiscalYear, selectedClassroomId, tenantId, weeklyReports]);

  async function loadClassrooms() {
    setLoadingClassrooms(true);
    setMessage("");

    try {
      const result = await client.models.Classroom.list({
        filter: {
          tenantId: { eq: tenantId },
        },
        limit: 1000,
      });

      if (result.errors?.length) {
        throw new Error(
          formatErrors(result.errors, "クラスの取得に失敗しました。"),
        );
      }

      const allowedSet = new Set(allowedClassroomIds.map(s).filter(Boolean));
      const rows = (result.data ?? [])
        .filter((row) => row.fiscalYear === fiscalYear)
        .filter((row) => s(row.status).toUpperCase() === "ACTIVE")
        .filter((row) =>
          isSchoolScope || allowedSet.size === 0
            ? true
            : allowedSet.has(s(row.id)),
        )
        .sort((left, right) =>
          `${s(left.ageLabel)}_${s(left.name)}`.localeCompare(
            `${s(right.ageLabel)}_${s(right.name)}`,
            "ja",
          ),
        );

      setClassrooms(rows);

      const preferredId = s(currentClassroomId);
      const nextClassroomId = rows.some((row) => row.id === preferredId)
        ? preferredId
        : rows[0]?.id ?? "";

      setSelectedClassroomId((current) =>
        rows.some((row) => row.id === current) ? current : nextClassroomId,
      );

      if (rows.length === 0) {
        setMessage("表示可能なクラスがありません。");
      }
    } catch (error) {
      console.error(error);
      setClassrooms([]);
      setMessage(
        `クラス読込エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setLoadingClassrooms(false);
    }
  }

  async function loadWorkspace() {
    if (!selectedClassroomId) {
      setMessage("対象クラスを選択してください。");
      return;
    }
    if (!targetDate) {
      setMessage("対象日を入力してください。");
      return;
    }

    setLoadingWorkspace(true);
    setMessage("");

    try {
      const sheetId = sheetIdFor(tenantId, selectedClassroomId, targetDate);

      const [
        enrollmentRes,
        childRes,
        contactRes,
        sheetRes,
        entryRes,
        weeklyReportRes,
      ] = await Promise.all([
          client.models.ChildClassroomEnrollment.list({
            filter: {
              tenantId: { eq: tenantId },
              classroomId: { eq: selectedClassroomId },
              fiscalYear: { eq: fiscalYear },
            },
            limit: 1000,
          }),
          client.models.Child.list({
            filter: {
              tenantId: { eq: tenantId },
            },
            limit: 1000,
          }),
          client.models.ChildGuardianContact.list({
            filter: {
              tenantId: { eq: tenantId },
            },
            limit: 1000,
          }),
          client.models.ParentNotebookSheet.get({ id: sheetId }),
          client.models.ParentNotebookEntry.list({
            filter: {
              tenantId: { eq: tenantId },
              parentNotebookSheetId: { eq: sheetId },
            },
            limit: 1000,
          }),
          client.models.ChildWeeklyReport.list({
            filter: {
              tenantId: { eq: tenantId },
              classroomId: { eq: selectedClassroomId },
            },
            limit: 1000,
          }),
        ]);

      const allErrors = [
        ...(enrollmentRes.errors ?? []),
        ...(childRes.errors ?? []),
        ...(contactRes.errors ?? []),
        ...(entryRes.errors ?? []),
        ...(weeklyReportRes.errors ?? []),
      ];

      if (allErrors.length > 0) {
        throw new Error(
          formatErrors(allErrors, "連絡帳ワークスペースの取得に失敗しました。"),
        );
      }

      const enrollments = (enrollmentRes.data ?? [])
        .filter((row) => isEnrollmentActiveOnDate(row, targetDate))
        .sort((left, right) => s(left.childId).localeCompare(s(right.childId)));

      const childById = new Map(
        (childRes.data ?? [])
          .filter((row) => s(row.status).toUpperCase() === "ACTIVE")
          .map((row) => [s(row.id), row]),
      );

      const contactsByChildId = new Map<string, GuardianContactRow[]>();
      for (const contact of contactRes.data ?? []) {
        const childId = s(contact.childId);
        if (!childId) continue;
        const bucket = contactsByChildId.get(childId) ?? [];
        bucket.push(contact);
        contactsByChildId.set(childId, bucket);
      }

      const entryByChildId = new Map(
        (entryRes.data ?? []).map((row) => [s(row.childId), row]),
      );
      const loadedWeeklyReports = (weeklyReportRes.data ?? [])
        .filter((row) => Number(row.fiscalYear ?? 0) === fiscalYear)
        .sort((left, right) => {
          const startDiff = s(right.weekStartDate).localeCompare(s(left.weekStartDate));
          if (startDiff !== 0) return startDiff;
          return s(right.id).localeCompare(s(left.id));
        });

      const rows: ChildWorkspaceRow[] = enrollments
        .map((enrollment) => {
          const child = childById.get(s(enrollment.childId));
          if (!child) return null;
          return {
            child,
            enrollment,
            contact: choosePrimaryContact(
              contactsByChildId.get(s(child.id)) ?? [],
            ),
            entry: entryByChildId.get(s(child.id)) ?? null,
          };
        })
        .filter((row): row is ChildWorkspaceRow => row !== null)
        .sort((left, right) =>
          s(left.child.displayName).localeCompare(
            s(right.child.displayName),
            "ja",
          ),
        );

      const drafts: Record<string, ContactDraft> = {};
      const reportSelections: Record<string, string> = {};
      for (const row of rows) {
        const childId = s(row.child.id);
        drafts[childId] = {
          contactId: s(row.contact?.id),
          relation: s(row.contact?.relation) || DEFAULT_RELATION,
          guardianName: s(row.contact?.guardianName),
          email: s(row.contact?.email),
        };
        reportSelections[childId] = s(row.entry?.childWeeklyReportId);
      }

      setWorkspaceRows(rows);
      setWeeklyReports(loadedWeeklyReports);
      setWeeklyReportSelections(reportSelections);
      setContactDrafts(drafts);
      setSheet(sheetRes.data ?? null);
      setNoticeDraft(
        s(sheetRes.data?.noticeDraftText) || s(sheetRes.data?.noticeText),
      );

      setMessage(
        `連絡帳を読み込みました。対象児童=${rows.length}名、連絡先登録=${
          rows.filter((row) => row.contact).length
        }名、発行済み=${rows.filter((row) => row.entry).length}名、確認済み週末だより=${
          loadedWeeklyReports.filter((report) =>
            isSelectableWeeklyReport(report, {
              tenantId,
              fiscalYear,
              classroomId: selectedClassroomId,
              childId: s(report.childId),
            }),
          ).length
        }件`,
      );
    } catch (error) {
      console.error(error);
      setWorkspaceRows([]);
      setWeeklyReports([]);
      setWeeklyReportSelections({});
      setContactDrafts({});
      setSheet(null);
      setNoticeDraft("");
      setMessage(
        `連絡帳読込エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setLoadingWorkspace(false);
    }
  }

  async function generateParentNotebookNotice() {
    if (!selectedClassroomId || !targetDate) {
      setMessage("対象日と対象クラスを指定してください。");
      return;
    }

    if (["CLOSED", "ARCHIVED"].includes(s(sheet?.status).toUpperCase())) {
      setMessage("締切済みまたはアーカイブ済みの連絡帳ではAI生成できません。");
      return;
    }

    if (lockedEntryCount > 0) {
      setMessage(
        "送信済みまたは回答済みの児童がいるため、AIで連絡文を書き換えることはできません。",
      );
      return;
    }

    const runner = client.mutations?.generateParentNotebookNotice;
    if (!runner) {
      setMessage(
        "generateParentNotebookNotice mutationが見つかりません。resource.tsとSandboxを確認してください。",
      );
      return;
    }

    setGeneratingNotice(true);
    setMessage("");

    try {
      const sheetId = sheetIdFor(tenantId, selectedClassroomId, targetDate);
      let currentSheet = sheet;

      // The Lambda starts from a real draft Sheet. Save the current textarea
      // first so an existing draft can also be refined by Haiku.
      if (!currentSheet) {
        const createResult = await client.models.ParentNotebookSheet.create({
          id: sheetId,
          tenantId,
          fiscalYear,
          classroomId: selectedClassroomId,
          targetDate,
          status: "DRAFT",
          noticeDraftText: noticeDraft.trim() || null,
          createdByUserId: userId,
          updatedByUserId: userId,
        });

        if (!createResult.data) {
          throw new Error(
            formatErrors(
              createResult.errors,
              "AI生成用の連絡帳下書き作成に失敗しました。",
            ),
          );
        }
        currentSheet = createResult.data;
      } else if (s(currentSheet.noticeDraftText) !== noticeDraft.trim()) {
        const updateResult = await client.models.ParentNotebookSheet.update({
          id: currentSheet.id,
          noticeDraftText: noticeDraft.trim() || null,
          updatedByUserId: userId,
        });

        if (!updateResult.data) {
          throw new Error(
            formatErrors(
              updateResult.errors,
              "AI生成前の下書き保存に失敗しました。",
            ),
          );
        }
        currentSheet = updateResult.data;
      }

      const data = await runOperation<
        GenerateParentNotebookNoticeArgs,
        GenerateParentNotebookNoticeResult
      >(runner, {
        parentNotebookSheetId: sheetId,
        manualNote: aiManualNote.trim() || undefined,
      });

      const draftText = s(data.draftText);
      if (!draftText) {
        throw new Error("AI生成結果が空でした。");
      }

      const generatedAt = s(data.generatedAt) || new Date().toISOString();
      setNoticeDraft(draftText);
      setSheet({
        ...currentSheet,
        sourceDailyPlanId:
          s(data.sourceDailyPlanId) || currentSheet.sourceDailyPlanId,
        noticeDraftText: draftText,
        noticeSourceJson: data.sourceJson ?? currentSheet.noticeSourceJson,
        generatedAt,
        updatedByUserId: userId,
      } as ParentNotebookSheetRow);

      setMessage(
        data.message ||
          `Claude Haikuで園からの連絡文を生成しました。生成=${formatDateTime(
            generatedAt,
          )}`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        `AI連絡文生成エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setGeneratingNotice(false);
    }
  }

  async function saveNoticeDraft() {
    if (!selectedClassroomId || !targetDate) {
      setMessage("対象日と対象クラスを指定してください。");
      return;
    }

    setSavingDraft(true);
    setMessage("");

    try {
      const now = new Date().toISOString();
      const sheetId = sheetIdFor(tenantId, selectedClassroomId, targetDate);
      const input = {
        id: sheetId,
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        targetDate,
        status: sheet?.status || "DRAFT",
        noticeDraftText: noticeDraft.trim() || null,
        updatedByUserId: userId,
      };

      const result = sheet
        ? await client.models.ParentNotebookSheet.update(input)
        : await client.models.ParentNotebookSheet.create({
            ...input,
            createdByUserId: userId,
          });

      if (!result.data) {
        throw new Error(
          formatErrors(result.errors, "連絡帳の下書き保存に失敗しました。"),
        );
      }

      setSheet(result.data);
      setMessage(`園からの連絡を下書き保存しました。更新=${formatDateTime(now)}`);
    } catch (error) {
      console.error(error);
      setMessage(
        `下書き保存エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function saveGuardianContact(childId: string) {
    const draft = contactDrafts[childId];
    if (!draft) return;

    if (!s(draft.relation) || !s(draft.guardianName) || !s(draft.email)) {
      setMessage("続柄・保護者氏名・メールアドレスをすべて入力してください。");
      return;
    }

    setSavingContactChildId(childId);
    setMessage("");

    try {
      const existing = workspaceRows.find(
        (row) => s(row.child.id) === childId,
      )?.contact;
      const contactId = s(existing?.id) || primaryContactIdFor(childId);
      const input = {
        id: contactId,
        tenantId,
        childId,
        relation: s(draft.relation),
        guardianName: s(draft.guardianName),
        email: s(draft.email),
        isPrimary: true,
        receiveParentNotebook: true,
        status: "ACTIVE",
        updatedByUserId: userId,
      };

      const result = existing
        ? await client.models.ChildGuardianContact.update(input)
        : await client.models.ChildGuardianContact.create({
            ...input,
            createdByUserId: userId,
          });

      if (!result.data) {
        throw new Error(
          formatErrors(result.errors, "保護者連絡先の保存に失敗しました。"),
        );
      }

      setWorkspaceRows((previous) =>
        previous.map((row) =>
          s(row.child.id) === childId
            ? {
                ...row,
                contact: result.data ?? row.contact,
              }
            : row,
        ),
      );
      setContactDrafts((previous) => ({
        ...previous,
        [childId]: {
          ...previous[childId],
          contactId: contactId,
        },
      }));
      setMessage("保護者連絡先を保存しました。");
    } catch (error) {
      console.error(error);
      setMessage(
        `連絡先保存エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSavingContactChildId("");
    }
  }

  async function issueParentNotebooks() {
    if (!selectedClassroomId || !targetDate) {
      setMessage("対象日と対象クラスを指定してください。");
      return;
    }
    if (workspaceRows.length === 0) {
      setMessage("発行対象の在籍児童がいません。");
      return;
    }
    if (!noticeDraft.trim()) {
      setMessage("園からの連絡を入力してください。");
      return;
    }
    if (["CLOSED", "ARCHIVED"].includes(s(sheet?.status).toUpperCase())) {
      setMessage("締切済みまたはアーカイブ済みの連絡帳は発行できません。");
      return;
    }

    const invalidSelectionRows = workspaceRows.filter((row) => {
      if (isEntryDeliveryLocked(row.entry)) return false;
      const childId = s(row.child.id);
      const selectedId = s(weeklyReportSelections[childId]);
      if (!selectedId) return false;
      const report = weeklyReportsById.get(selectedId);
      return !report || !isSelectableWeeklyReport(report, {
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        childId,
      });
    });
    if (invalidSelectionRows.length > 0) {
      setMessage(
        `週末こどもだよりを確認できない児童がいます: ${invalidSelectionRows
          .map((row) => s(row.child.displayName))
          .filter(Boolean)
          .join("、")}。確認済み・発信準備完了の週末だよりを選び直してください。`,
      );
      return;
    }

    const changedLockedRows = workspaceRows.filter((row) => {
      if (!isEntryDeliveryLocked(row.entry)) return false;
      const childId = s(row.child.id);
      return s(weeklyReportSelections[childId]) !== s(row.entry?.childWeeklyReportId);
    });
    if (changedLockedRows.length > 0) {
      setMessage(
        `送信済みまたは回答済みのため週末こどもだよりを変更できない児童がいます: ${changedLockedRows
          .map((row) => s(row.child.displayName))
          .filter(Boolean)
          .join("、")}`,
      );
      return;
    }

    const issuedText = s(sheet?.noticeText);
    const noticeChanged = Boolean(issuedText) && issuedText !== noticeDraft.trim();
    if (lockedEntryCount > 0 && noticeChanged) {
      setMessage(
        "送信済みまたは回答済みの児童がいるため、発行済み本文は変更できません。",
      );
      return;
    }

    setIssuing(true);
    setMessage("");

    try {
      const now = new Date().toISOString();
      const sheetId = sheetIdFor(tenantId, selectedClassroomId, targetDate);
      const sheetInput = {
        id: sheetId,
        tenantId,
        fiscalYear,
        classroomId: selectedClassroomId,
        targetDate,
        status: "ISSUED",
        noticeDraftText: noticeDraft.trim(),
        noticeText: noticeDraft.trim(),
        issuedAt: sheet?.issuedAt || now,
        issuedByUserId: sheet?.issuedByUserId || userId,
        issuedByName: sheet?.issuedByName || s(userName) || userId,
        updatedByUserId: userId,
      };

      const sheetResult = sheet
        ? await client.models.ParentNotebookSheet.update(sheetInput)
        : await client.models.ParentNotebookSheet.create({
            ...sheetInput,
            createdByUserId: userId,
          });

      if (!sheetResult.data) {
        throw new Error(
          formatErrors(sheetResult.errors, "連絡帳Sheetの発行に失敗しました。"),
        );
      }

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (let index = 0; index < workspaceRows.length; index += 1) {
        const row = workspaceRows[index];
        const childId = s(row.child.id);
        const contact = row.contact;
        const hasContact = Boolean(contact && s(contact.email));
        const existingEntry = row.entry;
        const existingDeliveryStatus = s(
          existingEntry?.deliveryStatus,
        ).toUpperCase();
        const childWeeklyReportId = isEntryDeliveryLocked(existingEntry)
          ? s(existingEntry?.childWeeklyReportId)
          : s(weeklyReportSelections[childId]);
        const deliveryStatus = existingEntry
          ? existingDeliveryStatus === "SKIPPED" && hasContact
            ? "NOT_SENT"
            : !hasContact && existingDeliveryStatus !== "SENT"
              ? "SKIPPED"
              : existingDeliveryStatus || (hasContact ? "NOT_SENT" : "SKIPPED")
          : hasContact
            ? "NOT_SENT"
            : "SKIPPED";

        const entryInput = {
          id: entryIdFor(sheetId, childId),
          tenantId,
          fiscalYear,
          parentNotebookSheetId: sheetId,
          classroomId: selectedClassroomId,
          childId,
          childWeeklyReportId: childWeeklyReportId || null,
          childName: s(row.child.displayName),
          targetDate,
          sortOrder: index + 1,
          guardianContactId: contact?.id ?? null,
          guardianRelationSnapshot: contact?.relation ?? null,
          guardianNameSnapshot: contact?.guardianName ?? null,
          guardianEmailSnapshot: contact?.email ?? null,
          deliveryStatus,
          responseStatus: existingEntry?.responseStatus || "NOT_SUBMITTED",
          responseRevision: existingEntry?.responseRevision ?? 0,
          updatedByUserId: userId,
        };

        const entryResult = existingEntry
          ? await client.models.ParentNotebookEntry.update(entryInput)
          : await client.models.ParentNotebookEntry.create({
              ...entryInput,
              createdByUserId: userId,
            });

        if (!entryResult.data) {
          throw new Error(
            formatErrors(
              entryResult.errors,
              `${s(row.child.displayName)}さんのEntry発行に失敗しました。`,
            ),
          );
        }

        if (existingEntry) updatedCount += 1;
        else createdCount += 1;
        if (!hasContact) skippedCount += 1;
      }

      setSheet(sheetResult.data);
      await loadWorkspace();
      setMessage(
        `連絡帳を発行しました。新規=${createdCount}名、更新=${updatedCount}名、連絡先未登録=${skippedCount}名`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        `連絡帳発行エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIssuing(false);
    }
  }

  async function updateResponseConfirmation(
    entry: ParentNotebookEntryRow,
    nextStatus: "SUBMITTED" | "CONFIRMED",
  ) {
    const entryId = s(entry.id);
    if (!entryId) return;

    const currentStatus = s(entry.responseStatus).toUpperCase();
    if (nextStatus === "CONFIRMED" && currentStatus !== "SUBMITTED") {
      setMessage("回答ありの連絡帳だけを園確認済みにできます。");
      return;
    }
    if (nextStatus === "SUBMITTED" && currentStatus !== "CONFIRMED") {
      setMessage("園確認済みの連絡帳だけ確認を取り消せます。");
      return;
    }

    const actionLabel =
      nextStatus === "CONFIRMED" ? "園確認済みにする" : "園確認を取り消す";
    const confirmed = window.confirm(
      `${s(entry.childName) || "選択した児童"}さんの回答を「${actionLabel}」で更新します。よろしいですか？`,
    );
    if (!confirmed) return;

    setUpdatingResponseEntryId(entryId);
    setMessage("");

    try {
      const now = new Date().toISOString();
      const result = await client.models.ParentNotebookEntry.update({
        id: entryId,
        responseStatus: nextStatus,
        confirmedAt: nextStatus === "CONFIRMED" ? now : null,
        confirmedByUserId: nextStatus === "CONFIRMED" ? userId : null,
        confirmedByName:
          nextStatus === "CONFIRMED" ? s(userName) || userId : null,
        updatedByUserId: userId,
      });

      if (!result.data) {
        throw new Error(
          formatErrors(result.errors, "保護者回答の確認状態更新に失敗しました。"),
        );
      }

      setWorkspaceRows((previous) =>
        previous.map((row) =>
          s(row.entry?.id) === entryId
            ? {
                ...row,
                entry: result.data ?? row.entry,
              }
            : row,
        ),
      );
      setMessage(
        nextStatus === "CONFIRMED"
          ? `${s(entry.childName)}さんの回答を園確認済みにしました。`
          : `${s(entry.childName)}さんの園確認を取り消し、回答ありへ戻しました。`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        `回答確認更新エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setUpdatingResponseEntryId("");
    }
  }

  async function sendParentNotebookEmails() {
    const runner = client.mutations?.sendParentNotebookEmails;

    if (!runner) {
      setMessage(
        "sendParentNotebookEmails mutationが見つかりません。resource.tsとSandboxを確認してください。",
      );
      return;
    }

    if (!sheet || s(sheet.status).toUpperCase() !== "ISSUED") {
      setMessage("先に児童別連絡帳を発行してください。");
      return;
    }

    const sendableCount = workspaceRows.filter((row) => {
      const status = s(row.entry?.deliveryStatus).toUpperCase();
      const hasEmail = Boolean(s(row.entry?.guardianEmailSnapshot));
      return Boolean(
        row.entry &&
          hasEmail &&
          ["NOT_SENT", "FAILED", "SKIPPED"].includes(status),
      );
    }).length;

    if (sendableCount === 0) {
      setMessage("メール送信対象の未送信または送信失敗児童がいません。");
      return;
    }

    const confirmed = window.confirm(
      `未送信または送信失敗の${sendableCount}名へ、児童別回答URL付きメールを送信します。よろしいですか？`,
    );
    if (!confirmed) return;

    setSendingEmails(true);
    setMessage("");

    try {
      const data = await runOperation<
        SendParentNotebookEmailsArgs,
        SendParentNotebookEmailsResult
      >(runner, {
        parentNotebookSheetId: sheet.id,
        baseUrl:
          typeof window === "undefined" ? undefined : window.location.origin,
      });

      await loadWorkspace();

      const details = (data.results ?? [])
        .filter(
          (row): row is ParentNotebookEmailSendResult =>
            Boolean(row) && !["SENT", "SKIPPED_ALREADY_SENT"].includes(
              s(row?.status).toUpperCase(),
            ),
        )
        .map((row) => {
          const child = s(row.childName) || s(row.childId) || "-";
          return `- ${child}: ${s(row.status) || "-"}${
            s(row.message) ? ` / ${s(row.message)}` : ""
          }`;
        })
        .join("\n");

      setMessage(
        `${data.message || "保護者連絡帳メールを送信しました。"}${
          details ? `\n${details}` : ""
        }`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        `メール送信エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSendingEmails(false);
    }
  }

  useEffect(() => {
    void loadClassrooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, fiscalYear]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        style={{
          padding: 16,
          border: "1px solid #d0d7de",
          borderRadius: 10,
          background: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>保護者連絡帳</h2>
          <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
            対象日の在籍児童を読み込み、園からの連絡を保存して児童別連絡帳を発行します。
            Phase 11-Fでは、対象日の日案をもとにClaude Haikuで園からの連絡文の下書きを生成できます。
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 700 }}>対象日</span>
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              disabled={loadingWorkspace || issuing || sendingEmails}
            />
          </label>

          <label style={{ display: "grid", gap: 4, minWidth: 220 }}>
            <span style={{ fontWeight: 700 }}>対象クラス</span>
            <select
              value={selectedClassroomId}
              onChange={(event) => setSelectedClassroomId(event.target.value)}
              disabled={loadingClassrooms || loadingWorkspace || issuing || sendingEmails}
            >
              <option value="">選択してください</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                  {classroom.ageLabel ? `（${classroom.ageLabel}）` : ""}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={loadWorkspace}
            disabled={loadingWorkspace || sendingEmails || !selectedClassroomId}
          >
            {loadingWorkspace ? "読込中..." : "連絡帳を読み込む"}
          </button>
        </div>

        <div style={{ fontSize: 13, color: "#555" }}>
          園: <b>{tenantName || tenantId}</b> / 年度: <b>{fiscalYear}</b> / 操作者: {" "}
          <b>{userName || userId}</b>（{userRole || "-"}）
        </div>

        {message ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              whiteSpace: "pre-wrap",
              border: "1px solid #dbeafe",
              background: "#f6fbff",
              borderRadius: 8,
            }}
          >
            {message}
          </pre>
        ) : null}
      </section>

      <section
        style={{
          padding: 16,
          border: "1px solid #d0d7de",
          borderRadius: 10,
          background: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>園からの連絡</h3>
          <span style={{ color: "#555", fontSize: 13 }}>
            状態: <b>{sheetStatusLabel(sheet?.status)}</b>
          </span>
          <span style={{ color: "#555", fontSize: 13 }}>
            Sheet ID: <code>{currentSheetId || "-"}</code>
          </span>
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 700 }}>AI生成用の補足（任意）</span>
          <textarea
            value={aiManualNote}
            onChange={(event) => setAiManualNote(event.target.value)}
            placeholder="例：明日は水遊びです。水着、タオル、着替えの案内を必ず含めてください。"
            disabled={generatingNotice || savingDraft || issuing || sendingEmails}
            style={{
              width: "100%",
              minHeight: 72,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <span style={{ color: "#666", fontSize: 12 }}>
            対象日の確定済み日案を優先して参照します。補足はAI入力にだけ使用し、保護者へ自動送信されません。
          </span>
        </label>

        <textarea
          value={noticeDraft}
          onChange={(event) => setNoticeDraft(event.target.value)}
          placeholder="例：明日は水遊びを予定しています。水着、タオル、着替えをご用意ください。"
          disabled={generatingNotice || savingDraft || issuing || sendingEmails}
          style={{
            width: "100%",
            minHeight: 140,
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={generateParentNotebookNotice}
            disabled={
              generatingNotice ||
              savingDraft ||
              issuing ||
              sendingEmails ||
              !selectedClassroomId ||
              lockedEntryCount > 0
            }
          >
            {generatingNotice ? "AI生成中..." : "AI連絡文を生成（Haiku）"}
          </button>
          <button
            type="button"
            onClick={saveNoticeDraft}
            disabled={generatingNotice || savingDraft || issuing || sendingEmails || !selectedClassroomId}
          >
            {savingDraft ? "保存中..." : "下書き保存"}
          </button>
          <button
            type="button"
            onClick={issueParentNotebooks}
            disabled={
              generatingNotice ||
              issuing ||
              savingDraft ||
              sendingEmails ||
              workspaceRows.length === 0 ||
              !noticeDraft.trim()
            }
          >
            {issuing
              ? "発行中..."
              : sheet
                ? "児童別連絡帳を更新発行"
                : "児童別連絡帳を発行"}
          </button>
          <button
            type="button"
            onClick={sendParentNotebookEmails}
            disabled={
              sendingEmails ||
              generatingNotice ||
              issuing ||
              !sheet ||
              s(sheet.status).toUpperCase() !== "ISSUED" ||
              issuedEntryCount === 0
            }
          >
            {sendingEmails ? "メール送信中..." : "未送信へメール送信"}
          </button>
        </div>

        {sheet?.generatedAt ? (
          <div style={{ color: "#555", fontSize: 13 }}>
            AI生成: <b>{formatDateTime(sheet.generatedAt)}</b>
            {sheet.sourceDailyPlanId ? (
              <> / 参照日案: <code>{sheet.sourceDailyPlanId}</code></>
            ) : null}
          </div>
        ) : null}

        {lockedEntryCount > 0 ? (
          <div style={{ color: "#92400e", fontSize: 13 }}>
            送信済みまたは回答済みが{lockedEntryCount}名います。発行済み本文を変更した再発行はできません。
          </div>
        ) : null}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        {[
          ["対象児童", workspaceRows.length],
          ["Entry発行済み", issuedEntryCount],
          ["未発行", notIssuedCount],
          ["未回答", unansweredCount],
          ["回答あり", submittedCount],
          ["園確認済み", confirmedCount],
          ["メール送信済み", sentCount],
          ["メール送信失敗", failedCount],
          ["連絡先登録", contactCount],
          ["週末だより紐付け", linkedWeeklyReportCount],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              padding: 12,
              border: "1px solid #d0d7de",
              borderRadius: 8,
              background: "#f8fafc",
            }}
          >
            <div style={{ color: "#555", fontSize: 12 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 24 }}>{value}</div>
          </div>
        ))}
      </section>


      <section
        style={{
          padding: 16,
          border: "1px solid #d0d7de",
          borderRadius: 10,
          background: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>保護者回答確認</h3>
          <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
            保護者が入力した登降園予定、お迎え予定、家庭での様子を確認し、確認後に園確認済みへ更新します。
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {(["ALL", "NOT_SUBMITTED", "SUBMITTED", "CONFIRMED"] as ResponseFilter[]).map(
            (filter) => {
              const count =
                filter === "ALL"
                  ? responseRows.length
                  : responseRows.filter(
                      (row) =>
                        s(row.entry.responseStatus).toUpperCase() === filter,
                    ).length;
              const selected = responseFilter === filter;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setResponseFilter(filter)}
                  style={{
                    border: selected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: selected ? "#eff6ff" : "#fff",
                    borderRadius: 999,
                    padding: "7px 12px",
                    fontWeight: selected ? 800 : 600,
                  }}
                >
                  {responseFilterLabel(filter)}（{count}）
                </button>
              );
            },
          )}
        </div>

        <div
          style={{
            padding: 12,
            border: unansweredCount > 0 ? "1px solid #fed7aa" : "1px solid #bbf7d0",
            background: unansweredCount > 0 ? "#fff7ed" : "#f0fdf4",
            borderRadius: 8,
            display: "grid",
            gap: 5,
          }}
        >
          <div style={{ fontWeight: 800 }}>未回答一覧（{unansweredCount}名）</div>
          <div style={{ fontSize: 13, color: unansweredCount > 0 ? "#9a3412" : "#166534" }}>
            {unansweredChildNames.length > 0
              ? unansweredChildNames.join("、")
              : responseRows.length > 0
                ? "発行済みの連絡帳はすべて回答済みです。"
                : "児童別連絡帳がまだ発行されていません。"}
          </div>
        </div>

        {responseRows.length === 0 ? (
          <div style={{ color: "#666" }}>
            児童別連絡帳を発行すると、ここに回答状況が表示されます。
          </div>
        ) : filteredResponseRows.length === 0 ? (
          <div style={{ color: "#666" }}>
            選択した状態に該当する児童はいません。
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 1900,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>児童</th>
                  <th style={{ padding: 8 }}>回答状態</th>
                  <th style={{ padding: 8 }}>登降園予定</th>
                  <th style={{ padding: 8 }}>予定時刻</th>
                  <th style={{ padding: 8 }}>お迎え予定</th>
                  <th style={{ padding: 8 }}>家庭での様子</th>
                  <th style={{ padding: 8 }}>保護者から園へ</th>
                  <th style={{ padding: 8 }}>回答日時・回数</th>
                  <th style={{ padding: 8 }}>園確認</th>
                  <th style={{ padding: 8 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredResponseRows.map((row) => {
                  const entry = row.entry;
                  const entryId = s(entry.id);
                  const status = s(entry.responseStatus).toUpperCase();
                  const updating = updatingResponseEntryId === entryId;
                  const pickupParts = [
                    s(entry.plannedPickupRelation),
                    s(entry.plannedPickupName),
                  ].filter(Boolean);

                  return (
                    <tr key={entryId}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 150,
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{row.child.displayName}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: "#666" }}>
                          {row.child.kana || s(row.child.id)}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 110,
                          fontWeight: 700,
                        }}
                      >
                        {responseStatusLabel(entry.responseStatus)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 120,
                        }}
                      >
                        {attendancePlanTypeLabel(entry.attendancePlanType)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 170,
                          fontSize: 13,
                        }}
                      >
                        <div>登園: {s(entry.plannedArrivalTime) || "-"}</div>
                        <div>降園: {s(entry.plannedDepartureTime) || "-"}</div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 210,
                          fontSize: 13,
                        }}
                      >
                        <div>{pickupParts.join(" / ") || "-"}</div>
                        <div style={{ marginTop: 3 }}>
                          時刻: {s(entry.plannedPickupTime) || "-"}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 280,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.55,
                        }}
                      >
                        {s(entry.homeNote) || "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 280,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.55,
                        }}
                      >
                        {s(entry.parentMessage) || "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 180,
                          fontSize: 13,
                        }}
                      >
                        <div>{formatDateTime(entry.submittedAt)}</div>
                        <div style={{ marginTop: 3, color: "#666" }}>
                          回答回数: {entry.responseRevision ?? 0}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 200,
                          fontSize: 13,
                        }}
                      >
                        {status === "CONFIRMED" ? (
                          <>
                            <div>{formatDateTime(entry.confirmedAt)}</div>
                            <div style={{ marginTop: 3, color: "#666" }}>
                              {s(entry.confirmedByName) || s(entry.confirmedByUserId) || "-"}
                            </div>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 170,
                        }}
                      >
                        {status === "SUBMITTED" ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateResponseConfirmation(entry, "CONFIRMED")
                            }
                            disabled={updating}
                          >
                            {updating ? "更新中..." : "園確認済みにする"}
                          </button>
                        ) : status === "CONFIRMED" ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateResponseConfirmation(entry, "SUBMITTED")
                            }
                            disabled={updating}
                          >
                            {updating ? "更新中..." : "確認を取り消す"}
                          </button>
                        ) : (
                          <span style={{ color: "#666" }}>回答待ち</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          padding: 16,
          border: "1px solid #d0d7de",
          borderRadius: 10,
          background: "#fff",
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>児童別連絡帳・週末だより・送信管理</h3>
          <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>
            メール送信対象となる主連絡先と、児童別に掲載する確認済み週末こどもだよりを選択して発行します。回答内容の確認は上の「保護者回答確認」で行います。
          </div>
          <div
            style={{
              marginTop: 8,
              padding: 10,
              border: "1px solid #dbeafe",
              borderRadius: 8,
              background: "#f6fbff",
              color: "#334155",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            「添付しない」も選択できます。メール送信済み、または保護者回答済みの児童は、URLで表示する週末だよりが後から変わらないよう選択を固定します。
          </div>
        </div>

        {workspaceRows.length === 0 ? (
          <div style={{ color: "#666" }}>
            対象日とクラスを選択して「連絡帳を読み込む」を押してください。
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 2050,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>児童</th>
                  <th style={{ padding: 8 }}>続柄</th>
                  <th style={{ padding: 8 }}>保護者氏名</th>
                  <th style={{ padding: 8 }}>メールアドレス</th>
                  <th style={{ padding: 8 }}>連絡先操作</th>
                  <th style={{ padding: 8 }}>週末こどもだより</th>
                  <th style={{ padding: 8 }}>発行</th>
                  <th style={{ padding: 8 }}>送信</th>
                  <th style={{ padding: 8 }}>送信日時・結果</th>
                  <th style={{ padding: 8 }}>回答</th>
                  <th style={{ padding: 8 }}>回答日時</th>
                </tr>
              </thead>
              <tbody>
                {workspaceRows.map((row) => {
                  const childId = s(row.child.id);
                  const draft = contactDrafts[childId] ?? {
                    contactId: "",
                    relation: DEFAULT_RELATION,
                    guardianName: "",
                    email: "",
                  };
                  const savingContact = savingContactChildId === childId;
                  const entryLocked = isEntryDeliveryLocked(row.entry);
                  const selectableReports =
                    selectableWeeklyReportsByChildId.get(childId) ?? [];
                  const selectedWeeklyReportId = s(
                    weeklyReportSelections[childId],
                  );
                  const selectedWeeklyReport = selectedWeeklyReportId
                    ? weeklyReportsById.get(selectedWeeklyReportId) ?? null
                    : null;
                  const selectedIsSelectable = Boolean(
                    selectedWeeklyReport &&
                      isSelectableWeeklyReport(selectedWeeklyReport, {
                        tenantId,
                        fiscalYear,
                        classroomId: selectedClassroomId,
                        childId,
                      }),
                  );

                  return (
                    <tr key={childId}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 150,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {row.child.displayName}
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {row.child.kana || childId}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 100,
                        }}
                      >
                        <select
                          value={draft.relation}
                          onChange={(event) =>
                            setContactDrafts((previous) => ({
                              ...previous,
                              [childId]: {
                                ...draft,
                                relation: event.target.value,
                              },
                            }))
                          }
                          disabled={savingContact}
                        >
                          <option value="母">母</option>
                          <option value="父">父</option>
                          <option value="祖母">祖母</option>
                          <option value="祖父">祖父</option>
                          <option value="その他">その他</option>
                        </select>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 180,
                        }}
                      >
                        <input
                          value={draft.guardianName}
                          onChange={(event) =>
                            setContactDrafts((previous) => ({
                              ...previous,
                              [childId]: {
                                ...draft,
                                guardianName: event.target.value,
                              },
                            }))
                          }
                          placeholder="例：山田 花子"
                          disabled={savingContact}
                          style={{ width: "100%", boxSizing: "border-box" }}
                        />
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 260,
                        }}
                      >
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(event) =>
                            setContactDrafts((previous) => ({
                              ...previous,
                              [childId]: {
                                ...draft,
                                email: event.target.value,
                              },
                            }))
                          }
                          placeholder="parent@example.jp"
                          disabled={savingContact}
                          style={{ width: "100%", boxSizing: "border-box" }}
                        />
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 120,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => saveGuardianContact(childId)}
                          disabled={savingContact}
                        >
                          {savingContact
                            ? "保存中..."
                            : row.contact
                              ? "連絡先更新"
                              : "連絡先登録"}
                        </button>
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 350,
                          verticalAlign: "top",
                        }}
                      >
                        <select
                          value={selectedWeeklyReportId}
                          onChange={(event) =>
                            setWeeklyReportSelections((previous) => ({
                              ...previous,
                              [childId]: event.target.value,
                            }))
                          }
                          disabled={entryLocked || issuing || sendingEmails}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">添付しない</option>
                          {selectedWeeklyReportId && !selectedIsSelectable ? (
                            <option value={selectedWeeklyReportId}>
                              紐付け済み（現在は候補外）: {selectedWeeklyReport?.title || selectedWeeklyReportId}
                            </option>
                          ) : null}
                          {selectableReports.map((report) => (
                            <option key={s(report.id)} value={s(report.id)}>
                              {weeklyReportOptionLabel(report)}
                            </option>
                          ))}
                        </select>
                        <div
                          style={{
                            marginTop: 5,
                            color: selectedWeeklyReportId
                              ? selectedIsSelectable
                                ? "#166534"
                                : "#b45309"
                              : "#64748b",
                            fontSize: 12,
                            lineHeight: 1.55,
                          }}
                        >
                          {selectedWeeklyReportId
                            ? selectedIsSelectable
                              ? `選択中: ${weeklyReportOptionLabel(selectedWeeklyReport as ChildWeeklyReportRow)}`
                              : "現在の紐付け先は確認済み・発信準備完了の候補ではありません。未送信の場合は選び直してください。"
                            : selectableReports.length > 0
                              ? `選択可能 ${selectableReports.length}件`
                              : "確認済み・発信準備完了の週末だよりはありません。"}
                        </div>
                        {entryLocked ? (
                          <div
                            style={{
                              marginTop: 4,
                              color: "#92400e",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            送信・回答後のため固定
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 90,
                        }}
                      >
                        {row.entry ? "発行済み" : "未発行"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 120,
                        }}
                      >
                        {deliveryStatusLabel(row.entry?.deliveryStatus)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 250,
                          fontSize: 12,
                        }}
                      >
                        <div>{formatDateTime(row.entry?.sentAt)}</div>
                        {row.entry?.sendErrorMessage ? (
                          <div
                            style={{
                              marginTop: 4,
                              color: "#b91c1c",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {row.entry.sendErrorMessage}
                          </div>
                        ) : row.entry?.emailMessageId ? (
                          <div
                            style={{
                              marginTop: 4,
                              color: "#64748b",
                              wordBreak: "break-all",
                            }}
                          >
                            SES: {row.entry.emailMessageId}
                          </div>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 110,
                        }}
                      >
                        {responseStatusLabel(row.entry?.responseStatus)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #e5e7eb",
                          minWidth: 170,
                        }}
                      >
                        {formatDateTime(row.entry?.submittedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
