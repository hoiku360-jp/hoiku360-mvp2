import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/generate-parent-notebook-notice";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];
type JsonObject = Record<string, unknown>;

type GenerateArgs = {
  parentNotebookSheetId?: string | null;
  manualNote?: string | null;
};

type SheetRow = Schema["ParentNotebookSheet"]["type"] & {
  id: string;
  tenantId?: string | null;
  fiscalYear?: number | null;
  classroomId?: string | null;
  targetDate?: string | null;
  status?: string | null;
  noticeDraftText?: string | null;
  updatedByUserId?: string | null;
};

type EntryRow = Schema["ParentNotebookEntry"]["type"] & {
  deliveryStatus?: string | null;
  responseStatus?: string | null;
};

type PlanRow = Schema["PlanDocument"]["type"] & {
  id: string;
  tenantId?: string | null;
  classroomId?: string | null;
  planKind?: string | null;
  status?: string | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  title?: string | null;
  contentJson?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

type ClassroomRow = Schema["Classroom"]["type"] & {
  id: string;
  name?: string | null;
  ageLabel?: string | null;
};

type CognitoIdentity = {
  sub?: string;
  username?: string;
  claims?: Record<string, unknown>;
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n…(truncated)…`;
}

function errorText(errors?: Array<{ message?: string | null }> | null): string {
  return (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean)
    .join("\n");
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJson(value: string): JsonObject | null {
  try {
    return JSON.parse(stripCodeFence(value)) as JsonObject;
  } catch {
    return null;
  }
}

function prettyContentJson(value?: string | null): string {
  const text = s(value);
  if (!text) return "（日案内容なし）";

  try {
    return truncate(JSON.stringify(JSON.parse(text), null, 2), 12000);
  } catch {
    return truncate(text, 12000);
  }
}

function formatJapaneseMonthDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  return `${Number(match[2])}月${Number(match[3])}日`;
}

function normalizeNoticeDateExpression(
  value: string,
  targetDateLabel: string,
): string {
  let text = s(value);
  if (!text) return text;

  const replacements: Array<[RegExp, string]> = [
    [/本日は/g, `${targetDateLabel}は`],
    [/本日/g, targetDateLabel],
    [/今日は/g, `${targetDateLabel}は`],
    [/今日/g, targetDateLabel],
    [/明日は/g, `${targetDateLabel}は`],
    [/明日/g, targetDateLabel],
    [/翌日は/g, `${targetDateLabel}は`],
    [/翌日/g, targetDateLabel],
    [/当日は/g, `${targetDateLabel}は`],
    [/当日/g, targetDateLabel],
    [/対象日は/g, `${targetDateLabel}は`],
    [/対象日/g, targetDateLabel],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  const requiredPrefix = `${targetDateLabel}は、`;
  const startsWithTargetDate = new RegExp(
    `^${targetDateLabel}は[、,]?\\s*`,
  );

  if (startsWithTargetDate.test(text)) {
    return text.replace(startsWithTargetDate, requiredPrefix);
  }

  return `${requiredPrefix}${text}`;
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
  filter?: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  let nextToken: string | null | undefined = null;

  do {
    const result = await listFn({
      limit: 1000,
      nextToken,
      ...(filter ? { filter } : {}),
    });

    if (result.errors?.length) {
      throw new Error(errorText(result.errors));
    }

    rows.push(...(result.data ?? []));
    nextToken = result.nextToken ?? null;
  } while (nextToken);

  return rows;
}

function selectDailyPlan(rows: PlanRow[]): PlanRow | null {
  const statusRank = (status?: string | null) => {
    switch (s(status).toUpperCase()) {
      case "CONFIRMED":
        return 3;
      case "DRAFT":
        return 2;
      case "ARCHIVED":
        return 0;
      default:
        return 1;
    }
  };

  return [...rows]
    .filter((row) => s(row.status).toUpperCase() !== "ARCHIVED")
    .sort((left, right) => {
      const statusDiff = statusRank(right.status) - statusRank(left.status);
      if (statusDiff !== 0) return statusDiff;

      const updatedDiff = s(right.updatedAt).localeCompare(s(left.updatedAt));
      if (updatedDiff !== 0) return updatedDiff;
      return s(right.createdAt).localeCompare(s(left.createdAt));
    })[0] ?? null;
}

function buildPrompt(args: {
  targetDate: string;
  classroomName: string;
  ageLabel: string;
  dailyPlan: PlanRow | null;
  currentDraft: string;
  manualNote: string;
}): string {
  const {
    targetDate,
    classroomName,
    ageLabel,
    dailyPlan,
    currentDraft,
    manualNote,
  } = args;
  const targetDateLabel = formatJapaneseMonthDay(targetDate);

  return `
あなたは保育園の担任が、保護者連絡帳に掲載する「園からの連絡」を作る支援者です。
以下の日案と補足をもとに、保護者へ送る短い日本語の下書きを作ってください。

重要なルール:
- 対象日にこれから実施する予定を伝える文章にする
- 本文は必ず「${targetDateLabel}は、」から書き始める
- 「本日」「今日」「明日」「翌日」「当日」「対象日」などの相対的な日付表現は一切使わない
- 入力文や現在の下書きに相対的な日付表現があっても、必ず「${targetDateLabel}」へ置き換える
- 「行いました」「楽しみました」など実施済みの過去形を使わない
- 「予定しています」「行います」「ご用意ください」など未来形・予定形にする
- 丁寧な敬体（です・ます）にする
- 2〜5文程度で、長くしすぎない
- 入力にない持ち物、服装、時刻、行事を創作しない
- 個別児童の評価、氏名、家庭情報を書かない
- 日案の内部用コードやJSON構造を本文に出さない
- 現在の下書きがある場合は、内容を尊重しながら自然に整える
- 補足に「必ず含める」とある事項は、入力事実の範囲で反映する
- 出力はJSONのみとし、次の形式を厳守する
{"draftText":"..."}

対象日: ${targetDate}（本文表記: ${targetDateLabel}）
クラス: ${classroomName || "（名称未設定）"}
年齢表示: ${ageLabel || "（未設定）"}

日案タイトル:
${s(dailyPlan?.title) || "（対象日の日案なし）"}

日案内容:
${prettyContentJson(dailyPlan?.contentJson)}

現在の下書き:
${currentDraft || "（なし）"}

AI生成用の補足:
${manualNote || "（なし）"}
`.trim();
}

async function invokeHaiku(
  modelId: string,
  prompt: string,
): Promise<{ draftText: string; rawText: string }> {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "ap-northeast-1",
  });

  const response = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 900,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        ],
      }),
    }),
  );

  const rawBody = new TextDecoder("utf-8").decode(response.body);
  const body = JSON.parse(rawBody) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const rawText = s(body.content?.find((item) => item.type === "text")?.text);
  const parsed = parseJson(rawText);
  const draftText = s(parsed?.draftText);

  if (!draftText) {
    throw new Error(`AI応答にdraftTextがありません: ${truncate(rawText, 1000)}`);
  }

  return { draftText, rawText };
}

export const handler: Schema["generateParentNotebookNotice"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as GenerateArgs;
    const parentNotebookSheetId = s(args.parentNotebookSheetId);
    const manualNote = truncate(s(args.manualNote), 3000);

    if (!parentNotebookSheetId) {
      throw new Error("parentNotebookSheetIdが空です。");
    }

    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(
      env as DataClientEnv,
    );
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const sheetResult = await dataClient.models.ParentNotebookSheet.get({
      id: parentNotebookSheetId,
    });
    if (sheetResult.errors?.length) {
      throw new Error(errorText(sheetResult.errors));
    }

    const sheet = (sheetResult.data as SheetRow | null) ?? null;
    if (!sheet) {
      throw new Error("保護者連絡帳Sheetが見つかりません。");
    }

    const sheetStatus = s(sheet.status).toUpperCase();
    if (["CLOSED", "ARCHIVED"].includes(sheetStatus)) {
      throw new Error("締切済みまたはアーカイブ済みの連絡帳ではAI生成できません。");
    }

    const entries = await listAll<EntryRow>(
      dataClient.models.ParentNotebookEntry.list,
      { parentNotebookSheetId: { eq: parentNotebookSheetId } },
    );
    const lockedEntries = entries.filter((entry) => {
      const delivery = s(entry.deliveryStatus).toUpperCase();
      const response = s(entry.responseStatus).toUpperCase();
      return delivery === "SENT" || ["SUBMITTED", "CONFIRMED"].includes(response);
    });
    if (lockedEntries.length > 0) {
      throw new Error(
        "送信済みまたは回答済みの児童がいるため、AIで連絡文を書き換えることはできません。",
      );
    }

    const tenantId = s(sheet.tenantId);
    const classroomId = s(sheet.classroomId);
    const targetDate = s(sheet.targetDate);
    if (!tenantId || !classroomId || !targetDate) {
      throw new Error("SheetのtenantId、classroomId、targetDateが不足しています。");
    }

    const [classroomResult, planRows] = await Promise.all([
      dataClient.models.Classroom.get({ id: classroomId }),
      listAll<PlanRow>(dataClient.models.PlanDocument.list, {
        tenantId: { eq: tenantId },
        classroomId: { eq: classroomId },
        planKind: { eq: "DAILY" },
        periodStartDate: { eq: targetDate },
      }),
    ]);

    if (classroomResult.errors?.length) {
      throw new Error(errorText(classroomResult.errors));
    }

    const classroom = (classroomResult.data as ClassroomRow | null) ?? null;
    const dailyPlan = selectDailyPlan(planRows);
    const currentDraft = truncate(s(sheet.noticeDraftText), 4000);

    if (!dailyPlan && !manualNote && !currentDraft) {
      throw new Error(
        "対象日の日案が見つかりません。AI生成用の補足を入力してから再実行してください。",
      );
    }

    const modelId =
      process.env.BEDROCK_MODEL_ID ||
      "jp.anthropic.claude-haiku-4-5-20251001-v1:0";
    const generatedAt = new Date().toISOString();
    const prompt = buildPrompt({
      targetDate,
      classroomName: s(classroom?.name),
      ageLabel: s(classroom?.ageLabel),
      dailyPlan,
      currentDraft,
      manualNote,
    });
    const ai = await invokeHaiku(modelId, prompt);
    const targetDateLabel = formatJapaneseMonthDay(targetDate);
    const normalizedDraftText = normalizeNoticeDateExpression(
      ai.draftText,
      targetDateLabel,
    );

    const sourceSnapshot = {
      sourceVersion: 2,
      parentNotebookSheetId,
      tenantId,
      classroomId,
      targetDate,
      dailyPlanId: s(dailyPlan?.id) || null,
      dailyPlanStatus: s(dailyPlan?.status) || null,
      dailyPlanTitle: s(dailyPlan?.title) || null,
      dailyPlanContentJson: s(dailyPlan?.contentJson) || null,
      currentDraft: currentDraft || null,
      manualNote: manualNote || null,
      generatedAt,
    };
    const noticeSource = {
      sourceVersion: 2,
      aiModel: modelId,
      generatedAt,
      sourceDailyPlanId: s(dailyPlan?.id) || null,
      manualNote: manualNote || null,
      targetDateLabel,
      rawResponse: truncate(ai.rawText, 4000),
    };

    const identity = event.identity as CognitoIdentity | null | undefined;
    const actorUserId =
      s(identity?.sub) ||
      s(identity?.claims?.sub) ||
      s(sheet.updatedByUserId) ||
      null;

    const updateResult = await dataClient.models.ParentNotebookSheet.update({
      id: parentNotebookSheetId,
      sourceDailyPlanId: s(dailyPlan?.id) || null,
      sourceSnapshotJson: JSON.stringify(sourceSnapshot),
      noticeDraftText: normalizedDraftText,
      noticeSourceJson: JSON.stringify(noticeSource),
      generatedAt,
      updatedByUserId: actorUserId,
    });

    if (!updateResult.data) {
      throw new Error(
        errorText(updateResult.errors) || "AI生成結果の保存に失敗しました。",
      );
    }

    return {
      parentNotebookSheetId,
      sourceDailyPlanId: s(dailyPlan?.id) || null,
      draftText: normalizedDraftText,
      sourceJson: JSON.stringify(noticeSource),
      status: "DRAFT",
      aiModel: modelId,
      generatedAt,
      message: dailyPlan
        ? "対象日の日案をもとに、Claude Haikuで園からの連絡文を生成しました。内容を確認して下書き保存または発行してください。"
        : "AI生成用の補足と現在の下書きをもとに、Claude Haikuで園からの連絡文を生成しました。内容を確認してください。",
    };
  };
