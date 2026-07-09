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
import "./App.css";

const rawClient = generateClient<Schema>({
  authMode: "userPool",
});

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

const client = rawClient as unknown as {
  models: {
    Tenant: ModelApi<TenantRecord, TenantCreateInput>;
    Classroom: ModelApi<ClassroomRecord, ClassroomCreateInput>;
    UserProfile: ModelApi<UserProfileRecord, UserProfileCreateInput>;
    StaffAssignment: ModelApi<StaffAssignmentRecord, StaffAssignmentCreateInput>;
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

type SeedRow = Record<string, string>;

function parseCsv(text: string): SeedRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",");
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

function SignedInHome({ signOut }: { signOut?: () => void }) {
  const [status, setStatus] = useState<string>("読み込み中...");
  const [context, setContext] = useState<AppUserContext | null>(null);
  const [isWorking, setIsWorking] = useState(false);

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

    setStatus("所属コンテキストを取得しました。");
  }

  async function runCsvSeed() {
    setIsWorking(true);
    setStatus("CSV seedを実行中...");

    try {
      const user = await getCurrentUser();
      const userSub = user.userId;
      const username = user.username || "MVP2テストユーザー";

      const tenantCount = await seedTenants(userSub, username);
      const classroomCount = await seedClassrooms(userSub, username);
      const userProfileCount = await seedUserProfiles(userSub, username);
      const staffAssignmentCount = await seedStaffAssignments(userSub, username);

      setStatus(
        [
          "CSV seedを実行しました。",
          `Tenant=${tenantCount}`,
          `Classroom=${classroomCount}`,
          `UserProfile=${userProfileCount}`,
          `StaffAssignment=${staffAssignmentCount}`,
        ].join(" ")
      );

      await loadContext();
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