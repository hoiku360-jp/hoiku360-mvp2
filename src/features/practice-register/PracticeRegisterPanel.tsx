import { useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type Props = {
  owner: string;
  tenantId: string;
};

type CategoryOption = "outdoor" | "indoor" | "life" | "event" | "environment";
type PublishOption = "global" | "tenant" | "private";

type PracticeCodeCreateInput = Record<string, unknown>;
type PracticeCodeUpdateInput = Record<string, unknown> & { id: string };

type ModelError = {
  message?: string | null;
};

type OperationEnvelope<TData> = {
  data?: TData | null;
  errors?: ReadonlyArray<ModelError> | null;
};

type CleanupTranscriptResult = {
  originalText?: string | null;
  cleanedText?: string | null;
  status?: string | null;
  message?: string | null;
};

type CleanupTranscriptMutation = (
  args: unknown,
) => Promise<
  OperationEnvelope<CleanupTranscriptResult> | CleanupTranscriptResult
>;

type MutationClient = {
  cleanupTranscriptText?: CleanupTranscriptMutation;
};

type PracticeCodeModelClient = {
  create: (input: Record<string, unknown>) => Promise<{
    data?: { id?: string | null } | null;
    errors?: ReadonlyArray<ModelError> | null;
  }>;
  update: (input: Record<string, unknown> & { id: string }) => Promise<{
    data?: { id?: string | null } | null;
    errors?: ReadonlyArray<ModelError> | null;
  }>;
};

const CATEGORY_OPTIONS: Array<{ value: CategoryOption; label: string }> = [
  { value: "outdoor", label: "外遊び" },
  { value: "indoor", label: "室内遊び" },
  { value: "life", label: "生活（身支度/食事/排泄など）" },
  { value: "event", label: "行事" },
  { value: "environment", label: "環境構成" },
];

const PUBLISH_OPTIONS: Array<{ value: PublishOption; label: string }> = [
  { value: "global", label: "公開" },
  { value: "tenant", label: "園内" },
  { value: "private", label: "非公開" },
];

function toVisibilityAndScope(publish: PublishOption): {
  visibility: string;
  publishScope: string;
} {
  switch (publish) {
    case "global":
      return { visibility: "public", publishScope: "global" };
    case "tenant":
      return { visibility: "public", publishScope: "tenant" };
    case "private":
    default:
      return { visibility: "private", publishScope: "self" };
  }
}

function buildPracticeCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `PR-${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
}

function formatModelErrors(
  errors: ReadonlyArray<ModelError> | null | undefined,
  fallback: string,
): string {
  if (!errors?.length) return fallback;

  const message = errors
    .map((e) => e.message ?? "")
    .filter(Boolean)
    .join("\n");

  return message || fallback;
}

function getOperationErrors<TData>(
  res: OperationEnvelope<TData> | TData | null | undefined,
): ReadonlyArray<ModelError> | null {
  if (!res || typeof res !== "object") return null;
  const maybeEnvelope = res as OperationEnvelope<TData>;

  return Array.isArray(maybeEnvelope.errors) ? maybeEnvelope.errors : null;
}

function getOperationData<TData>(
  res: OperationEnvelope<TData> | TData | null | undefined,
): TData | null {
  if (!res) return null;

  if (typeof res === "object" && "data" in res) {
    return (res as OperationEnvelope<TData>).data ?? null;
  }

  return res as TData;
}

function defaultPracticeName(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "Practice下書き";
  return normalized.length <= 24 ? normalized : `${normalized.slice(0, 24)}…`;
}

export default function PracticeRegisterPanel(props: Props) {
  const { owner, tenantId } = props;
  const client = useMemo(() => generateClient<Schema>(), []);

  const practiceCodeModel = client.models
    .PracticeCode as unknown as PracticeCodeModelClient;

  const [category, setCategory] = useState<CategoryOption>("outdoor");
  const [publish, setPublish] = useState<PublishOption>("tenant");

  const [transcriptText, setTranscriptText] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [memo, setMemo] = useState("");

  const [createdPracticeId, setCreatedPracticeId] = useState("");
  const [createdPracticeCode, setCreatedPracticeCode] = useState("");
  const [createdStatus, setCreatedStatus] = useState("");

  const [cleaning, setCleaning] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const busy = cleaning || savingDraft || confirming;

  async function handleCleanupTranscript() {
    const text = transcriptText.trim();

    if (!text) {
      setError("先に transcript text を入力してください。");
      return;
    }

    setCleaning(true);
    setError("");
    setMessage("");

    try {
      const mutationClient = client.mutations as unknown as MutationClient;
      const cleanupRunner = mutationClient.cleanupTranscriptText;

      if (!cleanupRunner) {
        throw new Error(
          "cleanupTranscriptText が client.mutations に見つかりません。",
        );
      }

      const args = {
        practiceCode: createdPracticeCode || null,
        childNames: [],
        transcriptText: text,
      };

      let result:
        | OperationEnvelope<CleanupTranscriptResult>
        | CleanupTranscriptResult;

      try {
        result = await cleanupRunner(args);
      } catch {
        result = await cleanupRunner({ input: args });
      }

      const errors = getOperationErrors(result);
      if (errors?.length) {
        throw new Error(
          formatModelErrors(errors, "AIクリーンアップに失敗しました。"),
        );
      }

      const data = getOperationData<CleanupTranscriptResult>(result);
      const cleanedText = String(data?.cleanedText ?? "").trim();

      if (!cleanedText) {
        throw new Error("AIクリーンアップ結果が空です。");
      }

      setTranscriptText(cleanedText);
      setMessage(
        data?.message
          ? `AIクリーンアップを反映しました。${data.message}`
          : "AIクリーンアップを反映しました。必要に応じて手修正してください。",
      );
    } catch (e) {
      console.error(e);
      setError(
        `AIクリーンアップエラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setCleaning(false);
    }
  }

  async function handleSaveDraft() {
    const text = transcriptText.trim();

    if (!text) {
      setError("transcript text が空です。");
      return;
    }

    setSavingDraft(true);
    setError("");
    setMessage("");

    try {
      const { visibility, publishScope } = toVisibilityAndScope(publish);
      const nowIso = new Date().toISOString();

      const nextPracticeCode = createdPracticeCode || buildPracticeCode();
      const nextName =
        practiceName.trim() || defaultPracticeName(text) || "Practice下書き";

      if (createdPracticeId) {
        const updatePayload: PracticeCodeUpdateInput = {
          id: createdPracticeId,
          practice_code: nextPracticeCode,
          tenantId,
          owner,
          status: "REVIEW",
          name: nextName,
          memo: memo.trim(),
          source_type: "practiceRegister",
          version: 1,
          category_code: "",
          category_name: "",
          source_ref: "",
          source_url: "",
          visibility,
          publishScope,
          ownerType: "user",
          practiceCategory: category,
          practiceSourceType: "text",
          recordedAt: nowIso,
          transcriptText: text,
          aiStatus: "PENDING",
          aiModel: "",
          aiRawJson: "",
          errorMessage: "",
          updatedBy: owner,
          reviewedAt: nowIso,
        };

        const result = await practiceCodeModel.update(updatePayload);

        if (result.errors?.length) {
          throw new Error(
            formatModelErrors(result.errors, "PracticeCode の更新に失敗しました。"),
          );
        }

        setCreatedStatus("REVIEW");
        setPracticeName(nextName);
        setMessage(
          "Practice下書きを更新しました。内容確認後、「確定する」を押してください。",
        );
        return;
      }

      const createPayload: PracticeCodeCreateInput = {
        practice_code: nextPracticeCode,
        tenantId,
        owner,
        status: "REVIEW",
        name: nextName,
        memo: memo.trim(),
        source_type: "practiceRegister",
        version: 1,
        category_code: "",
        category_name: "",
        source_ref: "",
        source_url: "",
        createdBy: owner,
        updatedBy: owner,
        visibility,
        publishScope,
        ownerType: "user",
        practiceCategory: category,
        practiceSourceType: "text",
        recordedAt: nowIso,
        transcriptText: text,
        aiStatus: "PENDING",
        aiModel: "",
        aiRawJson: "",
        errorMessage: "",
        reviewedAt: nowIso,
      };

      const result = await practiceCodeModel.create(createPayload);

      if (result.errors?.length) {
        throw new Error(
          formatModelErrors(result.errors, "PracticeCode の作成に失敗しました。"),
        );
      }

      const id = String(result.data?.id ?? "");
      if (!id) {
        throw new Error("PracticeCode の id を取得できませんでした。");
      }

      setCreatedPracticeId(id);
      setCreatedPracticeCode(nextPracticeCode);
      setCreatedStatus("REVIEW");
      setPracticeName(nextName);
      setMessage(
        "Practice下書きを保存しました。内容確認後、「確定する」を押してください。",
      );
    } catch (e) {
      console.error(e);
      setError(
        `Practice保存エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleConfirmPractice() {
    if (!createdPracticeId || !createdPracticeCode) {
      setError("先に下書きを保存してください。");
      return;
    }

    const text = transcriptText.trim();
    const nextName = practiceName.trim();

    if (!text) {
      setError("transcript text が空です。");
      return;
    }

    if (!nextName) {
      setError("Practice名を入力してください。");
      return;
    }

    setConfirming(true);
    setError("");
    setMessage("");

    try {
      const nowIso = new Date().toISOString();
      const { visibility, publishScope } = toVisibilityAndScope(publish);

      const updatePayload: PracticeCodeUpdateInput = {
        id: createdPracticeId,
        practice_code: createdPracticeCode,
        tenantId,
        owner,
        status: "COMPLETED",
        name: nextName,
        memo: memo.trim(),
        source_type: "practiceRegister",
        version: 1,
        category_code: "",
        category_name: "",
        source_ref: "",
        source_url: "",
        visibility,
        publishScope,
        ownerType: "user",
        practiceCategory: category,
        practiceSourceType: "text",
        transcriptText: text,
        aiStatus: "PENDING",
        errorMessage: "",
        updatedBy: owner,
        completedAt: nowIso,
      };

      const result = await practiceCodeModel.update(updatePayload);

      if (result.errors?.length) {
        throw new Error(
          formatModelErrors(result.errors, "PracticeCode の確定に失敗しました。"),
        );
      }

      setCreatedStatus("COMPLETED");
      setMessage(
        "Practiceを確定しました。次に Practice検索 / 一覧 の「Practice一覧・メンテ」で、AIで名前と要約を作る → Ability候補を生成 → 本登録する、の順に進めてください。",
      );
    } catch (e) {
      console.error(e);
      setError(
        `Practice確定エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Practice登録</h2>

      <div
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 920,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
          iPad または Windows PC 側で音声入力したテキストを貼り付けます。
          その後、AIクリーンアップ、手修正、確定の順に進めます。
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>カテゴリー</div>
            <div style={{ display: "grid", gap: 8 }}>
              {CATEGORY_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="radio"
                    name="practice-category"
                    value={opt.value}
                    checked={category === opt.value}
                    disabled={busy}
                    onChange={() => setCategory(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>公開設定</div>
            <div style={{ display: "grid", gap: 8 }}>
              {PUBLISH_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="radio"
                    name="practice-publish"
                    value={opt.value}
                    checked={publish === opt.value}
                    disabled={busy}
                    onChange={() => setPublish(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            transcript text
          </div>
          <textarea
            value={transcriptText}
            disabled={busy}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="iPad / Windows PC の音声入力で作成したテキストをここに貼り付けてください。"
            style={{
              width: "100%",
              minHeight: 240,
              boxSizing: "border-box",
              padding: 10,
              lineHeight: 1.7,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            入力文字数: {transcriptText.trim().length}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Practice名（任意）
          </div>
          <input
            value={practiceName}
            disabled={busy}
            onChange={(e) => setPracticeName(e.target.value)}
            placeholder="未入力の場合は transcript の冒頭から仮名を作ります。"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 8,
              fontFamily: "inherit",
            }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            memo / 要約（任意）
          </div>
          <textarea
            value={memo}
            disabled={busy}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="必要に応じて、実践の概要や保育者の意図を記入します。AIで名前と要約を作る前なら空でも構いません。"
            style={{
              width: "100%",
              minHeight: 120,
              boxSizing: "border-box",
              padding: 10,
              lineHeight: 1.7,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || !transcriptText.trim()}
            onClick={handleCleanupTranscript}
          >
            {cleaning ? "クリーンアップ中..." : "AIによるクリーンアップ"}
          </button>

          <button
            type="button"
            disabled={busy || !transcriptText.trim()}
            onClick={handleSaveDraft}
          >
            {savingDraft ? "保存中..." : "下書き保存"}
          </button>

          <button
            type="button"
            disabled={busy || !createdPracticeId || !transcriptText.trim()}
            onClick={handleConfirmPractice}
          >
            {confirming ? "確定中..." : "確定する"}
          </button>
        </div>

        {error ? (
          <div
            style={{
              color: "#b00020",
              whiteSpace: "pre-wrap",
              border: "1px solid #f2b8b5",
              background: "#fff8f8",
              padding: 10,
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              color: "#0b5",
              whiteSpace: "pre-wrap",
              border: "1px solid #b7e4c7",
              background: "#f6fff8",
              padding: 10,
              borderRadius: 6,
            }}
          >
            {message}
          </div>
        ) : null}

        {createdPracticeCode ? (
          <div
            style={{
              display: "grid",
              gap: 4,
              fontSize: 13,
              borderTop: "1px solid #eee",
              paddingTop: 12,
              color: "#333",
            }}
          >
            <div>
              <strong>PracticeCode:</strong> {createdPracticeCode}
            </div>
            <div>
              <strong>Status:</strong> {createdStatus || "(未設定)"}
            </div>
            <div>
              <strong>Tenant:</strong> {tenantId}
            </div>
            <div>
              <strong>Owner:</strong> {owner}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{ maxWidth: 920, marginTop: 16, color: "#555", fontSize: 13 }}
      >
        確定後は、Practice検索 / 一覧 の「Practice一覧・メンテ」で
        「AIで名前と要約を作る」→「Ability候補を生成」→「採用」→
        「本登録する」の順に進めてください。
      </div>
    </div>
  );
}