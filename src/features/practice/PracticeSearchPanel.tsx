// src/features/practice/PracticeSearchPanel.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type SortKey = "scoreSum" | "scoreMax" | "linkCount";
type ViewMode = "ability" | "debug";
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
  domain?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_leaf?: boolean | null;
  status?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AbilityPracticeAggRow = {
  id?: string | null;
  abilityCode?: string | null;
  practiceCode?: string | null;
  scoreSum?: number | null;
  scoreMax?: number | null;
  linkCount?: number | null;
  level?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AbilityPracticeLinkRow = {
  id?: string | null;
  abilityCode?: string | null;
  practiceCode?: string | null;
  score?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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

type PracticeLite = {
  id?: string | null;
  practice_code: string;
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
  recordedAt?: string | null;
  transcriptText?: string | null;
  aiStatus?: string | null;
  aiModel?: string | null;
  aiRawJson?: string | null;
  errorMessage?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
};

type PracticeMap = Record<string, PracticeLite>;

function s(v: unknown): string {
  return String(v ?? "").trim();
}

function n(v: unknown, fallback = 0): number {
  const value = Number(v ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeDisplayText(v: unknown): string {
  return s(v).replace(/\s+/g, " ");
}

function previewText(v: unknown, max = 120): string {
  const text = normalizeDisplayText(v);
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function practiceMemoDisplay(
  memo: unknown,
  transcriptText: unknown,
  transcriptMax = 240,
): string {
  const memoText = normalizeDisplayText(memo);
  if (memoText) return memoText;

  return previewText(transcriptText, transcriptMax);
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

function errorText(errors?: GraphqlErrorLike[] | null): string {
  const messages = (errors ?? []).map((e) => s(e.message)).filter(Boolean);
  return messages.join("\n") || "GraphQL request failed.";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readValue(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

function isAcceptedSuggestion(row: PracticeLinkSuggestionRow): boolean {
  const st = s(row.status).toLowerCase();
  return st === "accepted" || st === "edited";
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

function toPracticeLite(row: PracticeCodeRow): PracticeLite | null {
  const practiceCode = s(row.practice_code);
  if (!practiceCode) return null;

  return {
    id: row.id ?? null,
    practice_code: practiceCode,
    category_code: row.category_code ?? null,
    category_name: row.category_name ?? null,
    name: row.name ?? null,
    memo: row.memo ?? null,
    source_type: row.source_type ?? null,
    source_ref: row.source_ref ?? null,
    source_url: row.source_url ?? null,
    status: row.status ?? null,
    version: row.version ?? null,
    tenantId: row.tenantId ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    visibility: row.visibility ?? null,
    publishScope: row.publishScope ?? null,
    ownerType: row.ownerType ?? null,
    owner: row.owner ?? null,
    practiceCategory: row.practiceCategory ?? null,
    practiceSourceType: row.practiceSourceType ?? null,
    recordedAt: row.recordedAt ?? null,
    transcriptText: row.transcriptText ?? null,
    aiStatus: row.aiStatus ?? null,
    aiModel: row.aiModel ?? null,
    aiRawJson: row.aiRawJson ?? null,
    errorMessage: row.errorMessage ?? null,
    reviewedAt: row.reviewedAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

function practiceVisibleForTenant(
  row: {
    tenantId?: string | null;
    visibility?: string | null;
    publishScope?: string | null;
  },
  targetTenantId: string,
): boolean {
  const rowTenantId = s(row.tenantId);
  if (!targetTenantId) return true;
  if (rowTenantId && rowTenantId !== targetTenantId) return false;

  // tenantId が空のPracticeは共通マスターとして扱う。
  return true;
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

  function buildCodeName(code: string): string {
    const item = byCode.get(code);
    if (!item) return code;
    return `${s(item.code)}_${s(item.name)}`;
  }

  function buildParentLabel(code: string): string {
    const item = byCode.get(code);
    if (!item) return "-";

    const parentCode = s(item.parent_code);
    if (!parentCode) return "-";

    const parent = byCode.get(parentCode);
    if (!parent) return parentCode;

    return `${s(parent.code)}_${s(parent.name)}`;
  }

  return { buildCodeName, buildParentLabel };
}

type Props = {
  owner?: string;
  tenantId?: string;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
};

export default function PracticeSearchPanel(props: Props) {
  const tenantId = s(props.tenantId);
  void props.owner;
  void props.currentClassroomId;
  void props.allowedClassroomIds;
  void props.isSchoolScope;

  const client = useMemo(() => generateClient<Schema>(), []);

  const [viewMode, setViewMode] = useState<ViewMode>("ability");

  const [abilityRawCount, setAbilityRawCount] = useState(0);
  const [abilityOptions, setAbilityOptions] = useState<AbilityCodeRow[]>([]);
  const [allAbilityCodes, setAllAbilityCodes] = useState<AbilityCodeRow[]>([]);
  const [selectedAbility, setSelectedAbility] = useState("");
  const [selectedLeafAbility, setSelectedLeafAbility] = useState("");

  const selectedSearchAbility = selectedLeafAbility || selectedAbility;

  const [sortKey, setSortKey] = useState<SortKey>("scoreSum");
  const [rows, setRows] = useState<AbilityPracticeAggRow[]>([]);
  const [practiceByCode, setPracticeByCode] = useState<PracticeMap>({});

  const [loadingAbility, setLoadingAbility] = useState(false);
  const [loadingAgg, setLoadingAgg] = useState(false);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [error, setError] = useState("");

  const [practiceReloadKey, setPracticeReloadKey] = useState(0);

  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(0);

  const [suggestionPage, setSuggestionPage] = useState(0);
  const suggestionPageSize = 5;

  const [debugRows, setDebugRows] = useState<PracticeCodeRow[]>([]);
  const [debugFilter, setDebugFilter] = useState("");
  const [debugStatusFilter, setDebugStatusFilter] = useState("");

  const [analyzingPracticeId, setAnalyzingPracticeId] = useState("");
  const [analyzeMessage, setAnalyzeMessage] = useState("");

  const [suggestingPracticeId, setSuggestingPracticeId] = useState("");
  const [suggestMessage, setSuggestMessage] = useState("");

  const [registeringPracticeCode, setRegisteringPracticeCode] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");

  const [archivingPracticeCode, setArchivingPracticeCode] = useState("");
  const [archiveMessage, setArchiveMessage] = useState("");

  const [selectedPracticeCode, setSelectedPracticeCode] = useState("");
  const [suggestions, setSuggestions] = useState<PracticeLinkSuggestionRow[]>(
    [],
  );
  const [savingSuggestionId, setSavingSuggestionId] = useState("");

  const [editingPracticeId, setEditingPracticeId] = useState("");
  const [editingPracticeName, setEditingPracticeName] = useState("");
  const [editingPracticeMemo, setEditingPracticeMemo] = useState("");
  const [editingPracticeCategory, setEditingPracticeCategory] = useState("");
  const [savingPracticeEditId, setSavingPracticeEditId] = useState("");
  const [editPracticeMessage, setEditPracticeMessage] = useState("");

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
    async (
      filter: Record<string, unknown>,
    ): Promise<AbilityPracticeAggRow[]> => {
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
    async (
      filter: Record<string, unknown>,
    ): Promise<AbilityPracticeLinkRow[]> => {
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
      const rows = await listAll<
        PracticeCodeRow,
        Parameters<typeof client.models.PracticeCode.list>[0]
      >(
        (args) =>
          client.models.PracticeCode.list(args) as unknown as Promise<
            ListResult<PracticeCodeRow>
          >,
        filter ? { filter } : undefined,
      );

      return rows.filter((row) => practiceVisibleForTenant(row, tenantId));
    },
    [client, tenantId],
  );

  const listPracticeLinkSuggestions = useCallback(
    async (
      filter: Record<string, unknown>,
    ): Promise<PracticeLinkSuggestionRow[]> => {
      const rows = await listAll<
        PracticeLinkSuggestionRow,
        Parameters<typeof client.models.PracticeLinkSuggestion.list>[0]
      >(
        (args) =>
          client.models.PracticeLinkSuggestion.list(args) as unknown as Promise<
            ListResult<PracticeLinkSuggestionRow>
          >,
        { filter },
      );

      return rows.filter((row) => suggestionVisibleForTenant(row, tenantId));
    },
    [client, tenantId],
  );

  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoadingAbility(true);
      setError("");

      try {
        const raw = await listAbilityCodes();
        if (ignore) return;

        setAbilityRawCount(raw.length);
        setAllAbilityCodes(raw);

        const filtered = raw.filter((x) => {
          const status = s(x.status || "active").toLowerCase();
          const level = n(x.level);
          return (
            (level === 1 || level === 2 || level === 3) && status === "active"
          );
        });

        const items = [...filtered].sort((a, b) => {
          const sa = n(a.sort_order, 999999);
          const sb = n(b.sort_order, 999999);
          if (sa !== sb) return sa - sb;
          return s(a.code).localeCompare(s(b.code));
        });

        setAbilityOptions(items);

        const first = items.find((i) => n(i.level) === 2) ?? items[0];
        setSelectedAbility(first?.code ? s(first.code) : "");
        setSelectedLeafAbility("");
      } catch (e) {
        if (ignore) return;
        setError(e instanceof Error ? e.message : JSON.stringify(e, null, 2));
        setAbilityRawCount(0);
        setAbilityOptions([]);
        setAllAbilityCodes([]);
        setSelectedAbility("");
        setSelectedLeafAbility("");
      } finally {
        if (!ignore) setLoadingAbility(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [listAbilityCodes]);

  useEffect(() => {
    let ignore = false;

    if (!selectedSearchAbility) {
      setRows([]);
      return () => {
        ignore = true;
      };
    }

    (async () => {
      setLoadingAgg(true);
      setError("");

      try {
        const list = await listAbilityPracticeAggs({
          abilityCode: { eq: selectedSearchAbility },
        });

        if (ignore) return;

        const fallbackRows: AbilityPracticeAggRow[] =
          selectedLeafAbility && list.length === 0
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
                  createdAt: "",
                  updatedAt: "",
                };
              })
            : [];

        const sourceRows: AbilityPracticeAggRow[] =
          list.length > 0 ? list : fallbackRows;
        const onlyPR = sourceRows.filter((r) =>
          s(r.practiceCode).startsWith("PR-"),
        );

        const sorted = [...onlyPR].sort((a, b) => {
          const av = n(a[sortKey]);
          const bv = n(b[sortKey]);
          return bv - av;
        });

        setRows(sorted);
        setPage(0);
      } catch (e) {
        if (ignore) return;
        setError(e instanceof Error ? e.message : JSON.stringify(e, null, 2));
        setRows([]);
      } finally {
        if (!ignore) setLoadingAgg(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [
    listAbilityPracticeAggs,
    listAbilityPracticeLinks,
    selectedLeafAbility,
    selectedSearchAbility,
    sortKey,
    practiceReloadKey,
  ]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoadingPractice(true);
      setError("");

      try {
        const codes = Array.from(
          new Set(
            rows
              .map((r) => s(r.practiceCode))
              .filter((code) => code.startsWith("PR-")),
          ),
        );

        if (codes.length === 0) {
          if (!ignore) setPracticeByCode({});
          return;
        }

        const nextMap: PracticeMap = {};
        const batches = chunk(codes, 20);

        for (const batch of batches) {
          const or = batch.map((practiceCode) => ({
            practice_code: { eq: practiceCode },
          }));

          const data = await listPracticeCodes({ or });

          for (const item of data) {
            const lite = toPracticeLite(item);
            if (lite) nextMap[lite.practice_code] = lite;
          }
        }

        if (!ignore) setPracticeByCode(nextMap);
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : JSON.stringify(e, null, 2));
        }
      } finally {
        if (!ignore) setLoadingPractice(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [listPracticeCodes, rows, practiceReloadKey]);

  useEffect(() => {
    let ignore = false;

    if (viewMode !== "debug") {
      return () => {
        ignore = true;
      };
    }

    (async () => {
      setLoadingDebug(true);
      setError("");

      try {
        const list = await listPracticeCodes();

        if (ignore) return;

        const onlyPR = list.filter((x) => s(x.practice_code).startsWith("PR-"));

        onlyPR.sort((a, b) => {
          const ra = s(a.recordedAt);
          const rb = s(b.recordedAt);
          return rb.localeCompare(ra);
        });

        setDebugRows(onlyPR);
        setPage(0);
      } catch (e) {
        if (ignore) return;
        setError(e instanceof Error ? e.message : JSON.stringify(e, null, 2));
        setDebugRows([]);
      } finally {
        if (!ignore) setLoadingDebug(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [listPracticeCodes, viewMode, practiceReloadKey]);

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
        const list = await listPracticeLinkSuggestions({
          practiceCode: { eq: selectedPracticeCode },
        });

        if (ignore) return;

        const sorted = [...list].sort((a, b) => {
          const sa = n(a.sortOrder, 9999);
          const sb = n(b.sortOrder, 9999);
          return sa - sb;
        });

        setSuggestions(sorted);
        setSuggestionPage(0);
      } catch (e) {
        if (ignore) return;
        setError(e instanceof Error ? e.message : JSON.stringify(e, null, 2));
        setSuggestions([]);
      } finally {
        if (!ignore) setLoadingSuggestions(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [listPracticeLinkSuggestions, selectedPracticeCode, practiceReloadKey]);

  const abilityGroups = useMemo(() => {
    const parents = abilityOptions.filter((a) => n(a.level) === 1);
    const children = abilityOptions.filter((a) => n(a.level) === 2);
    const leaves = abilityOptions.filter((a) => n(a.level) >= 3 || a.is_leaf);

    const sortAbilityRows = (items: AbilityCodeRow[]) => {
      items.sort((a, b) => {
        const sa = n(a.sort_order, 999999);
        const sb = n(b.sort_order, 999999);
        if (sa !== sb) return sa - sb;
        return s(a.code).localeCompare(s(b.code));
      });
    };

    const childrenByParent = new Map<string, AbilityCodeRow[]>();
    const leavesByParent = new Map<string, AbilityCodeRow[]>();

    for (const child of children) {
      const parentCode = s(child.parent_code);
      if (!childrenByParent.has(parentCode)) {
        childrenByParent.set(parentCode, []);
      }
      childrenByParent.get(parentCode)?.push(child);
    }

    for (const leaf of leaves) {
      const parentCode = s(leaf.parent_code);
      if (!leavesByParent.has(parentCode)) {
        leavesByParent.set(parentCode, []);
      }
      leavesByParent.get(parentCode)?.push(leaf);
    }

    for (const [key, value] of childrenByParent.entries()) {
      sortAbilityRows(value);
      childrenByParent.set(key, value);
    }

    for (const [key, value] of leavesByParent.entries()) {
      sortAbilityRows(value);
      leavesByParent.set(key, value);
    }

    sortAbilityRows(parents);

    return { parents, childrenByParent, leavesByParent };
  }, [abilityOptions]);

  const leafAbilityOptions = useMemo(() => {
    return abilityGroups.leavesByParent.get(s(selectedAbility)) ?? [];
  }, [abilityGroups, selectedAbility]);

  const selectedSearchAbilityLabel = useMemo(() => {
    const found = abilityOptions.find(
      (x) => s(x.code) === s(selectedSearchAbility),
    );
    if (!found) return "";

    const level = n(found.level);
    const prefix = level === 1 ? "大分類" : level === 2 ? "中分類" : "小分類";
    return `${prefix}：${s(found.name)}（${s(found.code)}）`;
  }, [abilityOptions, selectedSearchAbility]);

  const selectedMiddleAbilityLabel = useMemo(() => {
    const found = abilityOptions.find((x) => s(x.code) === s(selectedAbility));
    if (!found) return "";

    return `中分類：${s(found.name)}（${s(found.code)}）`;
  }, [abilityOptions, selectedAbility]);

  const totalScoreSum = useMemo(() => {
    return rows.reduce((acc, row) => acc + n(row.scoreSum), 0);
  }, [rows]);

  const filteredDebugRows = useMemo(() => {
    const q = s(debugFilter).toLowerCase();
    const st = s(debugStatusFilter).toUpperCase();

    return debugRows.filter((row) => {
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
  }, [debugRows, debugFilter, debugStatusFilter]);

  const { buildCodeName, buildParentLabel } = useMemo(
    () => buildAbilityMaps(allAbilityCodes),
    [allAbilityCodes],
  );

  const totalRows =
    viewMode === "ability" ? rows.length : filteredDebugRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);

  const pageRowsAbility = useMemo(() => {
    const start = clampedPage * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, clampedPage, pageSize]);

  const pageRowsDebug = useMemo(() => {
    const start = clampedPage * pageSize;
    const end = start + pageSize;
    return filteredDebugRows.slice(start, end);
  }, [filteredDebugRows, clampedPage, pageSize]);

  const from = totalRows === 0 ? 0 : clampedPage * pageSize + 1;
  const to = Math.min(totalRows, (clampedPage + 1) * pageSize);

  const suggestionTotalRows = suggestions.length;
  const suggestionTotalPages = Math.max(
    1,
    Math.ceil(suggestionTotalRows / suggestionPageSize),
  );
  const suggestionClampedPage = Math.min(
    Math.max(suggestionPage, 0),
    suggestionTotalPages - 1,
  );

  const pagedSuggestions = useMemo(() => {
    const start = suggestionClampedPage * suggestionPageSize;
    const end = start + suggestionPageSize;
    return suggestions.slice(start, end);
  }, [suggestions, suggestionClampedPage]);

  const suggestionFrom =
    suggestionTotalRows === 0
      ? 0
      : suggestionClampedPage * suggestionPageSize + 1;
  const suggestionTo = Math.min(
    suggestionTotalRows,
    (suggestionClampedPage + 1) * suggestionPageSize,
  );

  const acceptedCount = useMemo(() => {
    return suggestions.filter(isAcceptedSuggestion).length;
  }, [suggestions]);

  const loading =
    loadingAbility ||
    loadingAgg ||
    loadingPractice ||
    loadingDebug ||
    loadingSuggestions;

  async function findPracticeRowByCode(
    practiceCode: string,
  ): Promise<PracticeCodeRow | null> {
    const list = await listPracticeCodes({
      practice_code: { eq: practiceCode },
    });

    return list[0] ?? null;
  }

  function beginEditPracticeResult(
    practice: PracticeLite | PracticeCodeRow | null | undefined,
  ) {
    const practiceId = s(practice?.id);
    if (!practiceId) {
      setError("PracticeCode の id が空のため編集できません。");
      return;
    }

    setError("");
    setEditPracticeMessage("");
    setEditingPracticeId(practiceId);
    setEditingPracticeName(s(practice?.name));
    setEditingPracticeMemo(s(practice?.memo));
    setEditingPracticeCategory(
      normalizePracticeCategory(practice?.practiceCategory) ||
        normalizePracticeCategory(practice?.category_name),
    );
  }

  function cancelEditPracticeResult() {
    setEditingPracticeId("");
    setEditingPracticeName("");
    setEditingPracticeMemo("");
    setEditingPracticeCategory("");
    setSavingPracticeEditId("");
    setEditPracticeMessage("");
  }

  async function savePracticeResultEdit(
    practice: PracticeLite | PracticeCodeRow | null | undefined,
  ) {
    const practiceId = s(practice?.id);
    const practiceCode = s(practice?.practice_code);
    const nextName = s(editingPracticeName);
    const nextMemo = s(editingPracticeMemo);
    const nextCategory = normalizePracticeCategory(editingPracticeCategory);

    if (!practiceId) {
      setError("PracticeCode の id が空のため保存できません。");
      return;
    }

    if (!nextName) {
      setError("Practice名を入力してください。");
      return;
    }

    if (!nextMemo) {
      setError("memoを入力してください。");
      return;
    }

    if (!nextCategory) {
      setError("categoryを選択してください。");
      return;
    }

    setSavingPracticeEditId(practiceId);
    setError("");
    setEditPracticeMessage("");

    try {
      const updatePayload = {
        id: practiceId,
        name: nextName,
        memo: nextMemo,
        category_name: "",
        practiceCategory: nextCategory,
        updatedBy: "practice-search-panel",
      };

      const result = await client.models.PracticeCode.update(
        updatePayload as unknown as Parameters<
          typeof client.models.PracticeCode.update
        >[0],
      );

      if (result.errors?.length) {
        throw new Error(errorText(result.errors));
      }

      const savedName = s(result.data?.name) || nextName;
      const savedMemo = s(result.data?.memo) || nextMemo;
      const savedCategory =
        normalizePracticeCategory(result.data?.practiceCategory) ||
        nextCategory;

      if (practiceCode) {
        setPracticeByCode((prev) => {
          const current = prev[practiceCode];
          if (!current) return prev;

          return {
            ...prev,
            [practiceCode]: {
              ...current,
              name: savedName,
              memo: savedMemo,
              category_name: "",
              practiceCategory: savedCategory,
              updatedBy: "practice-search-panel",
            },
          };
        });
      }

      setDebugRows((prev) =>
        prev.map((row): PracticeCodeRow => {
          const sameId = s(row.id) === practiceId;
          const sameCode = practiceCode && s(row.practice_code) === practiceCode;

          if (!sameId && !sameCode) return row;

          return {
            ...row,
            name: savedName,
            memo: savedMemo,
            category_name: "",
            practiceCategory: savedCategory,
            updatedBy: "practice-search-panel",
          };
        }),
      );

      setEditingPracticeId("");
      setEditingPracticeName("");
      setEditingPracticeMemo("");
      setEditingPracticeCategory("");
      setEditPracticeMessage(
        "Practice名・memo・categoryを保存しました。必要に応じて Ability候補を生成してください。",
      );
      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Practice名とmemoの保存に失敗しました。",
      );
    } finally {
      setSavingPracticeEditId("");
    }
  }

  async function handleAnalyzePractice(practiceId: string) {
    setAnalyzeMessage("");
    setSuggestMessage("");
    setRegisterMessage("");
    setArchiveMessage("");
    setEditPracticeMessage("");
    setError("");
    setAnalyzingPracticeId(practiceId);

    try {
      const result = await client.mutations.analyzePractice({
        practiceId,
      });

      if (result.errors?.length) {
        throw new Error(errorText(result.errors));
      }

      const name = s(readValue(result.data, "name"));
      setAnalyzeMessage(
        name ? `AI生成が完了しました: ${name}` : "AI生成が完了しました。",
      );

      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI生成に失敗しました。");
    } finally {
      setAnalyzingPracticeId("");
    }
  }

  async function handleSuggestLinks(practiceId: string, practiceCode: string) {
    setSuggestMessage("");
    setAnalyzeMessage("");
    setRegisterMessage("");
    setArchiveMessage("");
    setEditPracticeMessage("");
    setError("");
    setSuggestingPracticeId(practiceId);

    try {
      const result = await client.mutations.suggestPracticeLinks({
        practiceId,
      });

      if (result.errors?.length) {
        throw new Error(errorText(result.errors));
      }

      const count = n(readValue(result.data, "suggestionCount"));
      setSuggestMessage(`AI候補生成が完了しました: ${count}件`);
      setSelectedPracticeCode(practiceCode);
      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Ability候補生成に失敗しました。",
      );
    } finally {
      setSuggestingPracticeId("");
    }
  }

  async function updateSuggestionStatus(
    row: PracticeLinkSuggestionRow,
    checked: boolean,
  ) {
    setError("");
    setSavingSuggestionId(row.id);

    try {
      if (!suggestionVisibleForTenant(row, tenantId)) {
        throw new Error("現在のテナント外の候補は更新できません。");
      }

      const nextStatus = checked ? "accepted" : "rejected";

      const payload = {
        id: row.id,
        tenantId: row.tenantId ?? undefined,
        practiceCode: row.practiceCode ?? "",
        abilityCode: row.abilityCode ?? "",
        score: n(row.score, 1),
        reason: row.reason ?? "",
        status: nextStatus,
        sortOrder: n(row.sortOrder),
        createdBy: row.createdBy ?? undefined,
        updatedBy: "practice-search-panel",
      };

      const result = await client.models.PracticeLinkSuggestion.update(
        payload as unknown as Parameters<
          typeof client.models.PracticeLinkSuggestion.update
        >[0],
      );

      if (result.errors?.length) {
        throw new Error(errorText(result.errors));
      }

      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "候補ステータス更新に失敗しました。",
      );
    } finally {
      setSavingSuggestionId("");
    }
  }

  async function updateSuggestionScore(
    row: PracticeLinkSuggestionRow,
    score: number,
  ) {
    setError("");
    setSavingSuggestionId(row.id);

    try {
      if (!suggestionVisibleForTenant(row, tenantId)) {
        throw new Error("現在のテナント外の候補は更新できません。");
      }

      const payload = {
        id: row.id,
        tenantId: row.tenantId ?? undefined,
        practiceCode: row.practiceCode ?? "",
        abilityCode: row.abilityCode ?? "",
        score,
        reason: row.reason ?? "",
        status: "edited",
        sortOrder: n(row.sortOrder),
        createdBy: row.createdBy ?? undefined,
        updatedBy: "practice-search-panel",
      };

      const result = await client.models.PracticeLinkSuggestion.update(
        payload as unknown as Parameters<
          typeof client.models.PracticeLinkSuggestion.update
        >[0],
      );

      if (result.errors?.length) {
        throw new Error(errorText(result.errors));
      }

      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "score更新に失敗しました。");
    } finally {
      setSavingSuggestionId("");
    }
  }

  async function handleRegisterPracticeLinks(practiceCode: string) {
    setRegisterMessage("");
    setArchiveMessage("");
    setEditPracticeMessage("");
    setError("");
    setRegisteringPracticeCode(practiceCode);

    try {
      const result = await client.mutations.registerPracticeLinks({
        practiceCode,
      });

      if (result.errors?.length) {
        throw new Error(errorText(result.errors));
      }

      const count = n(readValue(result.data, "registeredCount"));
      setRegisterMessage(`本登録が完了しました: ${count}件`);
      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "本登録に失敗しました。");
    } finally {
      setRegisteringPracticeCode("");
    }
  }

  async function handleCleanupPracticeByCode(
    practiceCode: string,
    practiceRow?: PracticeLite | PracticeCodeRow | null,
  ) {
    const normalizedPracticeCode = s(practiceCode);
    if (!normalizedPracticeCode) {
      setError("practiceCode が空のため整理できません。");
      return;
    }

    setError("");
    setArchiveMessage("");
    setAnalyzeMessage("");
    setSuggestMessage("");
    setRegisterMessage("");
    setEditPracticeMessage("");
    setArchivingPracticeCode(normalizedPracticeCode);

    try {
      const resolvedPractice =
        practiceRow === undefined
          ? await findPracticeRowByCode(normalizedPracticeCode)
          : practiceRow;

      const practiceName = s(resolvedPractice?.name);
      const currentStatus = s(resolvedPractice?.status).toUpperCase();
      const hasPracticeRow = Boolean(resolvedPractice);

      const confirmed = window.confirm(
        hasPracticeRow
          ? [
              "Practice をアーカイブして関連データを整理します。",
              `${normalizedPracticeCode}${practiceName ? ` / ${practiceName}` : ""}`,
              "",
              "- PracticeCode.status を ARCHIVED に変更",
              "- AbilityPracticeLink を削除",
              "- AbilityPracticeAgg を削除",
              "- PracticeLinkSuggestion を削除",
              "",
              "過去の ObservationRecord / ObservationAbilityLink / Schedule は削除しません。",
              "実行してよろしいですか？",
            ].join("\n")
          : [
              "PracticeCode が見つからないため、孤児データを整理します。",
              normalizedPracticeCode,
              "",
              "- AbilityPracticeLink を削除",
              "- AbilityPracticeAgg を削除",
              "- PracticeLinkSuggestion を削除",
              "",
              "PracticeCode 本体は存在しないため更新しません。",
              "実行してよろしいですか？",
            ].join("\n"),
      );

      if (!confirmed) return;

      const [abilityLinks, abilityAggs, suggestionRows] = await Promise.all([
        listAbilityPracticeLinks({
          practiceCode: { eq: normalizedPracticeCode },
        }),
        listAbilityPracticeAggs({
          practiceCode: { eq: normalizedPracticeCode },
        }),
        listPracticeLinkSuggestions({
          practiceCode: { eq: normalizedPracticeCode },
        }),
      ]);

      if (resolvedPractice && currentStatus !== "ARCHIVED") {
        const practiceId = s(resolvedPractice.id);
        if (!practiceId) {
          throw new Error(
            `PracticeCode の id が空のためアーカイブできません: ${normalizedPracticeCode}`,
          );
        }

        const updatePayload = {
          id: practiceId,
          practice_code:
            resolvedPractice.practice_code ?? normalizedPracticeCode,
          category_code: resolvedPractice.category_code ?? undefined,
          category_name: resolvedPractice.category_name ?? undefined,
          name: resolvedPractice.name ?? "",
          memo: resolvedPractice.memo ?? "",
          source_type: resolvedPractice.source_type ?? undefined,
          source_ref: resolvedPractice.source_ref ?? undefined,
          source_url: resolvedPractice.source_url ?? undefined,
          status: "ARCHIVED",
          version: n(resolvedPractice.version, 1),
          tenantId: resolvedPractice.tenantId ?? undefined,
          createdBy: resolvedPractice.createdBy ?? undefined,
          updatedBy: "practice-search-panel",
          visibility: resolvedPractice.visibility ?? undefined,
          publishScope: resolvedPractice.publishScope ?? undefined,
          ownerType: resolvedPractice.ownerType ?? undefined,
          owner: resolvedPractice.owner ?? undefined,
          practiceCategory: resolvedPractice.practiceCategory ?? undefined,
          practiceSourceType: resolvedPractice.practiceSourceType ?? undefined,
          recordedAt: resolvedPractice.recordedAt ?? undefined,
          transcriptText: resolvedPractice.transcriptText ?? undefined,
          aiStatus: resolvedPractice.aiStatus ?? undefined,
          aiModel: resolvedPractice.aiModel ?? undefined,
          aiRawJson: resolvedPractice.aiRawJson ?? undefined,
          errorMessage: resolvedPractice.errorMessage ?? undefined,
          reviewedAt: resolvedPractice.reviewedAt ?? undefined,
          completedAt: resolvedPractice.completedAt ?? undefined,
        };

        const updateResult = await client.models.PracticeCode.update(
          updatePayload as unknown as Parameters<
            typeof client.models.PracticeCode.update
          >[0],
        );

        if (updateResult.errors?.length) {
          throw new Error(errorText(updateResult.errors));
        }
      }

      for (const row of abilityLinks) {
        const result = await client.models.AbilityPracticeLink.delete({
          abilityCode: row.abilityCode ?? "",
          practiceCode: row.practiceCode ?? "",
        } as unknown as Parameters<
          typeof client.models.AbilityPracticeLink.delete
        >[0]);

        if (result.errors?.length) {
          throw new Error(errorText(result.errors));
        }
      }

      for (const row of abilityAggs) {
        const result = await client.models.AbilityPracticeAgg.delete({
          id: row.id ?? "",
        } as unknown as Parameters<
          typeof client.models.AbilityPracticeAgg.delete
        >[0]);

        if (result.errors?.length) {
          throw new Error(errorText(result.errors));
        }
      }

      for (const row of suggestionRows) {
        const result = await client.models.PracticeLinkSuggestion.delete({
          id: row.id,
        } as unknown as Parameters<
          typeof client.models.PracticeLinkSuggestion.delete
        >[0]);

        if (result.errors?.length) {
          throw new Error(errorText(result.errors));
        }
      }

      if (selectedPracticeCode === normalizedPracticeCode) {
        setSelectedPracticeCode("");
        setSuggestions([]);
      }

      setArchiveMessage(
        [
          hasPracticeRow
            ? currentStatus === "ARCHIVED"
              ? `整理完了: ${normalizedPracticeCode}（PracticeCode は既に ARCHIVED）`
              : `アーカイブ完了: ${normalizedPracticeCode}`
            : `孤児データ掃除完了: ${normalizedPracticeCode}`,
          `AbilityPracticeLink 削除: ${abilityLinks.length}件`,
          `AbilityPracticeAgg 削除: ${abilityAggs.length}件`,
          `PracticeLinkSuggestion 削除: ${suggestionRows.length}件`,
          hasPracticeRow
            ? currentStatus === "ARCHIVED"
              ? "PracticeCode 更新: 0件（既に ARCHIVED）"
              : "PracticeCode 更新: 1件"
            : "PracticeCode 更新: 0件（本体なし）",
        ].join("\n"),
      );

      setPracticeByCode((prev) => {
        const current = prev[normalizedPracticeCode];
        if (!current) return prev;

        return {
          ...prev,
          [normalizedPracticeCode]: {
            ...current,
            status: "ARCHIVED",
            updatedBy: "practice-search-panel",
          },
        };
      });

      setPracticeReloadKey((k) => k + 1);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : `整理に失敗しました: ${normalizedPracticeCode}`,
      );
    } finally {
      setArchivingPracticeCode("");
    }
  }

  async function handleArchivePractice(practice: PracticeCodeRow) {
    await handleCleanupPracticeByCode(s(practice.practice_code), practice);
  }

  async function handleCleanupFromAbilityRow(practiceCode: string) {
    await handleCleanupPracticeByCode(practiceCode);
  }

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
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={clampedPage <= 0}
        >
          前へ
        </button>
        <span style={{ fontSize: 12 }}>
          {from}〜{to} / {totalRows}（ページ {clampedPage + 1} / {totalPages}）
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={clampedPage >= totalPages - 1}
        >
          次へ
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Practice検索 / Practice一覧</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setViewMode("ability");
            setPage(0);
          }}
          disabled={viewMode === "ability"}
        >
          Ability起点
        </button>

        <button
          onClick={() => {
            setViewMode("debug");
            setPage(0);
          }}
          disabled={viewMode === "debug"}
        >
          Practice一覧・メンテ
        </button>

        <button
          onClick={() => {
            setPracticeByCode({});
            setPracticeReloadKey((k) => k + 1);
          }}
          disabled={loading}
          title="PracticeCode を再取得します"
        >
          Refresh
        </button>
      </div>

      {viewMode === "ability" ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              10の姿
              <select
                value={selectedAbility}
                onChange={(e) => {
                  setSelectedAbility(e.target.value);
                  setSelectedLeafAbility("");
                  setPage(0);
                  setSelectedPracticeCode("");
                }}
                disabled={loadingAbility}
                style={{ minWidth: 360 }}
              >
                {abilityGroups.parents.map((parent) => {
                  const parentCode = s(parent.code);
                  const children =
                    abilityGroups.childrenByParent.get(parentCode) ?? [];

                  return (
                    <optgroup
                      key={parentCode}
                      label={`${s(parent.code)}_${s(parent.name)}`}
                    >
                      {children.map((child) => (
                        <option key={s(child.code)} value={s(child.code)}>
                          {s(child.code)}_{s(child.name)}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              小分類で絞り込み
              <select
                value={selectedLeafAbility}
                onChange={(e) => {
                  setSelectedLeafAbility(e.target.value);
                  setPage(0);
                  setSelectedPracticeCode("");
                }}
                disabled={loadingAbility || !selectedAbility}
                style={{ minWidth: 360 }}
              >
                <option value="">指定しない（10の姿全体で検索）</option>
                {leafAbilityOptions.map((leaf) => (
                  <option key={s(leaf.code)} value={s(leaf.code)}>
                    {s(leaf.code)}_{s(leaf.name)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              並び替え
              <select
                value={sortKey}
                onChange={(e) => {
                  setSortKey(e.target.value as SortKey);
                  setPage(0);
                }}
              >
                <option value="scoreSum">scoreSum</option>
                <option value="scoreMax">scoreMax</option>
                <option value="linkCount">linkCount</option>
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              1ページ表示
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={5}>5件</option>
                <option value={10}>10件</option>
                <option value={20}>20件</option>
                <option value={50}>50件</option>
              </select>
            </label>
          </div>

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            AbilityCode取得件数（raw）：{abilityRawCount} / プルダウン表示件数
            （level1/2/3 & active）：{abilityOptions.length}
            <br />
            10の姿：{selectedMiddleAbilityLabel || "（未選択）"} / 検索対象：
            {selectedSearchAbilityLabel || "（未選択）"} / 小分類候補：
            {leafAbilityOptions.length}件
            <br />
            結果件数：{rows.length} / scoreSum合計：{totalScoreSum}
            <br />
            表示範囲：{from}〜{to} / {totalRows}（ページ {clampedPage + 1} /{" "}
            {totalPages}）
            <br />※
            10の姿まで選ぶと中分類全体で検索し、必要な場合だけ小分類でさらに絞り込めます。
            <br />※ Ability起点では、PracticeCode
            本体が無い孤児レコードも「整理」で掃除できます。
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              検索
              <input
                value={debugFilter}
                onChange={(e) => {
                  setDebugFilter(e.target.value);
                  setPage(0);
                }}
                placeholder="practice_code / name / memo / transcript で検索"
                style={{ minWidth: 360 }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              status
              <select
                value={debugStatusFilter}
                onChange={(e) => {
                  setDebugStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">すべて</option>
                <option value="UPLOADING">UPLOADING</option>
                <option value="TRANSCRIBING">TRANSCRIBING</option>
                <option value="AI_ANALYZING">AI_ANALYZING</option>
                <option value="REVIEW">REVIEW</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="ARCHIVED">ARCHIVED</option>
                <option value="ERROR">ERROR</option>
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              1ページ表示
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={5}>5件</option>
                <option value={10}>10件</option>
                <option value={20}>20件</option>
                <option value={50}>50件</option>
              </select>
            </label>
          </div>

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            PracticeCode件数：{debugRows.length} / 絞込後：
            {filteredDebugRows.length}
            <br />
            表示範囲：{from}〜{to} / {totalRows}（ページ {clampedPage + 1} /{" "}
            {totalPages}）
            <br />※ アーカイブは PracticeCode を ARCHIVED にし、関連する
            AbilityPracticeLink / AbilityPracticeAgg / PracticeLinkSuggestion
            を掃除します。
          </div>
        </>
      )}

      {analyzeMessage ? (
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
          {analyzeMessage}
        </pre>
      ) : null}

      {suggestMessage ? (
        <pre
          style={{
            margin: 0,
            padding: 10,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {suggestMessage}
        </pre>
      ) : null}

      {registerMessage ? (
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
          {registerMessage}
        </pre>
      ) : null}

      {archiveMessage ? (
        <pre
          style={{
            margin: 0,
            padding: 10,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {archiveMessage}
        </pre>
      ) : null}

      {editPracticeMessage ? (
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
          {editPracticeMessage}
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
        {viewMode === "ability" ? (
          loadingAgg || loadingPractice ? (
            <div style={{ padding: 12 }}>Loading...</div>
          ) : rows.length === 0 ? (
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
                    <th style={{ padding: 8 }}>Practice</th>
                    <th style={{ padding: 8 }}>分類</th>
                    <th style={{ padding: 8 }}>scoreSum</th>
                    <th style={{ padding: 8 }}>scoreMax</th>
                    <th style={{ padding: 8 }}>linkCount</th>
                    <th style={{ padding: 8 }}>status</th>
                    <th style={{ padding: 8, minWidth: 360 }}>メモ</th>
                    <th style={{ padding: 8 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRowsAbility.map((row) => {
                    const practiceCode = s(row.practiceCode);
                    const practice = practiceByCode[practiceCode];
                    const practiceId = s(practice?.id);
                    const isArchived =
                      s(practice?.status).toUpperCase() === "ARCHIVED";
                    const isArchiving = archivingPracticeCode === practiceCode;
                    const isEditingPractice = editingPracticeId === practiceId;
                    const isSavingPracticeEdit =
                      savingPracticeEditId === practiceId;
                    const isSelected = selectedPracticeCode === practiceCode;

                    return (
                      <tr key={`${s(row.abilityCode)}-${practiceCode}`}>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            minWidth: 260,
                            verticalAlign: "top",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{practiceCode}</div>
                          {isEditingPractice ? (
                            <input
                              value={editingPracticeName}
                              disabled={isSavingPracticeEdit}
                              onChange={(e) =>
                                setEditingPracticeName(e.target.value)
                              }
                              placeholder="Practice名"
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                marginTop: 6,
                                padding: 6,
                              }}
                            />
                          ) : (
                            <div>
                              {s(practice?.name) || "（PracticeCode未取得）"}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          {isEditingPractice ? (
                            <select
                              value={editingPracticeCategory}
                              disabled={isSavingPracticeEdit}
                              onChange={(e) =>
                                setEditingPracticeCategory(e.target.value)
                              }
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: 6,
                              }}
                            >
                              {PRACTICE_CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            practiceCategoryLabel(
                              s(practice?.practiceCategory) ||
                                s(practice?.category_name),
                            )
                          )}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          {n(row.scoreSum)}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          {n(row.scoreMax)}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          {n(row.linkCount)}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          {s(practice?.status) || "-"}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            fontSize: 12,
                            lineHeight: 1.65,
                            whiteSpace: "pre-wrap",
                            minWidth: 360,
                            verticalAlign: "top",
                          }}
                        >
                          {isEditingPractice ? (
                            <textarea
                              value={editingPracticeMemo}
                              disabled={isSavingPracticeEdit}
                              onChange={(e) =>
                                setEditingPracticeMemo(e.target.value)
                              }
                              placeholder="概要memo"
                              style={{
                                width: "100%",
                                minHeight: 120,
                                boxSizing: "border-box",
                                padding: 8,
                                lineHeight: 1.6,
                                fontFamily: "inherit",
                              }}
                            />
                          ) : (
                            practiceMemoDisplay(
                              practice?.memo,
                              practice?.transcriptText,
                            ) || "-"
                          )}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          <div style={{ display: "grid", gap: 6 }}>
                            {isEditingPractice ? (
                              <>
                                <button
                                  onClick={() =>
                                    savePracticeResultEdit(practice)
                                  }
                                  disabled={isSavingPracticeEdit}
                                >
                                  {isSavingPracticeEdit ? "保存中..." : "保存"}
                                </button>
                                <button
                                  onClick={cancelEditPracticeResult}
                                  disabled={isSavingPracticeEdit}
                                >
                                  キャンセル
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() =>
                                  beginEditPracticeResult(practice)
                                }
                                disabled={!practiceId || isArchived}
                              >
                                Practice名・memo・categoryを編集
                              </button>
                            )}

                            <div
                              style={{
                                fontSize: 12,
                                color: "#666",
                                lineHeight: 1.5,
                              }}
                            >
                              Ability候補生成前に確認・修正
                            </div>

                            <button
                              onClick={() => handleAnalyzePractice(practiceId)}
                              disabled
                              title="Ability起点では参照専用です。AI生成は Practice一覧・メンテ で実行してください。"
                            >
                              {analyzingPracticeId === practiceId
                                ? "AI生成中..."
                                : "AIで名前と要約を作る"}
                            </button>

                            <button
                              onClick={() =>
                                handleSuggestLinks(practiceId, practiceCode)
                              }
                              disabled
                              title="Ability起点では参照専用です。Ability候補生成は Practice一覧・メンテ で実行してください。"
                            >
                              {suggestingPracticeId === practiceId
                                ? "候補生成中..."
                                : "Ability候補を生成"}
                            </button>

                            <button
                              onClick={() =>
                                setSelectedPracticeCode((current) =>
                                  current === practiceCode ? "" : practiceCode,
                                )
                              }
                              disabled={!practiceCode || isArchived}
                            >
                              {isSelected
                                ? "候補一覧を閉じる"
                                : "候補一覧を開く"}
                            </button>

                            <button
                              onClick={() =>
                                handleRegisterPracticeLinks(practiceCode)
                              }
                              disabled
                              title="Ability起点では本登録しません。本登録は Practice一覧・メンテ で実行してください。"
                            >
                              {registeringPracticeCode === practiceCode
                                ? "本登録中..."
                                : `本登録する${
                                    selectedPracticeCode === practiceCode
                                      ? `（${acceptedCount}件）`
                                      : ""
                                  }`}
                            </button>

                            <button
                              onClick={() =>
                                practice
                                  ? handleCleanupPracticeByCode(
                                      practiceCode,
                                      practice,
                                    )
                                  : handleCleanupFromAbilityRow(practiceCode)
                              }
                              disabled={isArchiving}
                              style={{
                                border: "1px solid #fdba74",
                                background: isArchived ? "#fef3c7" : "#fff7ed",
                                color: "#9a3412",
                                borderRadius: 6,
                                padding: "6px 10px",
                                cursor: isArchiving ? "default" : "pointer",
                              }}
                            >
                              {isArchiving
                                ? "処理中..."
                                : isArchived
                                  ? "整理"
                                  : "アーカイブ"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : loadingDebug ? (
          <div style={{ padding: 12 }}>Loading practices...</div>
        ) : filteredDebugRows.length === 0 ? (
          <div style={{ padding: 12 }}>該当するPracticeがありません。</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 1300,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", background: "#fafafa" }}>
                  <th style={{ padding: 8 }}>practice_code</th>
                  <th style={{ padding: 8 }}>name</th>
                  <th style={{ padding: 8 }}>status</th>
                  <th style={{ padding: 8 }}>aiStatus</th>
                  <th style={{ padding: 8 }}>category</th>
                  <th style={{ padding: 8 }}>visibility</th>
                  <th style={{ padding: 8 }}>recordedAt</th>
                  <th style={{ padding: 8 }}>transcript</th>
                  <th style={{ padding: 8, minWidth: 320 }}>memo</th>
                  <th style={{ padding: 8 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRowsDebug.map((practice) => {
                  const practiceId = s(practice.id);
                  const practiceCode = s(practice.practice_code);
                  const isArchived =
                    s(practice.status).toUpperCase() === "ARCHIVED";
                  const isArchiving = archivingPracticeCode === practiceCode;
                  const isEditingPractice = editingPracticeId === practiceId;
                  const isSavingPracticeEdit =
                    savingPracticeEditId === practiceId;
                  const isSelected = selectedPracticeCode === practiceCode;
                  const canAnalyze = Boolean(practiceId);
                  const canSuggest = Boolean(practiceId);

                  return (
                    <tr key={practiceId || practiceCode}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          verticalAlign: "top",
                        }}
                      >
                        {practiceCode || "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          minWidth: 220,
                          verticalAlign: "top",
                        }}
                      >
                        {isEditingPractice ? (
                          <input
                            value={editingPracticeName}
                            disabled={isSavingPracticeEdit}
                            onChange={(e) =>
                              setEditingPracticeName(e.target.value)
                            }
                            placeholder="Practice名"
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: 6,
                            }}
                          />
                        ) : (
                          s(practice.name) || "-"
                        )}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          verticalAlign: "top",
                        }}
                      >
                        {s(practice.status) || "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          verticalAlign: "top",
                        }}
                      >
                        {s(practice.aiStatus) || "-"}
                      </td>
                      
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          verticalAlign: "top",
                        }}
                      >
                        {isEditingPractice ? (
                          <select
                            value={editingPracticeCategory}
                            disabled={isSavingPracticeEdit}
                            onChange={(e) =>
                              setEditingPracticeCategory(e.target.value)
                            }
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: 6,
                            }}
                          >
                            {PRACTICE_CATEGORY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          practiceCategoryLabel(
                            s(practice.practiceCategory) ||
                              s(practice.category_name),
                          )
                        )}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          verticalAlign: "top",
                        }}
                      >
                        {s(practice.visibility) ||
                          s(practice.publishScope) ||
                          "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          minWidth: 180,
                          verticalAlign: "top",
                        }}
                      >
                        {s(practice.recordedAt) || "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          fontSize: 12,
                          minWidth: 260,
                          whiteSpace: "pre-wrap",
                          verticalAlign: "top",
                        }}
                      >
                        {previewText(practice.transcriptText, 160) || "-"}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          fontSize: 12,
                          lineHeight: 1.65,
                          minWidth: 320,
                          whiteSpace: "pre-wrap",
                          verticalAlign: "top",
                        }}
                      >
                        {isEditingPractice ? (
                          <textarea
                            value={editingPracticeMemo}
                            disabled={isSavingPracticeEdit}
                            onChange={(e) =>
                              setEditingPracticeMemo(e.target.value)
                            }
                            placeholder="概要memo"
                            style={{
                              width: "100%",
                              minHeight: 120,
                              boxSizing: "border-box",
                              padding: 8,
                              lineHeight: 1.6,
                              fontFamily: "inherit",
                            }}
                          />
                        ) : (
                          practiceMemoDisplay(practice.memo, "") || "-"
                        )}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f0f0f0",
                          verticalAlign: "top",
                        }}
                      >
                        <div style={{ display: "grid", gap: 6 }}>
                          {isEditingPractice ? (
                            <>
                              <button
                                onClick={() => savePracticeResultEdit(practice)}
                                disabled={isSavingPracticeEdit}
                              >
                                {isSavingPracticeEdit ? "保存中..." : "保存"}
                              </button>
                              <button
                                onClick={cancelEditPracticeResult}
                                disabled={isSavingPracticeEdit}
                              >
                                キャンセル
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => beginEditPracticeResult(practice)}
                              disabled={!practiceId || isArchived}
                            >
                              Practice名・memo・categoryを編集
                            </button>
                          )}

                          <div
                            style={{
                              fontSize: 12,
                              color: "#666",
                              lineHeight: 1.5,
                            }}
                          >
                            Ability候補生成前に確認・修正
                          </div>

                          <button
                            onClick={() => handleAnalyzePractice(practiceId)}
                            disabled={
                              !canAnalyze ||
                              analyzingPracticeId === practiceId ||
                              isArchived
                            }
                          >
                            {analyzingPracticeId === practiceId
                              ? "AI生成中..."
                              : "AIで名前と要約を作る"}
                          </button>

                          <button
                            onClick={() =>
                              handleSuggestLinks(practiceId, practiceCode)
                            }
                            disabled={
                              !canSuggest ||
                              suggestingPracticeId === practiceId ||
                              isArchived
                            }
                          >
                            {suggestingPracticeId === practiceId
                              ? "候補生成中..."
                              : "Ability候補を生成"}
                          </button>

                          <button
                            onClick={() =>
                              setSelectedPracticeCode((current) =>
                                current === practiceCode ? "" : practiceCode,
                              )
                            }
                            disabled={!practiceCode || isArchived}
                          >
                            {isSelected ? "候補一覧を閉じる" : "候補一覧を開く"}
                          </button>

                          <button
                            onClick={() =>
                              handleRegisterPracticeLinks(practiceCode)
                            }
                            disabled={
                              registeringPracticeCode === practiceCode ||
                              acceptedCount === 0 ||
                              selectedPracticeCode !== practiceCode ||
                              isArchived
                            }
                          >
                            {registeringPracticeCode === practiceCode
                              ? "本登録中..."
                              : `本登録する${
                                  selectedPracticeCode === practiceCode
                                    ? `（${acceptedCount}件）`
                                    : ""
                                }`}
                          </button>

                          <button
                            onClick={() => handleArchivePractice(practice)}
                            disabled={isArchiving}
                            style={{
                              border: "1px solid #fdba74",
                              background: isArchived ? "#fef3c7" : "#fff7ed",
                              color: "#9a3412",
                              borderRadius: 6,
                              padding: "6px 10px",
                              cursor: isArchiving ? "default" : "pointer",
                            }}
                          >
                            {isArchiving
                              ? "処理中..."
                              : isArchived
                                ? "整理"
                                : "アーカイブ"}
                          </button>
                        </div>
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
                {selectedPracticeCode} / 採用候補 {acceptedCount}件 / 表示{" "}
                {suggestionFrom}〜{suggestionTo} / {suggestionTotalRows}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setSuggestionPage((p) => Math.max(0, p - 1))}
                disabled={suggestionClampedPage <= 0}
              >
                前へ
              </button>
              <span style={{ fontSize: 12 }}>
                {suggestionClampedPage + 1} / {suggestionTotalPages}
              </span>
              <button
                onClick={() =>
                  setSuggestionPage((p) =>
                    Math.min(suggestionTotalPages - 1, p + 1),
                  )
                }
                disabled={suggestionClampedPage >= suggestionTotalPages - 1}
              >
                次へ
              </button>
              <button
                onClick={() =>
                  handleRegisterPracticeLinks(selectedPracticeCode)
                }
                disabled={
                  registeringPracticeCode === selectedPracticeCode ||
                  acceptedCount === 0
                }
              >
                {registeringPracticeCode === selectedPracticeCode
                  ? "本登録中..."
                  : `本登録する（${acceptedCount}件）`}
              </button>
            </div>
          </div>

          {loadingSuggestions ? (
            <div style={{ padding: 12 }}>Loading suggestions...</div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: 12 }}>
              候補がありません。「Ability候補を生成」を実行してください。
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
                    <th style={{ padding: 8 }}>採用</th>
                    <th style={{ padding: 8 }}>Ability</th>
                    <th style={{ padding: 8 }}>親</th>
                    <th style={{ padding: 8 }}>score</th>
                    <th style={{ padding: 8 }}>reason</th>
                    <th style={{ padding: 8 }}>status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSuggestions.map((row) => {
                    const checked = isAcceptedSuggestion(row);
                    const disabled = savingSuggestionId === row.id;
                    const abilityCode = s(row.abilityCode);

                    return (
                      <tr key={row.id}>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) =>
                              updateSuggestionStatus(row, e.target.checked)
                            }
                          />
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            minWidth: 240,
                            verticalAlign: "top",
                          }}
                        >
                          {buildCodeName(abilityCode)}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            minWidth: 180,
                            verticalAlign: "top",
                          }}
                        >
                          {buildParentLabel(abilityCode)}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          <select
                            value={n(row.score, 1)}
                            disabled={disabled}
                            onChange={(e) =>
                              updateSuggestionScore(row, Number(e.target.value))
                            }
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                          </select>
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            minWidth: 320,
                            whiteSpace: "pre-wrap",
                            verticalAlign: "top",
                          }}
                        >
                          {s(row.reason) || "-"}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #f0f0f0",
                            verticalAlign: "top",
                          }}
                        >
                          {s(row.status) || "-"}
                        </td>
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
