import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];
type JsonObject = Record<string, unknown>;

type GenerateArgs = {
  childWeeklyReportId: string;
};

type SourceEpisode = {
  observationId: string;
  reportDate: string;
  practiceName: string;
  episodeText: string;
  abilityCodes: string[];
};

type SourceAbility = {
  abilityCode: string;
  abilityName: string;
  domain: string;
  category: string;
};

type WeekendPlaySelection = {
  playId: string;
  playTitle: string;
  playType: string;
  setting: string;
  parentHint: string;
  playDescriptionDraft: string;
};

type SourceSnapshot = {
  promptVersion: string;
  childId: string;
  childName: string;
  weekStartDate: string;
  weekEndDate: string;
  episodes: SourceEpisode[];
  abilities: SourceAbility[];
  previousEpisodes: SourceEpisode[];
  newAbilityNames: string[];
  continuingAbilityNames: string[];
  selectedWeekendPlay: WeekendPlaySelection;
};

type GeneratedDraft = {
  title: string;
  weeklyEpisodeText: string;
  growthText: string;
  comparisonText: string;
  weekendPlayText: string;
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonObject(value: unknown): JsonObject | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as JsonObject
      : null;
  } catch {
    return null;
  }
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(s).filter(Boolean) : [];
}

function parseEpisodes(value: unknown): SourceEpisode[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = parseJsonObject(item);
      if (!row) return null;
      return {
        observationId: s(row.observationId),
        reportDate: s(row.reportDate),
        practiceName: s(row.practiceName),
        episodeText: s(row.episodeText),
        abilityCodes: parseStringArray(row.abilityCodes),
      };
    })
    .filter((row): row is SourceEpisode => Boolean(row?.observationId && row.episodeText))
    .slice(0, 5);
}

function parseAbilities(value: unknown): SourceAbility[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = parseJsonObject(item);
      if (!row) return null;
      return {
        abilityCode: s(row.abilityCode),
        abilityName: s(row.abilityName),
        domain: s(row.domain),
        category: s(row.category),
      };
    })
    .filter((row): row is SourceAbility => Boolean(row?.abilityName))
    .slice(0, 5);
}

function parseWeekendPlay(value: unknown): WeekendPlaySelection | null {
  const row = parseJsonObject(value);
  if (!row) return null;
  const parsed = {
    playId: s(row.playId),
    playTitle: s(row.playTitle),
    playType: s(row.playType),
    setting: s(row.setting),
    parentHint: s(row.parentHint),
    playDescriptionDraft: s(row.playDescriptionDraft),
  };
  return parsed.playId && parsed.playTitle ? parsed : null;
}

function parseSourceSnapshot(value: unknown): SourceSnapshot {
  const row = parseJsonObject(value);
  if (!row) throw new Error("sourceSnapshotJson is empty or invalid.");

  const selectedWeekendPlay = parseWeekendPlay(row.selectedWeekendPlay);
  if (!selectedWeekendPlay) {
    throw new Error("選択済み週末遊びが取得できません。");
  }

  const snapshot: SourceSnapshot = {
    promptVersion: s(row.promptVersion) || "child-weekend-letter-v1",
    childId: s(row.childId),
    childName: s(row.childName),
    weekStartDate: s(row.weekStartDate),
    weekEndDate: s(row.weekEndDate),
    episodes: parseEpisodes(row.episodes),
    abilities: parseAbilities(row.abilities),
    previousEpisodes: parseEpisodes(row.previousEpisodes).slice(0, 2),
    newAbilityNames: parseStringArray(row.newAbilityNames).slice(0, 3),
    continuingAbilityNames: parseStringArray(row.continuingAbilityNames).slice(0, 3),
    selectedWeekendPlay,
  };

  if (!snapshot.childName || !snapshot.weekStartDate || !snapshot.weekEndDate) {
    throw new Error("子ども名または対象週が取得できません。");
  }
  if (snapshot.episodes.length === 0) {
    throw new Error("保護者向け文章の根拠となる確認済みエピソードがありません。");
  }

  return snapshot;
}

function buildPrompt(snapshot: SourceSnapshot): string {
  const currentEpisodeLines = snapshot.episodes
    .map((episode, index) => [
      `${index + 1}. 日付=${episode.reportDate}`,
      `活動=${episode.practiceName}`,
      `記録=${episode.episodeText}`,
    ].join(" / "))
    .join("\n");

  const abilityLines = snapshot.abilities.length > 0
    ? snapshot.abilities.map((ability) =>
      `- ${ability.domain} / ${ability.category} / ${ability.abilityName}`,
    ).join("\n")
    : "- 特定の育ちのラベルは使用しない";

  const previousLines = snapshot.previousEpisodes.length > 0
    ? snapshot.previousEpisodes.map((episode, index) => [
      `${index + 1}. 日付=${episode.reportDate}`,
      `活動=${episode.practiceName}`,
      `記録=${episode.episodeText}`,
    ].join(" / ")).join("\n")
    : "比較に使える具体的な過去エピソードはありません。";

  const play = snapshot.selectedWeekendPlay;

  return `
あなたは保育所から保護者へ届ける「週末こどもだより」の下書きを作成する日本語アシスタントです。
確認済みの保育記録だけを使い、温かく具体的で、保護者が園での姿を想像できる文章にしてください。

対象:
- 子ども名: ${snapshot.childName}
- 対象週: ${snapshot.weekStartDate}〜${snapshot.weekEndDate}

今週の確認済みエピソード:
${currentEpisodeLines}

記録から見られた育ちの観点:
${abilityLines}

直前4週間の比較候補:
${previousLines}

今週新たに記録へ現れた育ち:
${snapshot.newAbilityNames.length > 0 ? snapshot.newAbilityNames.join("、") : "なし"}

継続して記録へ現れた育ち:
${snapshot.continuingAbilityNames.length > 0 ? snapshot.continuingAbilityNames.join("、") : "なし"}

選択済み週末遊び:
- 名称: ${play.playTitle}
- 種類: ${play.playType}
- 場所: ${play.setting}
- 内容: ${play.playDescriptionDraft}
- 保護者向けヒント原文: ${play.parentHint}

厳守事項:
- 入力にない出来事、発言、感情、家庭の状況を作らない
- 診断、発達判定、優劣、順位、達成度評価をしない
- 他の子どもとの比較をしない
- Abilityコード、confidence、score、weight、観察件数、グラフ、数値評価を出さない
- 「5領域」「10の姿」という専門分類名をそのまま説明せず、自然な育ちの言葉に置き換える
- 「成長した」「向上した」「以前より」と書くのは、具体的な過去エピソードとの比較根拠がある場合だけ
- 比較根拠が弱い場合、comparisonTextは空文字にする
- 週末遊びは指定された1件だけを使い、新しい遊びを発明しない
- 保護者へ指示・課題を課す口調にせず、「一緒に楽しんでみてはいかがでしょうか」程度の柔らかい提案にする
- 子どもの名前には「さん」を付ける
- markdown記号を使わない
- 出力はJSONのみ

文章量の目安:
- weeklyEpisodeText: 120〜220字
- growthText: 80〜160字
- comparisonText: 0〜120字
- weekendPlayText: 100〜180字

JSON形式:
{
  "title": "今週の${snapshot.childName}さん",
  "weeklyEpisodeText": "...",
  "growthText": "...",
  "comparisonText": "...",
  "weekendPlayText": "..."
}
`.trim();
}

function sanitizeGeneratedText(value: unknown, abilityCodes: string[]): string {
  let text = s(value)
    .replace(/\bconfidence\b/gi, "")
    .replace(/\bscore\b/gi, "")
    .replace(/\bweight\b/gi, "")
    .replace(/AbilityCode/gi, "")
    .replace(/```/g, "")
    .trim();

  for (const code of abilityCodes.filter(Boolean)) {
    text = text.split(code).join("");
  }

  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function parseGeneratedDraft(rawText: string, snapshot: SourceSnapshot): GeneratedDraft {
  const parsed = parseJsonObject(stripCodeFence(rawText));
  if (!parsed) {
    throw new Error(`AI response is not valid JSON: ${rawText}`);
  }

  const abilityCodes = snapshot.abilities.map((ability) => ability.abilityCode);
  const draft: GeneratedDraft = {
    title: sanitizeGeneratedText(parsed.title, abilityCodes),
    weeklyEpisodeText: sanitizeGeneratedText(parsed.weeklyEpisodeText, abilityCodes),
    growthText: sanitizeGeneratedText(parsed.growthText, abilityCodes),
    comparisonText: sanitizeGeneratedText(parsed.comparisonText, abilityCodes),
    weekendPlayText: sanitizeGeneratedText(parsed.weekendPlayText, abilityCodes),
  };

  if (!draft.title || !draft.weeklyEpisodeText || !draft.growthText || !draft.weekendPlayText) {
    throw new Error("AI response does not contain all required letter sections.");
  }

  if (snapshot.previousEpisodes.length === 0) {
    draft.comparisonText = "";
  }

  return draft;
}

function buildParentLetterText(draft: GeneratedDraft): string {
  return [
    draft.title,
    draft.weeklyEpisodeText,
    draft.growthText,
    draft.comparisonText,
    `週末の遊びのヒント\n${draft.weekendPlayText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function invokeClaude(input: {
  modelId: string;
  prompt: string;
  snapshot: SourceSnapshot;
}): Promise<{
  draft: GeneratedDraft;
  inputTokenCount: number;
  outputTokenCount: number;
  rawText: string;
}> {
  const region = process.env.AWS_REGION || "ap-northeast-1";
  const client = new BedrockRuntimeClient({ region });
  const response = await client.send(new InvokeModelCommand({
    modelId: input.modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1800,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: [{ type: "text", text: input.prompt }],
      }],
    }),
  }));

  const rawBody = new TextDecoder("utf-8").decode(response.body);
  const body = JSON.parse(rawBody) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const rawText = s(body.content?.find((item) => item.type === "text")?.text);

  return {
    draft: parseGeneratedDraft(rawText, input.snapshot),
    inputTokenCount: Number(body.usage?.input_tokens ?? 0),
    outputTokenCount: Number(body.usage?.output_tokens ?? 0),
    rawText,
  };
}

export const handler: Schema["generateChildWeekendLetter"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as GenerateArgs;
    const reportId = s(args.childWeeklyReportId);
    if (!reportId) throw new Error("childWeeklyReportId is required.");

    const modelId = process.env.BEDROCK_MODEL_ID
      || "jp.anthropic.claude-sonnet-4-5-20250929-v1:0";
    const generatedAt = new Date().toISOString();

    const { resourceConfig, libraryOptions } =
      await getAmplifyDataClientConfig(process.env as DataClientEnv);
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const reportResult = await dataClient.models.ChildWeeklyReport.get({ id: reportId });
    if (reportResult.errors?.length) {
      throw new Error(reportResult.errors.map((error: { message?: string | null }) => error.message).join("\n"));
    }
    const report = reportResult.data;
    if (!report) throw new Error(`ChildWeeklyReport not found: ${reportId}`);

    try {
      const snapshot = parseSourceSnapshot(report.sourceSnapshotJson);
      const prompt = buildPrompt(snapshot);
      const ai = await invokeClaude({ modelId, prompt, snapshot });
      const parentLetterText = buildParentLetterText(ai.draft);
      const sourceObservationIds = snapshot.episodes.map((episode) => episode.observationId);
      const sourceAbilityCodes = snapshot.abilities.map((ability) => ability.abilityCode);

      const updateResult = await dataClient.models.ChildWeeklyReport.update({
        id: reportId,
        title: ai.draft.title,
        weeklyEpisodeText: ai.draft.weeklyEpisodeText,
        growthText: ai.draft.growthText,
        comparisonText: ai.draft.comparisonText,
        weekendPlayText: ai.draft.weekendPlayText,
        parentLetterText,
        sourceObservationIdsJson: JSON.stringify(sourceObservationIds),
        sourceAbilityCodesJson: JSON.stringify(sourceAbilityCodes),
        aiStatus: "GENERATED",
        aiModel: modelId,
        promptVersion: snapshot.promptVersion,
        inputTokenCount: ai.inputTokenCount,
        outputTokenCount: ai.outputTokenCount,
        generatedAt,
        generationErrorMessage: "",
        aiRawJson: ai.rawText,
        updatedByUserId: "generate-child-weekend-letter",
      });

      if (updateResult.errors?.length) {
        throw new Error(updateResult.errors.map((error: { message?: string | null }) => error.message).join("\n"));
      }

      return {
        childWeeklyReportId: reportId,
        status: "GENERATED",
        title: ai.draft.title,
        weeklyEpisodeText: ai.draft.weeklyEpisodeText,
        growthText: ai.draft.growthText,
        comparisonText: ai.draft.comparisonText,
        weekendPlayText: ai.draft.weekendPlayText,
        parentLetterText,
        aiModel: modelId,
        inputTokenCount: ai.inputTokenCount,
        outputTokenCount: ai.outputTokenCount,
        generatedAt,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await dataClient.models.ChildWeeklyReport.update({
        id: reportId,
        aiStatus: "ERROR",
        aiModel: modelId,
        generatedAt,
        generationErrorMessage: message.slice(0, 4000),
        updatedByUserId: "generate-child-weekend-letter",
      }).catch(() => undefined);
      throw cause;
    }
  };
