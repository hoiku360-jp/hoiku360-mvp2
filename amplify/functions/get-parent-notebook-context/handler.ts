import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/get-parent-notebook-context";
import { createHash } from "node:crypto";

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

type GetParentNotebookContextArgs = {
  replyToken?: string | null;
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

function s(value: unknown): string {
  return String(value ?? "").trim();
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

export const handler: Schema["getParentNotebookContext"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as GetParentNotebookContextArgs;
    const replyToken = s(args.replyToken);

    if (!replyToken) {
      throw new Error("連絡帳URLのtokenが空です。");
    }

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

    const sheetStatus = s(sheet.status).toUpperCase();
    if (sheetStatus === "ARCHIVED") {
      throw new Error("この連絡帳はアーカイブされているため閲覧できません。");
    }
    if (sheetStatus === "DRAFT") {
      throw new Error("この連絡帳はまだ発行されていません。");
    }

    const responseStatus = s(entry.responseStatus) || "NOT_SUBMITTED";
    const contextStatus = sheetStatus === "CLOSED" ? "CLOSED" : "OK";

    return {
      parentNotebookSheetId: sheet.id,
      parentNotebookEntryId: entry.id,
      classroomId: s(entry.classroomId) || null,
      childId: s(entry.childId) || null,
      childName: s(entry.childName) || null,
      targetDate: s(entry.targetDate) || null,
      noticeText: s(sheet.noticeText) || s(sheet.noticeDraftText) || null,

      responseStatus,
      attendancePlanType: s(entry.attendancePlanType) || null,
      plannedArrivalTime: s(entry.plannedArrivalTime) || null,
      plannedDepartureTime: s(entry.plannedDepartureTime) || null,
      plannedPickupRelation: s(entry.plannedPickupRelation) || null,
      plannedPickupName: s(entry.plannedPickupName) || null,
      plannedPickupTime: s(entry.plannedPickupTime) || null,
      homeNote: s(entry.homeNote) || null,
      parentMessage: s(entry.parentMessage) || null,
      submittedAt: s(entry.submittedAt) || null,
      responseRevision: Number(entry.responseRevision ?? 0),

      status: contextStatus,
      message:
        contextStatus === "CLOSED"
          ? `${entry.childName}さんの連絡帳は回答受付を終了しています。`
          : responseStatus === "NOT_SUBMITTED"
            ? `${entry.childName}さんの連絡帳を開きました。`
            : `${entry.childName}さんの送信済み回答を読み込みました。内容を変更して再送信できます。`,
    };
  };
