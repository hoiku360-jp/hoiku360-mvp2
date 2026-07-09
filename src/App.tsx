import { useEffect, useMemo, useState } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "./App.css";

const rawClient = generateClient<Schema>();

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

const DEMO_TENANT_ID = "vehicle-nursery";
const DEMO_CLASSROOM_SAKURA_ID = "sakura-2026";
const DEMO_CLASSROOM_SUMIRE_ID = "sumire-2026";

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
      `classrooms=${context.classroomNames.length > 0 ? context.classroomNames.join(", ") : "園全体"}`,
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
      setStatus("UserProfile が未作成です。下のボタンで初期データを作成してください。");
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

  async function bootstrapCurrentUser() {
    setIsWorking(true);
    setStatus("初期データを作成中...");

    try {
      const user = await getCurrentUser();
      const userSub = user.userId;

      const nowDisplayName = user.username || "MVP2テストユーザー";

      const existingTenant = await client.models.Tenant.get({ id: DEMO_TENANT_ID });
      if (!existingTenant.data) {
        await client.models.Tenant.create({
          id: DEMO_TENANT_ID,
          name: "vehicle-nursery",
          displayName: "ビークル保育園",
          status: "ACTIVE",
        });
      }

      const existingSakura = await client.models.Classroom.get({
        id: DEMO_CLASSROOM_SAKURA_ID,
      });
      if (!existingSakura.data) {
        await client.models.Classroom.create({
          id: DEMO_CLASSROOM_SAKURA_ID,
          tenantId: DEMO_TENANT_ID,
          name: "さくら組",
          ageLabel: "3歳児",
          fiscalYear: 2026,
          status: "ACTIVE",
        });
      }

      const existingSumire = await client.models.Classroom.get({
        id: DEMO_CLASSROOM_SUMIRE_ID,
      });
      if (!existingSumire.data) {
        await client.models.Classroom.create({
          id: DEMO_CLASSROOM_SUMIRE_ID,
          tenantId: DEMO_TENANT_ID,
          name: "すみれ組",
          ageLabel: "4歳児",
          fiscalYear: 2026,
          status: "ACTIVE",
        });
      }

      const existingProfile = await client.models.UserProfile.get({ id: userSub });
      if (!existingProfile.data) {
        await client.models.UserProfile.create({
          id: userSub,
          userId: userSub,
          tenantId: DEMO_TENANT_ID,
          displayName: nowDisplayName,
          role: "DIRECTOR",
          status: "ACTIVE",
        });
      }

      const assignmentId = `${userSub}-director-2026`;
      const existingAssignment = await client.models.StaffAssignment.get({
        id: assignmentId,
      });
      if (!existingAssignment.data) {
        await client.models.StaffAssignment.create({
          id: assignmentId,
          tenantId: DEMO_TENANT_ID,
          userId: userSub,
          classroomId: undefined,
          role: "DIRECTOR",
          fiscalYear: 2026,
          status: "ACTIVE",
        });
      }

      setStatus("初期データを作成しました。所属コンテキストを再取得します。");
      await loadContext();
    } catch (error) {
      console.error(error);
      setStatus(`初期データ作成でエラーが発生しました: ${String(error)}`);
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
            まずはログインユーザーの tenant / role / classroom scope を取得できることを確認します。
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
          <button onClick={() => bootstrapCurrentUser()} disabled={isWorking}>
            初期データを作成
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