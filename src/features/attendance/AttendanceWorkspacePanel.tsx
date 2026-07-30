import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type Props = {
  owner: string;
  ownerName?: string | null;
  ownerRole?: string | null;
  tenantId: string;
  tenantName?: string | null;
  fiscalYear: number;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[];
  isSchoolScope?: boolean;
};

type ModelError = {
  message?: string | null;
};

type ListOptions = Record<string, unknown>;
type MutationInput = Record<string, unknown>;

type ListResponse<TRow> = {
  data?: TRow[] | null;
  nextToken?: string | null;
  errors?: ModelError[] | null;
};

type MutationResponse<TRow> = {
  data?: TRow | null;
  errors?: ModelError[] | null;
};

type ListableModel<TRow> = {
  list(options?: ListOptions): Promise<ListResponse<TRow>>;
};

type GettableModel<TRow> = {
  get(input: { id: string }): Promise<MutationResponse<TRow>>;
};

type CreatableModel<TRow> = {
  create(input: MutationInput): Promise<MutationResponse<TRow>>;
};

type UpdatableModel<TRow> = {
  update(input: MutationInput): Promise<MutationResponse<TRow>>;
};

type ClassroomRow = Schema["Classroom"]["type"];
type ChildRow = Schema["Child"]["type"];
type EnrollmentRow = Schema["ChildClassroomEnrollment"]["type"];
type CareTimeSettingRow = Schema["CareTimeSetting"]["type"];
type CertificationRow = Schema["ChildCareTimeCertification"]["type"];
type AttendanceSheetRow = Schema["AttendanceSheet"]["type"];
type AttendanceRecordRow = Schema["AttendanceRecord"]["type"];
type ParentNotebookEntryRow = Schema["ParentNotebookEntry"]["type"];

type AttendanceClient = {
  models: {
    Classroom: ListableModel<ClassroomRow>;
    Child: ListableModel<ChildRow>;
    ChildClassroomEnrollment: ListableModel<EnrollmentRow>;
    CareTimeSetting: ListableModel<CareTimeSettingRow>;
    ChildCareTimeCertification: ListableModel<CertificationRow>;
    AttendanceSheet: ListableModel<AttendanceSheetRow> &
      GettableModel<AttendanceSheetRow> &
      CreatableModel<AttendanceSheetRow> &
      UpdatableModel<AttendanceSheetRow>;
    AttendanceRecord: ListableModel<AttendanceRecordRow> &
      GettableModel<AttendanceRecordRow> &
      CreatableModel<AttendanceRecordRow> &
      UpdatableModel<AttendanceRecordRow>;
    ParentNotebookEntry: ListableModel<ParentNotebookEntryRow>;
  };
};

type ChildAttendanceContext = {
  child: ChildRow;
  enrollment: EnrollmentRow;
  certification: CertificationRow | null;
};

type LoadedContext = {
  careTimeSetting: CareTimeSettingRow | null;
  childContexts: ChildAttendanceContext[];
  sheet: AttendanceSheetRow | null;
  records: AttendanceRecordRow[];
  parentNotebookEntries: ParentNotebookEntryRow[];
};

type AttendanceDraft = {
  isAbsent: boolean;
  arrivalTime: string;
  departureTime: string;
  absenceReason: string;
  lateReason: string;
  earlyDepartureReason: string;
  actualPickupRelation: string;
  actualPickupName: string;
  memo: string;
};

/**
 * Phase 11-E:
 * Parent-notebook information displayed beside attendance results.
 *
 * ParentNotebookEntry remains the source of truth. AttendanceRecord stores
 * only actual attendance results; parent answers are never copied into it.
 */
type ParentNotebookPlan = {
  linkageStatus:
    | "NOT_CONNECTED"
    | "NOT_SUBMITTED"
    | "SUBMITTED"
    | "CONFIRMED";
  submittedAt: string;
  confirmedAt: string;
  homeNote: string;
  parentMessage: string;
  attendancePlanType: string;
  attendancePlanLabel: string;
  plannedArrivalTime: string;
  plannedDepartureTime: string;
  plannedPickupRelation: string;
  plannedPickupName: string;
  plannedPickupTime: string;
};

type ExtensionInfo = {
  beforeMinutes: number;
  afterMinutes: number;
  totalMinutes: number;
  arrivalBeforeOpen: boolean;
  departureAfterClose: boolean;
  invalidTimeOrder: boolean;
};

type AttendanceWorkflowEntry = {
  action: "COMPLETE" | "CONFIRM" | "RETURN";
  status: "COMPLETED" | "CONFIRMED" | "RETURNED";
  actorUserId: string;
  actorName: string;
  actorRole: string;
  at: string;
  comment: string;
};

type AttendanceWorkflow = {
  currentStatus: string;
  history: AttendanceWorkflowEntry[];
};

const client = generateClient<Schema>({
  authMode: "userPool",
}) as unknown as AttendanceClient;

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function todayYYYYMMDD(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
}

function parseHHMMToMinutes(value: unknown): number | null {
  const text = s(value);
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatHHMMFromMinutes(value: number | null): string {
  if (value === null) return "-";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60,
  ).padStart(2, "0")}`;
}

function formatDurationMinutes(value: number): string {
  const minutes = Math.max(0, Math.floor(value));
  if (minutes === 0) return "0分";

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

function formatModelErrors(
  errors?: ModelError[] | null,
  fallback = "Unknown error",
): string {
  const messages = (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean);
  return messages.length > 0 ? messages.join(", ") : fallback;
}

async function listAll<TRow>(
  model: ListableModel<TRow>,
  options?: ListOptions,
): Promise<TRow[]> {
  const rows: TRow[] = [];
  let nextToken: string | null | undefined;

  do {
    const response = await model.list({
      ...(options ?? {}),
      nextToken,
    });

    if (response.errors?.length) {
      throw new Error(formatModelErrors(response.errors, "list failed"));
    }

    if (Array.isArray(response.data)) {
      rows.push(...response.data);
    }

    nextToken = response.nextToken ?? null;
  } while (nextToken);

  return rows;
}

function assertMutationData<TRow>(
  response: MutationResponse<TRow>,
  fallback: string,
): TRow {
  if (response.errors?.length) {
    throw new Error(formatModelErrors(response.errors, fallback));
  }
  if (!response.data) {
    throw new Error(fallback);
  }
  return response.data;
}

function isDateWithinRange(
  targetDate: string,
  startDate: unknown,
  endDate: unknown,
): boolean {
  const start = s(startDate);
  const end = s(endDate);
  if (!start || start > targetDate) return false;
  return !end || end >= targetDate;
}

function latestByStartDate<TRow extends { startDate?: string | null }>(
  rows: TRow[],
): TRow | null {
  return (
    [...rows].sort((left, right) =>
      s(right.startDate).localeCompare(s(left.startDate)),
    )[0] ?? null
  );
}

function latestCareTimeSetting(
  rows: CareTimeSettingRow[],
): CareTimeSettingRow | null {
  return (
    [...rows].sort((left, right) =>
      s(right.effectiveFrom).localeCompare(s(left.effectiveFrom)),
    )[0] ?? null
  );
}

function attendanceSheetSort(
  left: AttendanceSheetRow,
  right: AttendanceSheetRow,
): number {
  const issuedAtDiff = s(right.issuedAt).localeCompare(s(left.issuedAt));
  if (issuedAtDiff !== 0) return issuedAtDiff;

  const leftCreatedAt = s((left as { createdAt?: string | null }).createdAt);
  const rightCreatedAt = s((right as { createdAt?: string | null }).createdAt);
  return rightCreatedAt.localeCompare(leftCreatedAt);
}

function careTimeTypeLabel(value: unknown): string {
  const type = s(value).toUpperCase();
  if (type === "STANDARD") return "保育標準時間";
  if (type === "SHORT") return "保育短時間";
  return type || "未設定";
}

function attendanceStatusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "NOT_ARRIVED") return "未登園";
  if (status === "ARRIVED") return "登園中";
  if (status === "DEPARTED") return "降園済";
  if (status === "ABSENT") return "欠席";
  return status || "未作成";
}

function sheetStatusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "DRAFT") return "入力中";
  if (status === "COMPLETED") return "担任記録完了";
  if (status === "CONFIRMED") return "確認済み";
  if (status === "RETURNED") return "差し戻し";
  if (status === "ARCHIVED") return "アーカイブ";
  return status || "未作成";
}

function parentNotebookStatusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "NOT_CONNECTED") return "未連携";
  if (status === "NOT_SUBMITTED") return "未回答";
  if (status === "SUBMITTED") return "回答あり";
  if (status === "CONFIRMED") return "園確認済み";
  return status || "未連携";
}

function parentNotebookAttendancePlanLabel(
  value: unknown,
  plannedArrivalTime: unknown,
  plannedDepartureTime: unknown,
): string {
  const type = s(value).toUpperCase();
  const arrival = s(plannedArrivalTime);
  const departure = s(plannedDepartureTime);

  if (type === "NORMAL") return "通常登園";
  if (type === "ABSENT") return "欠席予定";
  if (type === "LATE") {
    return arrival ? `遅刻予定（${arrival}登園）` : "遅刻予定";
  }
  if (type === "EARLY_DEPARTURE") {
    return departure ? `早退予定（${departure}降園）` : "早退予定";
  }
  if (type === "OTHER") return "その他の予定";
  return type || "-";
}

function createUnlinkedParentNotebookPlan(): ParentNotebookPlan {
  return {
    linkageStatus: "NOT_CONNECTED",
    submittedAt: "",
    confirmedAt: "",
    homeNote: "",
    parentMessage: "",
    attendancePlanType: "",
    attendancePlanLabel: "",
    plannedArrivalTime: "",
    plannedDepartureTime: "",
    plannedPickupRelation: "",
    plannedPickupName: "",
    plannedPickupTime: "",
  };
}

function parentNotebookEntrySort(
  left: ParentNotebookEntryRow,
  right: ParentNotebookEntryRow,
): number {
  const submittedDiff = s(right.submittedAt).localeCompare(s(left.submittedAt));
  if (submittedDiff !== 0) return submittedDiff;

  const leftUpdatedAt = s(
    (left as { updatedAt?: string | null }).updatedAt,
  );
  const rightUpdatedAt = s(
    (right as { updatedAt?: string | null }).updatedAt,
  );
  const updatedDiff = rightUpdatedAt.localeCompare(leftUpdatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  return s(right.id).localeCompare(s(left.id));
}

function buildParentNotebookPlanByChildId(
  entries: ParentNotebookEntryRow[],
): Record<string, ParentNotebookPlan> {
  const result: Record<string, ParentNotebookPlan> = {};

  for (const entry of [...entries].sort(parentNotebookEntrySort)) {
    const childId = s(entry.childId);
    if (!childId || result[childId]) continue;

    const responseStatus = s(entry.responseStatus).toUpperCase();
    const linkageStatus: ParentNotebookPlan["linkageStatus"] =
      responseStatus === "CONFIRMED"
        ? "CONFIRMED"
        : responseStatus === "SUBMITTED"
          ? "SUBMITTED"
          : "NOT_SUBMITTED";

    result[childId] = {
      linkageStatus,
      submittedAt: s(entry.submittedAt),
      confirmedAt: s(entry.confirmedAt),
      homeNote: s(entry.homeNote),
      parentMessage: s(entry.parentMessage),
      attendancePlanType: s(entry.attendancePlanType).toUpperCase(),
      attendancePlanLabel: parentNotebookAttendancePlanLabel(
        entry.attendancePlanType,
        entry.plannedArrivalTime,
        entry.plannedDepartureTime,
      ),
      plannedArrivalTime: s(entry.plannedArrivalTime),
      plannedDepartureTime: s(entry.plannedDepartureTime),
      plannedPickupRelation: s(entry.plannedPickupRelation),
      plannedPickupName: s(entry.plannedPickupName),
      plannedPickupTime: s(entry.plannedPickupTime),
    };
  }

  return result;
}

function pickupPersonLabel(relation: unknown, name: unknown): string {
  return [s(relation), s(name)].filter(Boolean).join(" ") || "-";
}

function signedMinuteDifferenceLabel(
  plannedTime: unknown,
  actualTime: unknown,
): string {
  const planned = parseHHMMToMinutes(plannedTime);
  const actual = parseHHMMToMinutes(actualTime);
  if (planned === null || actual === null) return "";

  const difference = actual - planned;
  if (difference === 0) return "予定どおり";
  if (difference > 0) return `予定より${difference}分遅い`;
  return `予定より${Math.abs(difference)}分早い`;
}

function parentNotebookComparisonLines(args: {
  plan: ParentNotebookPlan;
  actualAttendanceStatus: string;
  actualArrivalTime: string;
  actualDepartureTime: string;
  actualPickupRelation: string;
  actualPickupName: string;
}): string[] {
  const { plan } = args;
  if (
    plan.linkageStatus !== "SUBMITTED" &&
    plan.linkageStatus !== "CONFIRMED"
  ) {
    return [];
  }

  const lines: string[] = [];
  const planType = s(plan.attendancePlanType).toUpperCase();
  const actualStatus = s(args.actualAttendanceStatus).toUpperCase();

  if (planType === "ABSENT") {
    if (actualStatus === "NOT_ARRIVED" || actualStatus === "NOT_CREATED") {
      lines.push("欠席予定が実績へ未反映です");
    } else if (actualStatus && actualStatus !== "ABSENT") {
      lines.push(
        `欠席予定ですが、実績は${attendanceStatusLabel(actualStatus)}です`,
      );
    }
  } else if (planType && actualStatus === "ABSENT") {
    lines.push("登園予定ですが、実績は欠席です");
  }

  const arrivalDifference = signedMinuteDifferenceLabel(
    plan.plannedArrivalTime,
    args.actualArrivalTime,
  );
  if (arrivalDifference && arrivalDifference !== "予定どおり") {
    lines.push(`登園：${arrivalDifference}`);
  }

  const plannedDepartureTime =
    plan.plannedDepartureTime || plan.plannedPickupTime;
  const departureDifference = signedMinuteDifferenceLabel(
    plannedDepartureTime,
    args.actualDepartureTime,
  );
  if (departureDifference && departureDifference !== "予定どおり") {
    lines.push(`降園：${departureDifference}`);
  }

  const plannedPickup = pickupPersonLabel(
    plan.plannedPickupRelation,
    plan.plannedPickupName,
  );
  const actualPickup = pickupPersonLabel(
    args.actualPickupRelation,
    args.actualPickupName,
  );
  if (
    plannedPickup !== "-" &&
    actualPickup !== "-" &&
    plannedPickup !== actualPickup
  ) {
    lines.push(`お迎え者変更：予定 ${plannedPickup}／実績 ${actualPickup}`);
  }

  return lines;
}

function deterministicSheetId(
  tenantId: string,
  classroomId: string,
  targetDate: string,
): string {
  return `attendance-sheet-${tenantId}-${classroomId}-${targetDate}`;
}

function deterministicRecordId(sheetId: string, childId: string): string {
  return `attendance-record-${sheetId}-${childId}`;
}

function careWindowForCertification(
  setting: CareTimeSettingRow,
  careTimeType: string,
): { startTime: string; endTime: string } {
  if (careTimeType === "SHORT") {
    return {
      startTime: setting.shortCareStartTime,
      endTime: setting.shortCareEndTime,
    };
  }

  return {
    startTime: setting.standardCareStartTime,
    endTime: setting.standardCareEndTime,
  };
}

function filterClassroomsForScope(
  rows: ClassroomRow[],
  currentClassroomId: string | null,
  allowedClassroomIds: string[],
): ClassroomRow[] {
  const currentId = s(currentClassroomId);
  if (currentId) {
    return rows.filter((row) => row.id === currentId);
  }

  const allowed = new Set(
    allowedClassroomIds.map((id) => s(id)).filter(Boolean),
  );
  if (allowed.size > 0) {
    return rows.filter((row) => allowed.has(row.id));
  }

  return rows;
}

function createDraftFromRecord(record: AttendanceRecordRow): AttendanceDraft {
  return {
    isAbsent: s(record.status).toUpperCase() === "ABSENT",
    arrivalTime: s(record.arrivalTime),
    departureTime: s(record.departureTime),
    absenceReason: s(record.absenceReason),
    lateReason: s(record.lateReason),
    earlyDepartureReason: s(record.earlyDepartureReason),
    actualPickupRelation: s(record.actualPickupRelation),
    actualPickupName: s(record.actualPickupName),
    memo: s(record.memo),
  };
}

function buildDrafts(
  records: AttendanceRecordRow[],
): Record<string, AttendanceDraft> {
  const drafts: Record<string, AttendanceDraft> = {};
  for (const record of records) {
    drafts[record.id] = createDraftFromRecord(record);
  }
  return drafts;
}

function deriveAttendanceStatus(draft: AttendanceDraft): string {
  if (draft.isAbsent) return "ABSENT";
  if (s(draft.departureTime)) return "DEPARTED";
  if (s(draft.arrivalTime)) return "ARRIVED";
  return "NOT_ARRIVED";
}

function calculateExtension(
  record: AttendanceRecordRow,
  draft: AttendanceDraft,
): ExtensionInfo {
  if (draft.isAbsent) {
    return {
      beforeMinutes: 0,
      afterMinutes: 0,
      totalMinutes: 0,
      arrivalBeforeOpen: false,
      departureAfterClose: false,
      invalidTimeOrder: false,
    };
  }

  const arrival = parseHHMMToMinutes(draft.arrivalTime);
  const departure = parseHHMMToMinutes(draft.departureTime);
  const open = parseHHMMToMinutes(record.openTimeSnapshot);
  const close = parseHHMMToMinutes(record.closeTimeSnapshot);
  const careStart = parseHHMMToMinutes(record.careStartTimeSnapshot);
  const careEnd = parseHHMMToMinutes(record.careEndTimeSnapshot);

  const beforeMinutes =
    arrival !== null && careStart !== null
      ? Math.max(0, careStart - arrival)
      : 0;
  const afterMinutes =
    departure !== null && careEnd !== null
      ? Math.max(0, departure - careEnd)
      : 0;

  return {
    beforeMinutes,
    afterMinutes,
    totalMinutes: beforeMinutes + afterMinutes,
    arrivalBeforeOpen:
      arrival !== null && open !== null ? arrival < open : false,
    departureAfterClose:
      departure !== null && close !== null ? departure > close : false,
    invalidTimeOrder:
      arrival !== null && departure !== null ? departure < arrival : false,
  };
}

function isSheetEditable(sheet: AttendanceSheetRow | null): boolean {
  const status = s(sheet?.status).toUpperCase();
  return status === "DRAFT" || status === "RETURNED";
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

function parseAttendanceWorkflow(value: unknown): AttendanceWorkflow {
  const text = s(value);
  if (!text) {
    return { currentStatus: "", history: [] };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const container =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    const historyRaw = Array.isArray(parsed)
      ? parsed
      : Array.isArray(container.history)
        ? container.history
        : [];

    const history = historyRaw
      .map((item): AttendanceWorkflowEntry | null => {
        if (typeof item !== "object" || item === null) return null;
        const row = item as Record<string, unknown>;
        const action = s(row.action).toUpperCase();
        const status = s(row.status).toUpperCase();
        if (!['COMPLETE', 'CONFIRM', 'RETURN'].includes(action)) return null;
        if (!['COMPLETED', 'CONFIRMED', 'RETURNED'].includes(status)) {
          return null;
        }

        return {
          action: action as AttendanceWorkflowEntry['action'],
          status: status as AttendanceWorkflowEntry['status'],
          actorUserId: s(row.actorUserId),
          actorName: s(row.actorName),
          actorRole: s(row.actorRole),
          at: s(row.at),
          comment: s(row.comment),
        };
      })
      .filter((entry): entry is AttendanceWorkflowEntry => Boolean(entry));

    return {
      currentStatus: s(container.currentStatus),
      history,
    };
  } catch {
    return { currentStatus: "", history: [] };
  }
}

function appendAttendanceWorkflowEntry(
  value: unknown,
  entry: AttendanceWorkflowEntry,
): string {
  const workflow = parseAttendanceWorkflow(value);
  return JSON.stringify({
    schemaVersion: 1,
    currentStatus: entry.status,
    history: [...workflow.history, entry],
  });
}

function workflowActionLabel(
  action: AttendanceWorkflowEntry['action'],
): string {
  if (action === 'COMPLETE') return '担任記録完了';
  if (action === 'CONFIRM') return '確認';
  return '差し戻し';
}

function formatDateTimeJst(value: unknown): string {
  const text = s(value);
  if (!text) return '-';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function hasUnsavedAttendanceChanges(
  record: AttendanceRecordRow,
  draft: AttendanceDraft,
): boolean {
  const extension = calculateExtension(record, draft);
  const absent = draft.isAbsent;
  const expectedArrival = absent ? '' : s(draft.arrivalTime);
  const expectedDeparture = absent ? '' : s(draft.departureTime);
  const expectedAbsenceReason = absent ? s(draft.absenceReason) : '';
  const expectedLateReason = absent ? '' : s(draft.lateReason);
  const expectedEarlyDepartureReason = absent
    ? ''
    : s(draft.earlyDepartureReason);
  const expectedPickupRelation = absent ? '' : s(draft.actualPickupRelation);
  const expectedPickupName = absent ? '' : s(draft.actualPickupName);

  return (
    s(record.status).toUpperCase() !== deriveAttendanceStatus(draft) ||
    s(record.arrivalTime) !== expectedArrival ||
    s(record.departureTime) !== expectedDeparture ||
    s(record.absenceReason) !== expectedAbsenceReason ||
    s(record.lateReason) !== expectedLateReason ||
    s(record.earlyDepartureReason) !== expectedEarlyDepartureReason ||
    s(record.actualPickupRelation) !== expectedPickupRelation ||
    s(record.actualPickupName) !== expectedPickupName ||
    s(record.memo) !== s(draft.memo) ||
    Number(record.extensionBeforeMinutes ?? 0) !== extension.beforeMinutes ||
    Number(record.extensionAfterMinutes ?? 0) !== extension.afterMinutes ||
    Number(record.extensionTotalMinutes ?? 0) !== extension.totalMinutes
  );
}

export default function AttendanceWorkspacePanel(props: Props) {
  const {
    owner,
    ownerName,
    ownerRole,
    tenantId,
    tenantName,
    fiscalYear,
    currentClassroomId = null,
    allowedClassroomIds = [],
    isSchoolScope = false,
  } = props;

  const [targetDate, setTargetDate] = useState(todayYYYYMMDD);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [classroomId, setClassroomId] = useState("");
  const [careTimeSetting, setCareTimeSetting] =
    useState<CareTimeSettingRow | null>(null);
  const [childContexts, setChildContexts] = useState<
    ChildAttendanceContext[]
  >([]);
  const [sheet, setSheet] = useState<AttendanceSheetRow | null>(null);
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [parentNotebookEntries, setParentNotebookEntries] = useState<
    ParentNotebookEntryRow[]
  >([]);
  const [draftByRecordId, setDraftByRecordId] = useState<
    Record<string, AttendanceDraft>
  >({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingRecordId, setSavingRecordId] = useState("");
  const [workflowWorking, setWorkflowWorking] = useState(false);
  const [workflowComment, setWorkflowComment] = useState("");
  const [message, setMessage] = useState("");

  const selectedClassroom = useMemo(
    () => classrooms.find((row) => row.id === classroomId) ?? null,
    [classroomId, classrooms],
  );

  const recordByChildId = useMemo(() => {
    const map = new Map<string, AttendanceRecordRow>();
    for (const record of records) {
      map.set(record.childId, record);
    }
    return map;
  }, [records]);

  const parentNotebookPlanByChildId = useMemo(
    () => buildParentNotebookPlanByChildId(parentNotebookEntries),
    [parentNotebookEntries],
  );

  const certificationSummary = useMemo(() => {
    let standard = 0;
    let short = 0;
    let missing = 0;

    for (const context of childContexts) {
      const type = s(context.certification?.careTimeType).toUpperCase();
      if (type === "STANDARD") standard += 1;
      else if (type === "SHORT") short += 1;
      else missing += 1;
    }

    return { standard, short, missing };
  }, [childContexts]);

  const attendanceSummary = useMemo(() => {
    let notArrived = 0;
    let arrived = 0;
    let departed = 0;
    let absent = 0;
    let extendedCount = 0;
    let extensionTotalMinutes = 0;
    let outsideOpenTimeCount = 0;
    let invalidTimeOrderCount = 0;
    let latestDepartureMinutes: number | null = null;

    for (const record of records) {
      const draft =
        draftByRecordId[record.id] ?? createDraftFromRecord(record);
      const status = deriveAttendanceStatus(draft);
      if (status === "NOT_ARRIVED") notArrived += 1;
      if (status === "ARRIVED") arrived += 1;
      if (status === "DEPARTED") departed += 1;
      if (status === "ABSENT") absent += 1;

      const extension = calculateExtension(record, draft);
      if (extension.totalMinutes > 0) extendedCount += 1;
      extensionTotalMinutes += extension.totalMinutes;
      if (extension.arrivalBeforeOpen || extension.departureAfterClose) {
        outsideOpenTimeCount += 1;
      }
      if (extension.invalidTimeOrder) invalidTimeOrderCount += 1;

      const departureMinutes = draft.isAbsent
        ? null
        : parseHHMMToMinutes(draft.departureTime);
      if (departureMinutes !== null) {
        latestDepartureMinutes =
          latestDepartureMinutes === null
            ? departureMinutes
            : Math.max(latestDepartureMinutes, departureMinutes);
      }
    }

    return {
      notArrived,
      arrived,
      departed,
      absent,
      extendedCount,
      extensionTotalMinutes,
      outsideOpenTimeCount,
      invalidTimeOrderCount,
      latestDepartureTime: formatHHMMFromMinutes(latestDepartureMinutes),
    };
  }, [draftByRecordId, records]);

  const parentNotebookSummary = useMemo(() => {
    let notConnected = 0;
    let notSubmitted = 0;
    let submitted = 0;
    let confirmed = 0;
    let absentPlanned = 0;
    let latePlanned = 0;
    let earlyDeparturePlanned = 0;
    let differenceCount = 0;

    for (const context of childContexts) {
      const plan = parentNotebookPlanByChildId[context.child.id];
      if (!plan) {
        notConnected += 1;
        continue;
      }

      if (plan.linkageStatus === "NOT_SUBMITTED") notSubmitted += 1;
      if (plan.linkageStatus === "SUBMITTED") submitted += 1;
      if (plan.linkageStatus === "CONFIRMED") confirmed += 1;

      if (plan.attendancePlanType === "ABSENT") absentPlanned += 1;
      if (plan.attendancePlanType === "LATE") latePlanned += 1;
      if (plan.attendancePlanType === "EARLY_DEPARTURE") {
        earlyDeparturePlanned += 1;
      }

      const record = recordByChildId.get(context.child.id);
      if (!record) continue;
      const draft =
        draftByRecordId[record.id] ?? createDraftFromRecord(record);
      const comparisons = parentNotebookComparisonLines({
        plan,
        actualAttendanceStatus: deriveAttendanceStatus(draft),
        actualArrivalTime: draft.arrivalTime,
        actualDepartureTime: draft.departureTime,
        actualPickupRelation: draft.actualPickupRelation,
        actualPickupName: draft.actualPickupName,
      });
      if (comparisons.length > 0) differenceCount += 1;
    }

    return {
      notConnected,
      notSubmitted,
      submitted,
      confirmed,
      absentPlanned,
      latePlanned,
      earlyDeparturePlanned,
      differenceCount,
    };
  }, [
    childContexts,
    draftByRecordId,
    parentNotebookPlanByChildId,
    recordByChildId,
  ]);

  const editable = isSheetEditable(sheet);
  const normalizedOwnerRole = s(ownerRole).toUpperCase();
  const canReviewSheet = canReviewByRole(normalizedOwnerRole);
  const sheetWorkflow = useMemo(
    () => parseAttendanceWorkflow(sheet?.reviewHistoryJson),
    [sheet?.reviewHistoryJson],
  );

  const unsavedRecordCount = useMemo(
    () =>
      records.filter((record) => {
        const draft =
          draftByRecordId[record.id] ?? createDraftFromRecord(record);
        return hasUnsavedAttendanceChanges(record, draft);
      }).length,
    [draftByRecordId, records],
  );

  const completionBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!sheet) blockers.push('登降園シートがありません。');
    if (records.length === 0) blockers.push('児童別登降園記録がありません。');
    if (records.length !== childContexts.length) {
      blockers.push(
        `在籍児童${childContexts.length}名に対して、登降園記録が${records.length}件です。`,
      );
    }
    if (attendanceSummary.invalidTimeOrderCount > 0) {
      blockers.push('降園時刻が登園時刻より前の記録があります。');
    }
    if (unsavedRecordCount > 0) {
      blockers.push(`未保存の入力が${unsavedRecordCount}件あります。`);
    }
    return blockers;
  }, [
    attendanceSummary.invalidTimeOrderCount,
    childContexts.length,
    records.length,
    sheet,
    unsavedRecordCount,
  ]);

  const completionWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (attendanceSummary.notArrived > 0) {
      warnings.push(`未登園が${attendanceSummary.notArrived}名残っています。`);
    }
    if (attendanceSummary.arrived > 0) {
      warnings.push(`登園中が${attendanceSummary.arrived}名残っています。`);
    }
    return warnings;
  }, [attendanceSummary.arrived, attendanceSummary.notArrived]);

  const loadClassrooms = useCallback(async () => {
    const rows = await listAll(client.models.Classroom, {
      filter: {
        tenantId: { eq: tenantId },
        fiscalYear: { eq: fiscalYear },
        status: { eq: "ACTIVE" },
      },
      limit: 1000,
    });

    const scopedRows = filterClassroomsForScope(
      rows,
      currentClassroomId,
      allowedClassroomIds,
    ).sort((left, right) => left.name.localeCompare(right.name, "ja"));

    setClassrooms(scopedRows);
    setClassroomId((current) => {
      const fixedId = s(currentClassroomId);
      if (fixedId && scopedRows.some((row) => row.id === fixedId)) {
        return fixedId;
      }
      if (current && scopedRows.some((row) => row.id === current)) {
        return current;
      }
      return scopedRows[0]?.id ?? "";
    });
  }, [allowedClassroomIds, currentClassroomId, fiscalYear, tenantId]);

  const fetchAttendanceContext = useCallback(async (): Promise<LoadedContext> => {
    if (!classroomId || !targetDate) {
      return {
        careTimeSetting: null,
        childContexts: [],
        sheet: null,
        records: [],
        parentNotebookEntries: [],
      };
    }

    const [
      settingRows,
      enrollmentRows,
      childRows,
      certificationRows,
      sheetRows,
      parentNotebookEntryRows,
    ] = await Promise.all([
        listAll(client.models.CareTimeSetting, {
          filter: {
            tenantId: { eq: tenantId },
            status: { eq: "ACTIVE" },
          },
          limit: 100,
        }),
        listAll(client.models.ChildClassroomEnrollment, {
          filter: {
            tenantId: { eq: tenantId },
            classroomId: { eq: classroomId },
            fiscalYear: { eq: fiscalYear },
            status: { eq: "ACTIVE" },
          },
          limit: 1000,
        }),
        listAll(client.models.Child, {
          filter: {
            tenantId: { eq: tenantId },
            status: { eq: "ACTIVE" },
          },
          limit: 1000,
        }),
        listAll(client.models.ChildCareTimeCertification, {
          filter: {
            tenantId: { eq: tenantId },
            status: { eq: "ACTIVE" },
          },
          limit: 1000,
        }),
        listAll(client.models.AttendanceSheet, {
          filter: {
            tenantId: { eq: tenantId },
            classroomId: { eq: classroomId },
            targetDate: { eq: targetDate },
          },
          limit: 100,
        }),
        listAll(client.models.ParentNotebookEntry, {
          // ParentNotebookWorkspacePanel と同じ決定的Sheet IDで取得する。
          // classroomId / targetDate の複合filterだけに依存すると、
          // Main環境で発行済みEntryを取得できないケースがあったため、
          // 連絡帳の発行単位そのものを検索キーにする。
          filter: {
            tenantId: { eq: tenantId },
            parentNotebookSheetId: {
              eq: `parent-notebook-sheet-${tenantId}-${classroomId}-${targetDate}`,
            },
          },
          limit: 1000,
        }),
      ]);

    const applicableSettings = settingRows.filter((row) =>
      isDateWithinRange(targetDate, row.effectiveFrom, row.effectiveTo),
    );
    const selectedSetting = latestCareTimeSetting(applicableSettings);

    const activeEnrollments = enrollmentRows.filter((row) =>
      isDateWithinRange(targetDate, row.startDate, row.endDate),
    );
    const childMap = new Map(childRows.map((child) => [child.id, child]));

    const nextChildContexts = activeEnrollments
      .map((enrollment) => {
        const child = childMap.get(enrollment.childId);
        if (!child) return null;

        const applicableCertifications = certificationRows.filter(
          (certification) =>
            certification.childId === child.id &&
            isDateWithinRange(
              targetDate,
              certification.startDate,
              certification.endDate,
            ),
        );

        return {
          child,
          enrollment,
          certification: latestByStartDate(applicableCertifications),
        } satisfies ChildAttendanceContext;
      })
      .filter((value): value is ChildAttendanceContext => Boolean(value))
      .sort((left, right) =>
        left.child.displayName.localeCompare(right.child.displayName, "ja"),
      );

    const selectedSheet =
      sheetRows
        .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
        .sort(attendanceSheetSort)[0] ?? null;

    const recordRows = selectedSheet
      ? await listAll(client.models.AttendanceRecord, {
          filter: {
            tenantId: { eq: tenantId },
            attendanceSheetId: { eq: selectedSheet.id },
          },
          limit: 1000,
        })
      : [];

    recordRows.sort(
      (left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0),
    );

    return {
      careTimeSetting: selectedSetting,
      childContexts: nextChildContexts,
      sheet: selectedSheet,
      records: recordRows,
      parentNotebookEntries: parentNotebookEntryRows,
    };
  }, [classroomId, fiscalYear, targetDate, tenantId]);

  const applyLoadedContext = useCallback((loaded: LoadedContext) => {
    setCareTimeSetting(loaded.careTimeSetting);
    setChildContexts(loaded.childContexts);
    setSheet(loaded.sheet);
    setRecords(loaded.records);
    setParentNotebookEntries(loaded.parentNotebookEntries);
    setDraftByRecordId(buildDrafts(loaded.records));
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!classroomId || !targetDate) return;

    setLoading(true);
    setMessage("");
    setWorkflowComment("");

    try {
      const loaded = await fetchAttendanceContext();
      applyLoadedContext(loaded);

      const missingCertificationCount = loaded.childContexts.filter(
        (context) => !context.certification,
      ).length;

      setMessage(
        [
          `登降園情報を読み込みました。園児=${loaded.childContexts.length}名。`,
          loaded.sheet
            ? `シート=${sheetStatusLabel(loaded.sheet.status)}、レコード=${loaded.records.length}件。`
            : "登降園シートは未作成です。",
          !loaded.careTimeSetting ? "対象日の保育時間設定がありません。" : "",
          missingCertificationCount > 0
            ? `認定区分未設定=${missingCertificationCount}名。`
            : "",
          `連絡帳Entry=${loaded.parentNotebookEntries.length}件。`,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (error) {
      console.error(error);
      setCareTimeSetting(null);
      setChildContexts([]);
      setSheet(null);
      setRecords([]);
      setParentNotebookEntries([]);
      setDraftByRecordId({});
      setMessage(
        `登降園情報の読込エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, [applyLoadedContext, classroomId, fetchAttendanceContext, targetDate]);

  useEffect(() => {
    void loadClassrooms().catch((error) => {
      console.error(error);
      setMessage(
        `クラス一覧の読込エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }, [loadClassrooms]);

  useEffect(() => {
    if (classroomId) {
      void loadAttendance();
    }
  }, [classroomId, loadAttendance, targetDate]);

  function updateDraft(recordId: string, patch: Partial<AttendanceDraft>) {
    setDraftByRecordId((previous) => {
      const record = records.find((row) => row.id === recordId);
      const current =
        previous[recordId] ??
        (record
          ? createDraftFromRecord(record)
          : {
              isAbsent: false,
              arrivalTime: "",
              departureTime: "",
              absenceReason: "",
              lateReason: "",
              earlyDepartureReason: "",
              actualPickupRelation: "",
              actualPickupName: "",
              memo: "",
            });

      return {
        ...previous,
        [recordId]: {
          ...current,
          ...patch,
        },
      };
    });
  }

  async function createOrRepairAttendanceSheet() {
    if (!classroomId || !targetDate) {
      setMessage("対象日とクラスを選択してください。");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const loaded = await fetchAttendanceContext();
      applyLoadedContext(loaded);

      if (!loaded.careTimeSetting) {
        throw new Error(
          `${targetDate} に適用される有効な CareTimeSetting がありません。`,
        );
      }

      if (loaded.childContexts.length === 0) {
        throw new Error("対象日・対象クラスに在籍する有効な児童がいません。");
      }

      const missingCertificationChildren = loaded.childContexts
        .filter((context) => !context.certification)
        .map((context) => context.child.displayName);

      if (missingCertificationChildren.length > 0) {
        throw new Error(
          `認定区分が未設定の児童がいます: ${missingCertificationChildren.join(
            "、",
          )}`,
        );
      }

      const invalidCertificationChildren = loaded.childContexts
        .filter((context) => {
          const type = s(context.certification?.careTimeType).toUpperCase();
          return type !== "STANDARD" && type !== "SHORT";
        })
        .map((context) => context.child.displayName);

      if (invalidCertificationChildren.length > 0) {
        throw new Error(
          `認定区分が STANDARD / SHORT 以外の児童がいます: ${invalidCertificationChildren.join(
            "、",
          )}`,
        );
      }

      const sheetId = deterministicSheetId(tenantId, classroomId, targetDate);
      let workingSheet = loaded.sheet;
      let createdSheet = false;

      if (!workingSheet) {
        const deterministicExisting = await client.models.AttendanceSheet.get({
          id: sheetId,
        });

        if (deterministicExisting.errors?.length) {
          throw new Error(
            formatModelErrors(
              deterministicExisting.errors,
              "既存シートの確認に失敗しました。",
            ),
          );
        }

        workingSheet = deterministicExisting.data ?? null;
      }

      if (!workingSheet) {
        workingSheet = assertMutationData(
          await client.models.AttendanceSheet.create({
            id: sheetId,
            tenantId,
            fiscalYear,
            classroomId,
            targetDate,
            status: "DRAFT",
            issuedAt: new Date().toISOString(),
            completedByUserId: null,
            completedByName: null,
            completedAt: null,
            confirmedByUserId: null,
            confirmedByName: null,
            confirmedAt: null,
            reviewHistoryJson: null,
            memo: null,
            createdByUserId: owner,
            updatedByUserId: owner,
          }),
          "登降園シートの作成に失敗しました。",
        );
        createdSheet = true;
      }

      const existingRows = await listAll(client.models.AttendanceRecord, {
        filter: {
          tenantId: { eq: tenantId },
          attendanceSheetId: { eq: workingSheet.id },
        },
        limit: 1000,
      });
      const existingByChildId = new Map(
        existingRows.map((record) => [record.childId, record]),
      );

      let createdRecordCount = 0;

      for (let index = 0; index < loaded.childContexts.length; index += 1) {
        const context = loaded.childContexts[index];
        if (existingByChildId.has(context.child.id)) continue;

        const certification = context.certification;
        if (!certification) continue;

        const careTimeType = s(certification.careTimeType).toUpperCase();
        const careWindow = careWindowForCertification(
          loaded.careTimeSetting,
          careTimeType,
        );
        const recordId = deterministicRecordId(workingSheet.id, context.child.id);

        const deterministicExisting = await client.models.AttendanceRecord.get({
          id: recordId,
        });

        if (deterministicExisting.errors?.length) {
          throw new Error(
            formatModelErrors(
              deterministicExisting.errors,
              `${context.child.displayName}の既存レコード確認に失敗しました。`,
            ),
          );
        }

        if (deterministicExisting.data) continue;

        assertMutationData(
          await client.models.AttendanceRecord.create({
            id: recordId,
            tenantId,
            fiscalYear,
            attendanceSheetId: workingSheet.id,
            classroomId,
            childId: context.child.id,
            targetDate,
            childName: context.child.displayName,
            sortOrder: index + 1,
            careTimeType,
            openTimeSnapshot: loaded.careTimeSetting.openTime,
            closeTimeSnapshot: loaded.careTimeSetting.closeTime,
            careStartTimeSnapshot: careWindow.startTime,
            careEndTimeSnapshot: careWindow.endTime,
            status: "NOT_ARRIVED",
            arrivalTime: null,
            arrivalRecordedAt: null,
            arrivalRecordedByUserId: null,
            departureTime: null,
            departureRecordedAt: null,
            departureRecordedByUserId: null,
            extensionBeforeMinutes: 0,
            extensionAfterMinutes: 0,
            extensionTotalMinutes: 0,
            absenceReason: null,
            lateReason: null,
            earlyDepartureReason: null,
            actualPickupRelation: null,
            actualPickupName: null,
            memo: null,
            createdByUserId: owner,
            updatedByUserId: owner,
          }),
          `登降園レコードの作成に失敗しました: ${context.child.displayName}`,
        );
        createdRecordCount += 1;
      }

      const refreshed = await fetchAttendanceContext();
      applyLoadedContext(refreshed);

      setMessage(
        [
          createdSheet
            ? "登降園シートを作成しました。"
            : "既存の登降園シートを確認しました。",
          `新規児童レコード=${createdRecordCount}件。`,
          `シート内レコード=${refreshed.records.length}件。`,
          createdRecordCount === 0 && !createdSheet
            ? "不足レコードはありませんでした。"
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (error) {
      console.error(error);
      setMessage(
        `登降園シート作成エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveAttendanceRecord(
    record: AttendanceRecordRow,
    draftOverride?: AttendanceDraft,
  ) {
    if (!editable) {
      setMessage("担任記録完了または確認済みのシートは更新できません。");
      return;
    }

    const draft =
      draftOverride ??
      draftByRecordId[record.id] ??
      createDraftFromRecord(record);
    const extension = calculateExtension(record, draft);

    if (extension.invalidTimeOrder) {
      setMessage(
        `${record.childName}：降園時刻を登園時刻より前には設定できません。`,
      );
      return;
    }

    setSavingRecordId(record.id);
    setMessage("");

    try {
      const now = new Date().toISOString();
      const status = deriveAttendanceStatus(draft);
      const arrivalTime = draft.isAbsent ? "" : s(draft.arrivalTime);
      const departureTime = draft.isAbsent ? "" : s(draft.departureTime);

      const updated = assertMutationData(
        await client.models.AttendanceRecord.update({
          id: record.id,
          status,
          arrivalTime: arrivalTime || null,
          arrivalRecordedAt: arrivalTime
            ? record.arrivalRecordedAt || now
            : null,
          arrivalRecordedByUserId: arrivalTime
            ? record.arrivalRecordedByUserId || owner
            : null,
          departureTime: departureTime || null,
          departureRecordedAt: departureTime
            ? record.departureRecordedAt || now
            : null,
          departureRecordedByUserId: departureTime
            ? record.departureRecordedByUserId || owner
            : null,
          extensionBeforeMinutes: extension.beforeMinutes,
          extensionAfterMinutes: extension.afterMinutes,
          extensionTotalMinutes: extension.totalMinutes,
          absenceReason: draft.isAbsent
            ? s(draft.absenceReason) || null
            : null,
          lateReason: draft.isAbsent ? null : s(draft.lateReason) || null,
          earlyDepartureReason: draft.isAbsent
            ? null
            : s(draft.earlyDepartureReason) || null,
          actualPickupRelation: draft.isAbsent
            ? null
            : s(draft.actualPickupRelation) || null,
          actualPickupName: draft.isAbsent
            ? null
            : s(draft.actualPickupName) || null,
          memo: s(draft.memo) || null,
          updatedByUserId: owner,
        }),
        `${record.childName}の登降園記録保存に失敗しました。`,
      );

      setRecords((previous) =>
        previous.map((row) => (row.id === updated.id ? updated : row)),
      );
      setDraftByRecordId((previous) => ({
        ...previous,
        [updated.id]: createDraftFromRecord(updated),
      }));

      const warningText = [
        extension.arrivalBeforeOpen ? "開園前の登園です。" : "",
        extension.departureAfterClose ? "閉園後の降園です。" : "",
      ]
        .filter(Boolean)
        .join(" ");

      setMessage(
        [
          `${record.childName}の登降園記録を保存しました。`,
          `状態=${attendanceStatusLabel(status)}。`,
          extension.totalMinutes > 0
            ? `延長保育=${formatDurationMinutes(extension.totalMinutes)}。`
            : "延長保育=0分。",
          warningText,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (error) {
      console.error(error);
      setMessage(
        `登降園記録保存エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setSavingRecordId("");
    }
  }

  async function setCurrentTimeAndSave(
    record: AttendanceRecordRow,
    field: "arrivalTime" | "departureTime",
  ) {
    const currentDraft =
      draftByRecordId[record.id] ?? createDraftFromRecord(record);
    const nextDraft: AttendanceDraft = {
      ...currentDraft,
      isAbsent: false,
      absenceReason: "",
      [field]: currentTimeHHMM(),
    };

    setDraftByRecordId((previous) => ({
      ...previous,
      [record.id]: nextDraft,
    }));

    await saveAttendanceRecord(record, nextDraft);
  }

  function setAbsent(record: AttendanceRecordRow, isAbsent: boolean) {
    const currentDraft =
      draftByRecordId[record.id] ?? createDraftFromRecord(record);
    updateDraft(record.id, {
      isAbsent,
      arrivalTime: isAbsent ? "" : currentDraft.arrivalTime,
      departureTime: isAbsent ? "" : currentDraft.departureTime,
      actualPickupRelation: isAbsent ? "" : currentDraft.actualPickupRelation,
      actualPickupName: isAbsent ? "" : currentDraft.actualPickupName,
    });
  }

  async function handleCompleteSheet() {
    if (!sheet || !editable) {
      setMessage('この登降園シートは記録完了できる状態ではありません。');
      return;
    }
    if (completionBlockers.length > 0) {
      setMessage(`記録完了できません。\n${completionBlockers.join('\n')}`);
      return;
    }

    if (completionWarnings.length > 0) {
      const proceed = window.confirm(
        `${completionWarnings.join('\n')}\nこのまま担任記録を完了しますか？`,
      );
      if (!proceed) return;
    }

    setWorkflowWorking(true);
    setMessage('');

    try {
      const now = new Date().toISOString();
      const entry: AttendanceWorkflowEntry = {
        action: 'COMPLETE',
        status: 'COMPLETED',
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole || 'TEACHER',
        at: now,
        comment: workflowComment.trim(),
      };

      const updated = assertMutationData(
        await client.models.AttendanceSheet.update({
          id: sheet.id,
          status: 'COMPLETED',
          completedByUserId: owner,
          completedByName: s(ownerName) || owner,
          completedAt: now,
          confirmedByUserId: null,
          confirmedByName: null,
          confirmedAt: null,
          reviewHistoryJson: appendAttendanceWorkflowEntry(
            sheet.reviewHistoryJson,
            entry,
          ),
          updatedByUserId: owner,
        }),
        '登降園シートの担任記録完了に失敗しました。',
      );

      setSheet(updated);
      setWorkflowComment('');
      setMessage('登降園記録を担任記録完了にしました。園長・主任の確認待ちです。');
    } catch (error) {
      console.error(error);
      setMessage(
        `担任記録完了エラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleConfirmSheet() {
    if (!canReviewSheet) {
      setMessage('園長・主任権限のユーザーだけが確認できます。');
      return;
    }
    if (!sheet || s(sheet.status).toUpperCase() !== 'COMPLETED') {
      setMessage('担任記録完了の登降園シートだけを確認できます。');
      return;
    }

    setWorkflowWorking(true);
    setMessage('');

    try {
      const now = new Date().toISOString();
      const entry: AttendanceWorkflowEntry = {
        action: 'CONFIRM',
        status: 'CONFIRMED',
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: now,
        comment: workflowComment.trim(),
      };

      const updated = assertMutationData(
        await client.models.AttendanceSheet.update({
          id: sheet.id,
          status: 'CONFIRMED',
          confirmedByUserId: owner,
          confirmedByName: s(ownerName) || owner,
          confirmedAt: now,
          reviewHistoryJson: appendAttendanceWorkflowEntry(
            sheet.reviewHistoryJson,
            entry,
          ),
          updatedByUserId: owner,
        }),
        '登降園シートの確認に失敗しました。',
      );

      setSheet(updated);
      setWorkflowComment('');
      setMessage('登降園記録を確認済みにしました。');
    } catch (error) {
      console.error(error);
      setMessage(
        `確認エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setWorkflowWorking(false);
    }
  }

  async function handleReturnSheet() {
    if (!canReviewSheet) {
      setMessage('園長・主任権限のユーザーだけが差し戻しできます。');
      return;
    }
    if (!sheet || s(sheet.status).toUpperCase() !== 'COMPLETED') {
      setMessage('担任記録完了の登降園シートだけを差し戻しできます。');
      return;
    }
    if (!workflowComment.trim()) {
      setMessage('差し戻し理由を入力してください。');
      return;
    }

    setWorkflowWorking(true);
    setMessage('');

    try {
      const now = new Date().toISOString();
      const entry: AttendanceWorkflowEntry = {
        action: 'RETURN',
        status: 'RETURNED',
        actorUserId: owner,
        actorName: s(ownerName) || owner,
        actorRole: normalizedOwnerRole,
        at: now,
        comment: workflowComment.trim(),
      };

      const updated = assertMutationData(
        await client.models.AttendanceSheet.update({
          id: sheet.id,
          status: 'RETURNED',
          reviewHistoryJson: appendAttendanceWorkflowEntry(
            sheet.reviewHistoryJson,
            entry,
          ),
          updatedByUserId: owner,
        }),
        '登降園シートの差し戻しに失敗しました。',
      );

      setSheet(updated);
      setWorkflowComment('');
      setMessage('登降園記録を差し戻しました。担任が修正・再完了できます。');
    } catch (error) {
      console.error(error);
      setMessage(
        `差し戻しエラー: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setWorkflowWorking(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>登園・降園管理</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Phase 11-E：保護者連絡帳の回答を児童ID・対象日・クラスで参照し、
          登園・降園実績と並べて予定差異を確認します。連絡帳回答は登降園記録へ複製しません。
        </p>
      </div>

      <div className="context-box">
        <strong>Context</strong>
        <div>
          tenant={tenantName ?? tenantId} / user={ownerName ?? owner} / role=
          {ownerRole ?? "-"} / scope={isSchoolScope ? "園全体" : "担当クラス"}
        </div>
      </div>

      <div style={panelStyle}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <label>
            対象日
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>

          <label>
            クラス
            <select
              value={classroomId}
              onChange={(event) => setClassroomId(event.target.value)}
              disabled={Boolean(currentClassroomId) || classrooms.length <= 1}
              style={{ marginLeft: 8, minWidth: 180 }}
            >
              <option value="">選択してください</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void loadAttendance()}
            disabled={loading || creating || Boolean(savingRecordId) || !classroomId}
          >
            {loading ? "読込中..." : "再読み込み"}
          </button>

          <button
            type="button"
            onClick={() => void createOrRepairAttendanceSheet()}
            disabled={loading || creating || Boolean(savingRecordId) || !classroomId}
          >
            {creating
              ? "作成・確認中..."
              : sheet
                ? "シートを確認・補完"
                : "登降園シートを作成"}
          </button>
        </div>

        {message ? (
          <div style={messageStyle}>{message}</div>
        ) : null}

        <div style={summaryGridStyle}>
          <SummaryCard
            label="対象クラス"
            value={selectedClassroom?.name ?? "-"}
          />
          <SummaryCard
            label="シート状態"
            value={sheetStatusLabel(sheet?.status)}
          />
          <SummaryCard label="在籍児童" value={`${childContexts.length}名`} />
          <SummaryCard
            label="保育標準時間"
            value={`${certificationSummary.standard}名`}
          />
          <SummaryCard
            label="保育短時間"
            value={`${certificationSummary.short}名`}
          />
          <SummaryCard
            label="認定未設定"
            value={`${certificationSummary.missing}名`}
            warning={certificationSummary.missing > 0}
          />
        </div>
      </div>

      <div style={panelStyle}>
        <div>
          <h3 style={{ margin: 0 }}>連絡帳の回答・予定</h3>
          <div className="muted" style={{ marginTop: 4 }}>
            ParentNotebookEntryを直接参照しています。園側で連絡帳を再読込した後は、
            この画面でも「再読み込み」を押すと最新回答が反映されます。
          </div>
        </div>

        <div style={summaryGridStyle}>
          <SummaryCard
            label="未連携"
            value={`${parentNotebookSummary.notConnected}名`}
            warning={parentNotebookSummary.notConnected > 0}
          />
          <SummaryCard
            label="未回答"
            value={`${parentNotebookSummary.notSubmitted}名`}
          />
          <SummaryCard
            label="回答あり"
            value={`${parentNotebookSummary.submitted}名`}
          />
          <SummaryCard
            label="園確認済み"
            value={`${parentNotebookSummary.confirmed}名`}
          />
          <SummaryCard
            label="欠席予定"
            value={`${parentNotebookSummary.absentPlanned}名`}
          />
          <SummaryCard
            label="遅刻予定"
            value={`${parentNotebookSummary.latePlanned}名`}
          />
          <SummaryCard
            label="早退予定"
            value={`${parentNotebookSummary.earlyDeparturePlanned}名`}
          />
          <SummaryCard
            label="予定・実績差異"
            value={`${parentNotebookSummary.differenceCount}名`}
            warning={parentNotebookSummary.differenceCount > 0}
          />
        </div>
      </div>

      <div style={panelStyle}>
        <div>
          <h3 style={{ margin: 0 }}>本日の登降園状況</h3>
          <div className="muted" style={{ marginTop: 4 }}>
            入力中の時刻も集計へ反映します。各行の保存後に正式記録となります。
          </div>
        </div>

        <div style={summaryGridStyle}>
          <SummaryCard label="未登園" value={`${attendanceSummary.notArrived}名`} />
          <SummaryCard label="登園中" value={`${attendanceSummary.arrived}名`} />
          <SummaryCard label="降園済み" value={`${attendanceSummary.departed}名`} />
          <SummaryCard label="欠席" value={`${attendanceSummary.absent}名`} />
          <SummaryCard
            label="延長保育対象"
            value={`${attendanceSummary.extendedCount}名`}
          />
          <SummaryCard
            label="延長保育合計"
            value={formatDurationMinutes(attendanceSummary.extensionTotalMinutes)}
          />
          <SummaryCard
            label="最終降園"
            value={attendanceSummary.latestDepartureTime}
          />
          <SummaryCard
            label="開園時間外"
            value={`${attendanceSummary.outsideOpenTimeCount}名`}
            warning={attendanceSummary.outsideOpenTimeCount > 0}
          />
          <SummaryCard
            label="時刻順序エラー"
            value={`${attendanceSummary.invalidTimeOrderCount}名`}
            warning={attendanceSummary.invalidTimeOrderCount > 0}
          />
        </div>
      </div>

      <div style={panelStyle}>
        <div>
          <h3 style={{ margin: 0 }}>対象日の保育時間設定</h3>
          <div className="muted" style={{ marginTop: 4 }}>
            児童レコード作成時のスナップショットを延長保育判定に使います。
          </div>
        </div>

        {careTimeSetting ? (
          <div style={summaryGridStyle}>
            <SummaryCard
              label="開園時間"
              value={`${careTimeSetting.openTime}-${careTimeSetting.closeTime}`}
            />
            <SummaryCard
              label="保育標準時間"
              value={`${careTimeSetting.standardCareStartTime}-${careTimeSetting.standardCareEndTime}`}
            />
            <SummaryCard
              label="保育短時間"
              value={`${careTimeSetting.shortCareStartTime}-${careTimeSetting.shortCareEndTime}`}
            />
            <SummaryCard
              label="適用期間"
              value={`${careTimeSetting.effectiveFrom}-${careTimeSetting.effectiveTo ?? "継続中"}`}
            />
          </div>
        ) : (
          <div style={warningBoxStyle}>
            対象日に適用される保育時間設定がありません。シートは作成できません。
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <div>
          <h3 style={{ margin: 0 }}>児童別登降園記録</h3>
          <div className="muted" style={{ marginTop: 4 }}>
            「登園」「降園」は現在時刻を即時保存します。手動で時刻や連絡事項を変更した場合は、行の「保存」を押してください。
            「連絡帳からの予定」はParentNotebookEntryの最新回答です。予定と実績に差がある場合は、同じ欄に差異を表示します。
          </div>
        </div>

        {!sheet ? (
          <div style={warningBoxStyle}>
            登降園シートがありません。先に「登降園シートを作成」を押してください。
          </div>
        ) : null}

        {sheet && !editable ? (
          <div style={warningBoxStyle}>
            このシートは「{sheetStatusLabel(sheet.status)}」のため編集できません。
            担任記録完了後は園長・主任が確認または差し戻しを行います。
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 2180,
            }}
          >
            <thead>
              <tr style={{ background: "#f6f8fa", textAlign: "left" }}>
                <th style={thStyle}>子ども</th>
                <th style={thStyle}>連絡帳からの予定</th>
                <th style={thStyle}>認定区分・時間</th>
                <th style={thStyle}>状態・欠席</th>
                <th style={thStyle}>登園時刻</th>
                <th style={thStyle}>降園時刻</th>
                <th style={thStyle}>延長保育</th>
                <th style={thStyle}>欠席理由</th>
                <th style={thStyle}>遅刻・変更理由</th>
                <th style={thStyle}>早退・変更理由</th>
                <th style={thStyle}>実際のお迎え者</th>
                <th style={thStyle}>メモ</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {childContexts.map((context) => {
                const record = recordByChildId.get(context.child.id);
                if (!record) {
                  return (
                    <tr key={context.child.id}>
                      <td style={tdStyle}>
                        <strong>{context.child.displayName}</strong>
                      </td>
                      <td style={tdStyle}>
                        <ParentNotebookPlanCell
                          plan={parentNotebookPlanByChildId[context.child.id]}
                          actualAttendanceStatus="NOT_CREATED"
                          actualArrivalTime=""
                          actualPickupRelation=""
                          actualPickupName=""
                          actualDepartureTime=""
                        />
                      </td>
                      <td style={tdStyle}>
                        {careTimeTypeLabel(context.certification?.careTimeType)}
                      </td>
                      <td style={tdStyle} colSpan={10}>
                        AttendanceRecordが未作成です。「シートを確認・補完」を押してください。
                      </td>
                    </tr>
                  );
                }

                const draft =
                  draftByRecordId[record.id] ?? createDraftFromRecord(record);
                const extension = calculateExtension(record, draft);
                const saving = savingRecordId === record.id;
                const disabled = !editable || saving;
                const derivedStatus = deriveAttendanceStatus(draft);

                return (
                  <tr key={record.id}>
                    <td style={tdStyle}>
                      <strong>{record.childName}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {record.childId}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <ParentNotebookPlanCell
                        plan={parentNotebookPlanByChildId[record.childId]}
                        actualAttendanceStatus={derivedStatus}
                        actualArrivalTime={draft.arrivalTime}
                        actualPickupRelation={draft.actualPickupRelation}
                        actualPickupName={draft.actualPickupName}
                        actualDepartureTime={draft.departureTime}
                      />
                    </td>

                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>
                        {careTimeTypeLabel(record.careTimeType)}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        通常 {record.careStartTimeSnapshot}-
                        {record.careEndTimeSnapshot}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        開園 {record.openTimeSnapshot}-
                        {record.closeTimeSnapshot}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>
                        {attendanceStatusLabel(derivedStatus)}
                      </div>
                      <label
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          marginTop: 8,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={draft.isAbsent}
                          disabled={disabled}
                          onChange={(event) =>
                            setAbsent(record, event.target.checked)
                          }
                        />
                        欠席
                      </label>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          type="time"
                          value={draft.arrivalTime}
                          disabled={disabled || draft.isAbsent}
                          onChange={(event) =>
                            updateDraft(record.id, {
                              arrivalTime: event.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          disabled={disabled || draft.isAbsent}
                          onClick={() =>
                            void setCurrentTimeAndSave(record, "arrivalTime")
                          }
                        >
                          登園
                        </button>
                        {extension.arrivalBeforeOpen ? (
                          <div style={warningTextStyle}>開園前です</div>
                        ) : null}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          type="time"
                          value={draft.departureTime}
                          disabled={disabled || draft.isAbsent}
                          onChange={(event) =>
                            updateDraft(record.id, {
                              departureTime: event.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          disabled={disabled || draft.isAbsent}
                          onClick={() =>
                            void setCurrentTimeAndSave(record, "departureTime")
                          }
                        >
                          降園
                        </button>
                        {extension.departureAfterClose ? (
                          <div style={warningTextStyle}>閉園後です</div>
                        ) : null}
                        {extension.invalidTimeOrder ? (
                          <div style={warningTextStyle}>
                            降園＜登園になっています
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <div>
                        前延長：{formatDurationMinutes(extension.beforeMinutes)}
                      </div>
                      <div>
                        後延長：{formatDurationMinutes(extension.afterMinutes)}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontWeight: extension.totalMinutes > 0 ? 700 : 400,
                        }}
                      >
                        合計：{formatDurationMinutes(extension.totalMinutes)}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={draft.absenceReason}
                        disabled={disabled || !draft.isAbsent}
                        onChange={(event) =>
                          updateDraft(record.id, {
                            absenceReason: event.target.value,
                          })
                        }
                        placeholder="発熱、家庭都合など"
                        style={wideInputStyle}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={draft.lateReason}
                        disabled={disabled || draft.isAbsent}
                        onChange={(event) =>
                          updateDraft(record.id, {
                            lateReason: event.target.value,
                          })
                        }
                        placeholder="任意"
                        style={wideInputStyle}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={draft.earlyDepartureReason}
                        disabled={disabled || draft.isAbsent}
                        onChange={(event) =>
                          updateDraft(record.id, {
                            earlyDepartureReason: event.target.value,
                          })
                        }
                        placeholder="任意"
                        style={wideInputStyle}
                      />
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          type="text"
                          value={draft.actualPickupRelation}
                          disabled={disabled || draft.isAbsent}
                          onChange={(event) =>
                            updateDraft(record.id, {
                              actualPickupRelation: event.target.value,
                            })
                          }
                          placeholder="続柄 例：母"
                          style={wideInputStyle}
                        />
                        <input
                          type="text"
                          value={draft.actualPickupName}
                          disabled={disabled || draft.isAbsent}
                          onChange={(event) =>
                            updateDraft(record.id, {
                              actualPickupName: event.target.value,
                            })
                          }
                          placeholder="氏名"
                          style={wideInputStyle}
                        />
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <textarea
                        value={draft.memo}
                        disabled={disabled}
                        onChange={(event) =>
                          updateDraft(record.id, { memo: event.target.value })
                        }
                        rows={3}
                        placeholder="任意メモ"
                        style={{ ...wideInputStyle, resize: "vertical" }}
                      />
                    </td>

                    <td style={tdStyle}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void saveAttendanceRecord(record)}
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {childContexts.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={13}>
                    対象日の在籍児童がいません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>記録完了・確認</h3>
            <div className="muted" style={{ marginTop: 4 }}>
              担任が記録を完了し、園長・主任が確認または差し戻しを行います。
            </div>
          </div>
          <strong>{sheetStatusLabel(sheet?.status)}</strong>
        </div>

        {sheet ? (
          <div style={summaryGridStyle}>
            <SummaryCard
              label="担任記録完了"
              value={
                sheet.completedByName
                  ? `${sheet.completedByName} / ${formatDateTimeJst(sheet.completedAt)}`
                  : '-'
              }
            />
            <SummaryCard
              label="確認"
              value={
                sheet.confirmedByName
                  ? `${sheet.confirmedByName} / ${formatDateTimeJst(sheet.confirmedAt)}`
                  : '-'
              }
            />
            <SummaryCard
              label="未保存入力"
              value={`${unsavedRecordCount}件`}
              warning={unsavedRecordCount > 0}
            />
            <SummaryCard
              label="ログイン権限"
              value={`${normalizedOwnerRole || '未設定'}${
                canReviewSheet ? '（確認可）' : '（記録担当）'
              }`}
            />
          </div>
        ) : null}

        {sheet &&
        (editable || s(sheet.status).toUpperCase() === 'COMPLETED') ? (
          <label>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              完了コメント／確認コメント／差し戻し理由
            </div>
            <textarea
              value={workflowComment}
              disabled={workflowWorking}
              onChange={(event) => setWorkflowComment(event.target.value)}
              placeholder={
                s(sheet.status).toUpperCase() === 'COMPLETED'
                  ? '確認コメントは任意です。差し戻す場合は理由を入力してください。'
                  : '記録完了時の申し送りがあれば入力してください。'
              }
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </label>
        ) : null}

        {sheet && editable ? (
          <div
            style={{
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#f9fafb',
            }}
          >
            <strong>担任記録完了チェック</strong>
            {completionBlockers.length === 0 ? (
              <div style={{ marginTop: 8 }}>
                保存状態と時刻整合性に問題はありません。
              </div>
            ) : (
              <ul style={{ marginBottom: 0 }}>
                {completionBlockers.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {completionWarnings.length > 0 ? (
              <div style={{ ...warningBoxStyle, marginTop: 10 }}>
                <strong>完了時の確認事項</strong>
                <ul style={{ marginBottom: 0 }}>
                  {completionWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sheet && editable ? (
            <button
              type="button"
              disabled={
                workflowWorking ||
                loading ||
                creating ||
                Boolean(savingRecordId) ||
                completionBlockers.length > 0
              }
              onClick={() => void handleCompleteSheet()}
            >
              {workflowWorking
                ? '処理中...'
                : s(sheet.status).toUpperCase() === 'RETURNED'
                  ? '修正後、記録を再完了'
                  : '登降園記録を完了'}
            </button>
          ) : null}

          {sheet &&
          s(sheet.status).toUpperCase() === 'COMPLETED' &&
          canReviewSheet ? (
            <>
              <button
                type="button"
                disabled={workflowWorking}
                onClick={() => void handleConfirmSheet()}
              >
                {workflowWorking ? '処理中...' : '確認する'}
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={workflowWorking || !workflowComment.trim()}
                onClick={() => void handleReturnSheet()}
              >
                差し戻す
              </button>
            </>
          ) : null}

          {sheet &&
          s(sheet.status).toUpperCase() === 'COMPLETED' &&
          !canReviewSheet ? (
            <span className="muted">園長・主任の確認待ちです。</span>
          ) : null}

          {sheet && s(sheet.status).toUpperCase() === 'CONFIRMED' ? (
            <strong>この登降園記録は確認済みです。</strong>
          ) : null}
        </div>

        {sheetWorkflow.history.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>確認履歴</strong>
            {sheetWorkflow.history.map((entry, index) => (
              <div
                key={`${entry.at}-${entry.action}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, auto) 1fr auto',
                  gap: 12,
                  padding: 10,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  alignItems: 'start',
                }}
              >
                <strong>{workflowActionLabel(entry.action)}</strong>
                <div>
                  <strong>{entry.actorName || entry.actorUserId}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {entry.actorRole || '-'}
                  </div>
                  <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {entry.comment || 'コメントなし'}
                  </div>
                </div>
                <small>{formatDateTimeJst(entry.at)}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  padding: 16,
  border: "1px solid #d0d7de",
  borderRadius: 8,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const messageStyle: CSSProperties = {
  padding: 12,
  border: "1px solid #dbeafe",
  borderRadius: 8,
  background: "#f6fbff",
  whiteSpace: "pre-wrap",
};

const warningBoxStyle: CSSProperties = {
  padding: 12,
  border: "1px solid #fde68a",
  borderRadius: 8,
  background: "#fffbeb",
};

const warningTextStyle: CSSProperties = {
  color: "#c2410c",
  fontSize: 12,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
};

const thStyle: CSSProperties = {
  padding: 8,
  border: "1px solid #d0d7de",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: 8,
  border: "1px solid #e5e7eb",
  verticalAlign: "top",
};

const wideInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 130,
  boxSizing: "border-box",
};

function ParentNotebookPlanCell(props: {
  plan?: ParentNotebookPlan | null;
  actualAttendanceStatus: string;
  actualArrivalTime: string;
  actualPickupRelation: string;
  actualPickupName: string;
  actualDepartureTime: string;
}) {
  const plan = props.plan ?? createUnlinkedParentNotebookPlan();
  const plannedPickup = pickupPersonLabel(
    plan.plannedPickupRelation,
    plan.plannedPickupName,
  );
  const actualPickup = pickupPersonLabel(
    props.actualPickupRelation,
    props.actualPickupName,
  );
  const comparisonLines = parentNotebookComparisonLines({
    plan,
    actualAttendanceStatus: props.actualAttendanceStatus,
    actualArrivalTime: props.actualArrivalTime,
    actualDepartureTime: props.actualDepartureTime,
    actualPickupRelation: props.actualPickupRelation,
    actualPickupName: props.actualPickupName,
  });

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 240 }}>
      <div
        style={{
          display: "inline-flex",
          width: "fit-content",
          padding: "2px 8px",
          border: "1px solid #d0d7de",
          borderRadius: 999,
          background:
            plan.linkageStatus === "NOT_CONNECTED"
              ? "#f3f4f6"
              : plan.linkageStatus === "CONFIRMED"
                ? "#ecfdf5"
                : "#eff6ff",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {parentNotebookStatusLabel(plan.linkageStatus)}
      </div>

      {plan.submittedAt ? (
        <div className="muted" style={{ fontSize: 11 }}>
          回答 {formatDateTimeJst(plan.submittedAt)}
          {plan.confirmedAt
            ? ` / 園確認 ${formatDateTimeJst(plan.confirmedAt)}`
            : ""}
        </div>
      ) : null}

      <div style={{ fontSize: 12 }}>
        <b>登降園予定：</b>
        {plan.attendancePlanLabel || "-"}
      </div>
      <div style={{ fontSize: 12 }}>
        <b>予定登園：</b>
        {plan.plannedArrivalTime || "-"}
      </div>
      <div style={{ fontSize: 12 }}>
        <b>予定降園：</b>
        {plan.plannedDepartureTime || "-"}
      </div>
      <div style={{ fontSize: 12 }}>
        <b>お迎え予定：</b>
        {plannedPickup}
      </div>
      <div style={{ fontSize: 12 }}>
        <b>お迎え時刻：</b>
        {plan.plannedPickupTime || "-"}
      </div>
      <div style={{ fontSize: 12 }}>
        <b>家庭：</b>
        <span style={{ whiteSpace: "pre-wrap" }}>{plan.homeNote || "-"}</span>
      </div>
      <div style={{ fontSize: 12 }}>
        <b>園への連絡：</b>
        <span style={{ whiteSpace: "pre-wrap" }}>
          {plan.parentMessage || "-"}
        </span>
      </div>

      <div
        style={{
          marginTop: 2,
          paddingTop: 6,
          borderTop: "1px dashed #d1d5db",
          fontSize: 12,
        }}
      >
        <div>
          <b>実績：</b>
          {props.actualAttendanceStatus === "NOT_CREATED"
            ? "記録未作成"
            : attendanceStatusLabel(props.actualAttendanceStatus)}
        </div>
        <div style={{ marginTop: 3 }}>
          <b>実績登園：</b>
          {s(props.actualArrivalTime) || "-"}
        </div>
        <div style={{ marginTop: 3 }}>
          <b>実績お迎え：</b>
          {actualPickup}
        </div>
        <div style={{ marginTop: 3 }}>
          <b>実績降園：</b>
          {s(props.actualDepartureTime) || "-"}
        </div>
      </div>

      {comparisonLines.length > 0 ? (
        <div
          style={{
            padding: 7,
            border: "1px solid #fed7aa",
            borderRadius: 6,
            background: "#fff7ed",
            color: "#9a3412",
            fontSize: 11,
          }}
        >
          <b>予定・実績差異</b>
          {comparisonLines.map((line) => (
            <div key={line} style={{ marginTop: 3 }}>
              ・{line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      style={{
        padding: 10,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: props.warning ? "#fff7ed" : "#f9fafb",
      }}
    >
      <div className="muted" style={{ fontSize: 12 }}>
        {props.label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontWeight: 700,
          color: props.warning ? "#c2410c" : undefined,
        }}
      >
        {props.value}
      </div>
    </div>
  );
}
