import type { AppSyncResolverHandler } from "aws-lambda";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

type HandlerArgs = {
  scheduleDayId?: string | null;
  scheduleDayItemId?: string | null;
  practiceCode?: string | null;
  childNames?: string[] | null;
  transcriptText: string;
};

type HandlerResult = {
  originalText: string;
  cleanedText: string;
  status: string;
  message: string;
};

function stripCodeFence(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const firstNewline = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");
    if (firstNewline >= 0 && lastFence > firstNewline) {
      return trimmed.slice(firstNewline + 1, lastFence).trim();
    }
  }

  return trimmed;
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

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function invokeClaude(args: {
  transcriptText: string;
  childNames: string[];
  practiceCode?: string | null;
}): Promise<string> {
  const modelId =
    process.env.BEDROCK_MODEL_ID ||
    "apac.anthropic.claude-3-5-sonnet-20241022-v2:0";

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
  });

  const systemPrompt = [
    "あなたは保育現場向けの文字起こしクリーンアップ支援アシスタントです。",
    "入力された transcriptText を、事実を変えずに、読みやすい日本語へ整形してください。",
    "必ず次を守ってください。",
    "1. フィラーワード（えー、あの、えっと、そのー、まあ等）や不要な言い直しを削除する。",
    "2. 文体は敬体（です・ます調）に統一する。",
    "3. 子どもの名前、行動、発話、時系列は可能な限り保持する。",
    "4. 推測・要約・補足説明・解釈を加えない。",
    "5. 個人名や固有名詞は勝手に変更しない。",
    "6. 箇条書きや見出しにしない。自然な本文テキストとして返す。",
    "7. 出力はクリーンアップ後の本文のみ。JSON・説明文・前置きは不要。",
  ].join("\n");

  const userInput = {
    practiceCode: args.practiceCode ?? null,
    childNames: args.childNames,
    transcriptText: args.transcriptText,
  };

  const command = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: JSON.stringify(userInput, null, 2) }],
      },
    ],
    inferenceConfig: {
      maxTokens: 1400,
      temperature: 0,
    },
  });

  const response = await client.send(command);
  const responseText = normalizeText(
    stripCodeFence(extractResponseText(response)),
  );

  if (!responseText) {
    throw new Error("Claude response text was empty.");
  }

  return responseText;
}

export const handler: AppSyncResolverHandler<
  HandlerArgs,
  HandlerResult
> = async (event) => {
  const originalText = String(event.arguments.transcriptText ?? "").trim();
  if (!originalText) {
    throw new Error("transcriptText is required.");
  }

  const childNames = Array.isArray(event.arguments.childNames)
    ? event.arguments.childNames
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const cleanedText = await invokeClaude({
    transcriptText: originalText,
    childNames,
    practiceCode: event.arguments.practiceCode ?? null,
  });

  return {
    originalText,
    cleanedText,
    status: "SUCCEEDED",
    message:
      cleanedText === originalText
        ? "大きな修正はなく、そのまま利用できる内容でした。"
        : "フィラーワード除去と敬体変換を行いました。",
  };
};
