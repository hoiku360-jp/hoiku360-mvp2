import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";

type DataClientEnv = Parameters<typeof getAmplifyDataClientConfig>[0];

type RegisterPracticeLinksArgs = {
  practiceCode: string;
};

type PracticeLinkSuggestionRow = Schema["PracticeLinkSuggestion"]["type"] & {
  tenantId?: string | null;
  practiceCode?: string | null;
  abilityCode?: string | null;
  score?: number | null;
  reason?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  createdBy?: string | null;
};

type PracticeCodeRow = Schema["PracticeCode"]["type"] & {
  practice_code?: string | null;
  practiceCategory?: string | null;
  visibility?: string | null;
  publishScope?: string | null;
  version?: number | null;
};

type AbilityPracticeLinkRow = Schema["AbilityPracticeLink"]["type"] & {
  abilityCode?: string | null;
  score?: number | null;
};

type AbilityCodeRow = Schema["AbilityCode"]["type"] & {
  code?: string | number | null;
  level?: number | null;
  parent_code?: string | null;
};

type AggRow = {
  abilityCode: string;
  practiceCode: string;
  scoreSum: number;
  scoreMax: number;
  linkCount: number;
  level: number;
};

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function isoNow() {
  return new Date().toISOString();
}

function buildPracticeUpdateBase(practice: PracticeCodeRow) {
  return {
    id: practice.id,
    practice_code: practice.practice_code,
    tenantId: practice.tenantId ?? undefined,
    owner: practice.owner ?? undefined,
    ownerType: practice.ownerType ?? undefined,
    practiceCategory: practice.practiceCategory ?? undefined,
    visibility: practice.visibility ?? undefined,
    publishScope: practice.publishScope ?? undefined,
    name: practice.name ?? "",
    memo: practice.memo ?? "",
    source_type: practice.source_type ?? "practiceRegister",
    version: Number(practice.version ?? 1),
  };
}

export const handler: Schema["registerPracticeLinks"]["functionHandler"] =
  async (event) => {
    const args = event.arguments as RegisterPracticeLinksArgs;
    const practiceCode = s(args.practiceCode);

    if (!practiceCode) {
      throw new Error("practiceCode が空です。");
    }

    const { resourceConfig, libraryOptions } =
      await getAmplifyDataClientConfig(process.env as DataClientEnv);
    Amplify.configure(resourceConfig, libraryOptions);
    const dataClient = generateClient<Schema>();

    const suggestionResult =
      await dataClient.models.PracticeLinkSuggestion.list({
        filter: {
          practiceCode: { eq: practiceCode },
        },
        limit: 1000,
      });

    if (suggestionResult.errors?.length) {
      throw new Error(
        `PracticeLinkSuggestion lookup failed: ${suggestionResult.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    const allSuggestionRows =
      (suggestionResult.data as PracticeLinkSuggestionRow[] | null) ?? [];

    if (allSuggestionRows.length === 0) {
      throw new Error(`PracticeLinkSuggestion not found: ${practiceCode}`);
    }

    const tenantId = s(allSuggestionRows[0]?.tenantId);
    if (!tenantId) {
      throw new Error(
        `tenantId not found from PracticeLinkSuggestion: ${practiceCode}`,
      );
    }

    const practiceList = await dataClient.models.PracticeCode.list({
      filter: {
        tenantId: { eq: tenantId },
      },
      limit: 1000,
    });

    if (practiceList.errors?.length) {
      throw new Error(
        `PracticeCode lookup failed: ${practiceList.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    const practice =
      ((practiceList.data as PracticeCodeRow[] | null) ?? []).find(
        (x) => s(x.practice_code) === practiceCode,
      ) ?? null;

    if (!practice) {
      throw new Error(`PracticeCode not found: ${practiceCode}`);
    }

    const acceptedRows = allSuggestionRows.filter((row) => {
      const status = s(row.status).toLowerCase();
      return status === "accepted" || status === "edited";
    });

    if (acceptedRows.length === 0) {
      return {
        practiceCode,
        registeredCount: 0,
        status: "NO_ACCEPTED_ROWS",
      };
    }

    let registeredCount = 0;

    for (const row of acceptedRows) {
      const abilityCode = s(row.abilityCode);
      const score = Number(row.score ?? 0);

      if (!abilityCode || ![1, 2, 3].includes(score)) {
        continue;
      }

      const existing = await dataClient.models.AbilityPracticeLink.get({
        abilityCode,
        practiceCode,
      });

      if (existing.errors?.length) {
        throw new Error(
          `AbilityPracticeLink get failed: ${existing.errors
            .map((e) => e.message)
            .join("\n")}`,
        );
      }

      if (existing.data) {
        const updateResult = await dataClient.models.AbilityPracticeLink.update(
          {
            abilityCode,
            practiceCode,
            score,
          },
        );

        if (updateResult.errors?.length) {
          throw new Error(
            `AbilityPracticeLink update failed: ${updateResult.errors
              .map((e) => e.message)
              .join("\n")}`,
          );
        }
      } else {
        const createResult = await dataClient.models.AbilityPracticeLink.create(
          {
            abilityCode,
            practiceCode,
            score,
          },
        );

        if (createResult.errors?.length) {
          throw new Error(
            `AbilityPracticeLink create failed: ${createResult.errors
              .map((e) => e.message)
              .join("\n")}`,
          );
        }
      }

      const updateSuggestion =
        await dataClient.models.PracticeLinkSuggestion.update({
          id: row.id,
          tenantId: row.tenantId,
          practiceCode: row.practiceCode,
          abilityCode: row.abilityCode,
          score,
          reason: row.reason ?? "",
          status: "accepted",
          sortOrder: Number(row.sortOrder ?? 0),
          createdBy: row.createdBy ?? undefined,
          updatedBy: "register-practice-links",
        });

      if (updateSuggestion.errors?.length) {
        throw new Error(
          `PracticeLinkSuggestion update failed: ${updateSuggestion.errors
            .map((e) => e.message)
            .join("\n")}`,
        );
      }

      registeredCount += 1;
    }

    const oldAggResult = await dataClient.models.AbilityPracticeAgg.list({
      filter: {
        practiceCode: { eq: practiceCode },
      },
      limit: 1000,
    });

    if (oldAggResult.errors?.length) {
      throw new Error(
        `AbilityPracticeAgg list failed: ${oldAggResult.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    for (const oldAgg of oldAggResult.data ?? []) {
      const delResult = await dataClient.models.AbilityPracticeAgg.delete({
        id: oldAgg.id,
      });

      if (delResult.errors?.length) {
        throw new Error(
          `AbilityPracticeAgg delete failed: ${delResult.errors
            .map((e) => e.message)
            .join("\n")}`,
        );
      }
    }

    const linkResult = await dataClient.models.AbilityPracticeLink.list({
      filter: {
        practiceCode: { eq: practiceCode },
      },
      limit: 1000,
    });

    if (linkResult.errors?.length) {
      throw new Error(
        `AbilityPracticeLink list failed: ${linkResult.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    const links = (linkResult.data as AbilityPracticeLinkRow[] | null) ?? [];

    const abilityResult = await dataClient.models.AbilityCode.list({
      limit: 10000,
    });

    if (abilityResult.errors?.length) {
      throw new Error(
        `AbilityCode list failed: ${abilityResult.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    const abilityMap = new Map<string, AbilityCodeRow>();
    for (const a of (abilityResult.data as AbilityCodeRow[] | null) ?? []) {
      abilityMap.set(String(a.code), a);
    }

    const aggMap = new Map<string, AggRow>();

    for (const link of links) {
      const leafAbilityCode = s(link.abilityCode);
      const score = Number(link.score ?? 0);

      if (!leafAbilityCode || ![1, 2, 3].includes(score)) {
        continue;
      }

      let currentCode: string | undefined = leafAbilityCode;
      let guard = 0;

      while (currentCode && guard < 10) {
        guard += 1;

        const ability = abilityMap.get(currentCode);
        const level = Number(ability?.level ?? 0);
        const key = `${currentCode}__${practiceCode}`;

        const prev = aggMap.get(key);
        if (prev) {
          prev.scoreSum += score;
          prev.scoreMax = Math.max(prev.scoreMax, score);
          prev.linkCount += 1;
        } else {
          aggMap.set(key, {
            abilityCode: currentCode,
            practiceCode,
            scoreSum: score,
            scoreMax: score,
            linkCount: 1,
            level,
          });
        }

        const parentCode = s(ability?.parent_code);
        currentCode = parentCode || undefined;
      }
    }

    for (const agg of aggMap.values()) {
      const createAgg = await dataClient.models.AbilityPracticeAgg.create({
        abilityCode: agg.abilityCode,
        practiceCode: agg.practiceCode,
        scoreSum: agg.scoreSum,
        scoreMax: agg.scoreMax,
        linkCount: agg.linkCount,
        level: agg.level,
      });

      if (createAgg.errors?.length) {
        throw new Error(
          `AbilityPracticeAgg create failed: ${createAgg.errors
            .map((e) => e.message)
            .join("\n")}`,
        );
      }
    }

    const practiceUpdate = await dataClient.models.PracticeCode.update({
      ...buildPracticeUpdateBase(practice),
      status: "COMPLETED",
      completedAt: isoNow(),
      updatedBy: "register-practice-links",
    });

    if (practiceUpdate.errors?.length) {
      throw new Error(
        `PracticeCode update failed: ${practiceUpdate.errors
          .map((e) => e.message)
          .join("\n")}`,
      );
    }

    return {
      practiceCode,
      registeredCount,
      status: "REGISTERED",
    };
  };
