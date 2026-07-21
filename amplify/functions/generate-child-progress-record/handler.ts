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
  childProgressRecordId: string;
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
  currentCount: number;
  previousCount: number;
  status: string;
};

type DomainSource = {
  domain: string;
  abilities: SourceAbility[];
  currentEpisodes: SourceEpisode[];
  previousEpisodes: SourceEpisode[];
  practices: string[];
};

type SourceSnapshot = {
  promptVersion: string;
  childId: string;
  childName: string;
  classroomId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  comparisonPeriodStart: string;
  comparisonPeriodEnd: string;
  overallCurrentEpisodes: SourceEpisode[];
  overallPreviousEpisodes: SourceEpisode[];
  domains: DomainSource[];
  newAbilityNames: string[];
  continuingAbilityNames: string[];
  sourceObservationIds: string[];
  sourceAbilityCodes: string[];
};

type GeneratedDraft = {
  centralThemes: string[];
  interpretationNotes: string[];
  overviewText: string;
  healthText: string;
  relationshipText: string;
  environmentText: string;
  languageText: string;
  expressionText: string;
  continuityText: string;
  nextPerspectiveText: string;
  needsTeacherInputDomains: string[];
  sourceObservationIds: string[];
  warnings: string[];
};

type DomainTextField =
  | "healthText"
  | "relationshipText"
  | "environmentText"
  | "languageText"
  | "expressionText";

const DOMAIN_TO_FIELD: Record<string, DomainTextField> = {
  健康: "healthText",
  人間関係: "relationshipText",
  環境: "environmentText",
  言葉: "languageText",
  表現: "expressionText",
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function withSan(name: string): string {
  const trimmed = s(name);
  if (!trimmed) return "";
  return trimmed.endsWith("さん") ? trimmed : `${trimmed}さん`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureChildNameHonorific(text: string, childName: string): string {
  const trimmedName = s(childName);
  if (!trimmedName) return text;

  const baseName = trimmedName.endsWith("さん")
    ? trimmedName.slice(0, -2)
    : trimmedName;
  if (!baseName) return text;

  const pattern = new RegExp(
    `${escapeRegExp(baseName)}(?!さん)(?=\\s|は|が|の|に|を|も|と|へ|で|から|について|、|。|「|」|$)`,
    "g",
  );
  return text.replace(pattern, `${baseName}さん`);
}

function normalizeTeacherVoice(text: string): string {
  return text
    // Longer phrases must be replaced first.
    .replace(/継続して記録していきたいと考えています/g, "これからも丁寧に見守っていきます")
    .replace(/複数回記録されています/g, "繰り返し見られました")
    .replace(/記録されており/g, "見られ、")
    .replace(/確認されており/g, "見られ、")
    .replace(/記録されています/g, "見られました")
    .replace(/確認されています/g, "見られました")
    .replace(/記録されている。/g, "見られます。")
    .replace(/記録されている/g, "見られる")
    // Normalize common plain-style sentence endings as a final safety net.
    .replace(/であった。/g, "でした。")
    .replace(/である。/g, "です。")
    .replace(/だった。/g, "でした。")
    .replace(/していた。/g, "していました。")
    .replace(/している。/g, "しています。")
    .replace(/見られた。/g, "見られました。")
    .replace(/考えられる。/g, "考えられます。")
    .replace(/捉えられる。/g, "捉えられます。")
    .replace(/うかがえる。/g, "うかがえます。")
    .replace(/広がっている。/g, "広がっています。")
    .replace(/深まっている。/g, "深まっています。")
    .replace(/続いている。/g, "続いています。")
    .replace(/表れている。/g, "表れています。");
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

function parseEpisodes(value: unknown, limit: number): SourceEpisode[] {
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
    .slice(0, limit);
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
        currentCount: n(row.currentCount),
        previousCount: n(row.previousCount),
        status: s(row.status),
      };
    })
    .filter((row): row is SourceAbility => Boolean(row?.abilityName))
    .slice(0, 5);
}

function parseDomains(value: unknown): DomainSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = parseJsonObject(item);
      if (!row) return null;
      return {
        domain: s(row.domain),
        abilities: parseAbilities(row.abilities),
        currentEpisodes: parseEpisodes(row.currentEpisodes, 3),
        previousEpisodes: parseEpisodes(row.previousEpisodes, 2),
        practices: parseStringArray(row.practices).slice(0, 3),
      };
    })
    .filter((row): row is DomainSource => Boolean(row?.domain))
    .slice(0, 5);
}

function parseSourceSnapshot(value: unknown): SourceSnapshot {
  const row = parseJsonObject(value);
  if (!row) throw new Error("aiSourceSnapshotJson is empty or invalid.");

  const snapshot: SourceSnapshot = {
    promptVersion: s(row.promptVersion) || "child-progress-record-v1",
    childId: s(row.childId),
    childName: s(row.childName),
    classroomId: s(row.classroomId),
    currentPeriodStart: s(row.currentPeriodStart),
    currentPeriodEnd: s(row.currentPeriodEnd),
    comparisonPeriodStart: s(row.comparisonPeriodStart),
    comparisonPeriodEnd: s(row.comparisonPeriodEnd),
    overallCurrentEpisodes: parseEpisodes(row.overallCurrentEpisodes, 5),
    overallPreviousEpisodes: parseEpisodes(row.overallPreviousEpisodes, 3),
    domains: parseDomains(row.domains),
    newAbilityNames: parseStringArray(row.newAbilityNames).slice(0, 5),
    continuingAbilityNames: parseStringArray(row.continuingAbilityNames).slice(0, 5),
    sourceObservationIds: parseStringArray(row.sourceObservationIds),
    sourceAbilityCodes: parseStringArray(row.sourceAbilityCodes),
  };

  if (!snapshot.childName || !snapshot.currentPeriodStart || !snapshot.currentPeriodEnd) {
    throw new Error("子ども名または対象期間が取得できません。");
  }
  if (snapshot.overallCurrentEpisodes.length === 0) {
    throw new Error("自然文下書きの根拠となる確認済みエピソードがありません。");
  }

  return snapshot;
}

function episodeLines(rows: SourceEpisode[]): string {
  if (rows.length === 0) return "具体的な根拠エピソードなし";
  return rows.map((episode, index) => [
    `${index + 1}. 日付=${episode.reportDate}`,
    `活動=${episode.practiceName || "生活や遊び"}`,
    `保育士が観察した具体的な姿=${episode.episodeText}`,
  ].join(" / ")).join("\n");
}

function abilityStatusLabel(status: string): string {
  switch (s(status).toUpperCase()) {
    case "NEW":
      return "現在期間で新たに見られた観点";
    case "CONTINUED":
      return "両期間を通して見られた観点";
    case "MORE_RECORDED":
      return "現在期間で見られる場面が広がった観点";
    case "LESS_RECORDED":
      return "比較期間にも見られた観点";
    case "PREVIOUS_ONLY":
      return "比較期間に見られた観点";
    default:
      return "関連する育ちの観点";
  }
}

function domainPrompt(domain: DomainSource): string {
  const abilityLines = domain.abilities.length > 0
    ? domain.abilities.map((ability) =>
      `- ${ability.category} / ${ability.abilityName} / ${abilityStatusLabel(ability.status)}`,
    ).join("\n")
    : "- 関連する育ちの整理タグなし";

  return `
【${domain.domain}】
現在期間の根拠エピソード:
${episodeLines(domain.currentEpisodes)}
比較期間の根拠エピソード:
${episodeLines(domain.previousEpisodes)}
関連する育ちの整理タグ:
${abilityLines}
関連Practice: ${domain.practices.length > 0 ? domain.practices.join("、") : "なし"}
`.trim();
}

function buildPrompt(snapshot: SourceSnapshot): string {
  const childDisplayName = withSan(snapshot.childName);

  return `
あなたは、保育所で長年、子どもの観察と保育経過記録の作成に携わってきた経験豊かな担任保育士です。
保育360へ入力された具体的なエピソードは、あなた自身が日々の保育の中で子どもと関わり、見守り、観察した内容です。
第三者が資料を読み上げるような文章ではなく、担任保育士として、その子の育ちを自分の言葉で振り返る下書きを作成してください。

あなたの役割は、エピソードを活動ごとに並べ直したり、単に読みやすく要約したりすることではありません。
複数の具体的なエピソードを読み、${childDisplayName}に共通して見られる関心、試行、表現、関係性、環境との関わりを捉え、保育経過記録として意味のある文章へ統合してください。

AIが児童票を評価・診断・確定するのではありません。
保育士が日々の保育で観察した具体的な姿を、保育士自身が確認・修正するための下書きへ整理します。
専門知識は、観察した行動の意味やつながりを整理するために使い、入力にない出来事、発言、感情、能力、発達状態を推測して加えてはいけません。

最重要の文体:
1. 対象児を本文中で呼ぶ場合は、必ず「${childDisplayName}」と書く。呼び捨てにしない
2. overviewText、5領域、continuityText、nextPerspectiveText、interpretationNotesは、すべて「です・ます調」の敬体で書く
3. 担任保育士本人の当事者意識で書き、「資料によると」「記録によると」のような第三者視点にしない
4. 「記録されている」「記録されており」「記録されています」「確認されています」「複数回記録されています」「継続して記録していきたいと考えています」は使用しない
5. 観察した事実は、「〜していました」「〜する姿が見られました」「〜を楽しんでいました」「〜しようとする様子がありました」と表現する
6. 今後の視点は、「これからも〜する姿を丁寧に見守っていきます」「〜できる環境を整えていきます」など、担任としての関わりが伝わる敬体で書く
7. centralThemesだけは短い名詞句でよいが、子どもの名前を含める場合は必ず「${childDisplayName}」とする

重要な作業方針:
1. まず、異なる活動や日付のエピソードに共通する「中心的な育ちのテーマ」を1〜3件抽出する
2. 活動名を順番に列挙するのではなく、中心テーマを軸に文章を再構成する
3. ${childDisplayName}が何に関心を向け、どのように試し、伝え、周囲と関わり、経験を広げているかを、具体的なエピソードから読み取れる範囲で捉える
4. 友だち、保育者、素材、場所などとの相互作用を整理する
5. 5領域を別々の能力評価として扱わず、一つの姿が複数領域に関係することを踏まえる
6. 比較期間の具体的エピソードがある場合だけ、継続、広がり、深まりとして控えめに記述する
7. 「今後見届けたい視点」は不足や訓練ではなく、現在見られる姿がどのような場面でさらに表れるかを見届ける視点として書く

対象:
- 子ども名: ${childDisplayName}
- 現在期間: ${snapshot.currentPeriodStart}〜${snapshot.currentPeriodEnd}
- 比較期間: ${snapshot.comparisonPeriodStart}〜${snapshot.comparisonPeriodEnd}

現在期間の代表エピソード:
${episodeLines(snapshot.overallCurrentEpisodes)}

比較期間の代表エピソード:
${episodeLines(snapshot.overallPreviousEpisodes)}

現在期間で新たに見られた育ちの観点:
${snapshot.newAbilityNames.length > 0 ? snapshot.newAbilityNames.join("、") : "なし"}

比較期間から続いて見られた育ちの観点:
${snapshot.continuingAbilityNames.length > 0 ? snapshot.continuingAbilityNames.join("、") : "なし"}

5領域別の根拠:
${snapshot.domains.map(domainPrompt).join("\n\n")}

定型下書きについて:
- 定型下書き全文は入力されていない
- 元のObservationエピソードと構造化されたAbility・5領域・Practice情報だけから、独立して解釈・統合する
- 活動ごとの要約文を作るのではなく、複数のエピソードの共通性とつながりを捉える

文章作成ルール:
- overviewTextは、中心的な育ちのテーマから書き始める
- 「様々な活動の中で」「〜では、〜では、〜では」のような活動列挙を文章の中心にしない
- 具体例は、中心テーマを裏付ける代表例として1〜2場面を用いる
- 「〜と考えている」「〜を感じている」など内面を断定しない
- 解釈を示す場合は、「〜しようとする姿が見られました」「〜として捉えました」「〜する様子がありました」など、担任保育士として観察した事実と解釈の距離を保つ
- 5領域別文章でも、行動の要約だけでなく、その行動が遊びや生活の中で果たしている意味を書く
- 同じエピソードを全領域で機械的に繰り返さない
- 「記録」「確認」という語を、子どもの姿を説明する述語として使用しない
- interpretationNotesは、「〜という場面と〜という場面をつなぎ、〜する育ちとして捉えました」のように、保育士が確認しやすい敬体で書く

厳守事項:
- 入力にない出来事、発言、感情、家庭状況を作らない
- 発達診断、能力評価、優劣、順位、達成度判定をしない
- 他児との比較をしない
- 「できていない」「遅れている」「能力が低い」「弱い」「発達上の問題」などの表現を使わない
- Abilityコード、confidence、score、weight、観察件数、差分数値を本文に出さない
- 5領域は子どもを評価する尺度ではなく、育ちを整理する視点として扱う
- 件数が増えたことだけを理由に「成長した」「向上した」と断定しない
- 比較文は、現在期間と比較期間の双方に具体的な根拠エピソードがある場合だけ書く
- 各領域に現在期間の具体的根拠がない場合、その領域の本文は空文字にし、needsTeacherInputDomainsへ領域名を入れる
- 根拠が1件だけの場合は断定を避け、「〜する姿が見られました」「〜を楽しんでいました」など控えめな敬体で書く
- 常体の「〜である」「〜だ」「〜していた」「〜している」「〜と考えられる」で文を終えない
- markdown記号を使わない
- 出力はJSONのみ

出力項目の意味:
- centralThemes: 複数のエピソードに共通して見られる中心的な育ちのテーマ。1〜3件、各40字以内
- interpretationNotes: 保育士がAI解釈を検証するためのメモ。どの場面をどのようにつないで捉えたかを2〜5件、各100字以内の敬体で書く。児童票本文には含めない
- overviewText: 活動列挙ではなく、中心テーマを軸に統合した期間全体の記述
- 各5領域: その領域から捉えた育ちの意味と、それを裏付ける代表的な姿
- continuityText: 比較期間との具体的なつながり。根拠が不足する場合は空文字
- nextPerspectiveText: 現在の姿の延長として、担任保育士が今後見守りたい場面や整えたい環境

文章量の目安:
- overviewText: 180〜300字
- 各5領域: 根拠があれば100〜220字、なければ空文字
- continuityText: 0〜220字
- nextPerspectiveText: 100〜180字

JSON形式:
{
  "centralThemes": ["中心テーマ1", "中心テーマ2"],
  "interpretationNotes": ["場面のつなぎ方を説明する保育士確認用の敬体メモです。"],
  "overviewText": "${childDisplayName}の期間を通した育ちを、です・ます調で書きます。",
  "healthText": "健康の視点から見た育ちを、です・ます調で書きます。",
  "relationshipText": "人間関係の視点から見た育ちを、です・ます調で書きます。",
  "environmentText": "環境の視点から見た育ちを、です・ます調で書きます。",
  "languageText": "言葉の視点から見た育ちを、です・ます調で書きます。",
  "expressionText": "表現の視点から見た育ちを、です・ます調で書きます。",
  "continuityText": "比較期間からのつながりを敬体で書きます。比較根拠がなければ空文字です。",
  "nextPerspectiveText": "今後見届けたい視点を、担任保育士の当事者的な敬体で書きます。",
  "needsTeacherInputDomains": ["根拠がない領域名"],
  "sourceObservationIds": ["本文の根拠として使用したObservation ID"],
  "warnings": []
}
`.trim();
}

function sanitizeGeneratedText(
  value: unknown,
  abilityCodes: string[],
  childName: string,
): string {
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

  text = normalizeTeacherVoice(text);
  text = ensureChildNameHonorific(text, childName);

  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function sanitizeGeneratedArray(
  value: unknown,
  abilityCodes: string[],
  childName: string,
  maxItems: number,
  maxLength: number,
): string[] {
  return parseStringArray(value)
    .map((item) =>
      sanitizeGeneratedText(item, abilityCodes, childName).slice(0, maxLength),
    )
    .filter(Boolean)
    .slice(0, maxItems);
}

function assertSafeLanguage(draft: GeneratedDraft): void {
  const allText = [
    ...draft.centralThemes,
    ...draft.interpretationNotes,
    draft.overviewText,
    draft.healthText,
    draft.relationshipText,
    draft.environmentText,
    draft.languageText,
    draft.expressionText,
    draft.continuityText,
    draft.nextPerspectiveText,
  ].join("\n");

  const forbidden = [
    "できていない",
    "遅れている",
    "能力が低い",
    "言葉領域が弱い",
    "発達上の問題",
    "発達障害",
    "記録されている",
    "記録されており",
    "記録されています",
    "確認されています",
    "複数回記録されています",
    "継続して記録していきたいと考えています",
  ];
  const found = forbidden.find((phrase) => allText.includes(phrase));
  if (found) {
    throw new Error(`AI下書きに使用禁止表現が含まれています: ${found}`);
  }

  const narrativeText = [
    ...draft.interpretationNotes,
    draft.overviewText,
    draft.healthText,
    draft.relationshipText,
    draft.environmentText,
    draft.languageText,
    draft.expressionText,
    draft.continuityText,
    draft.nextPerspectiveText,
  ].join("\n");

  const plainEnding = narrativeText.match(
    /(?:である|であった|だった|していた|している|見られた|考えられる|捉えられる|うかがえる|広がっている|深まっている|続いている|表れている)[。！？]/,
  );
  if (plainEnding) {
    throw new Error(`AI下書きが敬体になっていません: ${plainEnding[0]}`);
  }
}

function parseGeneratedDraft(rawText: string, snapshot: SourceSnapshot): GeneratedDraft {
  const parsed = parseJsonObject(stripCodeFence(rawText));
  if (!parsed) {
    throw new Error(`AI response is not valid JSON: ${rawText}`);
  }

  const draft: GeneratedDraft = {
    centralThemes: sanitizeGeneratedArray(parsed.centralThemes, snapshot.sourceAbilityCodes, snapshot.childName, 3, 60),
    interpretationNotes: sanitizeGeneratedArray(parsed.interpretationNotes, snapshot.sourceAbilityCodes, snapshot.childName, 5, 160),
    overviewText: sanitizeGeneratedText(parsed.overviewText, snapshot.sourceAbilityCodes, snapshot.childName),
    healthText: sanitizeGeneratedText(parsed.healthText, snapshot.sourceAbilityCodes, snapshot.childName),
    relationshipText: sanitizeGeneratedText(parsed.relationshipText, snapshot.sourceAbilityCodes, snapshot.childName),
    environmentText: sanitizeGeneratedText(parsed.environmentText, snapshot.sourceAbilityCodes, snapshot.childName),
    languageText: sanitizeGeneratedText(parsed.languageText, snapshot.sourceAbilityCodes, snapshot.childName),
    expressionText: sanitizeGeneratedText(parsed.expressionText, snapshot.sourceAbilityCodes, snapshot.childName),
    continuityText: sanitizeGeneratedText(parsed.continuityText, snapshot.sourceAbilityCodes, snapshot.childName),
    nextPerspectiveText: sanitizeGeneratedText(parsed.nextPerspectiveText, snapshot.sourceAbilityCodes, snapshot.childName),
    needsTeacherInputDomains: parseStringArray(parsed.needsTeacherInputDomains),
    sourceObservationIds: parseStringArray(parsed.sourceObservationIds),
    warnings: parseStringArray(parsed.warnings),
  };

  if (!draft.overviewText || !draft.nextPerspectiveText) {
    throw new Error("AI response does not contain overviewText or nextPerspectiveText.");
  }
  if (draft.centralThemes.length === 0) {
    throw new Error("AI response does not contain centralThemes.");
  }

  const needsTeacherInput = new Set(draft.needsTeacherInputDomains);
  for (const domain of snapshot.domains) {
    const field = DOMAIN_TO_FIELD[domain.domain];
    if (!field) continue;

    if (domain.currentEpisodes.length === 0) {
      draft[field] = "";
      needsTeacherInput.add(domain.domain);
      continue;
    }

    // Concrete source episodes exist for this domain. Do not accept an
    // over-cautious AI response that marks the domain as evidence-free.
    needsTeacherInput.delete(domain.domain);
    if (!draft[field]) {
      throw new Error(
        `AI response omitted ${domain.domain} text although ${domain.currentEpisodes.length} source episode(s) were supplied.`,
      );
    }
  }
  draft.needsTeacherInputDomains = [...needsTeacherInput];

  if (snapshot.overallPreviousEpisodes.length === 0) {
    draft.continuityText = "";
  }

  const allowedObservationIds = new Set(snapshot.sourceObservationIds);
  draft.sourceObservationIds = draft.sourceObservationIds
    .filter((id) => allowedObservationIds.has(id));
  if (draft.sourceObservationIds.length === 0) {
    draft.sourceObservationIds = snapshot.overallCurrentEpisodes
      .map((episode) => episode.observationId);
  }

  assertSafeLanguage(draft);
  return draft;
}

function buildDraftText(snapshot: SourceSnapshot, draft: GeneratedDraft): string {
  const sections: Array<[string, string]> = [
    ["期間を通した育ち", draft.overviewText],
    ["健康の視点から見た育ち", draft.healthText],
    ["人間関係の視点から見た育ち", draft.relationshipText],
    ["環境の視点から見た育ち", draft.environmentText],
    ["言葉の視点から見た育ち", draft.languageText],
    ["表現の視点から見た育ち", draft.expressionText],
    ["比較期間からのつながり", draft.continuityText],
    ["今後見届けたい視点", draft.nextPerspectiveText],
  ];

  const lines = [
    `【保育経過記録支援：${withSan(snapshot.childName)}】`,
    `対象期間：${snapshot.currentPeriodStart}〜${snapshot.currentPeriodEnd}`,
    `比較期間：${snapshot.comparisonPeriodStart}〜${snapshot.comparisonPeriodEnd}`,
    "",
    "※この内容は、保育士が日々の保育で入力した観察エピソードをもとにAIが作成した確認前の下書きです。児童票へ転記する前に、具体的な姿を振り返り、必要に応じて修正・追記してください。",
    "",
  ];

  for (const [title, text] of sections) {
    lines.push(`■ ${title}`);
    lines.push(text || "（この領域については、対象期間に入力したエピソードだけでは具体的な文章を作成できません。必要に応じて追記してください。）");
    lines.push("");
  }

  return lines.join("\n").trim();
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
      max_tokens: 3200,
      temperature: 0.15,
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

export const handler: Schema["generateChildProgressRecord"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as GenerateArgs;
    const recordId = s(args.childProgressRecordId);
    if (!recordId) throw new Error("childProgressRecordId is required.");

    const modelId = process.env.BEDROCK_MODEL_ID
      || "jp.anthropic.claude-sonnet-4-5-20250929-v1:0";
    const generatedAt = new Date().toISOString();

    const { resourceConfig, libraryOptions } =
      await getAmplifyDataClientConfig(process.env as DataClientEnv);
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const recordResult = await dataClient.models.ChildProgressRecord.get({ id: recordId });
    if (recordResult.errors?.length) {
      throw new Error(recordResult.errors.map((error: { message?: string | null }) => error.message).join("\n"));
    }
    const record = recordResult.data;
    if (!record) throw new Error(`ChildProgressRecord not found: ${recordId}`);

    try {
      const snapshot = parseSourceSnapshot(record.aiSourceSnapshotJson);
      const prompt = buildPrompt(snapshot);
      const ai = await invokeClaude({ modelId, prompt, snapshot });
      const aiDraftText = buildDraftText(snapshot, ai.draft);

      const updateResult = await dataClient.models.ChildProgressRecord.update({
        id: recordId,
        aiDraftJson: JSON.stringify(ai.draft),
        aiDraftText,
        draftText: aiDraftText,
        aiStatus: "GENERATED",
        aiModel: modelId,
        promptVersion: snapshot.promptVersion,
        inputTokenCount: ai.inputTokenCount,
        outputTokenCount: ai.outputTokenCount,
        generatedAt,
        generationErrorMessage: "",
        aiRawJson: ai.rawText,
        updatedByUserId: "generate-child-progress-record",
      });

      if (updateResult.errors?.length) {
        throw new Error(updateResult.errors.map((error: { message?: string | null }) => error.message).join("\n"));
      }

      return {
        childProgressRecordId: recordId,
        status: "GENERATED",
        aiDraftJson: JSON.stringify(ai.draft),
        aiDraftText,
        aiModel: modelId,
        inputTokenCount: ai.inputTokenCount,
        outputTokenCount: ai.outputTokenCount,
        generatedAt,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      await dataClient.models.ChildProgressRecord.update({
        id: recordId,
        aiStatus: "ERROR",
        aiModel: modelId,
        generatedAt,
        generationErrorMessage: message.slice(0, 4000),
        updatedByUserId: "generate-child-progress-record",
      }).catch(() => undefined);
      throw cause;
    }
  };
