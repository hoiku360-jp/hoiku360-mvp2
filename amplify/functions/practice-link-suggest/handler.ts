import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

type JsonObject = Record<string, unknown>;
type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

type PracticeSuggestArgs = {
  practiceId: string;
};

type PracticeCodeRow = Schema["PracticeCode"]["type"] & {
  practiceCategory?: string | null;
  practice_code?: string | null;
  tenantId?: string | null;
  visibility?: string | null;
  publishScope?: string | null;
  version?: number | null;
};

type AbilityCodeRow = Schema["AbilityCode"]["type"] & {
  parent_code?: string | null;
  status?: string | null;
  level?: number | null;
  is_leaf?: boolean | null;
};

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function safeJsonParse(text: string): JsonObject | null {
  try {
    return JSON.parse(stripCodeFence(text)) as JsonObject;
  } catch {
    return null;
  }
}

function truncateText(text: string, max = 12000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…(truncated)…";
}

function buildAbilityLabelMap(codes: AbilityCodeRow[]): Record<string, string> {
  const byCode = new Map<string, AbilityCodeRow>();
  for (const c of codes) {
    byCode.set(String(c.code), c);
  }

  const out: Record<string, string> = {};

  for (const c of codes) {
    const code = String(c.code);
    const names: string[] = [];
    let cur: AbilityCodeRow | undefined = c;

    while (cur) {
      names.unshift(s(cur.name));
      const parentCode = s(cur.parent_code);
      if (!parentCode) break;
      cur = byCode.get(parentCode);
    }

    out[code] = names.filter(Boolean).join(" > ");
  }

  return out;
}

function buildPrompt(input: {
  practiceName: string;
  practiceMemo: string;
  practiceCategory: string;
  abilities: Array<{
    code: string;
    label: string;
    level: number;
    is_leaf: boolean;
  }>;
}) {
  const abilityLines = input.abilities
    .map(
      (a) =>
        `- code=${a.code} / level=${a.level} / is_leaf=${a.is_leaf} / label=${a.label}`,
    )
    .join("\n");

  return `
あなたは保育実践と「幼児期の教育で育みたい資質・能力」の対応付けを支援する日本語アシスタントです。

入力として、整理済みの Practice 情報と、AbilityCode 一覧が与えられます。
あなたの仕事は、この Practice に関係が強い AbilityCode を最大5件選び、
各候補について score と reason を返すことです。

入力Practice:
- name: ${input.practiceName}
- memo: ${input.practiceMemo}
- category: ${input.practiceCategory}

AbilityCode一覧:
${abilityLines}

要件:
- transcript は見ず、name / memo / category だけを根拠にする
- 候補は最大5件
- できるだけ具体的で妥当な code を選ぶ
- score は 1 / 2 / 3 のいずれか
- reason は日本語で簡潔に書く
- 事実を過剰に補わない
- 出力は JSON のみ
- JSON 形式は必ず次の通り

{
  "suggestions": [
    {
      "abilityCode": "xxxx",
      "score": 3,
      "reason": "..."
    }
  ]
}
`.trim();
}

async function invokeBedrockJson(
  modelId: string,
  prompt: string,
): Promise<{
  suggestions: Array<{
    abilityCode: string;
    score: number;
    reason: string;
  }>;
  rawText: string;
}> {
  const region = process.env.AWS_REGION || "ap-northeast-1";
  const client = new BedrockRuntimeClient({ region });

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1500,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    }),
  });

  const response = await client.send(command);
  const rawBody = new TextDecoder("utf-8").decode(response.body);
  const json = JSON.parse(rawBody) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const rawText = s(json.content?.find((x) => x?.type === "text")?.text ?? "");

  const parsed = safeJsonParse(rawText);
  if (!parsed) {
    throw new Error(`AI response is not valid JSON: ${rawText}`);
  }

  const suggestionsRaw = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
    : [];

  const suggestions = suggestionsRaw
    .map((x) => {
      const item = x as Record<string, unknown>;
      return {
        abilityCode: s(item.abilityCode),
        score: Number(item.score ?? 0),
        reason: s(item.reason),
      };
    })
    .filter((x) => x.abilityCode && [1, 2, 3].includes(x.score) && x.reason)
    .slice(0, 5);

  return { suggestions, rawText };
}

export const handler: Schema["suggestPracticeLinks"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as PracticeSuggestArgs;
    const practiceId = args.practiceId;
    const modelId =
      process.env.BEDROCK_MODEL_ID ||
      "anthropic.claude-3-5-sonnet-20240620-v1:0";

    const { resourceConfig, libraryOptions } =
      await getAmplifyDataClientConfig(process.env as DataClientEnv);
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const getPractice = await dataClient.models.PracticeCode.get({
      id: practiceId,
    });

    if (getPractice.errors?.length) {
      throw new Error(
        `PracticeCode get failed: ${getPractice.errors.map((e) => e.message).join("\n")}`,
      );
    }

    const practice = (getPractice.data as PracticeCodeRow | null) ?? null;
    if (!practice) {
      throw new Error(`PracticeCode not found: ${practiceId}`);
    }

    const practiceName = s(practice.name);
    const practiceMemo = truncateText(s(practice.memo));
    const practiceCategory = s(practice.practiceCategory);
    const practiceCode = s(practice.practice_code);
    const tenantId = s(practice.tenantId);

    if (!practiceName || !practiceMemo) {
      throw new Error(
        "name または memo が空のため Ability 候補生成できません。",
      );
    }

    const abilityResult = await dataClient.models.AbilityCode.list({
      limit: 10000,
    });

    if (abilityResult.errors?.length) {
      throw new Error(
        `AbilityCode list failed: ${abilityResult.errors.map((e) => e.message).join("\n")}`,
      );
    }

    const abilityCodes = (
      (abilityResult.data ?? []) as AbilityCodeRow[]
    ).filter((x) => {
      const status = s(x.status || "active").toLowerCase();
      return status === "active";
    });

    const labelMap = buildAbilityLabelMap(abilityCodes);

    const abilityInput = abilityCodes.map((x) => ({
      code: s(x.code),
      label: labelMap[String(x.code)] ?? s(x.name),
      level: Number(x.level ?? 0),
      is_leaf: Boolean(x.is_leaf),
    }));

    const prompt = buildPrompt({
      practiceName,
      practiceMemo,
      practiceCategory,
      abilities: abilityInput,
    });

    const ai = await invokeBedrockJson(modelId, prompt);

    const oldSuggestions = await dataClient.models.PracticeLinkSuggestion.list({
      filter: {
        practiceCode: { eq: practiceCode },
      },
      limit: 1000,
    });

    if (oldSuggestions.errors?.length) {
      throw new Error(
        `PracticeLinkSuggestion list failed: ${oldSuggestions.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    for (const oldRow of oldSuggestions.data ?? []) {
      const deleted = await dataClient.models.PracticeLinkSuggestion.delete({
        id: oldRow.id,
      });

      if (deleted.errors?.length) {
        throw new Error(
          `PracticeLinkSuggestion delete failed: ${deleted.errors
            .map((e) => e.message)
            .join("\n")}`,
        );
      }
    }

    let createdCount = 0;

    for (let i = 0; i < ai.suggestions.length; i += 1) {
      const sug = ai.suggestions[i];

      const createResult =
        await dataClient.models.PracticeLinkSuggestion.create({
          tenantId,
          practiceCode,
          abilityCode: sug.abilityCode,
          score: sug.score,
          reason: sug.reason,
          status: "suggested",
          sortOrder: i + 1,
          createdBy: "suggest-practice-links",
          updatedBy: "suggest-practice-links",
        });

      if (createResult.errors?.length) {
        throw new Error(
          `PracticeLinkSuggestion create failed: ${createResult.errors
            .map((e) => e.message)
            .join("\n")}`,
        );
      }

      createdCount += 1;
    }

    const practiceUpdate = await dataClient.models.PracticeCode.update({
      id: practice.id,
      aiModel: modelId,
      aiRawJson: ai.rawText,
      updatedBy: "suggest-practice-links",
    });

    if (practiceUpdate.errors?.length) {
      throw new Error(
        `PracticeCode update failed: ${practiceUpdate.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    return {
      practiceId: practice.id,
      practiceCode,
      suggestionCount: createdCount,
      status: "SUGGESTED",
      aiModel: modelId,
    };
  };
