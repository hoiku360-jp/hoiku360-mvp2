import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type Props = {
  owner: string;
  tenantId: string;
};

type CategoryOption = "outdoor" | "indoor" | "life" | "event" | "environment";
type PublishOption = "global" | "tenant" | "private";
type SeasonalityOption = "ALL_YEAR" | "MONTHS";

type PracticeCodeCreateInput = Record<string, unknown>;
type PracticeCodeUpdateInput = Record<string, unknown> & { id: string };

type ModelError = {
  message?: string | null;
};

type OperationEnvelope<TData> = {
  data?: TData | null;
  errors?: ReadonlyArray<ModelError> | null;
};

type ListResult<T> = {
  data?: T[] | null;
  nextToken?: string | null;
  errors?: ReadonlyArray<ModelError> | null;
};

type CleanupTranscriptResult = {
  originalText?: string | null;
  cleanedText?: string | null;
  status?: string | null;
  message?: string | null;
};

type AnalyzePracticeResult = {
  practiceId?: string | null;
  practiceCode?: string | null;
  name?: string | null;
  memo?: string | null;
  status?: string | null;
  aiModel?: string | null;
};

type SuggestPracticeLinksResult = {
  practiceId?: string | null;
  practiceCode?: string | null;
  suggestionCount?: number | null;
  status?: string | null;
  aiModel?: string | null;
};

type RegisterPracticeLinksResult = {
  practiceCode?: string | null;
  registeredCount?: number | null;
  status?: string | null;
};

type CleanupTranscriptMutation = (
  args: unknown,
) => Promise<
  OperationEnvelope<CleanupTranscriptResult> | CleanupTranscriptResult
>;

type AnalyzePracticeMutation = (
  args: unknown,
) => Promise<OperationEnvelope<AnalyzePracticeResult> | AnalyzePracticeResult>;

type SuggestPracticeLinksMutation = (
  args: unknown,
) => Promise<
  OperationEnvelope<SuggestPracticeLinksResult> | SuggestPracticeLinksResult
>;

type RegisterPracticeLinksMutation = (
  args: unknown,
) => Promise<
  OperationEnvelope<RegisterPracticeLinksResult> | RegisterPracticeLinksResult
>;

type MutationClient = {
  cleanupTranscriptText?: CleanupTranscriptMutation;
  analyzePractice?: AnalyzePracticeMutation;
  suggestPracticeLinks?: SuggestPracticeLinksMutation;
  registerPracticeLinks?: RegisterPracticeLinksMutation;
};

type PracticeCodeRow = {
  id?: string | null;
  practice_code?: string | null;
  category_code?: string | null;
  category_name?: string | null;
  name?: string | null;
  memo?: string | null;
  source_type?: string | null;
  source_ref?: string | null;
  source_url?: string | null;
  status?: string | null;
  version?: number | null;
  tenantId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  visibility?: string | null;
  publishScope?: string | null;
  ownerType?: string | null;
  owner?: string | null;
  practiceCategory?: string | null;
  practiceSourceType?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  seasonalityType?: string | null;
  seasonMonthsJson?: unknown;
  recordedAt?: string | null;
  transcriptText?: string | null;
  aiStatus?: string | null;
  aiModel?: string | null;
  aiRawJson?: string | null;
  errorMessage?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type PracticeLinkSuggestionRow = {
  id: string;
  tenantId?: string | null;
  practiceCode?: string | null;
  abilityCode?: string | null;
  score?: number | null;
  reason?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AbilityCodeRow = {
  id?: string | null;
  code?: string | null;
  code_display?: string | null;
  parent_code?: string | null;
  level?: number | null;
  name?: string | null;
  domain?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_leaf?: boolean | null;
  status?: string | null;
  note?: string | null;
};

type PracticeCodeModelClient = {
  create: (input: Record<string, unknown>) => Promise<{
    data?: { id?: string | null } | null;
    errors?: ReadonlyArray<ModelError> | null;
  }>;
  update: (input: Record<string, unknown> & { id: string }) => Promise<{
    data?: PracticeCodeRow | null;
    errors?: ReadonlyArray<ModelError> | null;
  }>;
  list: (input?: Record<string, unknown>) => Promise<ListResult<PracticeCodeRow>>;
};

type PracticeLinkSuggestionModelClient = {
  list: (
    input?: Record<string, unknown>,
  ) => Promise<ListResult<PracticeLinkSuggestionRow>>;
  update: (input: Record<string, unknown> & { id: string }) => Promise<{
    data?: PracticeLinkSuggestionRow | null;
    errors?: ReadonlyArray<ModelError> | null;
  }>;
};

type AbilityCodeModelClient = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<AbilityCodeRow>>;
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

const TARGET_AGE_OPTIONS = [3, 4, 5] as const;
const DEFAULT_TARGET_AGE_MIN = 3;
const DEFAULT_TARGET_AGE_MAX = 5;
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const SEASONALITY_OPTIONS: Array<{ value: SeasonalityOption; label: string }> = [
  { value: "ALL_YEAR", label: "通年" },
  { value: "MONTHS", label: "月指定" },
];

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMonths(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
  }

  const text = s(value);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return text
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
}

function normalizeAge(value: unknown, fallback: number): number {
  const age = Number(value ?? fallback);
  if (TARGET_AGE_OPTIONS.some((option) => option === age)) return age;
  return fallback;
}

function normalizeSeasonality(value: unknown): SeasonalityOption {
  return s(value).toUpperCase() === "MONTHS" ? "MONTHS" : "ALL_YEAR";
}

function formatTargetAge(minAge: unknown, maxAge: unknown): string {
  const min = normalizeAge(minAge, DEFAULT_TARGET_AGE_MIN);
  const max = normalizeAge(maxAge, DEFAULT_TARGET_AGE_MAX);
  return min === max ? `${min}歳` : `${min}〜${max}歳`;
}

function formatSeasonality(type: unknown, monthsValue: unknown): string {
  const seasonalityType = normalizeSeasonality(type);
  if (seasonalityType === "ALL_YEAR") return "通年";

  const months = parseMonths(monthsValue);
  if (months.length === 0) return "月指定（未設定）";

  return months
    .slice()
    .sort((a, b) => a - b)
    .map((month) => `${month}月`)
    .join("、");
}

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

function fromVisibilityAndScope(args: {
  visibility?: string | null;
  publishScope?: string | null;
}): PublishOption {
  const visibility = s(args.visibility).toLowerCase();
  const publishScope = s(args.publishScope).toLowerCase();

  if (visibility === "private" || publishScope === "self") return "private";
  if (publishScope === "global") return "global";
  return "tenant";
}

function normalizePracticeCategory(value: unknown): CategoryOption {
  const raw = s(value);
  const lower = raw.toLowerCase();

  if (CATEGORY_OPTIONS.some((opt) => opt.value === lower)) {
    return lower as CategoryOption;
  }

  switch (raw) {
    case "外遊び":
      return "outdoor";
    case "室内遊び":
      return "indoor";
    case "生活":
    case "生活（身支度/食事/排泄など）":
      return "life";
    case "行事":
      return "event";
    case "環境":
    case "環境構成":
      return "environment";
    default:
      return "outdoor";
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

function readValue(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) return undefined;
  return (obj as Record<string, unknown>)[key];
}

function defaultPracticeName(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "Practice下書き";
  return normalized.length <= 24 ? normalized : `${normalized.slice(0, 24)}…`;
}

function isAcceptedSuggestion(row: PracticeLinkSuggestionRow): boolean {
  const status = s(row.status).toLowerCase();
  return status === "accepted" || status === "edited";
}

function buildAbilityLabelMap(codes: AbilityCodeRow[]) {
  const byCode = new Map<string, AbilityCodeRow>();
  for (const code of codes) {
    const key = s(code.code);
    if (key) byCode.set(key, code);
  }

  function label(code: unknown): string {
    const key = s(code);
    const item = byCode.get(key);
    if (!item) return key || "-";

    const parentCode = s(item.parent_code);
    const parent = parentCode ? byCode.get(parentCode) : null;
    const parentName = parent ? ` / ${s(parent.name)}` : "";

    return `${key}_${s(item.name)}${parentName}`;
  }

  return { label };
}

function previewText(value: unknown, max = 160): string {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function findPracticeByCodeForTenant(
  model: PracticeCodeModelClient,
  tenantId: string,
  owner: string,
  practiceCode: string,
): Promise<PracticeCodeRow | null> {
  const normalizedTenantId = s(tenantId);
  const normalizedOwner = s(owner);
  const normalizedPracticeCode = s(practiceCode).toUpperCase();

  let nextToken: string | null | undefined;
  const sameCodeRows: PracticeCodeRow[] = [];

  do {
    const result = await model.list({
      authMode: "userPool",
      limit: 1000,
      nextToken,
    });

    if (result.errors?.length) {
      throw new Error(
        formatModelErrors(
          result.errors,
          "PracticeCodeの検索に失敗しました。",
        ),
      );
    }

    for (const row of result.data ?? []) {
      if (
        s(row.practice_code).toUpperCase() !== normalizedPracticeCode
      ) {
        continue;
      }

      sameCodeRows.push(row);

      const sameTenant = s(row.tenantId) === normalizedTenantId;
      const sameOwner = s(row.owner) === normalizedOwner;

      if (sameTenant && sameOwner) {
        return row;
      }
    }

    nextToken = result.nextToken ?? null;
  } while (nextToken);

  const sameTenantRow = sameCodeRows.find(
    (row) => s(row.tenantId) === normalizedTenantId,
  );

  if (sameTenantRow) {
    throw new Error(
      [
        "このPracticeは別のユーザーが登録したため、メンテナンスできません。",
        "登録したユーザーでログインしてください。",
      ].join(" "),
    );
  }

  if (sameCodeRows.length > 0) {
    throw new Error(
      [
        "このPracticeは別の園で登録されているため、メンテナンスできません。",
        "登録した園のユーザーでログインしてください。",
      ].join(" "),
    );
  }

  return null;
}

export default function PracticeRegisterPanel(props: Props) {
  const { owner, tenantId } = props;
  const client = useMemo(() => generateClient<Schema>(), []);

  const practiceCodeModel = client.models
    .PracticeCode as unknown as PracticeCodeModelClient;
  const suggestionModel = client.models
    .PracticeLinkSuggestion as unknown as PracticeLinkSuggestionModelClient;
  const abilityCodeModel = client.models
    .AbilityCode as unknown as AbilityCodeModelClient;

  const [mode, setMode] = useState<"create" | "maintenance">("create");
  const [loadPracticeCode, setLoadPracticeCode] = useState("");

  const [category, setCategory] = useState<CategoryOption>("outdoor");
  const [publish, setPublish] = useState<PublishOption>("tenant");

  const [targetAgeMin, setTargetAgeMin] = useState(DEFAULT_TARGET_AGE_MIN);
  const [targetAgeMax, setTargetAgeMax] = useState(DEFAULT_TARGET_AGE_MAX);
  const [seasonalityType, setSeasonalityType] =
    useState<SeasonalityOption>("ALL_YEAR");
  const [seasonMonths, setSeasonMonths] = useState<number[]>(ALL_MONTHS);

  const [transcriptText, setTranscriptText] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [memo, setMemo] = useState("");

  const [createdPracticeId, setCreatedPracticeId] = useState("");
  const [createdPracticeCode, setCreatedPracticeCode] = useState("");
  const [createdStatus, setCreatedStatus] = useState("");

  const [suggestions, setSuggestions] = useState<PracticeLinkSuggestionRow[]>(
    [],
  );
  const [abilityCodes, setAbilityCodes] = useState<AbilityCodeRow[]>([]);

  const [cleaning, setCleaning] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [savingSuggestionId, setSavingSuggestionId] = useState("");
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [registering, setRegistering] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const abilityLabel = useMemo(
    () => buildAbilityLabelMap(abilityCodes).label,
    [abilityCodes],
  );

  const acceptedCount = useMemo(
    () => suggestions.filter(isAcceptedSuggestion).length,
    [suggestions],
  );

  const busy =
    cleaning ||
    savingDraft ||
    confirming ||
    loadingPractice ||
    analyzing ||
    suggesting ||
    acceptingAll ||
    registering;

  const selectedSeasonMonths =
    seasonalityType === "ALL_YEAR" ? ALL_MONTHS : seasonMonths;

  function handleChangeTargetAgeMin(nextAge: number) {
    setTargetAgeMin(nextAge);
    if (targetAgeMax < nextAge) setTargetAgeMax(nextAge);
  }

  function handleChangeTargetAgeMax(nextAge: number) {
    setTargetAgeMax(nextAge);
    if (targetAgeMin > nextAge) setTargetAgeMin(nextAge);
  }

  function handleChangeSeasonality(nextType: SeasonalityOption) {
    setSeasonalityType(nextType);
    if (nextType === "ALL_YEAR") {
      setSeasonMonths(ALL_MONTHS);
    } else if (seasonMonths.length === 0) {
      const currentMonth = new Date().getMonth() + 1;
      setSeasonMonths([currentMonth]);
    }
  }

  function handleToggleSeasonMonth(month: number, checked: boolean) {
    setSeasonMonths((prev) => {
      const next = checked
        ? Array.from(new Set([...prev, month]))
        : prev.filter((item) => item !== month);

      return next.sort((a, b) => a - b);
    });
  }

  const loadAbilityCodes = useCallback(async () => {
    const result = await abilityCodeModel.list({ limit: 10000 });

    if (result.errors?.length) {
      throw new Error(formatModelErrors(result.errors, "AbilityCode取得に失敗しました。"));
    }

    const rows = (result.data ?? []).filter((row) => {
      const status = s(row.status || "active").toLowerCase();
      return status === "active";
    });

    setAbilityCodes(rows);
  }, [abilityCodeModel]);

  useEffect(() => {
    loadAbilityCodes().catch((e: unknown) => {
      console.error(e);
    });
  }, [loadAbilityCodes]);

  function resetForm() {
    setLoadPracticeCode("");
    setCategory("outdoor");
    setPublish("tenant");
    setTargetAgeMin(DEFAULT_TARGET_AGE_MIN);
    setTargetAgeMax(DEFAULT_TARGET_AGE_MAX);
    setSeasonalityType("ALL_YEAR");
    setSeasonMonths(ALL_MONTHS);
    setTranscriptText("");
    setPracticeName("");
    setMemo("");
    setCreatedPracticeId("");
    setCreatedPracticeCode("");
    setCreatedStatus("");
    setSuggestions([]);
    setError("");
    setMessage("");
  }

  function applyPracticeToForm(practice: PracticeCodeRow) {
    setCreatedPracticeId(s(practice.id));
    setCreatedPracticeCode(s(practice.practice_code));
    setCreatedStatus(s(practice.status));
    setPracticeName(s(practice.name));
    setMemo(s(practice.memo));
    setTranscriptText(s(practice.transcriptText));
    setCategory(
      normalizePracticeCategory(
        s(practice.practiceCategory) || s(practice.category_name),
      ),
    );

    const nextAgeMin = normalizeAge(
      practice.targetAgeMin,
      DEFAULT_TARGET_AGE_MIN,
    );
    const nextAgeMax = normalizeAge(
      practice.targetAgeMax,
      DEFAULT_TARGET_AGE_MAX,
    );
    setTargetAgeMin(Math.min(nextAgeMin, nextAgeMax));
    setTargetAgeMax(Math.max(nextAgeMin, nextAgeMax));

    const nextSeasonality = normalizeSeasonality(practice.seasonalityType);
    const nextMonths = parseMonths(practice.seasonMonthsJson);
    setSeasonalityType(nextSeasonality);
    setSeasonMonths(
      nextSeasonality === "ALL_YEAR"
        ? ALL_MONTHS
        : nextMonths.length > 0
          ? nextMonths
          : ALL_MONTHS,
    );

    setPublish(
      fromVisibilityAndScope({
        visibility: practice.visibility,
        publishScope: practice.publishScope,
      }),
    );
  }

  async function listSuggestions(practiceCode: string) {
    if (!practiceCode) {
      setSuggestions([]);
      return;
    }

    const result = await suggestionModel.list({
      filter: {
        practiceCode: { eq: practiceCode },
      },
      limit: 1000,
    });

    if (result.errors?.length) {
      throw new Error(
        formatModelErrors(result.errors, "Ability候補一覧の取得に失敗しました。"),
      );
    }

    const rows = [...(result.data ?? [])].sort((a, b) => {
      const left = n(a.sortOrder, 9999);
      const right = n(b.sortOrder, 9999);
      return left - right;
    });

    setSuggestions(rows);
  }

  async function handleLoadPracticeByCode() {
    const targetCode = loadPracticeCode.trim().toUpperCase();

    if (!targetCode) {
      setError("読み込む practiceCode を入力してください。");
      return;
    }

    setLoadingPractice(true);
    setError("");
    setMessage("");

    try {
      const practice = await findPracticeByCodeForTenant(
        practiceCodeModel,
        tenantId,
        owner,
        targetCode,
      );

      if (!practice) {
        throw new Error(
          `指定したPracticeCodeが見つかりません。入力内容を確認してください: ${targetCode}`,
        );
      }

      const actualPracticeCode = s(practice.practice_code);

      applyPracticeToForm(practice);
      setLoadPracticeCode(actualPracticeCode);

      await listSuggestions(actualPracticeCode);

      setMode("maintenance");
      setMessage(
        `既存Practiceを読み込みました: ${actualPracticeCode}。必要に応じて編集・再生成・本登録できます。`,
      );
    } catch (e) {
      console.error(e);

      setError(
        `Practice読み込みエラー: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      setLoadingPractice(false);
    }
  }

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

  async function saveDraftInternal(options?: {
    nextStatus?: string;
    completedAt?: string;
    silent?: boolean;
  }): Promise<{ id: string; practiceCode: string }> {
    const text = transcriptText.trim();

    if (!text) {
      throw new Error("transcript text が空です。");
    }

    const { visibility, publishScope } = toVisibilityAndScope(publish);
    const nowIso = new Date().toISOString();

    const nextPracticeCode = createdPracticeCode || buildPracticeCode();
    const nextName =
      practiceName.trim() || defaultPracticeName(text) || "Practice下書き";
    const nextStatus = options?.nextStatus ?? "REVIEW";
    const normalizedTargetAgeMin = Math.min(targetAgeMin, targetAgeMax);
    const normalizedTargetAgeMax = Math.max(targetAgeMin, targetAgeMax);
    const normalizedSeasonMonths =
      seasonalityType === "ALL_YEAR" ? ALL_MONTHS : selectedSeasonMonths;

    if (seasonalityType === "MONTHS" && normalizedSeasonMonths.length === 0) {
      throw new Error("月指定の場合は、対象月を1つ以上選択してください。");
    }

    if (createdPracticeId) {
      const updatePayload: PracticeCodeUpdateInput = {
        id: createdPracticeId,
        practice_code: nextPracticeCode,
        tenantId,
        owner,
        status: nextStatus,
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
        targetAgeMin: normalizedTargetAgeMin,
        targetAgeMax: normalizedTargetAgeMax,
        seasonalityType,
        seasonMonthsJson: JSON.stringify(normalizedSeasonMonths),
        recordedAt: nowIso,
        transcriptText: text,
        aiStatus: "PENDING",
        errorMessage: "",
        updatedBy: owner,
        reviewedAt: nowIso,
        completedAt: options?.completedAt,
      };

      const result = await practiceCodeModel.update(updatePayload);

      if (result.errors?.length) {
        throw new Error(
          formatModelErrors(result.errors, "PracticeCode の更新に失敗しました。"),
        );
      }

      setCreatedStatus(nextStatus);
      setPracticeName(nextName);
      if (!options?.silent) {
        setMessage(
          nextStatus === "COMPLETED"
            ? "Practiceを確定しました。このままAI生成へ進めます。"
            : "Practice下書きを更新しました。",
        );
      }

      return {
        id: createdPracticeId,
        practiceCode: nextPracticeCode,
      };
    }

    const createPayload: PracticeCodeCreateInput = {
      practice_code: nextPracticeCode,
      tenantId,
      owner,
      status: nextStatus,
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
      targetAgeMin: normalizedTargetAgeMin,
      targetAgeMax: normalizedTargetAgeMax,
      seasonalityType,
      seasonMonthsJson: JSON.stringify(normalizedSeasonMonths),
      recordedAt: nowIso,
      transcriptText: text,
      aiStatus: "PENDING",
      aiModel: "",
      aiRawJson: "",
      errorMessage: "",
      reviewedAt: nowIso,
      completedAt: options?.completedAt,
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
    setCreatedStatus(nextStatus);
    setPracticeName(nextName);
    if (!options?.silent) {
      setMessage(
        nextStatus === "COMPLETED"
          ? "Practiceを確定しました。このままAI生成へ進めます。"
          : "Practice下書きを保存しました。",
      );
    }

    return {
      id,
      practiceCode: nextPracticeCode,
    };
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    setError("");
    setMessage("");

    try {
      await saveDraftInternal();
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
    setConfirming(true);
    setError("");
    setMessage("");

    try {
      await saveDraftInternal({
        nextStatus: "COMPLETED",
        completedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
      setError(
        `Practice確定エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleAnalyzePractice() {
    setAnalyzing(true);
    setError("");
    setMessage("");

    try {
      const draft = await saveDraftInternal({
        nextStatus: createdStatus || "REVIEW",
        silent: true,
      });

      const mutationClient = client.mutations as unknown as MutationClient;
      const runner = mutationClient.analyzePractice;

      if (!runner) {
        throw new Error("analyzePractice が client.mutations に見つかりません。");
      }

      let result: OperationEnvelope<AnalyzePracticeResult> | AnalyzePracticeResult;

      try {
        result = await runner({ practiceId: draft.id });
      } catch {
        result = await runner({ input: { practiceId: draft.id } });
      }

      const errors = getOperationErrors(result);
      if (errors?.length) {
        throw new Error(formatModelErrors(errors, "AI生成に失敗しました。"));
      }

      const data = getOperationData<AnalyzePracticeResult>(result);
      const nextName = s(data?.name);
      const nextMemo = s(data?.memo);
      const nextStatus = s(data?.status) || "REVIEW";

      if (nextName) setPracticeName(nextName);
      if (nextMemo) setMemo(nextMemo);
      setCreatedStatus(nextStatus);

      setMessage(
        nextName
          ? `AIでPractice名と要約を作成しました: ${nextName}。内容を確認・手修正してから Ability候補を生成してください。`
          : "AIでPractice名と要約を作成しました。内容を確認・手修正してから Ability候補を生成してください。",
      );
    } catch (e) {
      console.error(e);
      setError(`AI生成エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSuggestLinks() {
    setSuggesting(true);
    setError("");
    setMessage("");

    try {
      if (!practiceName.trim()) {
        throw new Error("Practice名を入力してください。");
      }
      if (!memo.trim()) {
        throw new Error("memo / 要約を入力してください。");
      }

      const draft = await saveDraftInternal({
        nextStatus: createdStatus || "REVIEW",
        silent: true,
      });

      const mutationClient = client.mutations as unknown as MutationClient;
      const runner = mutationClient.suggestPracticeLinks;

      if (!runner) {
        throw new Error(
          "suggestPracticeLinks が client.mutations に見つかりません。",
        );
      }

      let result:
        | OperationEnvelope<SuggestPracticeLinksResult>
        | SuggestPracticeLinksResult;

      try {
        result = await runner({ practiceId: draft.id });
      } catch {
        result = await runner({ input: { practiceId: draft.id } });
      }

      const errors = getOperationErrors(result);
      if (errors?.length) {
        throw new Error(formatModelErrors(errors, "Ability候補生成に失敗しました。"));
      }

      const data = getOperationData<SuggestPracticeLinksResult>(result);
      const count = n(readValue(data, "suggestionCount"));

      await listSuggestions(draft.practiceCode);
      setMessage(
        `Ability候補生成が完了しました: ${count}件。候補を確認し、採用するものにチェックを入れてください。`,
      );
    } catch (e) {
      console.error(e);
      setError(
        `Ability候補生成エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function updateSuggestion(
    row: PracticeLinkSuggestionRow,
    patch: {
      status?: string;
      score?: number;
    },
  ) {
    const payload = {
      id: row.id,
      tenantId: row.tenantId ?? undefined,
      practiceCode: row.practiceCode ?? "",
      abilityCode: row.abilityCode ?? "",
      score: patch.score ?? n(row.score, 1),
      reason: row.reason ?? "",
      status: patch.status ?? row.status ?? "suggested",
      sortOrder: n(row.sortOrder),
      createdBy: row.createdBy ?? undefined,
      updatedBy: owner,
    };

    const result = await suggestionModel.update(payload);

    if (result.errors?.length) {
      throw new Error(
        formatModelErrors(result.errors, "候補ステータス更新に失敗しました。"),
      );
    }

    const updated = result.data ?? {
      ...row,
      ...payload,
    };

    setSuggestions((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)),
    );
  }

  async function handleToggleSuggestion(
    row: PracticeLinkSuggestionRow,
    checked: boolean,
  ) {
    setSavingSuggestionId(row.id);
    setError("");
    setMessage("");

    try {
      await updateSuggestion(row, {
        status: checked ? "accepted" : "rejected",
      });
    } catch (e) {
      console.error(e);
      setError(
        `候補更新エラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSavingSuggestionId("");
    }
  }

  async function handleChangeSuggestionScore(
    row: PracticeLinkSuggestionRow,
    score: number,
  ) {
    setSavingSuggestionId(row.id);
    setError("");
    setMessage("");

    try {
      await updateSuggestion(row, {
        score,
        status: "edited",
      });
    } catch (e) {
      console.error(e);
      setError(`score更新エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingSuggestionId("");
    }
  }

  async function handleAcceptAllSuggestions() {
    if (suggestions.length === 0) {
      setError("採用する候補がありません。");
      return;
    }

    setAcceptingAll(true);
    setError("");
    setMessage("");

    try {
      for (const row of suggestions) {
        if (!isAcceptedSuggestion(row)) {
          await updateSuggestion(row, { status: "accepted" });
        }
      }

      setMessage("表示中のAbility候補をすべて採用にしました。");
    } catch (e) {
      console.error(e);
      setError(`一括採用エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAcceptingAll(false);
    }
  }

  async function handleRegisterPracticeLinks() {
    if (!createdPracticeCode) {
      setError("PracticeCode が未作成です。先に下書き保存または確定してください。");
      return;
    }

    if (acceptedCount === 0) {
      setError("採用済みのAbility候補がありません。");
      return;
    }

    setRegistering(true);
    setError("");
    setMessage("");

    try {
      const mutationClient = client.mutations as unknown as MutationClient;
      const runner = mutationClient.registerPracticeLinks;

      if (!runner) {
        throw new Error(
          "registerPracticeLinks が client.mutations に見つかりません。",
        );
      }

      let result:
        | OperationEnvelope<RegisterPracticeLinksResult>
        | RegisterPracticeLinksResult;

      try {
        result = await runner({ practiceCode: createdPracticeCode });
      } catch {
        result = await runner({ input: { practiceCode: createdPracticeCode } });
      }

      const errors = getOperationErrors(result);
      if (errors?.length) {
        throw new Error(formatModelErrors(errors, "本登録に失敗しました。"));
      }

      const data = getOperationData<RegisterPracticeLinksResult>(result);
      const count = n(readValue(data, "registeredCount"));
      const nextStatus = s(readValue(data, "status")) || "REGISTERED";
      const completeMessage = `Practice本登録が完了しました: ${count}件 / status=${nextStatus}。続けて新しいPracticeを登録できます。`;

      setMode("create");
      resetForm();
      setMessage(completeMessage);
    } catch (e) {
      console.error(e);
      setError(`本登録エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegistering(false);
    }
  }

  async function handleArchivePractice() {
    if (!createdPracticeId || !createdPracticeCode) {
      setError("アーカイブするPracticeが読み込まれていません。");
      return;
    }

    const confirmed = window.confirm(
      [
        "Practiceをアーカイブします。",
        createdPracticeCode,
        "",
        "この画面では PracticeCode.status を ARCHIVED に変更します。",
        "関連する AbilityPracticeLink / AbilityPracticeAgg / PracticeLinkSuggestion の掃除は、必要に応じて Practice検索 / 一覧 側の整理機能を使ってください。",
        "",
        "実行してよろしいですか？",
      ].join("\n"),
    );

    if (!confirmed) return;

    setSavingDraft(true);
    setError("");
    setMessage("");

    try {
      const result = await practiceCodeModel.update({
        id: createdPracticeId,
        practice_code: createdPracticeCode,
        tenantId,
        owner,
        name: practiceName.trim() || "ARCHIVED Practice",
        memo: memo.trim(),
        source_type: "practiceRegister",
        version: 1,
        status: "ARCHIVED",
        practiceCategory: category,
        targetAgeMin,
        targetAgeMax,
        seasonalityType,
        seasonMonthsJson: JSON.stringify(selectedSeasonMonths),
        visibility: toVisibilityAndScope(publish).visibility,
        publishScope: toVisibilityAndScope(publish).publishScope,
        transcriptText: transcriptText.trim(),
        updatedBy: owner,
      });

      if (result.errors?.length) {
        throw new Error(
          formatModelErrors(result.errors, "Practiceのアーカイブに失敗しました。"),
        );
      }

      setCreatedStatus("ARCHIVED");
      setMessage(`Practiceをアーカイブしました: ${createdPracticeCode}`);
    } catch (e) {
      console.error(e);
      setError(
        `アーカイブエラー: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSavingDraft(false);
    }
  }

  const canRunAi =
    Boolean(createdPracticeId) || Boolean(transcriptText.trim());
  const canSuggest = canRunAi && Boolean(practiceName.trim()) && Boolean(memo.trim());

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Practice登録 / メンテ</h2>

      <div
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 980,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setMode("create");
              resetForm();
            }}
            disabled={busy || mode === "create"}
          >
            新規登録
          </button>
          <button
            type="button"
            onClick={() => setMode("maintenance")}
            disabled={busy || mode === "maintenance"}
          >
            既存Practiceをメンテ
          </button>
        </div>

        {mode === "maintenance" ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 700 }}>既存Practiceの読み込み</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={loadPracticeCode}
                disabled={busy}
                onChange={(e) => setLoadPracticeCode(e.target.value)}
                placeholder="例: PR-20260711-120000-ABCD"
                style={{
                  minWidth: 320,
                  padding: 8,
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                disabled={busy || !loadPracticeCode.trim()}
                onClick={handleLoadPracticeByCode}
              >
                {loadingPractice ? "読み込み中..." : "読み込む"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Practice検索 / 一覧で見つけた practiceCode を指定すると、この画面で編集・AI再生成・Ability候補生成・本登録まで行えます。
            </div>
          </div>
        ) : null}

        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
          iPad または Windows PC 側で音声入力したテキストを貼り付けます。
          その後、AIクリーンアップ、下書き保存、確定、AIで名前と要約、
          Ability候補生成、採用、本登録までこの画面で進めます。
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fcfcfc",
            }}
          >
            <div style={{ fontWeight: 700 }}>対象年齢</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                最小
                <select
                  value={targetAgeMin}
                  disabled={busy}
                  onChange={(e) => handleChangeTargetAgeMin(Number(e.target.value))}
                >
                  {TARGET_AGE_OPTIONS.map((age) => (
                    <option key={age} value={age}>
                      {age}歳
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                最大
                <select
                  value={targetAgeMax}
                  disabled={busy}
                  onChange={(e) => handleChangeTargetAgeMax(Number(e.target.value))}
                >
                  {TARGET_AGE_OPTIONS.map((age) => (
                    <option key={age} value={age}>
                      {age}歳
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              インパクト分析で、対象クラス年齢に合うPracticeだけを候補に出すための情報です。
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
              background: "#fcfcfc",
            }}
          >
            <div style={{ fontWeight: 700 }}>季節性</div>
            <div style={{ display: "grid", gap: 8 }}>
              {SEASONALITY_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="radio"
                    name="practice-seasonality"
                    value={opt.value}
                    checked={seasonalityType === opt.value}
                    disabled={busy}
                    onChange={() => handleChangeSeasonality(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            {seasonalityType === "MONTHS" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 6,
                }}
              >
                {ALL_MONTHS.map((month) => (
                  <label
                    key={month}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={seasonMonths.includes(month)}
                      disabled={busy}
                      onChange={(e) =>
                        handleToggleSeasonMonth(month, e.target.checked)
                      }
                    />
                    <span>{MONTH_LABELS[month - 1]}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <div style={{ fontSize: 12, color: "#666" }}>
              七夕やクリスマスなど、時期が限定されるPracticeは月指定にします。
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
            Practice名
          </div>
          <input
            value={practiceName}
            disabled={busy}
            onChange={(e) => setPracticeName(e.target.value)}
            placeholder="AIで名前と要約を作ると自動入力されます。手修正もできます。"
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
            memo / 要約
          </div>
          <textarea
            value={memo}
            disabled={busy}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="AIで名前と要約を作ると自動入力されます。内容確認後、手修正できます。"
            style={{
              width: "100%",
              minHeight: 140,
              boxSizing: "border-box",
              padding: 10,
              lineHeight: 1.7,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 8,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 8,
            background: "#fcfcfc",
          }}
        >
          <div style={{ fontWeight: 700 }}>登録フロー</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy || !transcriptText.trim()}
              onClick={handleCleanupTranscript}
            >
              {cleaning ? "クリーンアップ中..." : "1. AIによるクリーンアップ"}
            </button>

            <button
              type="button"
              disabled={busy || !transcriptText.trim()}
              onClick={handleSaveDraft}
            >
              {savingDraft ? "保存中..." : "2. 下書き保存"}
            </button>

            <button
              type="button"
              disabled={busy || !transcriptText.trim()}
              onClick={handleConfirmPractice}
            >
              {confirming ? "確定中..." : "3. 確定する"}
            </button>

            <button
              type="button"
              disabled={busy || !canRunAi}
              onClick={handleAnalyzePractice}
            >
              {analyzing ? "AI生成中..." : "4. AIで名前と要約を作る"}
            </button>

            <button
              type="button"
              disabled={busy || !canSuggest}
              onClick={handleSuggestLinks}
            >
              {suggesting ? "候補生成中..." : "5. Ability候補を生成"}
            </button>

            <button
              type="button"
              disabled={busy || suggestions.length === 0}
              onClick={handleAcceptAllSuggestions}
            >
              {acceptingAll ? "一括採用中..." : "6. 候補をすべて採用"}
            </button>

            <button
              type="button"
              disabled={busy || !createdPracticeCode || acceptedCount === 0}
              onClick={handleRegisterPracticeLinks}
            >
              {registering
                ? "本登録中..."
                : `7. 本登録する（${acceptedCount}件）`}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
            ※ AI生成前に下書き保存が未実行でも、内部で自動保存してからAI処理します。
            <br />
            ※ 候補は個別チェックでも、一括採用でも登録できます。
          </div>
        </div>

        {suggestions.length > 0 ? (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "space-between",
                alignItems: "center",
                padding: 10,
                background: "#fafafa",
                borderBottom: "1px solid #eee",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>Ability候補一覧</strong>
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
                  {createdPracticeCode} / 採用候補 {acceptedCount}件 / 候補{" "}
                  {suggestions.length}件
                </span>
              </div>

              <button
                type="button"
                disabled={busy || acceptedCount === 0}
                onClick={handleRegisterPracticeLinks}
              >
                {registering
                  ? "本登録中..."
                  : `本登録する（${acceptedCount}件）`}
              </button>
            </div>

            <div style={{ display: "grid", gap: 8, padding: 10 }}>
              {suggestions.map((row) => {
                const checked = isAcceptedSuggestion(row);
                const disabled = savingSuggestionId === row.id || busy;
                const abilityCode = s(row.abilityCode);

                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(220px, 1fr) auto",
                      gap: 12,
                      alignItems: "start",
                      padding: 10,
                      border: "1px solid #eee",
                      borderRadius: 8,
                      background: checked ? "#f0fdf4" : "#fff",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) =>
                          handleToggleSuggestion(row, e.target.checked)
                        }
                      />
                      採用
                    </label>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 700 }}>
                        {abilityLabel(abilityCode)}
                      </div>
                      <div
                        style={{
                          color: "#444",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.6,
                        }}
                      >
                        {s(row.reason) || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        status: {s(row.status) || "-"} / sortOrder:{" "}
                        {n(row.sortOrder)}
                      </div>
                    </div>

                    <label
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      score
                      <select
                        value={n(row.score, 1)}
                        disabled={disabled}
                        onChange={(e) =>
                          handleChangeSuggestionScore(
                            row,
                            Number(e.target.value),
                          )
                        }
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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
              <strong>対象年齢:</strong> {formatTargetAge(targetAgeMin, targetAgeMax)}
            </div>
            <div>
              <strong>季節性:</strong>{" "}
              {formatSeasonality(seasonalityType, selectedSeasonMonths)}
            </div>
            <div>
              <strong>Tenant:</strong> {tenantId}
            </div>
            <div>
              <strong>Owner:</strong> {owner}
            </div>
            <div>
              <strong>Transcript preview:</strong>{" "}
              {previewText(transcriptText, 180) || "-"}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                disabled={busy || !createdPracticeId}
                onClick={handleArchivePractice}
                style={{
                  border: "1px solid #fdba74",
                  background: "#fff7ed",
                  color: "#9a3412",
                  borderRadius: 6,
                  padding: "6px 10px",
                }}
              >
                アーカイブ
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
