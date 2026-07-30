import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/submit-parent-notebook-reply";
import { createHash } from "node:crypto";

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

type SubmitParentNotebookReplyArgs = {
  replyToken?: string | null;
  okSigned?: boolean | null;

  attendancePlanType?: string | null;
  plannedArrivalTime?: string | null;
  plannedDepartureTime?: string | null;

  plannedPickupRelation?: string | null;
  plannedPickupName?: string | null;
  plannedPickupTime?: string | null;

  homeNote?: string | null;
  parentMessage?: string | null;
  userAgent?: string | null;
};

type ParentNotebookAccessTokenRow =
  Schema["ParentNotebookAccessToken"]["type"] & {
    id: string;
  };

type ParentNotebookEntryRow = Schema["ParentNotebookEntry"]["type"] & {
  id: string;
};

type ParentNotebookSheetRow = Schema["ParentNotebookSheet"]["type"] & {
  id: string;
};

const ATTENDANCE_PLAN_TYPES = new Set([
  "NORMAL",
  "ABSENT",
  "LATE",
  "EARLY_DEPARTURE",
  "OTHER",
]);

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function truncate(value: unknown, maxLength: number): string {
  return s(value).slice(0, maxLength);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isExpired(expiresAt: unknown): boolean {
  const text = s(expiresAt);
  if (!text) return false;

  const expires = new Date(text);
  return !Number.isNaN(expires.getTime()) && expires.getTime() < Date.now();
}

function isValidHHMM(value: string): boolean {
  if (!value) return true;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function errorText(
  errors?: Array<{ message?: string | null }> | null,
  fallback = "GraphQL request failed.",
): string {
  const messages = (errors ?? []).map((error) => s(error.message)).filter(Boolean);
  return messages.join("\n") || fallback;
}

async function listAll<T>(
  listFn: (args: {
    limit?: number;
    nextToken?: string | null;
    filter?: Record<string, unknown>;
  }) => Promise<{
    data?: T[] | null;
    nextToken?: string | null;
    errors?: Array<{ message?: string | null }> | null;
  }>,
  filter: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  let nextToken: string | null | undefined;

  do {
    const result = await listFn({ limit: 1000, nextToken, filter });
    if (result.errors?.length) {
      throw new Error(errorText(result.errors));
    }

    rows.push(...(result.data ?? []));
    nextToken = result.nextToken ?? null;
  } while (nextToken);

  return rows;
}

function validateTokenReferences(
  token: ParentNotebookAccessTokenRow,
  entry: ParentNotebookEntryRow,
  sheet: ParentNotebookSheetRow,
) {
  if (
    s(token.parentNotebookEntryId) !== entry.id ||
    s(token.parentNotebookSheetId) !== sheet.id ||
    s(entry.parentNotebookSheetId) !== sheet.id ||
    s(token.tenantId) !== s(entry.tenantId) ||
    s(token.tenantId) !== s(sheet.tenantId) ||
    s(token.childId) !== s(entry.childId) ||
    s(token.classroomId) !== s(entry.classroomId) ||
    s(token.classroomId) !== s(sheet.classroomId) ||
    s(token.targetDate) !== s(entry.targetDate) ||
    s(token.targetDate) !== s(sheet.targetDate)
  ) {
    throw new Error(
      "返信URLの内部情報に不整合があります。園側でURLを再発行してください。",
    );
  }
}

function validateReply(args: SubmitParentNotebookReplyArgs) {
  if (args.okSigned !== true) {
    throw new Error("園からの連絡内容を確認したチェックが必要です。");
  }

  const planType = s(args.attendancePlanType).toUpperCase();
  if (!ATTENDANCE_PLAN_TYPES.has(planType)) {
    throw new Error(
      "登園予定はNORMAL / ABSENT / LATE / EARLY_DEPARTURE / OTHERから選択してください。",
    );
  }

  const arrival = truncate(args.plannedArrivalTime, 5);
  const departure = truncate(args.plannedDepartureTime, 5);
  const pickup = truncate(args.plannedPickupTime, 5);

  for (const [label, value] of [
    ["登園予定時刻", arrival],
    ["降園予定時刻", departure],
    ["お迎え予定時刻", pickup],
  ] as const) {
    if (!isValidHHMM(value)) {
      throw new Error(`${label}はHH:mm形式で入力してください。`);
    }
  }

  if (planType === "LATE" && !arrival) {
    throw new Error("遅刻予定の場合は登園予定時刻を入力してください。");
  }

  if (planType === "EARLY_DEPARTURE" && !departure && !pickup) {
    throw new Error(
      "早退予定の場合は降園予定時刻またはお迎え予定時刻を入力してください。",
    );
  }

  return { planType, arrival, departure, pickup };
}

export const handler: Schema["submitParentNotebookReply"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as SubmitParentNotebookReplyArgs;
    const replyToken = s(args.replyToken);

    if (!replyToken) {
      throw new Error("連絡帳URLのtokenが空です。");
    }

    const normalized = validateReply(args);

    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
      env as DataClientEnv,
    );
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const tokenHash = sha256Hex(replyToken);
    const tokenRows = await listAll<ParentNotebookAccessTokenRow>(
      dataClient.models.ParentNotebookAccessToken.list,
      { tokenHash: { eq: tokenHash } },
    );

    const token =
      [...tokenRows]
        .sort((left, right) => {
          const versionDiff =
            Number(right.tokenVersion ?? 0) - Number(left.tokenVersion ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return s(right.issuedAt).localeCompare(s(left.issuedAt));
        })
        .find((row) => s(row.status).toUpperCase() === "ACTIVE") ??
      tokenRows[0] ??
      null;

    if (!token) {
      throw new Error(
        "連絡帳URLが見つかりません。園から受け取った最新のURLを確認してください。",
      );
    }

    if (s(token.status).toUpperCase() !== "ACTIVE") {
      throw new Error("この連絡帳URLは現在利用できません。");
    }

    if (isExpired(token.expiresAt)) {
      await dataClient.models.ParentNotebookAccessToken.update({
        id: token.id,
        status: "EXPIRED",
      });
      throw new Error(
        "この連絡帳URLの有効期限が切れています。園へご確認ください。",
      );
    }

    const [entryResult, sheetResult] = await Promise.all([
      dataClient.models.ParentNotebookEntry.get({
        id: s(token.parentNotebookEntryId),
      }),
      dataClient.models.ParentNotebookSheet.get({
        id: s(token.parentNotebookSheetId),
      }),
    ]);

    if (entryResult.errors?.length) {
      throw new Error(
        errorText(entryResult.errors, "児童別連絡帳の取得に失敗しました。"),
      );
    }
    if (sheetResult.errors?.length) {
      throw new Error(
        errorText(sheetResult.errors, "連絡帳ヘッダーの取得に失敗しました。"),
      );
    }

    const entry = (entryResult.data as ParentNotebookEntryRow | null) ?? null;
    const sheet = (sheetResult.data as ParentNotebookSheetRow | null) ?? null;

    if (!entry || !sheet) {
      throw new Error(
        "連絡帳データが見つかりません。園側でURLを再発行してください。",
      );
    }

    validateTokenReferences(token, entry, sheet);

    if (s(sheet.status).toUpperCase() !== "ISSUED") {
      throw new Error(
        s(sheet.status).toUpperCase() === "CLOSED"
          ? "この連絡帳は回答受付を終了しています。"
          : "この連絡帳は現在回答できません。",
      );
    }

    const now = new Date().toISOString();
    const nextRevision = Math.max(0, Number(entry.responseRevision ?? 0)) + 1;
    const absent = normalized.planType === "ABSENT";

    const updateResult = await dataClient.models.ParentNotebookEntry.update({
      id: entry.id,
      responseStatus: "SUBMITTED",
      okSigned: true,

      attendancePlanType: normalized.planType,
      plannedArrivalTime: absent ? null : normalized.arrival || null,
      plannedDepartureTime: absent ? null : normalized.departure || null,

      plannedPickupRelation: absent
        ? null
        : truncate(args.plannedPickupRelation, 40) || null,
      plannedPickupName: absent
        ? null
        : truncate(args.plannedPickupName, 80) || null,
      plannedPickupTime: absent ? null : normalized.pickup || null,

      homeNote: truncate(args.homeNote, 2000) || null,
      parentMessage: truncate(args.parentMessage, 2000) || null,

      submittedAt: now,
      responseRevision: nextRevision,

      // A changed parent response always returns to the nursery's review queue.
      confirmedAt: null,
      confirmedByUserId: null,
      confirmedByName: null,

      userAgent: truncate(args.userAgent, 300) || null,
    });

    if (updateResult.errors?.length) {
      throw new Error(
        errorText(updateResult.errors, "連絡帳回答の保存に失敗しました。"),
      );
    }
    if (!updateResult.data) {
      throw new Error("連絡帳回答の保存結果が空です。");
    }

    return {
      parentNotebookEntryId: entry.id,
      responseStatus: "SUBMITTED",
      responseRevision: nextRevision,
      submittedAt: now,
      status: "SUBMITTED",
      message:
        nextRevision === 1
          ? "連絡帳の回答を受け付けました。"
          : `連絡帳の回答を更新しました（${nextRevision}回目）。`,
    };
  };
