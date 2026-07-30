import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/send-parent-notebook-emails";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { createHash, randomUUID } from "node:crypto";

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

type SendParentNotebookEmailsArgs = {
  parentNotebookSheetId?: string | null;
  baseUrl?: string | null;
};

type ParentNotebookSheetRow = Schema["ParentNotebookSheet"]["type"] & {
  id: string;
};

type ParentNotebookEntryRow = Schema["ParentNotebookEntry"]["type"] & {
  id: string;
};

type ParentNotebookAccessTokenRow =
  Schema["ParentNotebookAccessToken"]["type"] & {
    id: string;
  };

type ClassroomRow = Schema["Classroom"]["type"] & {
  id: string;
};

type SendResult = {
  parentNotebookEntryId: string | null;
  childId: string | null;
  childName: string | null;
  email: string | null;
  status: string;
  message: string | null;
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function errorText(
  errors?: Array<{ message?: string | null }> | null,
  fallback = "GraphQL request failed.",
): string {
  const messages = (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean);
  return messages.join("\n") || fallback;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function makeRandomToken(): string {
  return `${randomUUID()}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizeBaseUrl(value: unknown): string {
  const text = s(value);
  if (!text) {
    throw new Error(
      "保護者連絡帳URLの基準URLがありません。画面を再読み込みしてから送信してください。",
    );
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("保護者連絡帳URLの基準URLが正しくありません。");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("保護者連絡帳URLはhttpまたはhttpsで指定してください。");
  }

  return url.origin.replace(/\/+$/, "");
}

function buildReplyUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/parent-notebook/reply?token=${encodeURIComponent(token)}`;
}

function classroomLabel(row: ClassroomRow | null): string {
  if (!row) return "";
  return s(row.name) || s(row.id);
}

function buildSubject(args: {
  targetDate: string;
  classroomName: string;
}): string {
  const classroom = args.classroomName ? ` ${args.classroomName}` : "";
  return `【保育360】${args.targetDate}${classroom} 保護者連絡帳`;
}

function buildEmailBody(args: {
  childName: string;
  noticeText: string;
  replyUrl: string;
}): string {
  return `${args.childName}さん 保護者様

${args.noticeText.trim()}

【連絡帳への回答はこちら】
登園予定、お迎え予定、ご家庭での様子は、次のURLから入力してください。
${args.replyUrl}

※このURLは${args.childName}さん専用です。他の方へ転送しないでください。
※回答内容を変更する場合も、同じURLから再度送信できます。
※本メールは保育360から送信しています。`;
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

function tokenIdFor(entryId: string): string {
  return `parent-notebook-token-${entryId}`;
}

async function issueAccessToken(args: {
  dataClient: ReturnType<typeof generateClient<Schema>>;
  sheet: ParentNotebookSheetRow;
  entry: ParentNotebookEntryRow;
  issuedByUserId: string;
}): Promise<{ plainToken: string; tokenRowId: string }> {
  const { dataClient, sheet, entry, issuedByUserId } = args;
  const tokenRowId = tokenIdFor(entry.id);
  const existingResult = await dataClient.models.ParentNotebookAccessToken.get({
    id: tokenRowId,
  });

  if (existingResult.errors?.length) {
    throw new Error(
      errorText(existingResult.errors, "連絡帳トークンの確認に失敗しました。"),
    );
  }

  const existing =
    (existingResult.data as ParentNotebookAccessTokenRow | null) ?? null;
  const plainToken = makeRandomToken();
  const now = new Date().toISOString();
  const tokenVersion = Math.max(0, Number(existing?.tokenVersion ?? 0)) + 1;
  const expiresDays = Math.max(
    1,
    Number(process.env.PARENT_NOTEBOOK_TOKEN_EXPIRES_DAYS || 14),
  );

  const input = {
    id: tokenRowId,
    tenantId: s(entry.tenantId),
    parentNotebookSheetId: sheet.id,
    parentNotebookEntryId: entry.id,
    classroomId: s(entry.classroomId),
    childId: s(entry.childId),
    targetDate: s(entry.targetDate),
    tokenHash: sha256Hex(plainToken),
    tokenVersion,
    status: "ACTIVE",
    issuedAt: now,
    expiresAt: addDaysIso(expiresDays),
    issuedByUserId: issuedByUserId || null,
    revokedAt: null,
    revokedByUserId: null,
    memo: `保護者連絡帳メール送信用トークン v${tokenVersion}`,
  };

  const result = existing
    ? await dataClient.models.ParentNotebookAccessToken.update(input)
    : await dataClient.models.ParentNotebookAccessToken.create(input);

  if (!result.data) {
    throw new Error(
      errorText(result.errors, "連絡帳トークンの発行に失敗しました。"),
    );
  }

  return { plainToken, tokenRowId };
}

async function revokeToken(args: {
  dataClient: ReturnType<typeof generateClient<Schema>>;
  tokenRowId: string;
  userId: string;
}) {
  if (!args.tokenRowId) return;

  await args.dataClient.models.ParentNotebookAccessToken.update({
    id: args.tokenRowId,
    status: "REVOKED",
    revokedAt: new Date().toISOString(),
    revokedByUserId: args.userId || null,
  });
}

export const handler: Schema["sendParentNotebookEmails"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as SendParentNotebookEmailsArgs;
    const parentNotebookSheetId = s(args.parentNotebookSheetId);

    if (!parentNotebookSheetId) {
      throw new Error("parentNotebookSheetIdが空です。");
    }

    const configuredBaseUrl = s(process.env.PARENT_NOTEBOOK_BASE_URL);
    const baseUrl = normalizeBaseUrl(configuredBaseUrl || args.baseUrl);

    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
      env as DataClientEnv,
    );
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const sheetResult = await dataClient.models.ParentNotebookSheet.get({
      id: parentNotebookSheetId,
    });

    if (sheetResult.errors?.length) {
      throw new Error(
        errorText(sheetResult.errors, "連絡帳Sheetの取得に失敗しました。"),
      );
    }

    const sheet = (sheetResult.data as ParentNotebookSheetRow | null) ?? null;
    if (!sheet) {
      throw new Error("連絡帳Sheetが見つかりません。");
    }

    if (s(sheet.status).toUpperCase() !== "ISSUED") {
      throw new Error("発行済みの連絡帳だけメール送信できます。");
    }

    const tenantId = s(sheet.tenantId);
    const classroomId = s(sheet.classroomId);
    const targetDate = s(sheet.targetDate);
    const noticeText = s(sheet.noticeText) || s(sheet.noticeDraftText);
    const issuedByUserId = s(sheet.issuedByUserId);

    if (!tenantId || !classroomId || !targetDate || !noticeText) {
      throw new Error(
        "連絡帳SheetのtenantId / classroomId / targetDate / noticeTextのいずれかが空です。",
      );
    }

    const [entries, classroomResult] = await Promise.all([
      listAll<ParentNotebookEntryRow>(
        dataClient.models.ParentNotebookEntry.list,
        {
          tenantId: { eq: tenantId },
          parentNotebookSheetId: { eq: parentNotebookSheetId },
        },
      ),
      dataClient.models.Classroom.get({ id: classroomId }),
    ]);

    if (classroomResult.errors?.length) {
      throw new Error(
        errorText(classroomResult.errors, "クラスの取得に失敗しました。"),
      );
    }

    const classroom = (classroomResult.data as ClassroomRow | null) ?? null;
    const subject = buildSubject({
      targetDate,
      classroomName: classroomLabel(classroom),
    });

    const region = process.env.AWS_REGION || "ap-northeast-1";
    const ses = new SESv2Client({ region });
    const fromEmail =
      s(process.env.PARENT_NOTEBOOK_FROM_EMAIL) || "demo@hoiku360.jp";

    const sortedEntries = [...entries].sort((left, right) => {
      const sortDiff = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return s(left.childName).localeCompare(s(right.childName), "ja");
    });

    const results: SendResult[] = [];

    for (const entry of sortedEntries) {
      const childId = s(entry.childId);
      const childName = s(entry.childName);
      const email = s(entry.guardianEmailSnapshot);
      const deliveryStatus = s(entry.deliveryStatus).toUpperCase();
      const responseStatus = s(entry.responseStatus).toUpperCase();

      if (!email) {
        await dataClient.models.ParentNotebookEntry.update({
          id: entry.id,
          deliveryStatus: "SKIPPED",
          sendErrorMessage: "保護者メールアドレスが登録されていません。",
        });

        results.push({
          parentNotebookEntryId: entry.id,
          childId: childId || null,
          childName: childName || null,
          email: null,
          status: "SKIPPED_NO_EMAIL",
          message: "保護者メールアドレスが登録されていません。",
        });
        continue;
      }

      if (deliveryStatus === "SENT") {
        results.push({
          parentNotebookEntryId: entry.id,
          childId: childId || null,
          childName: childName || null,
          email,
          status: "SKIPPED_ALREADY_SENT",
          message: "すでに送信済みです。",
        });
        continue;
      }

      if (responseStatus === "SUBMITTED" || responseStatus === "CONFIRMED") {
        results.push({
          parentNotebookEntryId: entry.id,
          childId: childId || null,
          childName: childName || null,
          email,
          status: "SKIPPED_ALREADY_REPLIED",
          message: "すでに保護者回答があります。",
        });
        continue;
      }

      let tokenRowId = "";

      try {
        await dataClient.models.ParentNotebookEntry.update({
          id: entry.id,
          deliveryStatus: "PENDING",
          sendErrorMessage: null,
        });

        const token = await issueAccessToken({
          dataClient,
          sheet,
          entry,
          issuedByUserId,
        });
        tokenRowId = token.tokenRowId;

        const replyUrl = buildReplyUrl(baseUrl, token.plainToken);
        const sendResult = await ses.send(
          new SendEmailCommand({
            FromEmailAddress: fromEmail,
            Destination: {
              ToAddresses: [email],
            },
            Content: {
              Simple: {
                Subject: {
                  Data: subject,
                  Charset: "UTF-8",
                },
                Body: {
                  Text: {
                    Data: buildEmailBody({ childName, noticeText, replyUrl }),
                    Charset: "UTF-8",
                  },
                },
              },
            },
          }),
        );

        const sentAt = new Date().toISOString();
        const messageId = s(sendResult.MessageId);

        const updateResult = await dataClient.models.ParentNotebookEntry.update({
          id: entry.id,
          deliveryStatus: "SENT",
          sentAt,
          emailMessageId: messageId || null,
          sendErrorMessage: null,
        });

        if (!updateResult.data) {
          throw new Error(
            errorText(updateResult.errors, "メール送信結果の保存に失敗しました。"),
          );
        }

        results.push({
          parentNotebookEntryId: entry.id,
          childId: childId || null,
          childName: childName || null,
          email,
          status: "SENT",
          message: messageId ? `SES MessageId=${messageId}` : "送信しました。",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "送信失敗");

        await revokeToken({
          dataClient,
          tokenRowId,
          userId: issuedByUserId,
        });

        await dataClient.models.ParentNotebookEntry.update({
          id: entry.id,
          deliveryStatus: "FAILED",
          sendErrorMessage: message.slice(0, 1000),
        });

        results.push({
          parentNotebookEntryId: entry.id,
          childId: childId || null,
          childName: childName || null,
          email,
          status: "FAILED",
          message,
        });
      }
    }

    const sentCount = results.filter((row) => row.status === "SENT").length;
    const failedCount = results.filter((row) => row.status === "FAILED").length;
    const skippedCount = results.length - sentCount - failedCount;
    const status =
      failedCount > 0
        ? sentCount > 0
          ? "PARTIAL"
          : "FAILED"
        : sentCount > 0
          ? "SENT"
          : "SKIPPED";

    return {
      parentNotebookSheetId,
      sentCount,
      failedCount,
      skippedCount,
      status,
      message: `保護者連絡帳メール処理が完了しました。送信=${sentCount}件 / 失敗=${failedCount}件 / スキップ=${skippedCount}件`,
      results,
    };
  };
