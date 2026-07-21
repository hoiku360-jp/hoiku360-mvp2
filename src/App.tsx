import { useEffect, useMemo, useState } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import tenantCsv from "./seed/data/Tenant.csv?raw";
import classroomCsv from "./seed/data/Classroom.csv?raw";
import userProfileCsv from "./seed/data/UserProfile.csv?raw";
import staffAssignmentCsv from "./seed/data/StaffAssignment.csv?raw";
import userSubMapCsv from "./seed/data/UserSubMap.csv?raw";
import abilityCodesLangCsv from "./seed/data/ability_codes_lang.csv?raw";
import childCsv from "./seed/data/Child.csv?raw";
import childClassroomEnrollmentCsv from "./seed/data/ChildClassroomEnrollment.csv?raw";
import planPhraseCsv from "./seed/data/PlanPhrase.csv?raw";
import planPhraseAbilityLinkCsv from "./seed/data/PlanPhraseAbilityLink.csv?raw";
import abilityObservationHintCsv from "./seed/data/AbilityObservationHint.csv?raw";
import PracticeRegisterPanel from "./features/practice-register/PracticeRegisterPanel";
import PracticeSearchPanel from "./features/practice/PracticeSearchPanel";
import PlanWorkspacePanel from "./features/plan/PlanWorkspacePanel";
import DoWorkspacePanel from "./features/do/DoWorkspacePanel";
import CheckWorkspacePanel from "./features/check/CheckWorkspacePanel";
import ChildWeeklyWorkspacePanel from "./features/check/ChildWeeklyWorkspacePanel";
import ChildProgressRecordPanel from "./features/check/ChildProgressRecordPanel";
import "./App.css";

const rawClient = generateClient<Schema>({
  authMode: "userPool",
});

const CURRENT_FISCAL_YEAR = 2026;

type ModelGetResult<T> = Promise<{
  data: T | null;
  errors?: unknown[];
}>;

type ModelListResult<T> = Promise<{
  data: T[];
  errors?: unknown[];
}>;

type ModelApi<T, CreateInput extends Record<string, unknown>> = {
  get(args: { id: string }): ModelGetResult<T>;
  list(args?: { filter?: Record<string, unknown> }): ModelListResult<T>;
  create(input: CreateInput): ModelGetResult<T>;
  update(input: CreateInput & { id: string }): ModelGetResult<T>;
};

type ModelIdentifierApi<
  T,
  CreateInput extends Record<string, unknown>,
  GetArgs extends Record<string, unknown>
> = {
  get(args: GetArgs): ModelGetResult<T>;
  list(args?: { filter?: Record<string, unknown> }): ModelListResult<T>;
  create(input: CreateInput): ModelGetResult<T>;
  update(input: CreateInput): ModelGetResult<T>;
};

type TenantRecord = {
  id: string;
  name: string;
  displayName?: string | null;
  status: string;
};

type ClassroomRecord = {
  id: string;
  tenantId: string;
  name: string;
  ageLabel?: string | null;
  fiscalYear: number;
  status: string;
};

type AbilityCodeRecord = {
  id: string;
  code: string;
  code_display: string;
  parent_code?: string | null;
  level: number;
  name: string;
  domain?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_leaf: boolean;
  status: string;
  note?: string | null;
};

type ChildRecord = {
  id: string;
  tenantId: string;
  displayName: string;
  kana?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  status: string;
};

type ChildClassroomEnrollmentRecord = {
  id: string;
  tenantId: string;
  childId: string;
  classroomId: string;
  fiscalYear: number;
  startDate: string;
  endDate?: string | null;
  status: string;
};

type AbilityCodeCreateInput = {
  id?: string;
  code: string;
  code_display: string;
  parent_code?: string;
  level: number;
  name: string;
  domain?: string;
  category?: string;
  sort_order?: number;
  is_leaf: boolean;
  status: string;
  note?: string;
};

type ChildCreateInput = {
  id?: string;
  tenantId: string;
  displayName: string;
  kana?: string;
  birthDate?: string;
  gender?: string;
  status: string;
};

type ChildClassroomEnrollmentCreateInput = {
  id?: string;
  tenantId: string;
  childId: string;
  classroomId: string;
  fiscalYear: number;
  startDate: string;
  endDate?: string;
  status: string;
};

type UserProfileRecord = {
  id: string;
  userId: string;
  tenantId: string;
  displayName: string;
  email?: string | null;
  role: string;
  status: string;
};

type StaffAssignmentRecord = {
  id: string;
  tenantId: string;
  userId: string;
  classroomId?: string | null;
  role: string;
  fiscalYear: number;
  status: string;
};

type PlanPhraseRecord = {
  planPhraseId: string;
  planPeriodType: string;
  domainCode: string;
  domain: string;
  ageYears: number;
  phraseNo?: number | null;
  phraseType?: string | null;
  phraseText: string;
  source?: string | null;
  status: string;
  sortOrder?: number | null;
  note?: string | null;
};

type PlanPhraseAbilityLinkRecord = {
  linkId: string;
  planPhraseId: string;
  planPeriodType: string;
  phraseDomainCode?: string | null;
  phraseDomain?: string | null;
  ageYears?: number | null;
  phraseNo?: number | null;
  abilityCode: string;
  abilityDomain?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  abilityName?: string | null;
  relationType?: string | null;
  weight: number;
  status: string;
  sortOrder?: number | null;
  note?: string | null;
};


type AbilityObservationHintRecord = {
  id: string;
  abilityCode: string;
  abilityName: string;
  startingAge: number;
  hintNo: number;
  episode1?: string | null;
  episode2?: string | null;
  episode3?: string | null;
  isActive: boolean;
};

type TenantCreateInput = {
  id?: string;
  name: string;
  displayName?: string;
  status: string;
};

type ClassroomCreateInput = {
  id?: string;
  tenantId: string;
  name: string;
  ageLabel?: string;
  fiscalYear: number;
  status: string;
};

type UserProfileCreateInput = {
  id?: string;
  userId: string;
  tenantId: string;
  displayName: string;
  email?: string;
  role: string;
  status: string;
};

type StaffAssignmentCreateInput = {
  id?: string;
  tenantId: string;
  userId: string;
  classroomId?: string | null;
  role: string;
  fiscalYear: number;
  status: string;
};

type PlanPhraseCreateInput = {
  planPhraseId: string;
  planPeriodType: string;
  domainCode: string;
  domain: string;
  ageYears: number;
  phraseNo?: number;
  phraseType?: string;
  phraseText: string;
  source?: string;
  status: string;
  sortOrder?: number;
  note?: string;
};

type PlanPhraseAbilityLinkCreateInput = {
  linkId: string;
  planPhraseId: string;
  planPeriodType: string;
  phraseDomainCode?: string;
  phraseDomain?: string;
  ageYears?: number;
  phraseNo?: number;
  abilityCode: string;
  abilityDomain?: string;
  categoryCode?: string;
  categoryName?: string;
  abilityName?: string;
  relationType?: string;
  weight: number;
  status: string;
  sortOrder?: number;
  note?: string;
};


type AbilityObservationHintCreateInput = {
  id?: string;
  abilityCode: string;
  abilityName: string;
  startingAge: number;
  hintNo: number;
  episode1?: string;
  episode2?: string;
  episode3?: string;
  isActive: boolean;
};

const client = rawClient as unknown as {
  models: {
    Tenant: ModelApi<TenantRecord, TenantCreateInput>;
    Classroom: ModelApi<ClassroomRecord, ClassroomCreateInput>;
    UserProfile: ModelApi<UserProfileRecord, UserProfileCreateInput>;
    StaffAssignment: ModelApi<StaffAssignmentRecord, StaffAssignmentCreateInput>;
    AbilityCode: ModelApi<AbilityCodeRecord, AbilityCodeCreateInput>;
    Child: ModelApi<ChildRecord, ChildCreateInput>;
    ChildClassroomEnrollment: ModelApi<
      ChildClassroomEnrollmentRecord,
      ChildClassroomEnrollmentCreateInput
    >;
    PlanPhrase: ModelIdentifierApi<
      PlanPhraseRecord,
      PlanPhraseCreateInput,
      { planPhraseId: string }
    >;
    PlanPhraseAbilityLink: ModelIdentifierApi<
      PlanPhraseAbilityLinkRecord,
      PlanPhraseAbilityLinkCreateInput,
      { linkId: string }
    >;
    AbilityObservationHint: ModelApi<
      AbilityObservationHintRecord,
      AbilityObservationHintCreateInput
    >;
  };
};

type AppUserContext = {
  userSub: string;
  username: string;
  tenantId: string | null;
  tenantName: string | null;
  displayName: string | null;
  role: string | null;
  classroomIds: string[];
  classroomNames: string[];
};

type TabKey =
  | "home"
  | "doWorkspace"
  | "checkWorkspace"
  | "childWeekly"
  | "childProgress"
  | "planWorkspace"
  | "practiceRegister"
  | "practiceSearch";

type SeedSummary = {
  tenantCount: number;
  classroomCount: number;
  userProfileCount: number;
  staffAssignmentCount: number;
  abilityCodeCount: number;
  childCount: number;
  childClassroomEnrollmentCount: number;
  planPhraseCount: number;
  planPhraseAbilityLinkCount: number;
  abilityObservationHintCount: number;
};

type ClassroomChildSummary = {
  classroomId: string;
  classroomName: string;
  children: Array<{
    id: string;
    displayName: string;
    kana?: string | null;
  }>;
};

type SeedRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text: string): SeedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: SeedRow = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });

    return row;
  });
}

function buildUserSubMap(): Map<string, string> {
  const map = new Map<string, string>();
  const rows = parseCsv(userSubMapCsv);

  for (const row of rows) {
    const oldUserId = String(row.oldUserId ?? "").trim();
    const newUserId = String(row.newUserId ?? "").trim();

    if (!oldUserId || !newUserId) {
      continue;
    }

    map.set(oldUserId, newUserId);
  }

  return map;
}

function applyUserSubMap(value: string | undefined): string {
  const raw = String(value ?? "");
  if (!raw) return raw;

  const map = buildUserSubMap();
  let replaced = raw;

  for (const [oldUserId, newUserId] of map.entries()) {
    replaced = replaced.replaceAll(oldUserId, newUserId);
  }

  return replaced;
}

function resolveSeedValue(value: string | undefined, userSub: string, username: string): string {
  return applyUserSubMap(value)
    .replaceAll("CURRENT_USER", userSub)
    .replaceAll("CURRENT_USERNAME", username);
}

function optionalSeedValue(
  value: string | undefined,
  userSub: string,
  username: string
): string | undefined {
  const resolved = resolveSeedValue(value, userSub, username);
  return resolved.length > 0 ? resolved : undefined;
}

function requiredSeedValue(
  row: SeedRow,
  key: string,
  userSub: string,
  username: string
): string {
  const value = optionalSeedValue(row[key], userSub, username);

  if (!value) {
    throw new Error(`CSV seed error: ${key} is required.`);
  }

  return value;
}

function requiredSeedNumber(
  row: SeedRow,
  key: string,
  userSub: string,
  username: string
): number {
  const value = requiredSeedValue(row, key, userSub, username);
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV seed error: ${key} must be number. value=${value}`);
  }

  return parsed;
}

function optionalSeedNumber(
  row: SeedRow,
  key: string,
  userSub: string,
  username: string
): number | undefined {
  const value = optionalSeedValue(row[key], userSub, username);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV seed error: ${key} must be number. value=${value}`);
  }

  return parsed;
}

function requiredSeedBoolean(
  row: SeedRow,
  key: string,
  userSub: string,
  username: string
): boolean {
  const value = requiredSeedValue(row, key, userSub, username).toLowerCase();

  if (["true", "1", "yes", "y"].includes(value)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(value)) {
    return false;
  }

  throw new Error(`CSV seed error: ${key} must be boolean. value=${value}`);
}

async function upsertModel<T, CreateInput extends Record<string, unknown>>(
  model: ModelApi<T, CreateInput>,
  input: CreateInput & { id: string }
): ModelGetResult<T> {
  const existing = await model.get({ id: input.id });

  if (existing.data) {
    return model.update(input);
  }

  return model.create(input);
}

async function deactivateClassroomIfExists(id: string) {
  const existing = await client.models.Classroom.get({ id });
  const classroom = existing.data;

  if (!classroom || classroom.status === "INACTIVE") {
    return;
  }

  await client.models.Classroom.update({
    id: classroom.id,
    tenantId: classroom.tenantId,
    name: classroom.name,
    ageLabel: classroom.ageLabel ?? undefined,
    fiscalYear: classroom.fiscalYear,
    status: "INACTIVE",
  });
}

async function cleanupLegacyBootstrapData() {
  await deactivateClassroomIfExists("sakura-2026");
  await deactivateClassroomIfExists("sumire-2026");
}

async function seedTenants(userSub: string, username: string) {
  const rows = parseCsv(tenantCsv);

  for (const row of rows) {
    const id =
      optionalSeedValue(row.id, userSub, username) ??
      requiredSeedValue(row, "tenantId", userSub, username);

    await upsertModel(client.models.Tenant, {
      id,
      name: requiredSeedValue(row, "name", userSub, username),
      displayName:
        optionalSeedValue(row.displayName, userSub, username) ??
        optionalSeedValue(row.legalName, userSub, username) ??
        optionalSeedValue(row.name, userSub, username),
      status: requiredSeedValue(row, "status", userSub, username),
    });
  }

  return rows.length;
}

async function seedClassrooms(userSub: string, username: string) {
  const rows = parseCsv(classroomCsv);

  for (const row of rows) {
    const id =
      optionalSeedValue(row.id, userSub, username) ??
      requiredSeedValue(row, "classroomId", userSub, username);

    await upsertModel(client.models.Classroom, {
      id,
      tenantId: requiredSeedValue(row, "tenantId", userSub, username),
      name: requiredSeedValue(row, "name", userSub, username),
      ageLabel:
        optionalSeedValue(row.ageLabel, userSub, username) ??
        optionalSeedValue(row.ageBand, userSub, username),
      fiscalYear: optionalSeedValue(row.fiscalYear, userSub, username)
        ? requiredSeedNumber(row, "fiscalYear", userSub, username)
        : 2026,
      status: requiredSeedValue(row, "status", userSub, username),
    });
  }

  return rows.length;
}

async function seedUserProfiles(userSub: string, username: string) {
  const rows = parseCsv(userProfileCsv);

  for (const row of rows) {
    const id =
      optionalSeedValue(row.id, userSub, username) ??
      requiredSeedValue(row, "userId", userSub, username);

    const email =
      optionalSeedValue(row.email, userSub, username) ??
      (username.includes("@") ? username : undefined);

    await upsertModel(client.models.UserProfile, {
      id,
      userId: requiredSeedValue(row, "userId", userSub, username),
      tenantId: requiredSeedValue(row, "tenantId", userSub, username),
      displayName:
        optionalSeedValue(row.displayName, userSub, username) ??
        requiredSeedValue(row, "fullName", userSub, username),
      email,
      role: requiredSeedValue(row, "role", userSub, username),
      status: requiredSeedValue(row, "status", userSub, username),
    });
  }

  return rows.length;
}

async function seedStaffAssignments(userSub: string, username: string) {
  const rows = parseCsv(staffAssignmentCsv);

  for (const row of rows) {
    const id =
      optionalSeedValue(row.id, userSub, username) ??
      requiredSeedValue(row, "assignmentId", userSub, username);

    await upsertModel(client.models.StaffAssignment, {
      id,
      tenantId: requiredSeedValue(row, "tenantId", userSub, username),
      userId: requiredSeedValue(row, "userId", userSub, username),
      classroomId: optionalSeedValue(row.classroomId, userSub, username),
      role: requiredSeedValue(row, "role", userSub, username),
      fiscalYear: requiredSeedNumber(row, "fiscalYear", userSub, username),
      status: requiredSeedValue(row, "status", userSub, username),
    });
  }

  return rows.length;
}

async function seedAbilityCodes(userSub: string, username: string) {
  const rows = parseCsv(abilityCodesLangCsv);

  for (const row of rows) {
    const code = requiredSeedValue(row, "code", userSub, username);
    const id = optionalSeedValue(row.id, userSub, username) ?? code;

    await upsertModel(client.models.AbilityCode, {
      id,
      code,
      code_display:
        optionalSeedValue(row.code_display, userSub, username) ?? code,
      parent_code: optionalSeedValue(row.parent_code, userSub, username),
      level: requiredSeedNumber(row, "level", userSub, username),
      name: requiredSeedValue(row, "name", userSub, username),
      domain: optionalSeedValue(row.domain, userSub, username),
      category: optionalSeedValue(row.category, userSub, username),
      sort_order: optionalSeedNumber(row, "sort_order", userSub, username),
      is_leaf: requiredSeedBoolean(row, "is_leaf", userSub, username),
      status:
        optionalSeedValue(row.status, userSub, username) ?? "ACTIVE",
      note: optionalSeedValue(row.note, userSub, username),
    });
  }

  return rows.length;
}

async function seedChildren(userSub: string, username: string) {
  const rows = parseCsv(childCsv);

  for (const row of rows) {
    const id =
      optionalSeedValue(row.id, userSub, username) ??
      requiredSeedValue(row, "childId", userSub, username);

    await upsertModel(client.models.Child, {
      id,
      tenantId: requiredSeedValue(row, "tenantId", userSub, username),
      displayName: requiredSeedValue(row, "displayName", userSub, username),
      kana: optionalSeedValue(row.kana, userSub, username),
      birthDate: optionalSeedValue(row.birthDate, userSub, username),
      gender: optionalSeedValue(row.gender, userSub, username),
      status: requiredSeedValue(row, "status", userSub, username),
    });
  }

  return rows.length;
}

async function seedChildClassroomEnrollments(userSub: string, username: string) {
  const rows = parseCsv(childClassroomEnrollmentCsv);

  for (const row of rows) {
    const id =
      optionalSeedValue(row.id, userSub, username) ??
      requiredSeedValue(row, "enrollmentId", userSub, username);

    await upsertModel(client.models.ChildClassroomEnrollment, {
      id,
      tenantId: requiredSeedValue(row, "tenantId", userSub, username),
      childId: requiredSeedValue(row, "childId", userSub, username),
      classroomId: requiredSeedValue(row, "classroomId", userSub, username),
      fiscalYear: requiredSeedNumber(row, "fiscalYear", userSub, username),
      startDate: requiredSeedValue(row, "startDate", userSub, username),
      endDate: optionalSeedValue(row.endDate, userSub, username),
      status: requiredSeedValue(row, "status", userSub, username),
    });
  }

  return rows.length;
}

async function upsertPlanPhrase(input: PlanPhraseCreateInput) {
  const existing = await client.models.PlanPhrase.get({
    planPhraseId: input.planPhraseId,
  });

  if (existing.data) {
    return client.models.PlanPhrase.update(input);
  }

  return client.models.PlanPhrase.create(input);
}

async function upsertPlanPhraseAbilityLink(
  input: PlanPhraseAbilityLinkCreateInput
) {
  const existing = await client.models.PlanPhraseAbilityLink.get({
    linkId: input.linkId,
  });

  if (existing.data) {
    return client.models.PlanPhraseAbilityLink.update(input);
  }

  return client.models.PlanPhraseAbilityLink.create(input);
}

async function seedPlanPhrases(userSub: string, username: string) {
  const rows = parseCsv(planPhraseCsv);

  for (const row of rows) {
    await upsertPlanPhrase({
      planPhraseId: requiredSeedValue(row, "planPhraseId", userSub, username),
      planPeriodType: requiredSeedValue(row, "planPeriodType", userSub, username),
      domainCode: requiredSeedValue(row, "domainCode", userSub, username),
      domain: requiredSeedValue(row, "domain", userSub, username),
      ageYears: requiredSeedNumber(row, "ageYears", userSub, username),
      phraseNo: optionalSeedNumber(row, "phraseNo", userSub, username),
      phraseType: optionalSeedValue(row.phraseType, userSub, username),
      phraseText: requiredSeedValue(row, "phraseText", userSub, username),
      source: optionalSeedValue(row.source, userSub, username),
      status:
        optionalSeedValue(row.status, userSub, username) ?? "active",
      sortOrder: optionalSeedNumber(row, "sortOrder", userSub, username),
      note: optionalSeedValue(row.note, userSub, username),
    });
  }

  return rows.length;
}

async function seedPlanPhraseAbilityLinks(userSub: string, username: string) {
  const rows = parseCsv(planPhraseAbilityLinkCsv);

  for (const row of rows) {
    await upsertPlanPhraseAbilityLink({
      linkId: requiredSeedValue(row, "linkId", userSub, username),
      planPhraseId: requiredSeedValue(row, "planPhraseId", userSub, username),
      planPeriodType: requiredSeedValue(row, "planPeriodType", userSub, username),
      phraseDomainCode: optionalSeedValue(row.phraseDomainCode, userSub, username),
      phraseDomain: optionalSeedValue(row.phraseDomain, userSub, username),
      ageYears: optionalSeedNumber(row, "ageYears", userSub, username),
      phraseNo: optionalSeedNumber(row, "phraseNo", userSub, username),
      abilityCode: requiredSeedValue(row, "abilityCode", userSub, username),
      abilityDomain: optionalSeedValue(row.abilityDomain, userSub, username),
      categoryCode: optionalSeedValue(row.categoryCode, userSub, username),
      categoryName: optionalSeedValue(row.categoryName, userSub, username),
      abilityName: optionalSeedValue(row.abilityName, userSub, username),
      relationType: optionalSeedValue(row.relationType, userSub, username),
      weight: requiredSeedNumber(row, "weight", userSub, username),
      status:
        optionalSeedValue(row.status, userSub, username) ?? "active",
      sortOrder: optionalSeedNumber(row, "sortOrder", userSub, username),
      note: optionalSeedValue(row.note, userSub, username),
    });
  }

  return rows.length;
}


function abilityObservationHintId(
  abilityCode: string,
  startingAge: number,
  hintNo: number
): string {
  return `${abilityCode}-${startingAge}-${String(hintNo).padStart(2, "0")}`;
}

async function seedAbilityObservationHints(userSub: string, username: string) {
  const rows = parseCsv(abilityObservationHintCsv);
  const counters = new Map<string, number>();

  for (const row of rows) {
    const abilityCode = requiredSeedValue(row, "abilityCode", userSub, username);
    const startingAge = requiredSeedNumber(row, "startingAge", userSub, username);
    const counterKey = `${abilityCode}-${startingAge}`;
    const hintNo = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, hintNo);

    await upsertModel(client.models.AbilityObservationHint, {
      id: abilityObservationHintId(abilityCode, startingAge, hintNo),
      abilityCode,
      abilityName: requiredSeedValue(row, "abilityName", userSub, username),
      startingAge,
      hintNo,
      episode1: optionalSeedValue(row.episode1, userSub, username),
      episode2: optionalSeedValue(row.episode2, userSub, username),
      episode3: optionalSeedValue(row.episode3, userSub, username),
      isActive: true,
    });
  }

  return rows.length;
}


function SignedInHome({ signOut }: { signOut?: () => void }) {
  const [tab, setTab] = useState<TabKey>("home");
  const [status, setStatus] = useState<string>("読み込み中...");
  const [context, setContext] = useState<AppUserContext | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [seedSummary, setSeedSummary] = useState<SeedSummary | null>(null);
  const [classroomChildren, setClassroomChildren] = useState<ClassroomChildSummary[]>([]);

  const contextLabel = useMemo(() => {
    if (!context) return "未取得";
    return [
      `userSub=${context.userSub}`,
      `tenant=${context.tenantName ?? context.tenantId ?? "-"}`,
      `role=${context.role ?? "-"}`,
      `classrooms=${
        context.classroomNames.length > 0 ? context.classroomNames.join(", ") : "園全体"
      }`,
    ].join(" / ");
  }, [context]);

  const practiceOwner = context?.userSub ?? "unknown-owner";
  const practiceTenantId = context?.tenantId ?? "";
  const currentClassroomId = context?.classroomIds[0] ?? null;
  const isSchoolScope = (context?.classroomIds.length ?? 0) === 0;

  async function loadClassroomChildren(
    tenantId: string,
    scopedClassroomIds: string[]
  ) {
    const classroomRes = await client.models.Classroom.list({
      filter: {
        tenantId: { eq: tenantId },
        fiscalYear: { eq: CURRENT_FISCAL_YEAR },
        status: { eq: "ACTIVE" },
      },
    });

    const allClassrooms = (classroomRes.data ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, "ja")
    );

    const targetClassrooms =
      scopedClassroomIds.length > 0
        ? allClassrooms.filter((classroom) => scopedClassroomIds.includes(classroom.id))
        : allClassrooms;

    const summaries: ClassroomChildSummary[] = [];

    for (const classroom of targetClassrooms) {
      const enrollmentRes = await client.models.ChildClassroomEnrollment.list({
        filter: {
          tenantId: { eq: tenantId },
          classroomId: { eq: classroom.id },
          fiscalYear: { eq: CURRENT_FISCAL_YEAR },
          status: { eq: "ACTIVE" },
        },
      });

      const enrollments = enrollmentRes.data ?? [];
      const children: ClassroomChildSummary["children"] = [];

      for (const enrollment of enrollments) {
        const childRes = await client.models.Child.get({ id: enrollment.childId });
        const child = childRes.data;

        if (child?.status === "ACTIVE") {
          children.push({
            id: child.id,
            displayName: child.displayName,
            kana: child.kana,
          });
        }
      }

      children.sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));

      summaries.push({
        classroomId: classroom.id,
        classroomName: classroom.name,
        children,
      });
    }

    setClassroomChildren(summaries);
  }

  async function loadContext() {
    setStatus("ユーザー情報を取得中...");

    const user = await getCurrentUser();
    const userSub = user.userId;

    const profileRes = await client.models.UserProfile.get({ id: userSub });
    const profile = profileRes.data;

    if (!profile) {
      setContext({
        userSub,
        username: user.username,
        tenantId: null,
        tenantName: null,
        displayName: null,
        role: null,
        classroomIds: [],
        classroomNames: [],
      });
      setStatus("UserProfile が未作成です。下のボタンでCSV seedを実行してください。");
      return;
    }

    const tenantRes = await client.models.Tenant.get({ id: profile.tenantId });
    const tenant = tenantRes.data;

    const assignmentRes = await client.models.StaffAssignment.list({
      filter: {
        userId: { eq: userSub },
        tenantId: { eq: profile.tenantId },
        fiscalYear: { eq: CURRENT_FISCAL_YEAR },
        status: { eq: "ACTIVE" },
      },
    });

    const assignments = assignmentRes.data ?? [];
    const classroomIds = assignments
      .map((item) => item.classroomId)
      .filter((id): id is string => Boolean(id));

    const classroomNames: string[] = [];

    for (const classroomId of classroomIds) {
      const classroomRes = await client.models.Classroom.get({ id: classroomId });
      if (classroomRes.data?.name) {
        classroomNames.push(classroomRes.data.name);
      }
    }

    setContext({
      userSub,
      username: user.username,
      tenantId: profile.tenantId,
      tenantName: tenant?.displayName ?? tenant?.name ?? profile.tenantId,
      displayName: profile.displayName,
      role: profile.role,
      classroomIds,
      classroomNames,
    });

    await loadClassroomChildren(profile.tenantId, classroomIds);

    setStatus("所属コンテキストを取得しました。");
  }

  async function runCsvSeed() {
    setIsWorking(true);
    setStatus("CSV seedを実行中...");

    try {
      const user = await getCurrentUser();
      const userSub = user.userId;
      const username = user.username || "MVP2テストユーザー";

      await cleanupLegacyBootstrapData();

      const tenantCount = await seedTenants(userSub, username);
      const classroomCount = await seedClassrooms(userSub, username);
      const userProfileCount = await seedUserProfiles(userSub, username);
      const staffAssignmentCount = await seedStaffAssignments(userSub, username);
      const abilityCodeCount = await seedAbilityCodes(userSub, username);
      const childCount = await seedChildren(userSub, username);
      const childClassroomEnrollmentCount = await seedChildClassroomEnrollments(
        userSub,
        username
      );
      const planPhraseCount = await seedPlanPhrases(userSub, username);
      const planPhraseAbilityLinkCount = await seedPlanPhraseAbilityLinks(
        userSub,
        username
      );
      const abilityObservationHintCount = await seedAbilityObservationHints(
        userSub,
        username
      );

      setSeedSummary({
        tenantCount,
        classroomCount,
        userProfileCount,
        staffAssignmentCount,
        abilityCodeCount,
        childCount,
        childClassroomEnrollmentCount,
        planPhraseCount,
        planPhraseAbilityLinkCount,
        abilityObservationHintCount,
      });

      await loadContext();

      setStatus(
        [
          "CSV seedを実行しました。",
          `Tenant=${tenantCount}`,
          `Classroom=${classroomCount}`,
          `UserProfile=${userProfileCount}`,
          `StaffAssignment=${staffAssignmentCount}`,
          `AbilityCode=${abilityCodeCount}`,
          `Child=${childCount}`,
          `ChildClassroomEnrollment=${childClassroomEnrollmentCount}`,
          `PlanPhrase=${planPhraseCount}`,
          `PlanPhraseAbilityLink=${planPhraseAbilityLinkCount}`,
          `AbilityObservationHint=${abilityObservationHintCount}`,
        ].join(" ")
      );

    } catch (error) {
      console.error(error);
      setStatus(`CSV seedでエラーが発生しました: ${String(error)}`);
    } finally {
      setIsWorking(false);
    }
  }

  useEffect(() => {
    loadContext().catch((error) => {
      console.error(error);
      setStatus(`所属コンテキスト取得でエラーが発生しました: ${String(error)}`);
    });
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Hoiku360 MVP2</p>
          <h1>Phase 0：園・ユーザー・担当コンテキスト確認</h1>
          <p className="lead">
            CSV seedから Tenant / Classroom / UserProfile / StaffAssignment を作成し、
            ログインユーザーの tenant / role / classroom scope を確認します。
          </p>
        </div>

        <button className="secondary-button" onClick={signOut}>
          サインアウト
        </button>
      </section>

      <section className="panel">
        <h2>現在の状態</h2>
        <p>{status}</p>

        <div className="context-box">
          <strong>Context</strong>
          <div>{contextLabel}</div>
        </div>

        <div className="button-row">
          <button onClick={() => loadContext()} disabled={isWorking}>
            再読み込み
          </button>
          <button onClick={() => runCsvSeed()} disabled={isWorking}>
            CSV seedを実行
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>画面</h2>
        <div className="button-row">
          <button
            type="button"
            onClick={() => setTab("home")}
            disabled={tab === "home"}
          >
            ホーム
          </button>

          <button
            type="button"
            onClick={() => setTab("doWorkspace")}
            disabled={!context?.tenantId || tab === "doWorkspace"}
          >
            今日の日案 / 日報
          </button>

          <button
            type="button"
            onClick={() => setTab("checkWorkspace")}
            disabled={!context?.tenantId || tab === "checkWorkspace"}
          >
            クラス報告 / Check
          </button>

          <button
            type="button"
            onClick={() => setTab("childWeekly")}
            disabled={!context?.tenantId || tab === "childWeekly"}
          >
            子ども週次記録 / Check
          </button>


          <button
            type="button"
            onClick={() => setTab("childProgress")}
            disabled={!context?.tenantId || tab === "childProgress"}
          >
            保育経過記録支援 / Check
          </button>

          <button
            type="button"
            onClick={() => setTab("planWorkspace")}
            disabled={!context?.tenantId || tab === "planWorkspace"}
          >
            Plan Workspace
          </button>

          <button
            type="button"
            onClick={() => setTab("practiceRegister")}
            disabled={!context?.tenantId || tab === "practiceRegister"}
          >
            Practice登録
          </button>

          <button
            type="button"
            onClick={() => setTab("practiceSearch")}
            disabled={!context?.tenantId || tab === "practiceSearch"}
          >
            Practice検索 / 一覧
          </button>
        </div>

        {!context?.tenantId && (
          <p className="muted">
            Plan / Practice機能を使うには、先にCSV seedを実行して UserProfile / tenantId を作成してください。
          </p>
        )}
      </section>

      {tab === "doWorkspace" && context?.tenantId && (
        <section className="panel">
          <DoWorkspacePanel
            owner={practiceOwner}
            ownerName={context.displayName}
            ownerRole={context.role}
            tenantId={practiceTenantId}
            tenantName={context.tenantName}
            fiscalYear={CURRENT_FISCAL_YEAR}
            currentClassroomId={currentClassroomId}
            allowedClassroomIds={context.classroomIds}
            isSchoolScope={isSchoolScope}
          />
        </section>
      )}

      {tab === "checkWorkspace" && context?.tenantId && (
        <section className="panel">
          <CheckWorkspacePanel
            tenantId={practiceTenantId}
            tenantName={context.tenantName}
            fiscalYear={CURRENT_FISCAL_YEAR}
            currentClassroomId={currentClassroomId}
            allowedClassroomIds={context.classroomIds}
            isSchoolScope={isSchoolScope}
          />
        </section>
      )}

      {tab === "childWeekly" && context?.tenantId && (
        <section className="panel">
          <ChildWeeklyWorkspacePanel
            owner={practiceOwner}
            ownerName={context.displayName}
            ownerRole={context.role}
            tenantId={practiceTenantId}
            tenantName={context.tenantName}
            fiscalYear={CURRENT_FISCAL_YEAR}
            currentClassroomId={currentClassroomId}
            allowedClassroomIds={context.classroomIds}
            isSchoolScope={isSchoolScope}
          />
        </section>
      )}

      {tab === "childProgress" && context?.tenantId && (
        <section className="panel">
          <ChildProgressRecordPanel
            owner={practiceOwner}
            ownerName={context.displayName}
            ownerRole={context.role}
            tenantId={practiceTenantId}
            tenantName={context.tenantName}
            fiscalYear={CURRENT_FISCAL_YEAR}
            currentClassroomId={currentClassroomId}
            allowedClassroomIds={context.classroomIds}
            isSchoolScope={isSchoolScope}
          />
        </section>
      )}

      {tab === "planWorkspace" && context?.tenantId && (
        <section className="panel">
          <PlanWorkspacePanel
            owner={practiceOwner}
            tenantId={practiceTenantId}
            tenantName={context.tenantName}
            fiscalYear={CURRENT_FISCAL_YEAR}
            currentClassroomId={currentClassroomId}
            allowedClassroomIds={context.classroomIds}
            isSchoolScope={isSchoolScope}
          />
        </section>
      )}

      {tab === "practiceRegister" && context?.tenantId && (
        <section className="panel">
          <PracticeRegisterPanel
            owner={practiceOwner}
            tenantId={practiceTenantId}
          />
        </section>
      )}

      {tab === "practiceSearch" && context?.tenantId && (
        <section className="panel">
          <PracticeSearchPanel
            owner={practiceOwner}
            tenantId={practiceTenantId}
            currentClassroomId={currentClassroomId}
            allowedClassroomIds={context.classroomIds}
            isSchoolScope={isSchoolScope}
          />
        </section>
      )}

      {seedSummary && (
        <section className="panel">
          <h2>直近のCSV seed結果</h2>
          <dl className="detail-grid">
            <dt>Tenant</dt>
            <dd>{seedSummary.tenantCount}</dd>

            <dt>Classroom</dt>
            <dd>{seedSummary.classroomCount}</dd>

            <dt>UserProfile</dt>
            <dd>{seedSummary.userProfileCount}</dd>

            <dt>StaffAssignment</dt>
            <dd>{seedSummary.staffAssignmentCount}</dd>

            <dt>AbilityCode</dt>
            <dd>{seedSummary.abilityCodeCount}</dd>

            <dt>Child</dt>
            <dd>{seedSummary.childCount}</dd>

            <dt>ChildClassroomEnrollment</dt>
            <dd>{seedSummary.childClassroomEnrollmentCount}</dd>

            <dt>PlanPhrase</dt>
            <dd>{seedSummary.planPhraseCount}</dd>

            <dt>PlanPhraseAbilityLink</dt>
            <dd>{seedSummary.planPhraseAbilityLinkCount}</dd>

            <dt>AbilityObservationHint</dt>
            <dd>{seedSummary.abilityObservationHintCount}</dd>
          </dl>
        </section>
      )}

      {classroomChildren.length > 0 && (
        <section className="panel">
          <h2>子ども一覧</h2>
          <p className="muted">
            ログイン中ユーザーの tenant / classroom scope に基づいて表示しています。
          </p>

          <div className="classroom-child-list">
            {classroomChildren.map((classroom) => (
              <div className="classroom-child-card" key={classroom.classroomId}>
                <h3>{classroom.classroomName}</h3>

                {classroom.children.length > 0 ? (
                  <ul>
                    {classroom.children.map((child) => (
                      <li key={child.id}>
                        <strong>{child.displayName}</strong>
                        {child.kana ? <span>（{child.kana}）</span> : null}
                        <small>{child.id}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">このクラスの子どもは未登録です。</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {context && (
        <section className="panel">
          <h2>詳細</h2>
          <dl className="detail-grid">
            <dt>userSub</dt>
            <dd>{context.userSub}</dd>

            <dt>username</dt>
            <dd>{context.username}</dd>

            <dt>displayName</dt>
            <dd>{context.displayName ?? "-"}</dd>

            <dt>tenantId</dt>
            <dd>{context.tenantId ?? "-"}</dd>

            <dt>tenantName</dt>
            <dd>{context.tenantName ?? "-"}</dd>

            <dt>role</dt>
            <dd>{context.role ?? "-"}</dd>

            <dt>classroom scope</dt>
            <dd>
              {context.classroomNames.length > 0
                ? context.classroomNames.join(", ")
                : "園全体"}
            </dd>
          </dl>
        </section>
      )}
    </main>
  );
}

export default function App() {
  return (
    <Authenticator>
      {({ signOut }) => <SignedInHome signOut={signOut} />}
    </Authenticator>
  );
}