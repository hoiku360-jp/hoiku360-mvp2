import type {
  ChildWeeklyReportRow,
  ChildWeeklyWorkflowAction,
  ChildWeeklyWorkflowEntry,
} from "./types";

function s(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizedChildWeeklyStatus(value: unknown): string {
  return s(value).toUpperCase() || "DRAFT";
}

export function canEditChildWeeklyReport(report: ChildWeeklyReportRow | null): boolean {
  const status = normalizedChildWeeklyStatus(report?.status);
  return status === "DRAFT" || status === "RETURNED";
}

export function canReviewChildWeeklyReport(role: unknown): boolean {
  const normalized = s(role).toUpperCase();
  return normalized === "DIRECTOR" || normalized === "LEAD";
}

export function childWeeklyStatusLabel(value: unknown): string {
  switch (normalizedChildWeeklyStatus(value)) {
    case "COMPLETED":
      return "確認待ち";
    case "CONFIRMED":
      return "確認済み";
    case "RETURNED":
      return "差し戻し";
    case "ARCHIVED":
      return "アーカイブ";
    default:
      return "下書き";
  }
}

export function childWeeklyStatusClass(value: unknown): string {
  switch (normalizedChildWeeklyStatus(value)) {
    case "COMPLETED":
      return "submitted";
    case "CONFIRMED":
      return "approved";
    case "RETURNED":
      return "rejected";
    default:
      return "draft";
  }
}

export function childWeeklyWorkflowActionLabel(action: ChildWeeklyWorkflowAction): string {
  if (action === "COMPLETE") return "記録完了";
  if (action === "CONFIRM") return "確認";
  return "差し戻し";
}

export function parseChildWeeklyWorkflowHistory(value: unknown): ChildWeeklyWorkflowEntry[] {
  if (!s(value)) return [];

  try {
    const parsed = JSON.parse(s(value));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): ChildWeeklyWorkflowEntry | null => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const action = s(row.action).toUpperCase();
        const status = s(row.status).toUpperCase();
        if (!["COMPLETE", "CONFIRM", "RETURN"].includes(action)) return null;
        if (!["COMPLETED", "CONFIRMED", "RETURNED"].includes(status)) return null;
        return {
          action: action as ChildWeeklyWorkflowAction,
          status: status as ChildWeeklyWorkflowEntry["status"],
          actorUserId: s(row.actorUserId),
          actorName: s(row.actorName),
          actorRole: s(row.actorRole),
          at: s(row.at),
          comment: s(row.comment),
        };
      })
      .filter((item): item is ChildWeeklyWorkflowEntry => Boolean(item));
  } catch {
    return [];
  }
}

export function appendChildWeeklyWorkflowEntry(
  currentJson: unknown,
  entry: ChildWeeklyWorkflowEntry,
): string {
  return JSON.stringify([...parseChildWeeklyWorkflowHistory(currentJson), entry]);
}

export function formatWorkflowTimestamp(value: unknown): string {
  const raw = s(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}
