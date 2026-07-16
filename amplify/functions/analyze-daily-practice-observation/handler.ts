import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

type JsonObject = Record<string, unknown>;
type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

type AnalyzeArgs = {
  dailyPracticeRecordId: string;
  cleanedTranscriptText: string;
};

type DailyPracticeRecordRow = Schema["DailyPracticeRecord"]["type"];
type DailyReportRow = Schema["DailyReport"]["type"];
type PlanDocumentRow = Schema["PlanDocument"]["type"];
type ChildEnrollmentRow = Schema["ChildClassroomEnrollment"]["type"];
type ChildRow = Schema["Child"]["type"];
type AbilityCodeRow = Schema["AbilityCode"]["type"];

type ChildRosterRow = {
  childId: string;
  childName: string;
};

type ObservationHintAbilityCandidate = {
  abilityCode: string;
  abilityName: string;
  postureCode: string;
  postureName: string;
  score: number;
  observationExamples: string[];
};

type AbilityCandidate = {
  abilityCode: string;
  confidence: number;
  evidenceText: string;
  reason: string;
};

type ChildEpisode = {
  childId: string;
  childName: string;
  episodeText: string;
  abilityCandidates: AbilityCandidate[];
};

type AnalysisResult = {
  cleanedOverallText: string;
  childEpisodes: ChildEpisode[];
  rawText: string;
};

function s(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    const parsed = JSON.parse(stripCodeFence(text));
    return typeof parsed === "object" && parsed !== null
      ? parsed as JsonObject
      : null;
  } catch {
    return null;
  }
}

function parseJsonRecord(value: unknown): JsonObject | null {
  const text = s(value);
  if (!text) return null;
  return safeJsonParse(text);
}

function extractResponseText(response: unknown): string {
  const parts =
    (
      response as {
        output?: {
          message?: {
            content?: Array<{ text?: string }>;
          };
        };
      }
    )?.output?.message?.content ?? [];

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function truncateText(text: string, max = 18000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…(truncated)…`;
}

function clampConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, Math.round(parsed * 1000) / 1000));
}

function normalizeObservationMatchText(value: unknown): string {
  return s(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/もう一回/gu, "もう1回")
    .replace(/[\s\u3000「」『』（）()【】［］\[\]、。！？!?・,:：;；…‥]/gu, "");
}

function observationExampleFragments(value: unknown): string[] {
  const text = s(value).normalize("NFKC");
  if (!text) return [];

  const quoted = Array.from(text.matchAll(/[「『]([^」』]+)[」』]/gu))
    .map((match) => s(match[1]))
    .filter(Boolean);
  const segments = text
    .split(/[\n、。！？!?・,:：;；／/]|[「」『』（）()【】［］\[\]]/gu)
    .map((item) => s(item))
    .filter(Boolean);

  return Array.from(new Set([text, ...quoted, ...segments]))
    .filter((item) => normalizeObservationMatchText(item).length >= 3);
}

function directObservationAbilityCandidates(
  episodeText: string,
  hintAbilities: ObservationHintAbilityCandidate[],
): AbilityCandidate[] {
  const normalizedEpisode = normalizeObservationMatchText(episodeText);
  if (!normalizedEpisode) return [];

  const matches = hintAbilities
    .map((ability) => {
      const matchedFragments = Array.from(
        new Set(
          ability.observationExamples.flatMap((example) =>
            observationExampleFragments(example).filter((fragment) => {
              const normalizedFragment = normalizeObservationMatchText(fragment);
              return Boolean(
                normalizedFragment &&
                normalizedFragment.length >= 3 &&
                normalizedEpisode.includes(normalizedFragment)
              );
            }),
          ),
        ),
      );

      if (matchedFragments.length === 0) return null;

      return {
        candidate: {
          abilityCode: ability.abilityCode,
          confidence: matchedFragments.length >= 2 ? 0.98 : 0.92,
          evidenceText: matchedFragments.slice(0, 3).join(" / "),
          reason: `日案の「見届けたい子どもの姿」に示された具体例と、記録中の行動・言葉・しぐさが直接一致しています。`,
        } satisfies AbilityCandidate,
        matchCount: matchedFragments.length,
        score: ability.score,
      };
    })
    .filter((row): row is { candidate: AbilityCandidate; matchCount: number; score: number } => Boolean(row))
    .sort((a, b) => {
      if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount;
      if (a.score !== b.score) return b.score - a.score;
      return a.candidate.abilityCode.localeCompare(b.candidate.abilityCode);
    });

  return matches.slice(0, 2).map((row) => row.candidate);
}

function buildAbilityLabelMap(codes: AbilityCodeRow[]): Record<string, string> {
  const byCode = new Map<string, AbilityCodeRow>();
  for (const row of codes) {
    byCode.set(s(row.code), row);
  }

  const labels: Record<string, string> = {};

  for (const row of codes) {
    const names: string[] = [];
    let current: AbilityCodeRow | undefined = row;
    const visited = new Set<string>();

    while (current) {
      const code = s(current.code);
      if (!code || visited.has(code)) break;
      visited.add(code);
      names.unshift(s(current.name));
      const parentCode = s(current.parent_code);
      if (!parentCode) break;
      current = byCode.get(parentCode);
    }

    labels[s(row.code)] = names.filter(Boolean).join(" > ");
  }

  return labels;
}

function practiceSnapshotFromDailyPlan(
  dailyPlan: PlanDocumentRow,
  practiceRole: string,
): {
  practiceCode: string;
  practiceName: string;
  practiceMemo: string;
  observationHints: unknown[];
} {
  const content = parseJsonRecord(dailyPlan.contentJson) ?? {};
  const key = practiceRole === "RESERVE" ? "reservePractice" : "primaryPractice";
  const practice = typeof content[key] === "object" && content[key] !== null
    ? content[key] as JsonObject
    : {};

  return {
    practiceCode: s(practice.practiceCode),
    practiceName: s(practice.name),
    practiceMemo: s(practice.memo),
    observationHints: Array.isArray(practice.observationHints)
      ? practice.observationHints
      : [],
  };
}

function observationHintsFromPracticeRecord(
  record: DailyPracticeRecordRow,
): unknown[] {
  const text = s(record.observationHintsJson);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function observationHintAbilityCandidates(
  observationHints: unknown[],
  abilityLabelMap: Record<string, string>,
): ObservationHintAbilityCandidate[] {
  const byAbilityCode = new Map<string, ObservationHintAbilityCandidate>();

  for (const rawHint of observationHints) {
    if (typeof rawHint !== "object" || rawHint === null) continue;
    const hint = rawHint as JsonObject;
    const abilityCode = s(hint.abilityCode);
    if (!abilityCode) continue;

    const episodes = typeof hint.episodes === "object" && hint.episodes !== null
      ? hint.episodes as JsonObject
      : {};
    const observationExamples = [
      s(episodes.episode1),
      s(episodes.episode2),
      s(episodes.episode3),
    ].filter(Boolean);

    const existing = byAbilityCode.get(abilityCode);
    if (existing) {
      existing.observationExamples = Array.from(
        new Set([...existing.observationExamples, ...observationExamples]),
      );
      continue;
    }

    byAbilityCode.set(abilityCode, {
      abilityCode,
      abilityName: s(hint.abilityName) || abilityLabelMap[abilityCode] || abilityCode,
      postureCode: s(hint.postureCode),
      postureName: s(hint.postureName),
      score: n(hint.score),
      observationExamples,
    });
  }

  return Array.from(byAbilityCode.values());
}

async function loadChildRoster(
  dataClient: ReturnType<typeof generateClient<Schema>>,
  record: DailyPracticeRecordRow,
): Promise<ChildRosterRow[]> {
  const enrollmentsResult = await dataClient.models.ChildClassroomEnrollment.list({
    filter: {
      tenantId: { eq: s(record.tenantId) },
      classroomId: { eq: s(record.classroomId) },
      fiscalYear: { eq: n(record.fiscalYear) },
      status: { eq: "ACTIVE" },
    },
    limit: 1000,
  });

  if (enrollmentsResult.errors?.length) {
    throw new Error(
      `ChildClassroomEnrollment list failed: ${enrollmentsResult.errors
        .map((error) => error.message)
        .join("\n")}`,
    );
  }

  const enrollments = (enrollmentsResult.data ?? []) as ChildEnrollmentRow[];
  const children = await Promise.all(
    enrollments.map(async (enrollment) => {
      const childResult = await dataClient.models.Child.get({ id: s(enrollment.childId) });
      if (childResult.errors?.length) {
        throw new Error(
          `Child get failed: ${childResult.errors.map((error) => error.message).join("\n")}`,
        );
      }
      return childResult.data as ChildRow | null;
    }),
  );

  return children
    .filter((child): child is ChildRow => Boolean(child && s(child.status).toUpperCase() === "ACTIVE"))
    .map((child) => ({
      childId: s(child.id),
      childName: s(child.displayName),
    }))
    .filter((child) => child.childId && child.childName)
    .sort((a, b) => a.childName.localeCompare(b.childName, "ja"));
}

function buildPrompt(input: {
  practiceRole: string;
  practiceCode: string;
  practiceName: string;
  practiceMemo: string;
  observationHintAbilities: ObservationHintAbilityCandidate[];
  childRoster: ChildRosterRow[];
  cleanedTranscriptText: string;
}): string {
  return `
あなたは保育現場の実践記録を整理し、子ども別エピソードとAbility候補を抽出する日本語アシスタントです。

これは文字起こしのクリーンアップ後に行う第2段階の解析です。
入力文は既にフィラーワード除去・敬体化・読みやすさの調整が済んでいます。
入力された事実を変えず、観察されていない内容を追加しないでください。

対象Practice:
${JSON.stringify({
    practiceRole: input.practiceRole,
    practiceCode: input.practiceCode,
    practiceName: input.practiceName,
    practiceMemo: input.practiceMemo,
  }, null, 2)}

日案で提示された「見届けたい子どもの姿」と、そのAbility候補:
${JSON.stringify(input.observationHintAbilities, null, 2)}

クラスの子ども一覧:
${JSON.stringify(input.childRoster, null, 2)}

クリーンアップ済み記録:
${truncateText(input.cleanedTranscriptText)}

必須ルール:
1. cleanedOverallTextには、このPractice全体の実践記録を自然な敬体でまとめる。
2. 元文に含まれる重要な出来事、子どもの行動、発話、時系列、ネガティブまたは気になる行動を省略しない。
3. 眠そう、集中しなかった、他児へちょっかいを出した等も、無理に肯定的な表現へ変えず、観察された事実として客観的に残す。
4. 子どもの性格、意図、家庭事情、障害・診断、発達上の問題を推測しない。
5. クラス一覧にある子どもの名前またはchildIdが記録中に登場した場合、その子どものエピソードをchildEpisodesへ必ず含める。
6. 同じ子どもに複数の独立した出来事がある場合でも、今回は1人1件のepisodeTextへ時系列が分かるよう統合する。
7. Abilityとの関係が弱くても、子どものエピソード自体は削除しない。
8. Ability判定では、最初に必ず、各エピソードを上記の「見届けたい子どもの姿」の observationExamples（行動・言葉・しぐさ／表情）と一つずつ照合する。observationExamplesは単なる参考ではなく、このPracticeでAbilityの芽生えを見届けるための最重要判定基準である。
9. エピソードに、observationExamplesと同じ、または実質的に同じ行動・発話・しぐさが一つでも記録されている場合、そのAbilityをabilityCandidatesへ必ず含める。該当しているのに空配列としてはならない。行動・言葉・しぐさのすべてが揃う必要はなく、いずれか一つの明確な一致でよい。
10. 特に、見届けたい言葉として「もう一回やってみる」「まだできる」「がんばる」等が示され、記録中に同じ発話がある場合は、対応するAbilityの直接的かつ強い根拠として扱う。
11. abilityCandidatesは、上記の「見届けたい子どもの姿と、そのAbility候補」に含まれるabilityCodeだけから選ぶ。候補外のAbilityを新たに推測・連想・補完してはならない。
12. 各子どものabilityCandidatesは原則1件とする。異なる2つのAbilityについて、それぞれ別の具体的な見届けたい姿が明確に観察された場合に限り最大2件まで許容する。3件以上は絶対に返さない。
13. abilityCandidatesを空配列にできるのは、候補となる全AbilityのobservationExamplesと照合しても、対応する行動・言葉・しぐさがなく、直接的な関連も説明できない場合だけである。
14. Practiceから一般に期待される効果だけを根拠にAbilityを選ばない。一方で、observationExamplesと同一または同義の具体的な行動・発話・しぐさは、語句の一致だけとして退けず、保育士が見届けた重要な証拠として扱う。
15. confidenceは0.0〜1.0で、エピソードの真偽ではなく「観察された事実と、選んだAbilityとの直接的な関連の強さ」を表す。observationExamplesとの明確な一致は原則0.85以上、複数の一致がある場合は0.95前後を目安にする。
16. 2件返す場合は、同じ観察事実を言い換えて2つへ重複紐づけせず、それぞれ別のevidenceTextを示す。
17. evidenceTextには、記録中の該当する行動・発話・しぐさを簡潔に書く。reasonには、それがどの見届けたい姿と一致し、なぜAbilityの芽生えと判断できるかを簡潔に書く。
18. 出力はJSONのみ。説明、前置き、Markdownコードフェンスは禁止。

出力形式:
{
  "cleanedOverallText": "Practice全体の実践記録",
  "childEpisodes": [
    {
      "childId": "クラス一覧にあるchildId",
      "childName": "クラス一覧にあるchildName",
      "episodeText": "その子どもの観察エピソード",
      "abilityCandidates": [
        {
          "abilityCode": "見届けたい子どもの姿に含まれるabilityCode",
          "confidence": 0.0,
          "evidenceText": "観察事実",
          "reason": "Abilityとの関連理由"
        }
      ]
    }
  ]
}
`.trim();
}

async function invokeClaudeJson(
  modelId: string,
  prompt: string,
): Promise<JsonObject> {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "ap-northeast-1",
  });

  const command = new ConverseCommand({
    modelId,
    messages: [
      {
        role: "user",
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 5000,
      temperature: 0,
    },
  });

  const response = await client.send(command);
  const rawText = extractResponseText(response);
  const parsed = safeJsonParse(rawText);

  if (!parsed) {
    throw new Error(`AI response is not valid JSON: ${rawText}`);
  }

  return {
    ...parsed,
    __rawText: rawText,
  };
}

function normalizeAnalysis(args: {
  parsed: JsonObject;
  childRoster: ChildRosterRow[];
  allowedObservationAbilityCodes: Set<string>;
  observationHintAbilities: ObservationHintAbilityCandidate[];
}): AnalysisResult {
  const childById = new Map(args.childRoster.map((child) => [child.childId, child]));
  const childrenByName = new Map<string, ChildRosterRow[]>();
  for (const child of args.childRoster) {
    const list = childrenByName.get(child.childName) ?? [];
    list.push(child);
    childrenByName.set(child.childName, list);
  }

  const rawEpisodes = Array.isArray(args.parsed.childEpisodes)
    ? args.parsed.childEpisodes
    : [];

  const episodes: ChildEpisode[] = [];
  const seenChildIds = new Set<string>();

  for (const rawEpisode of rawEpisodes) {
    if (typeof rawEpisode !== "object" || rawEpisode === null) continue;
    const row = rawEpisode as JsonObject;

    let childId = s(row.childId);
    let child = childById.get(childId);
    if (!child) {
      const sameName = childrenByName.get(s(row.childName)) ?? [];
      if (sameName.length === 1) {
        child = sameName[0];
        childId = child.childId;
      }
    }

    if (!child || seenChildIds.has(childId)) continue;
    const episodeText = s(row.episodeText);
    if (!episodeText) continue;

    const rawCandidates = Array.isArray(row.abilityCandidates)
      ? row.abilityCandidates
      : [];

    const normalizedCandidates = rawCandidates
      .map((rawCandidate): AbilityCandidate | null => {
        if (typeof rawCandidate !== "object" || rawCandidate === null) return null;
        const candidate = rawCandidate as JsonObject;
        const abilityCode = s(candidate.abilityCode);
        if (!abilityCode || !args.allowedObservationAbilityCodes.has(abilityCode)) {
          return null;
        }

        return {
          abilityCode,
          confidence: clampConfidence(candidate.confidence),
          evidenceText: s(candidate.evidenceText),
          reason: s(candidate.reason),
        };
      })
      .filter((candidate): candidate is AbilityCandidate => Boolean(candidate))
      .sort((a, b) => b.confidence - a.confidence);

    const directCandidates = directObservationAbilityCandidates(
      episodeText,
      args.observationHintAbilities,
    );
    const mergedCandidates = new Map<string, AbilityCandidate>();
    for (const candidate of [...normalizedCandidates, ...directCandidates]) {
      const current = mergedCandidates.get(candidate.abilityCode);
      if (!current || candidate.confidence > current.confidence) {
        mergedCandidates.set(candidate.abilityCode, candidate);
      }
    }
    const candidates = Array.from(mergedCandidates.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 2);

    episodes.push({
      childId,
      childName: child.childName,
      episodeText,
      abilityCandidates: candidates,
    });
    seenChildIds.add(childId);
  }

  const cleanedOverallText = s(args.parsed.cleanedOverallText);
  if (!cleanedOverallText) {
    throw new Error("AI response cleanedOverallText was empty.");
  }

  return {
    cleanedOverallText,
    childEpisodes: episodes,
    rawText: s(args.parsed.__rawText),
  };
}

export const handler: Schema["analyzeDailyPracticeObservation"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as AnalyzeArgs;
    const dailyPracticeRecordId = s(args.dailyPracticeRecordId);
    const cleanedTranscriptText = s(args.cleanedTranscriptText);

    if (!dailyPracticeRecordId) {
      throw new Error("dailyPracticeRecordId is required.");
    }
    if (!cleanedTranscriptText) {
      throw new Error("cleanedTranscriptText is required.");
    }

    const modelId =
      process.env.BEDROCK_MODEL_ID ||
      "jp.anthropic.claude-sonnet-4-5-20250929-v1:0";

    const { resourceConfig, libraryOptions } =
      await getAmplifyDataClientConfig(process.env as DataClientEnv);
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const recordResult = await dataClient.models.DailyPracticeRecord.get({
      id: dailyPracticeRecordId,
    });
    if (recordResult.errors?.length) {
      throw new Error(
        `DailyPracticeRecord get failed: ${recordResult.errors
          .map((error) => error.message)
          .join("\n")}`,
      );
    }

    const record = recordResult.data as DailyPracticeRecordRow | null;
    if (!record) {
      throw new Error(`DailyPracticeRecord not found: ${dailyPracticeRecordId}`);
    }

    const reportResult = await dataClient.models.DailyReport.get({
      id: s(record.dailyReportId),
    });
    if (reportResult.errors?.length) {
      throw new Error(
        `DailyReport get failed: ${reportResult.errors
          .map((error) => error.message)
          .join("\n")}`,
      );
    }
    const report = reportResult.data as DailyReportRow | null;
    if (!report) {
      throw new Error(`DailyReport not found: ${s(record.dailyReportId)}`);
    }

    const planResult = await dataClient.models.PlanDocument.get({
      id: s(record.dailyPlanId),
    });
    if (planResult.errors?.length) {
      throw new Error(
        `PlanDocument get failed: ${planResult.errors
          .map((error) => error.message)
          .join("\n")}`,
      );
    }
    const dailyPlan = planResult.data as PlanDocumentRow | null;
    if (!dailyPlan) {
      throw new Error(`PlanDocument not found: ${s(record.dailyPlanId)}`);
    }

    const practiceRole = s(record.practiceRole).toUpperCase() === "RESERVE"
      ? "RESERVE"
      : "PRIMARY";
    const snapshot = practiceSnapshotFromDailyPlan(dailyPlan, practiceRole);
    const recordObservationHints = observationHintsFromPracticeRecord(record);
    const observationHints = recordObservationHints.length > 0
      ? recordObservationHints
      : snapshot.observationHints;
    const observationHintSource = recordObservationHints.length > 0
      ? "DAILY_PRACTICE_RECORD"
      : "DAILY_PLAN_FALLBACK";
    const practiceCode = s(record.practiceCode) || snapshot.practiceCode;
    const practiceName = s(record.practiceName) || snapshot.practiceName;

    const [childRoster, abilityResult] = await Promise.all([
      loadChildRoster(dataClient, record),
      dataClient.models.AbilityCode.list({ limit: 10000 }),
    ]);

    if (abilityResult.errors?.length) {
      throw new Error(
        `AbilityCode list failed: ${abilityResult.errors
          .map((error) => error.message)
          .join("\n")}`,
      );
    }

    const abilityCodes = (abilityResult.data ?? []) as AbilityCodeRow[];

    const activeAbilities = abilityCodes.filter((ability) =>
      s(ability.status || "ACTIVE").toUpperCase() === "ACTIVE",
    );
    const labelMap = buildAbilityLabelMap(activeAbilities);
    const observationHintAbilities = observationHintAbilityCandidates(
      observationHints,
      labelMap,
    );
    const allowedObservationAbilityCodes = new Set(
      observationHintAbilities.map((candidate) => candidate.abilityCode),
    );

    if (observationHintAbilities.length === 0) {
      throw new Error(
        `見届けたい子どもの姿を解析入力から取得できませんでした。source=${observationHintSource} / dailyPracticeRecordId=${dailyPracticeRecordId} / practiceRole=${practiceRole}`,
      );
    }

    console.log(
      "analyze-daily-practice-observation observation hints",
      JSON.stringify({
        dailyPracticeRecordId,
        practiceRole,
        practiceCode,
        observationHintSource,
        abilityCodes: observationHintAbilities.map((item) => item.abilityCode),
        observationExamples: observationHintAbilities.map((item) => ({
          abilityCode: item.abilityCode,
          examples: item.observationExamples,
        })),
      }),
    );

    const prompt = buildPrompt({
      practiceRole,
      practiceCode,
      practiceName,
      practiceMemo: snapshot.practiceMemo,
      observationHintAbilities,
      childRoster,
      cleanedTranscriptText,
    });

    try {
      const parsed = await invokeClaudeJson(modelId, prompt);
      const analysis = normalizeAnalysis({
        parsed,
        childRoster,
        allowedObservationAbilityCodes,
        observationHintAbilities,
      });
      const analyzedAt = new Date().toISOString();
      const analysisJson = JSON.stringify({
        schemaVersion: 1,
        analysisType: "DAILY_PRACTICE_CHILD_EPISODE_ABILITY",
        dailyReportId: s(report.id),
        dailyPracticeRecordId,
        dailyPlanId: s(record.dailyPlanId),
        reportDate: s(record.reportDate),
        practiceRole,
        practiceCode,
        practiceName,
        analyzedAt,
        observationHintSource,
        observationHintAbilityCodes: observationHintAbilities.map((item) => item.abilityCode),
        observationHintAbilities,
        childEpisodes: analysis.childEpisodes,
      });

      const updateResult = await dataClient.models.DailyPracticeRecord.update({
        id: dailyPracticeRecordId,
        cleanedTranscriptText,
        cleanedOverallText: analysis.cleanedOverallText,
        analysisStatus: "ANALYZED",
        analysisJson,
        aiModel: modelId,
        analyzedAt,
        analysisErrorMessage: "",
        updatedByUserId: s(record.updatedByUserId) || s(record.createdByUserId) || undefined,
      });

      if (updateResult.errors?.length) {
        throw new Error(
          `DailyPracticeRecord update failed: ${updateResult.errors
            .map((error) => error.message)
            .join("\n")}`,
        );
      }

      return {
        dailyPracticeRecordId,
        cleanedOverallText: analysis.cleanedOverallText,
        analysisJson,
        status: "ANALYZED",
        aiModel: modelId,
        message: `子ども別エピソード ${analysis.childEpisodes.length}件を抽出しました。`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await dataClient.models.DailyPracticeRecord.update({
        id: dailyPracticeRecordId,
        analysisStatus: "ERROR",
        analysisErrorMessage: message,
        aiModel: modelId,
        updatedByUserId: s(record.updatedByUserId) || s(record.createdByUserId) || undefined,
      });
      throw error;
    }
  };
