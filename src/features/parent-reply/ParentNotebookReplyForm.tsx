import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";

type ModelError = {
  message?: string | null;
};

type OperationEnvelope<TData> = {
  data?: TData | null;
  errors?: ModelError[] | null;
};

type OperationRunner<TArgs, TData> = (
  args: TArgs | { input: TArgs },
) => Promise<OperationEnvelope<TData> | TData>;

type GetParentNotebookContextArgs = {
  replyToken: string;
};

type GetParentNotebookContextResult = {
  parentNotebookSheetId?: string | null;
  parentNotebookEntryId?: string | null;
  classroomId?: string | null;
  childId?: string | null;
  childName?: string | null;
  targetDate?: string | null;
  noticeText?: string | null;

  responseStatus?: string | null;
  attendancePlanType?: string | null;
  plannedArrivalTime?: string | null;
  plannedDepartureTime?: string | null;
  plannedPickupRelation?: string | null;
  plannedPickupName?: string | null;
  plannedPickupTime?: string | null;
  homeNote?: string | null;
  parentMessage?: string | null;
  submittedAt?: string | null;
  responseRevision?: number | null;

  status?: string | null;
  message?: string | null;
};

type SubmitParentNotebookReplyArgs = {
  replyToken: string;
  okSigned: boolean;
  attendancePlanType: string;
  plannedArrivalTime?: string;
  plannedDepartureTime?: string;
  plannedPickupRelation?: string;
  plannedPickupName?: string;
  plannedPickupTime?: string;
  homeNote?: string;
  parentMessage?: string;
  userAgent?: string;
};

type SubmitParentNotebookReplyResult = {
  parentNotebookEntryId?: string | null;
  responseStatus?: string | null;
  responseRevision?: number | null;
  submittedAt?: string | null;
  status?: string | null;
  message?: string | null;
};

type ParentNotebookPublicClient = {
  mutations?: {
    getParentNotebookContext?: OperationRunner<
      GetParentNotebookContextArgs,
      GetParentNotebookContextResult
    >;
    submitParentNotebookReply?: OperationRunner<
      SubmitParentNotebookReplyArgs,
      SubmitParentNotebookReplyResult
    >;
  };
};

type AttendancePlanType =
  | "NORMAL"
  | "ABSENT"
  | "LATE"
  | "EARLY_DEPARTURE"
  | "OTHER";

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function formatErrors(
  errors?: ModelError[] | null,
  fallback = "処理に失敗しました。",
): string {
  const messages = (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean);
  return messages.length > 0 ? messages.join("\n") : fallback;
}

function getOperationErrors<TData>(
  response: OperationEnvelope<TData> | TData,
): ModelError[] | null {
  if (!response || typeof response !== "object" || !("errors" in response)) {
    return null;
  }
  return (response as OperationEnvelope<TData>).errors ?? null;
}

function getOperationData<TData>(
  response: OperationEnvelope<TData> | TData,
): TData {
  if (!response || typeof response !== "object" || !("data" in response)) {
    return response as TData;
  }
  return ((response as OperationEnvelope<TData>).data ?? response) as TData;
}

async function runOperation<TArgs, TData>(
  runner: OperationRunner<TArgs, TData>,
  args: TArgs,
): Promise<TData> {
  let response: OperationEnvelope<TData> | TData;

  try {
    response = await runner(args);
  } catch {
    response = await runner({ input: args });
  }

  const errors = getOperationErrors(response);
  if (errors?.length) {
    throw new Error(formatErrors(errors));
  }

  return getOperationData(response);
}

function getReplyTokenFromUrl(): string {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  return s(params.get("token"));
}

function formatTargetDate(value?: string | null): string {
  const text = s(value);
  return text ? text.replace(/-/g, "/") : "-";
}

function formatDateTime(value?: string | null): string {
  const text = s(value);
  if (!text) return "-";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("ja-JP");
}

function isValidHHMM(value: string): boolean {
  if (!value) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function attendancePlanLabel(value: AttendancePlanType): string {
  switch (value) {
    case "NORMAL":
      return "通常どおり登園";
    case "ABSENT":
      return "欠席";
    case "LATE":
      return "遅れて登園";
    case "EARLY_DEPARTURE":
      return "早退";
    case "OTHER":
      return "その他・未定";
  }
}

export default function ParentNotebookReplyForm() {
  const client = useMemo(
    () =>
      generateClient<Schema>({
        authMode: "apiKey",
      }) as unknown as ParentNotebookPublicClient,
    [],
  );

  const replyToken = useMemo(getReplyTokenFromUrl, []);

  const [context, setContext] =
    useState<GetParentNotebookContextResult | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState("");

  const [attendancePlanType, setAttendancePlanType] =
    useState<AttendancePlanType>("NORMAL");
  const [plannedArrivalTime, setPlannedArrivalTime] = useState("");
  const [plannedDepartureTime, setPlannedDepartureTime] = useState("");
  const [plannedPickupRelation, setPlannedPickupRelation] = useState("母");
  const [plannedPickupName, setPlannedPickupName] = useState("");
  const [plannedPickupTime, setPlannedPickupTime] = useState("");
  const [homeNote, setHomeNote] = useState("");
  const [parentMessage, setParentMessage] = useState("");
  const [okSigned, setOkSigned] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitSucceeded, setSubmitSucceeded] = useState(false);

  const closed = s(context?.status).toUpperCase() === "CLOSED";
  const responseRevision = Number(context?.responseRevision ?? 0);
  const alreadySubmitted = ["SUBMITTED", "CONFIRMED"].includes(
    s(context?.responseStatus).toUpperCase(),
  );

  function applyContext(data: GetParentNotebookContextResult) {
    setContext(data);
    setAttendancePlanType(
      (s(data.attendancePlanType).toUpperCase() as AttendancePlanType) ||
        "NORMAL",
    );
    setPlannedArrivalTime(s(data.plannedArrivalTime));
    setPlannedDepartureTime(s(data.plannedDepartureTime));
    setPlannedPickupRelation(s(data.plannedPickupRelation) || "母");
    setPlannedPickupName(s(data.plannedPickupName));
    setPlannedPickupTime(s(data.plannedPickupTime));
    setHomeNote(s(data.homeNote));
    setParentMessage(s(data.parentMessage));
  }

  async function loadContext() {
    const runner = client.mutations?.getParentNotebookContext;

    if (!replyToken) {
      setContextError(
        "連絡帳URLが正しくありません。園から受け取ったURLを確認してください。",
      );
      return;
    }

    if (!runner) {
      setContextError(
        "getParentNotebookContextが見つかりません。園へご連絡ください。",
      );
      return;
    }

    setLoadingContext(true);
    setContextError("");

    try {
      const data = await runOperation<
        GetParentNotebookContextArgs,
        GetParentNotebookContextResult
      >(runner, { replyToken });
      applyContext(data);
    } catch (error) {
      console.error(error);
      setContext(null);
      setContextError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLoadingContext(false);
    }
  }

  useEffect(() => {
    void loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyToken]);

  function handleAttendancePlanChange(next: AttendancePlanType) {
    setAttendancePlanType(next);

    if (next === "ABSENT") {
      setPlannedArrivalTime("");
      setPlannedDepartureTime("");
      setPlannedPickupRelation("母");
      setPlannedPickupName("");
      setPlannedPickupTime("");
    }
  }

  function validateForm(): string | null {
    if (!okSigned) {
      return "園からの連絡内容を確認したチェックが必要です。";
    }

    for (const [label, value] of [
      ["登園予定時刻", plannedArrivalTime],
      ["降園予定時刻", plannedDepartureTime],
      ["お迎え予定時刻", plannedPickupTime],
    ] as const) {
      if (!isValidHHMM(value)) {
        return `${label}を確認してください。`;
      }
    }

    if (attendancePlanType === "LATE" && !plannedArrivalTime) {
      return "遅れて登園する場合は、登園予定時刻を入力してください。";
    }

    if (
      attendancePlanType === "EARLY_DEPARTURE" &&
      !plannedDepartureTime &&
      !plannedPickupTime
    ) {
      return "早退の場合は、降園予定時刻またはお迎え予定時刻を入力してください。";
    }

    return null;
  }

  async function submitReply() {
    const runner = client.mutations?.submitParentNotebookReply;

    if (!runner) {
      setSubmitMessage(
        "submitParentNotebookReplyが見つかりません。園へご連絡ください。",
      );
      return;
    }

    if (closed) {
      setSubmitMessage("この連絡帳は回答受付を終了しています。");
      return;
    }

    const validationMessage = validateForm();
    if (validationMessage) {
      setSubmitMessage(validationMessage);
      setSubmitSucceeded(false);
      return;
    }

    setSubmitting(true);
    setSubmitMessage("");
    setSubmitSucceeded(false);

    try {
      const absent = attendancePlanType === "ABSENT";
      const data = await runOperation<
        SubmitParentNotebookReplyArgs,
        SubmitParentNotebookReplyResult
      >(runner, {
        replyToken,
        okSigned: true,
        attendancePlanType,
        plannedArrivalTime: absent ? undefined : plannedArrivalTime || undefined,
        plannedDepartureTime: absent
          ? undefined
          : plannedDepartureTime || undefined,
        plannedPickupRelation: absent
          ? undefined
          : plannedPickupRelation || undefined,
        plannedPickupName: absent ? undefined : plannedPickupName || undefined,
        plannedPickupTime: absent ? undefined : plannedPickupTime || undefined,
        homeNote: homeNote.trim() || undefined,
        parentMessage: parentMessage.trim() || undefined,
        userAgent:
          typeof navigator === "undefined" ? undefined : navigator.userAgent,
      });

      setSubmitSucceeded(true);
      setSubmitMessage(data.message || "連絡帳の回答を送信しました。");
      setOkSigned(false);

      setContext((previous) => ({
        ...(previous ?? {}),
        responseStatus: data.responseStatus || "SUBMITTED",
        responseRevision:
          data.responseRevision ?? (previous?.responseRevision ?? 0) + 1,
        submittedAt: data.submittedAt || new Date().toISOString(),
        attendancePlanType,
        plannedArrivalTime: absent ? null : plannedArrivalTime || null,
        plannedDepartureTime: absent ? null : plannedDepartureTime || null,
        plannedPickupRelation: absent ? null : plannedPickupRelation || null,
        plannedPickupName: absent ? null : plannedPickupName || null,
        plannedPickupTime: absent ? null : plannedPickupTime || null,
        homeNote: homeNote.trim() || null,
        parentMessage: parentMessage.trim() || null,
      }));
    } catch (error) {
      console.error(error);
      setSubmitMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  const inputDisabled = submitting || loadingContext || closed;
  const absent = attendancePlanType === "ABSENT";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <section
          style={{
            padding: 20,
            background: "#fff",
            border: "1px solid #d0d7de",
            borderRadius: 12,
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: "#475569", fontSize: 13 }}>保育360</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 24 }}>保護者連絡帳</h1>
            <div style={{ marginTop: 6, color: "#555", fontSize: 14 }}>
              園からの連絡をご確認のうえ、登園・お迎え予定とご家庭での様子を入力してください。
            </div>
          </div>

          {loadingContext ? (
            <div
              style={{
                padding: 12,
                border: "1px solid #dbeafe",
                background: "#f6fbff",
                borderRadius: 8,
              }}
            >
              連絡帳を読み込んでいます...
            </div>
          ) : null}

          {contextError ? (
            <div
              style={{
                padding: 12,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                borderRadius: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              {contextError}
            </div>
          ) : null}

          {context ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
                padding: 12,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ color: "#64748b", fontSize: 12 }}>お子さま</div>
                <div style={{ fontWeight: 800 }}>{context.childName || "-"}さん</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 12 }}>対象日</div>
                <div style={{ fontWeight: 800 }}>
                  {formatTargetDate(context.targetDate)}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 12 }}>回答状態</div>
                <div style={{ fontWeight: 800 }}>
                  {alreadySubmitted
                    ? `回答済み（${responseRevision}回）`
                    : "未回答"}
                </div>
                {context.submittedAt ? (
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {formatDateTime(context.submittedAt)}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {context ? (
          <>
            <section
              style={{
                padding: 20,
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 12,
                display: "grid",
                gap: 10,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18 }}>園からの連絡</h2>
              <div
                style={{
                  padding: 14,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.75,
                  border: "1px solid #e2e8f0",
                  background: "#fffdf5",
                  borderRadius: 8,
                }}
              >
                {context.noticeText || "園からの連絡はありません。"}
              </div>
            </section>

            {closed ? (
              <div
                style={{
                  padding: 14,
                  border: "1px solid #fed7aa",
                  background: "#fff7ed",
                  color: "#9a3412",
                  borderRadius: 10,
                }}
              >
                この連絡帳は回答受付を終了しています。現在の回答内容は閲覧できますが、更新できません。
              </div>
            ) : null}

            {submitMessage ? (
              <div
                style={{
                  padding: 14,
                  border: submitSucceeded
                    ? "1px solid #bbf7d0"
                    : "1px solid #fecaca",
                  background: submitSucceeded ? "#f0fdf4" : "#fff1f2",
                  color: submitSucceeded ? "#166534" : "#991b1b",
                  borderRadius: 10,
                  whiteSpace: "pre-wrap",
                }}
              >
                {submitMessage}
              </div>
            ) : null}

            <section
              style={{
                padding: 20,
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 12,
                display: "grid",
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>登園予定</h2>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
                  当日の予定に最も近いものを選択してください。
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 8,
                }}
              >
                {(
                  [
                    "NORMAL",
                    "ABSENT",
                    "LATE",
                    "EARLY_DEPARTURE",
                    "OTHER",
                  ] as AttendancePlanType[]
                ).map((value) => (
                  <label
                    key={value}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: 10,
                      border:
                        attendancePlanType === value
                          ? "2px solid #2563eb"
                          : "1px solid #cbd5e1",
                      borderRadius: 8,
                      background:
                        attendancePlanType === value ? "#eff6ff" : "#fff",
                    }}
                  >
                    <input
                      type="radio"
                      name="attendancePlanType"
                      checked={attendancePlanType === value}
                      onChange={() => handleAttendancePlanChange(value)}
                      disabled={inputDisabled}
                    />
                    <span>{attendancePlanLabel(value)}</span>
                  </label>
                ))}
              </div>

              {!absent ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>登園予定時刻</span>
                    <input
                      type="time"
                      value={plannedArrivalTime}
                      onChange={(event) =>
                        setPlannedArrivalTime(event.target.value)
                      }
                      disabled={inputDisabled}
                    />
                    <small style={{ color: "#64748b" }}>
                      遅れて登園する場合は入力してください。
                    </small>
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>降園予定時刻</span>
                    <input
                      type="time"
                      value={plannedDepartureTime}
                      onChange={(event) =>
                        setPlannedDepartureTime(event.target.value)
                      }
                      disabled={inputDisabled}
                    />
                    <small style={{ color: "#64748b" }}>
                      早退する場合などに入力してください。
                    </small>
                  </label>
                </div>
              ) : null}
            </section>

            {!absent ? (
              <section
                style={{
                  padding: 20,
                  background: "#fff",
                  border: "1px solid #d0d7de",
                  borderRadius: 12,
                  display: "grid",
                  gap: 14,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>お迎え予定</h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>続柄</span>
                    <select
                      value={plannedPickupRelation}
                      onChange={(event) =>
                        setPlannedPickupRelation(event.target.value)
                      }
                      disabled={inputDisabled}
                    >
                      <option value="母">母</option>
                      <option value="父">父</option>
                      <option value="祖母">祖母</option>
                      <option value="祖父">祖父</option>
                      <option value="その他">その他</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>お迎え予定者名</span>
                    <input
                      value={plannedPickupName}
                      onChange={(event) =>
                        setPlannedPickupName(event.target.value)
                      }
                      placeholder="例：山田 花子"
                      disabled={inputDisabled}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>お迎え予定時刻</span>
                    <input
                      type="time"
                      value={plannedPickupTime}
                      onChange={(event) =>
                        setPlannedPickupTime(event.target.value)
                      }
                      disabled={inputDisabled}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section
              style={{
                padding: 20,
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 12,
                display: "grid",
                gap: 14,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700 }}>家庭での子どもの様子</span>
                <textarea
                  value={homeNote}
                  onChange={(event) => setHomeNote(event.target.value)}
                  placeholder="例：昨夜はよく眠れており、今朝も元気です。"
                  disabled={inputDisabled}
                  style={{ minHeight: 110, resize: "vertical" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 700 }}>園への連絡事項</span>
                <textarea
                  value={parentMessage}
                  onChange={(event) => setParentMessage(event.target.value)}
                  placeholder="例：薬を持参しています。詳細は登園時にお伝えします。"
                  disabled={inputDisabled}
                  style={{ minHeight: 100, resize: "vertical" }}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  padding: 12,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  borderRadius: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={okSigned}
                  onChange={(event) => setOkSigned(event.target.checked)}
                  disabled={inputDisabled}
                  style={{ marginTop: 3 }}
                />
                <span>園からの連絡内容と、入力した回答内容を確認しました。</span>
              </label>

              <button
                type="button"
                onClick={submitReply}
                disabled={inputDisabled || !okSigned}
                style={{
                  justifySelf: "start",
                  padding: "11px 18px",
                  borderRadius: 8,
                  border: "1px solid #1d4ed8",
                  background: submitting ? "#bfdbfe" : "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: inputDisabled ? "default" : "pointer",
                }}
              >
                {submitting
                  ? "送信中..."
                  : alreadySubmitted
                    ? "回答を更新して送信"
                    : "回答を送信"}
              </button>

              {alreadySubmitted && !closed ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  回答内容を修正した場合は、確認欄へ再度チェックして「回答を更新して送信」を押してください。
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
