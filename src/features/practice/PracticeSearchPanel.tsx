// src/features/practice/PracticeSearchPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type SortKey = "scoreSum" | "scoreMax" | "linkCount";
type ViewMode = "ability" | "list";
type PracticeCategoryOption =
  | "outdoor"
  | "indoor"
  | "life"
  | "event"
  | "environment";

const PRACTICE_CATEGORY_OPTIONS: Array<{
  value: PracticeCategoryOption;
  label: string;
}> = [
  { value: "outdoor", label: "外遊び" },
  { value: "indoor", label: "室内遊び" },
  { value: "life", label: "生活（身支度/食事/排泄など）" },
  { value: "event", label: "行事" },
  { value: "environment", label: "環境構成" },
];

type GraphqlErrorLike = {
  message?: string | null;
};

type ListResult<T> = {
  data?: T[] | null;
  nextToken?: string | null;
  errors?: GraphqlErrorLike[] | null;
};

type ListArgs = {
  authMode: "userPool";
  limit?: number;
  nextToken?: string | null;
  filter?: Record<string, unknown>;
};

type AbilityCodeRow = {
  id?: string | null;
  code?: string | null;
  code_display?: string | null;
  parent_code?: string | null;
  level?: number | null;
  name?: string | null;
  sort_order?: number | null;
  is_leaf?: boolean | null;
  status?: string | null;
};

type AbilityPracticeAggRow = {
  id?: string | null;
  abilityCode?: string | null;
  practiceCode?: string | null;
  scoreSum?: number | null;
  scoreMax?: number | null;
  linkCount?: number | null;
  level?: number | null;
};

type AbilityPracticeLinkRow = {
  abilityCode?: string | null;
  practiceCode?: string | null;
  score?: number | null;
};

type PracticeCodeRow = {
  id?: string | null;
  practice_code?: string | null;
  category_code?: string | null;
  category_name?: string | null;
  name?: string | null;
  memo?: string | null;
  status?: string | null;
  version?: number | null;
  tenantId?: string | null;
  visibility?: string | null;
  publishScope?: string | null;
  owner?: string | null;
  practiceCategory?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  seasonalityType?: string | null;
  seasonMonthsJson?: unknown;
  recordedAt?: string | null;
  transcriptText?: string | null;
  aiStatus?: string | null;
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
};

type PracticeMap = Record<string, PracticeCodeRow>;

type Props = {
  owner?: string;
  tenantId?: string;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function errorText(errors?: GraphqlErrorLike[] | null): string {
  const messages = (errors ?? []).map((e) => s(e.message)).filter(Boolean);
  return messages.join("\n") || "GraphQL request failed.";
}

function normalizeDisplayText(value: unknown): string {
  return s(value).replace(/\s+/g, " ");
}

function previewText(value: unknown, max = 160): string {
  const text = normalizeDisplayText(value);
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function normalizePracticeCategory(value: unknown): string {
  const raw = s(value);
  if (!raw) return "";

  const lower = raw.toLowerCase();
  if (PRACTICE_CATEGORY_OPTIONS.some((opt) => opt.value === lower)) {
    return lower;
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
      return raw;
  }
}

function practiceCategoryLabel(value: unknown): string {
  const normalized = normalizePracticeCategory(value);
  if (!normalized) return "-";

  const found = PRACTICE_CATEGORY_OPTIONS.find(
    (opt) => opt.value === normalized,
  );

  return found ? `${found.label}（${found.value}）` : normalized;
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

function practiceTargetAgeLabel(practice?: PracticeCodeRow | null): string {
  if (!practice) return "-";

  const min = n(practice.targetAgeMin, 3);
  const max = n(practice.targetAgeMax, 5);

  return min === max ? `${min}歳` : `${min}〜${max}歳`;
}

function practiceSeasonalityLabel(practice?: PracticeCodeRow | null): string {
  if (!practice) return "-";

  const type = s(practice.seasonalityType || "ALL_YEAR").toUpperCase();
  if (type !== "MONTHS") return "通年";

  const months = parseMonths(practice.seasonMonthsJson);
  if (months.length === 0) return "月指定（未設定）";

  return months
    .slice()
    .sort((a, b) => a - b)
    .map((month) => `${month}月`)
    .join("、");
}

async function listAll<T, TArgs>(
  listFn: (args: TArgs) => Promise<ListResult<T>>,
  args?: Partial<Omit<ListArgs, "authMode" | "limit" | "nextToken">>,
): Promise<T[]> {
  const rows: T[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const request = {
      authMode: "userPool",
      limit: 1000,
      ...(args ?? {}),
      nextToken,
    } satisfies ListArgs;

    const result = await listFn(request as unknown as TArgs);

    if (result.errors?.length) {
      throw new Error(errorText(result.errors));
    }

    rows.push(...(result.data ?? []));
    nextToken = result.nextToken ?? null;
  } while (nextToken);

  return rows;
}

function practiceVisibleForTenant(
  row: { tenantId?: string | null },
  targetTenantId: string,
): boolean {
  const rowTenantId = s(row.tenantId);
  if (!targetTenantId) return true;
  return !rowTenantId || rowTenantId === targetTenantId;
}

function suggestionVisibleForTenant(
  row: { tenantId?: string | null },
  targetTenantId: string,
): boolean {
  const rowTenantId = s(row.tenantId);
  if (!targetTenantId) return true;
  return !rowTenantId || rowTenantId === targetTenantId;
}

function buildAbilityMaps(codes: AbilityCodeRow[]) {
  const byCode = new Map<string, AbilityCodeRow>();
  for (const code of codes) {
    const key = s(code.code);
    if (key) byCode.set(key, code);
  }

  function label(code: string): string {
    const item = byCode.get(code);
    if (!item) return code;
    return `${s(item.code)}_${s(item.name)}`;
  }

  function parentLabel(code: string): string {
    const item = byCode.get(code);
    if (!item) return "-";
    const parentCode = s(item.parent_code);
    if (!parentCode) return "-";
    return label(parentCode);
  }

  return { label, parentLabel };
}

function copyToClipboard(text: string) {
  if (!text) return;
  void navigator.clipboard?.writeText(text);
}

export default function PracticeSearchPanel(props: Props) {
  const tenantId = s(props.tenantId);
  void props.owner;
  void props.currentClassroomId;
  void props.allowedClassroomIds;
  void props.isSchoolScope;

  const client = useMemo(() => generateClient<Schema>(), []);

  const [viewMode, setViewMode] = useState<ViewMode>("ability");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [abilityOptions, setAbilityOptions] = useState<AbilityCodeRow[]>([]);
  const [allAbilityCodes, setAllAbilityCodes] = useState<AbilityCodeRow[]>([]);
  const [selectedAbility, setSelectedAbility] = useState("");
  const [selectedLeafAbility, setSelectedLeafAbility] = useState("");
  const selectedSearchAbility = selectedLeafAbility || selectedAbility;
  const [sortKey, setSortKey] = useState<SortKey>("scoreSum");

  const [rows, setRows] = useState<AbilityPracticeAggRow[]>([]);
  const [practiceByCode, setPracticeByCode] = useState<PracticeMap>({});

  const [practiceRows, setPracticeRows] = useState<PracticeCodeRow[]>([]);
  const [practiceFilter, setPracticeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedPracticeCode, setSelectedPracticeCode] = useState("");
  const [suggestions, setSuggestions] = useState<PracticeLinkSuggestionRow[]>(
    [],
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  const listAbilityCodes = useCallback(async () => {
    return listAll<
      AbilityCodeRow,
      Parameters<typeof client.models.AbilityCode.list>[0]
    >(
      (args) =>
        client.models.AbilityCode.list(args) as unknown as Promise<
          ListResult<AbilityCodeRow>
        >,
    );
  }, [client]);

  const listAbilityPracticeAggs = useCallback(
    async (filter: Record<string, unknown>): Promise<AbilityPracticeAggRow[]> => {
      return listAll<
        AbilityPracticeAggRow,
        Parameters<typeof client.models.AbilityPracticeAgg.list>[0]
      >(
        (args) =>
          client.models.AbilityPracticeAgg.list(args) as unknown as Promise<
            ListResult<AbilityPracticeAggRow>
          >,
        { filter },
      );
    },
    [client],
  );

  const listAbilityPracticeLinks = useCallback(
    async (filter: Record<string, unknown>): Promise<AbilityPracticeLinkRow[]> => {
      return listAll<
        AbilityPracticeLinkRow,
        Parameters<typeof client.models.AbilityPracticeLink.list>[0]
      >(
        (args) =>
          client.models.AbilityPracticeLink.list(args) as unknown as Promise<
            ListResult<AbilityPracticeLinkRow>
          >,
        { filter },
      );
    },
    [client],
  );

  const listPracticeCodes = useCallback(
    async (filter?: Record<string, unknown>): Promise<PracticeCodeRow[]> => {
      const items = await listAll<
        PracticeCodeRow,
        Parameters<typeof client.models.PracticeCode.list>[0]
      >(
        (args) =>
          client.models.PracticeCode.list(args) as unknown as Promise<
            ListResult<PracticeCodeRow>
          >,
        filter ? { filter } : undefined,
      );

      return items.filter((row) => practiceVisibleForTenant(row, tenantId));
    },
    [client, tenantId],
  );

  const listPracticeLinkSuggestions = useCallback(
    async (
      filter: Record<string, unknown>,
    ): Promise<PracticeLinkSuggestionRow[]> => {
      const items = await listAll<
        PracticeLinkSuggestionRow,
        Parameters<typeof client.models.PracticeLinkSuggestion.list>[0]
      >(
        (args) =>
          client.models.PracticeLinkSuggestion.list(args) as unknown as Promise<
            ListResult<PracticeLinkSuggestionRow>
          >,
        { filter },
      );

      return items.filter((row) => suggestionVisibleForTenant(row, tenantId));
    },
    [client, tenantId],
  );

  const refreshAbilities = useCallback(async () => {
    const raw = await listAbilityCodes();
    setAllAbilityCodes(raw);

    const filtered = raw.filter((x) => {
      const status = s(x.status || "active").toLowerCase();
      const level = n(x.level);
      return (level === 1 || level === 2 || level === 3) && status === "active";
    });

    const sorted = [...filtered].sort((a, b) => {
      const sa = n(a.sort_order, 999999);
      const sb = n(b.sort_order, 999999);
      if (sa !== sb) return sa - sb;
      return s(a.code).localeCompare(s(b.code));
    });

    setAbilityOptions(sorted);
    const first = sorted.find((item) => n(item.level) === 2) ?? sorted[0];
    setSelectedAbility(first?.code ? s(first.code) : "");
  }, [listAbilityCodes]);

  const refreshPracticeList = useCallback(async () => {
    const rows = await listPracticeCodes();
    const onlyPR = rows.filter((row) => s(row.practice_code).startsWith("PR-"));

    onlyPR.sort((a, b) => {
      const left = s(a.recordedAt) || s(a.createdAt);
      const right = s(b.recordedAt) || s(b.createdAt);
      return right.localeCompare(left);
    });

    setPracticeRows(onlyPR);
  }, [listPracticeCodes]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        await refreshAbilities();
        await refreshPracticeList();
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [refreshAbilities, refreshPracticeList]);

  useEffect(() => {
    let ignore = false;

    if (!selectedSearchAbility) {
      setRows([]);
      setPracticeByCode({});
      return () => {
        ignore = true;
      };
    }

    (async () => {
      setLoading(true);
      setError("");

      try {
        const aggRows = await listAbilityPracticeAggs({
          abilityCode: { eq: selectedSearchAbility },
        });

        const fallbackRows: AbilityPracticeAggRow[] =
          selectedLeafAbility && aggRows.length === 0
            ? (
                await listAbilityPracticeLinks({
                  abilityCode: { eq: selectedLeafAbility },
                })
              ).map((link): AbilityPracticeAggRow => {
                const abilityCode = s(link.abilityCode) || selectedLeafAbility;
                const practiceCode = s(link.practiceCode);
                const score = n(link.score, 1);

                return {
                  id: `fallback-${abilityCode}-${practiceCode}`,
                  abilityCode,
                  practiceCode,
                  scoreSum: score,
                  scoreMax: score,
                  linkCount: 1,
                  level: 3,
                };
              })
            : [];

        const sourceRows = aggRows.length > 0 ? aggRows : fallbackRows;
        const onlyPR = sourceRows.filter((row) =>
          s(row.practiceCode).startsWith("PR-"),
        );

        const sorted = [...onlyPR].sort((a, b) => {
          const av = n(a[sortKey]);
          const bv = n(b[sortKey]);
          return bv - av;
        });

        const codes = Array.from(
          new Set(sorted.map((row) => s(row.practiceCode)).filter(Boolean)),
        );

        const nextMap: PracticeMap = {};
        for (const practiceCode of codes) {
          const found = await listPracticeCodes({
            practice_code: { eq: practiceCode },
          });
          if (found[0]) {
            nextMap[practiceCode] = found[0];
          }
        }

        if (!ignore) {
          setRows(sorted);
          setPracticeByCode(nextMap);
          setPage(0);
        }
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : String(e));
          setRows([]);
          setPracticeByCode({});
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [
    listAbilityPracticeAggs,
    listAbilityPracticeLinks,
    listPracticeCodes,
    selectedLeafAbility,
    selectedSearchAbility,
    sortKey,
  ]);

  useEffect(() => {
    let ignore = false;

    if (!selectedPracticeCode) {
      setSuggestions([]);
      return () => {
        ignore = true;
      };
    }

    (async () => {
      setLoadingSuggestions(true);
      setError("");

      try {
        const items = await listPracticeLinkSuggestions({
          practiceCode: { eq: selectedPracticeCode },
        });
        const sorted = [...items].sort((a, b) =>
          n(a.sortOrder, 9999) - n(b.sortOrder, 9999),
        );

        if (!ignore) setSuggestions(sorted);
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : String(e));
          setSuggestions([]);
        }
      } finally {
        if (!ignore) setLoadingSuggestions(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [listPracticeLinkSuggestions, selectedPracticeCode]);

  const abilityGroups = useMemo(() => {
    const parents = abilityOptions.filter((item) => n(item.level) === 1);
    const children = abilityOptions.filter((item) => n(item.level) === 2);
    const leaves = abilityOptions.filter((item) => n(item.level) >= 3 || item.is_leaf);

    const childrenByParent = new Map<string, AbilityCodeRow[]>();
    const leavesByParent = new Map<string, AbilityCodeRow[]>();

    for (const child of children) {
      const parentCode = s(child.parent_code);
      if (!childrenByParent.has(parentCode)) childrenByParent.set(parentCode, []);
      childrenByParent.get(parentCode)?.push(child);
    }

    for (const leaf of leaves) {
      const parentCode = s(leaf.parent_code);
      if (!leavesByParent.has(parentCode)) leavesByParent.set(parentCode, []);
      leavesByParent.get(parentCode)?.push(leaf);
    }

    const sortRows = (items: AbilityCodeRow[]) =>
      items.sort((a, b) => {
        const sa = n(a.sort_order, 999999);
        const sb = n(b.sort_order, 999999);
        if (sa !== sb) return sa - sb;
        return s(a.code).localeCompare(s(b.code));
      });

    sortRows(parents);
    for (const items of childrenByParent.values()) sortRows(items);
    for (const items of leavesByParent.values()) sortRows(items);

    return { parents, childrenByParent, leavesByParent };
  }, [abilityOptions]);

  const leafAbilityOptions = useMemo(() => {
    return abilityGroups.leavesByParent.get(s(selectedAbility)) ?? [];
  }, [abilityGroups, selectedAbility]);

  const filteredPracticeRows = useMemo(() => {
    const q = s(practiceFilter).toLowerCase();
    const st = s(statusFilter).toUpperCase();

    return practiceRows.filter((row) => {
      const practiceCode = s(row.practice_code);
      const name = s(row.name);
      const memo = s(row.memo);
      const transcriptText = s(row.transcriptText);
      const status = s(row.status).toUpperCase();

      const hitQuery =
        !q ||
        practiceCode.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        memo.toLowerCase().includes(q) ||
        transcriptText.toLowerCase().includes(q);

      const hitStatus = !st || status === st;
      return hitQuery && hitStatus;
    });
  }, [practiceRows, practiceFilter, statusFilter]);

  const displayRows = viewMode === "ability" ? rows : filteredPracticeRows;
  const totalRows = displayRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const from = totalRows === 0 ? 0 : clampedPage * pageSize + 1;
  const to = Math.min(totalRows, (clampedPage + 1) * pageSize);

  const pageRowsAbility = useMemo(() => {
    const start = clampedPage * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, clampedPage, pageSize]);

  const pageRowsPractice = useMemo(() => {
    const start = clampedPage * pageSize;
    return filteredPracticeRows.slice(start, start + pageSize);
  }, [filteredPracticeRows, clampedPage, pageSize]);

  const { label: abilityLabel, parentLabel } = useMemo(
    () => buildAbilityMaps(allAbilityCodes),
    [allAbilityCodes],
  );

  function renderPagination() {
    return (
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          disabled={clampedPage <= 0}
        >
          前へ
        </button>
        <span style={{ fontSize: 12 }}>
          {from}〜{to} / {totalRows}（ページ {clampedPage + 1} / {totalPages}）
        </span>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
          disabled={clampedPage >= totalPages - 1}
        >
          次へ
        </button>
      </div>
    );
  }

  async function handleRefresh() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await refreshAbilities();
      await refreshPracticeList();
      setMessage("Practice検索データを再読み込みしました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Practice検索</h2>

      <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
        この画面は検索・参照用です。Practice登録、AI生成、Ability候補採用、本登録は
        「Practice登録 / メンテ」画面で行います。
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setViewMode("ability");
            setPage(0);
          }}
          disabled={viewMode === "ability"}
        >
          Ability起点
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode("list");
            setPage(0);
          }}
          disabled={viewMode === "list"}
        >
          Practice一覧
        </button>
        <button type="button" onClick={handleRefresh} disabled={loading}>
          Refresh
        </button>
      </div>

      {viewMode === "ability" ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            10の姿
            <select
              value={selectedAbility}
              onChange={(event) => {
                setSelectedAbility(event.target.value);
                setSelectedLeafAbility("");
                setSelectedPracticeCode("");
                setPage(0);
              }}
              disabled={loading}
              style={{ minWidth: 360 }}
            >
              {abilityGroups.parents.map((parent) => {
                const parentCode = s(parent.code);
                const children = abilityGroups.childrenByParent.get(parentCode) ?? [];

                return (
                  <optgroup key={parentCode} label={abilityLabel(parentCode)}>
                    {children.map((child) => (
                      <option key={s(child.code)} value={s(child.code)}>
                        {abilityLabel(s(child.code))}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            小分類
            <select
              value={selectedLeafAbility}
              onChange={(event) => {
                setSelectedLeafAbility(event.target.value);
                setSelectedPracticeCode("");
                setPage(0);
              }}
              disabled={loading || !selectedAbility}
              style={{ minWidth: 360 }}
            >
              <option value="">指定しない</option>
              {leafAbilityOptions.map((leaf) => (
                <option key={s(leaf.code)} value={s(leaf.code)}>
                  {abilityLabel(s(leaf.code))}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            並び替え
            <select
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value as SortKey);
                setPage(0);
              }}
            >
              <option value="scoreSum">scoreSum</option>
              <option value="scoreMax">scoreMax</option>
              <option value="linkCount">linkCount</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            1ページ表示
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              <option value={10}>10件</option>
              <option value={20}>20件</option>
              <option value={50}>50件</option>
            </select>
          </label>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            検索
            <input
              value={practiceFilter}
              onChange={(event) => {
                setPracticeFilter(event.target.value);
                setPage(0);
              }}
              placeholder="practice_code / name / memo / transcript"
              style={{ minWidth: 360 }}
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">すべて</option>
              <option value="REVIEW">REVIEW</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="AI_ANALYZING">AI_ANALYZING</option>
              <option value="ARCHIVED">ARCHIVED</option>
              <option value="ERROR">ERROR</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            1ページ表示
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              <option value={10}>10件</option>
              <option value={20}>20件</option>
              <option value={50}>50件</option>
            </select>
          </label>
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        表示範囲：{from}〜{to} / {totalRows}件
        {viewMode === "list" ? ` / PracticeCode件数：${practiceRows.length}` : ""}
      </div>

      {message ? (
        <pre
          style={{
            margin: 0,
            padding: 10,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </pre>
      ) : null}

      {error ? (
        <pre
          style={{
            margin: 0,
            padding: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            color: "#991b1b",
          }}
        >
          {error}
        </pre>
      ) : null}

      {renderPagination()}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: 12 }}>Loading...</div>
        ) : viewMode === "ability" ? (
          pageRowsAbility.length === 0 ? (
            <div style={{ padding: 12 }}>該当するPracticeがありません。</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 980,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", background: "#fafafa" }}>
                    <th style={{ padding: 8 }}>practice_code</th>
                    <th style={{ padding: 8 }}>name</th>
                    <th style={{ padding: 8 }}>category</th>
                    <th style={{ padding: 8 }}>対象年齢</th>
                    <th style={{ padding: 8 }}>季節性</th>
                    <th style={{ padding: 8 }}>scoreSum</th>
                    <th style={{ padding: 8 }}>scoreMax</th>
                    <th style={{ padding: 8 }}>linkCount</th>
                    <th style={{ padding: 8 }}>status</th>
                    <th style={{ padding: 8, minWidth: 320 }}>memo</th>
                    <th style={{ padding: 8 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRowsAbility.map((row) => {
                    const practiceCode = s(row.practiceCode);
                    const practice = practiceByCode[practiceCode];
                    const isSelected = selectedPracticeCode === practiceCode;

                    return (
                      <tr key={`${s(row.abilityCode)}-${practiceCode}`}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 700 }}>{practiceCode}</div>
                          <button
                            type="button"
                            onClick={() => {
                              copyToClipboard(practiceCode);
                              setMessage(`practice_code をコピーしました: ${practiceCode}`);
                            }}
                            disabled={!practiceCode}
                          >
                            コピー
                          </button>
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top", minWidth: 220 }}>
                          {s(practice?.name) || "-"}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                          {practiceCategoryLabel(
                            s(practice?.practiceCategory) || s(practice?.category_name),
                          )}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                          {practiceTargetAgeLabel(practice)}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                          {practiceSeasonalityLabel(practice)}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{n(row.scoreSum)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{n(row.scoreMax)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{n(row.linkCount)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{s(practice?.status) || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {previewText(practice?.memo || practice?.transcriptText, 240) || "-"}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedPracticeCode(isSelected ? "" : practiceCode)}
                            disabled={!practiceCode}
                          >
                            {isSelected ? "候補を閉じる" : "候補を見る"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : pageRowsPractice.length === 0 ? (
          <div style={{ padding: 12 }}>該当するPracticeがありません。</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 1240,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", background: "#fafafa" }}>
                  <th style={{ padding: 8 }}>practice_code</th>
                  <th style={{ padding: 8 }}>name</th>
                  <th style={{ padding: 8 }}>status</th>
                  <th style={{ padding: 8 }}>category</th>
                  <th style={{ padding: 8 }}>対象年齢</th>
                  <th style={{ padding: 8 }}>季節性</th>
                  <th style={{ padding: 8 }}>visibility</th>
                  <th style={{ padding: 8 }}>recordedAt</th>
                  <th style={{ padding: 8, minWidth: 320 }}>memo</th>
                  <th style={{ padding: 8 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRowsPractice.map((practice) => {
                  const practiceCode = s(practice.practice_code);
                  const isSelected = selectedPracticeCode === practiceCode;

                  return (
                    <tr key={s(practice.id) || practiceCode}>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700 }}>{practiceCode}</div>
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(practiceCode);
                            setMessage(`practice_code をコピーしました: ${practiceCode}`);
                          }}
                          disabled={!practiceCode}
                        >
                          コピー
                        </button>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", minWidth: 220, verticalAlign: "top" }}>
                        {s(practice.name) || "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{s(practice.status) || "-"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        {practiceCategoryLabel(
                          s(practice.practiceCategory) || s(practice.category_name),
                        )}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        {practiceTargetAgeLabel(practice)}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        {practiceSeasonalityLabel(practice)}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        {s(practice.visibility) || s(practice.publishScope) || "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", minWidth: 180, verticalAlign: "top" }}>
                        {s(practice.recordedAt) || s(practice.createdAt) || "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", fontSize: 12, lineHeight: 1.6, minWidth: 320, whiteSpace: "pre-wrap", verticalAlign: "top" }}>
                        {previewText(practice.memo || practice.transcriptText, 260) || "-"}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPracticeCode(isSelected ? "" : practiceCode)}
                          disabled={!practiceCode}
                        >
                          {isSelected ? "候補を閉じる" : "候補を見る"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {renderPagination()}

      {selectedPracticeCode ? (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 10,
              background: "#fafafa",
              borderBottom: "1px solid #eee",
            }}
          >
            <strong>Ability候補一覧</strong>
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>
              {selectedPracticeCode} / {suggestions.length}件
            </span>
          </div>

          {loadingSuggestions ? (
            <div style={{ padding: 12 }}>Loading suggestions...</div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: 12 }}>
              候補がありません。必要な場合は Practice登録 / メンテ画面で候補生成してください。
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 920,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", background: "#fafafa" }}>
                    <th style={{ padding: 8 }}>status</th>
                    <th style={{ padding: 8 }}>Ability</th>
                    <th style={{ padding: 8 }}>親</th>
                    <th style={{ padding: 8 }}>score</th>
                    <th style={{ padding: 8 }}>reason</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((row) => {
                    const abilityCode = s(row.abilityCode);
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{s(row.status) || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", minWidth: 240, verticalAlign: "top" }}>{abilityLabel(abilityCode)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", minWidth: 180, verticalAlign: "top" }}>{parentLabel(abilityCode)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>{n(row.score, 1)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0", minWidth: 320, whiteSpace: "pre-wrap", verticalAlign: "top" }}>{s(row.reason) || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
