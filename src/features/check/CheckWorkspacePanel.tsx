import { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import {
  aggregateObservationReport,
  practiceRoleLabelForReport,
} from "./observationAggregation";
import { aggregatePlanReport } from "./planAggregation";
import {
  buildMonthlyTrendSummaries,
  compareDomains,
  comparePlanActual,
} from "./planActualComparison";
import {
  loadObservationReportData,
  loadReportClassrooms,
  type ObservationReportClient,
} from "./loadObservationReportData";
import {
  anchorForFiscalTerm,
  buildReportProgress,
  createReportContext,
  fiscalTermForDate,
  formatDateLabel,
  formatPeriodLabel,
  shiftReportAnchor,
  todayJstDateOnly,
} from "./reportPeriod";
import type {
  ClassroomRow,
  MonthlyTrendSummary,
  ObservationReportSourceData,
  ObservationReportSummary,
  PlanActualComparisonRow,
  PlanActualComparisonSummary,
  PlanAnchorSummary,
  PlanReportSummary,
  ReportPeriodType,
} from "./types";

type Props = {
  tenantId: string;
  tenantName?: string | null;
  fiscalYear: number;
  currentClassroomId?: string | null;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
};

const DOMAIN_LABELS = ["健康", "人間関係", "環境", "言葉", "表現"];

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function reportPeriodLabel(value: ReportPeriodType): string {
  if (value === "MONTH") return "月報";
  if (value === "TERM") return "期報";
  if (value === "YEAR") return "年報";
  return "週報";
}

function childObservationLabel(count: number): string {
  if (count === 0) return "未観察";
  if (count === 1) return "観察少なめ";
  return "観察あり";
}

function childObservationClass(count: number): string {
  if (count === 0) return "check-status-missing";
  if (count === 1) return "check-status-low";
  return "check-status-ok";
}

function planStatusLabel(value: unknown): string {
  const status = s(value).toUpperCase();
  if (status === "APPROVED") return "承認済み";
  if (status === "SUBMITTED") return "承認依頼中";
  if (status === "REJECTED") return "差し戻し";
  if (status === "DRAFT") return "下書き";
  if (status === "NOT_CREATED") return "未作成";
  return status || "未作成";
}

function planKindLabel(value: unknown): string {
  const kind = s(value).toUpperCase();
  if (kind === "ANNUAL") return "年間アンカー";
  if (kind === "TERM") return "期アンカー";
  if (kind === "MONTHLY") return "月間アンカー";
  return kind || "計画アンカー";
}

function comparisonStatusLabel(row: PlanActualComparisonRow): string {
  if (row.status === "UNDER") return "不足傾向";
  if (row.status === "OVER") return "実績多め";
  if (row.status === "NO_PLAN") return "計画値なし";
  return "概ね均衡";
}

function comparisonStatusClass(row: PlanActualComparisonRow): string {
  if (row.status === "UNDER") return "check-comparison-under";
  if (row.status === "OVER") return "check-comparison-over";
  if (row.status === "NO_PLAN") return "check-comparison-no-plan";
  return "check-comparison-balanced";
}

function shareLabel(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function gapLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}pt`;
}

function barWidth(value: number): string {
  return `${Math.max(0, Math.min(100, value * 100))}%`;
}

function countBarWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function defaultAnchorDate(fiscalYear: number): string {
  const today = todayJstDateOnly();
  const start = `${fiscalYear}-04-01`;
  const end = `${fiscalYear + 1}-03-31`;
  return today >= start && today <= end ? today : start;
}

function renderAnchor(anchor: PlanAnchorSummary) {
  return (
    <article className="check-anchor-card" key={anchor.planId}>
      <div className="check-anchor-head">
        <div>
          <strong>{planKindLabel(anchor.planKind)}</strong>
          <h4>{anchor.title}</h4>
          <small>{anchor.periodStart}〜{anchor.periodEnd}</small>
        </div>
        <span className={`check-plan-status check-plan-status-${anchor.status.toLowerCase()}`}>
          {planStatusLabel(anchor.status)}
        </span>
      </div>

      {anchor.phrases.length > 0 ? (
        <div className="check-anchor-phrase-list">
          {anchor.phrases.map((phrase, index) => (
            <div key={`${anchor.planId}-${phrase.planPhraseId}-${index}`}>
              {phrase.phraseType ? <strong>{phrase.phraseType}</strong> : null}
              <span>{phrase.phraseText}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">表示できるアンカー文例がありません。</p>
      )}

      {anchor.memo ? <p className="check-anchor-memo">メモ：{anchor.memo}</p> : null}
    </article>
  );
}

function renderComparisonRows(
  comparison: PlanActualComparisonSummary,
  emptyText: string,
) {
  if (comparison.planTotal === 0 && comparison.actualTotal === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="check-comparison-list">
      {comparison.rows.map((row) => (
        <div
          className={`check-comparison-row ${comparisonStatusClass(row)}`}
          key={row.key}
        >
          <div className="check-comparison-label">
            <strong>{row.label}</strong>
            <span>{comparisonStatusLabel(row)} / 偏差 {gapLabel(row.gapPoints)}</span>
          </div>

          <div className="check-comparison-bars">
            <div>
              <small>計画</small>
              <span className="check-comparison-track">
                <i className="check-comparison-plan-bar" style={{ width: barWidth(row.planShare) }} />
              </span>
              <b>{shareLabel(row.planShare)}</b>
            </div>
            <div>
              <small>実績</small>
              <span className="check-comparison-track">
                <i className="check-comparison-actual-bar" style={{ width: barWidth(row.actualShare) }} />
              </span>
              <b>{shareLabel(row.actualShare)}</b>
            </div>
          </div>

          <div className="check-comparison-values">
            <span>計画スコア {row.planScore}</span>
            <span>実績 {row.actualCount}件</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderMonthlyTrendTable(trends: MonthlyTrendSummary[]) {
  if (trends.length === 0) return null;

  return (
    <div className="check-table-wrap">
      <table className="check-table check-trend-table">
        <thead>
          <tr>
            <th>月</th>
            <th>計画</th>
            <th>Observation</th>
            {DOMAIN_LABELS.map((domain) => <th key={domain}>{domain}</th>)}
          </tr>
        </thead>
        <tbody>
          {trends.map((trend) => {
            const rowByKey = new Map(
              trend.domainComparison.rows.map((row) => [row.key, row] as const),
            );
            return (
              <tr key={trend.monthKey}>
                <td><strong>{trend.label}</strong></td>
                <td>{trend.planApproved ? "承認済み" : "未承認／未作成"}</td>
                <td>{trend.observationCount}件</td>
                {DOMAIN_LABELS.map((domain) => {
                  const row = rowByKey.get(domain);
                  return (
                    <td
                      className={row ? comparisonStatusClass(row) : ""}
                      key={`${trend.monthKey}-${domain}`}
                    >
                      {row && trend.planApproved ? gapLabel(row.gapPoints) : "-"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CheckWorkspacePanel(props: Props) {
  const {
    tenantId,
    tenantName,
    fiscalYear,
    currentClassroomId,
    allowedClassroomIds,
    isSchoolScope,
  } = props;

  const client = useMemo(() => generateClient<Schema>(), []);
  const reportClient = useMemo<ObservationReportClient>(() => ({
    Classroom: client.models.Classroom as unknown as ObservationReportClient["Classroom"],
    Child: client.models.Child as unknown as ObservationReportClient["Child"],
    ChildClassroomEnrollment: client.models.ChildClassroomEnrollment as unknown as ObservationReportClient["ChildClassroomEnrollment"],
    ObservationRecord: client.models.ObservationRecord as unknown as ObservationReportClient["ObservationRecord"],
    ObservationAbilityLink: client.models.ObservationAbilityLink as unknown as ObservationReportClient["ObservationAbilityLink"],
    AbilityCode: client.models.AbilityCode as unknown as ObservationReportClient["AbilityCode"],
    DailyPracticeRecord: client.models.DailyPracticeRecord as unknown as ObservationReportClient["DailyPracticeRecord"],
    PlanDocument: client.models.PlanDocument as unknown as ObservationReportClient["PlanDocument"],
    PlanPhrase: client.models.PlanPhrase as unknown as ObservationReportClient["PlanPhrase"],
    PlanPhraseAbilityLink: client.models.PlanPhraseAbilityLink as unknown as ObservationReportClient["PlanPhraseAbilityLink"],
  }), [client]);

  const [periodType, setPeriodType] = useState<ReportPeriodType>("WEEK");
  const [anchorDate, setAnchorDate] = useState(() => defaultAnchorDate(fiscalYear));
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [source, setSource] = useState<ObservationReportSourceData | null>(null);
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

  const context = useMemo(() => createReportContext({
    periodType,
    anchorDate,
    tenantId,
    fiscalYear,
    classroomId: selectedClassroomId,
  }), [anchorDate, fiscalYear, periodType, selectedClassroomId, tenantId]);

  const selectedClassroom = useMemo(
    () => classrooms.find((row) => s(row.id) === selectedClassroomId) ?? null,
    [classrooms, selectedClassroomId],
  );

  const summary = useMemo<ObservationReportSummary | null>(
    () => source ? aggregateObservationReport(context, source) : null,
    [context, source],
  );

  const planSummary = useMemo<PlanReportSummary | null>(
    () => source && periodType !== "WEEK"
      ? aggregatePlanReport(context, source)
      : null,
    [context, periodType, source],
  );

  const domainComparison = useMemo(
    () => summary && planSummary
      ? compareDomains(planSummary.domains, summary.domains)
      : null,
    [planSummary, summary],
  );

  const postureComparison = useMemo(
    () => summary && planSummary
      ? comparePlanActual(planSummary.postures, summary.postures)
      : null,
    [planSummary, summary],
  );

  const monthlyTrends = useMemo(
    () => source ? buildMonthlyTrendSummaries(context, source) : [],
    [context, source],
  );

  const progress = useMemo(
    () => buildReportProgress(context),
    [context],
  );

  const classroomSelectionLocked =
    !isSchoolScope && (allowedClassroomIds?.length ?? 0) <= 1;

  const expectedAttention =
    summary?.expectedAbilities.filter((row) => row.status !== "OBSERVED") ?? [];

  const maxWeeklyDomainCount = Math.max(
    0,
    ...(summary?.domains.map((row) => row.observationCount) ?? []),
  );
  const maxWeeklyPostureCount = Math.max(
    0,
    ...(summary?.postures.map((row) => row.observationCount) ?? []),
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingClassrooms(true);
    setError("");

    void loadReportClassrooms({
      client: reportClient,
      tenantId,
      fiscalYear,
      allowedClassroomIds,
      isSchoolScope,
    })
      .then((rows) => {
        if (cancelled) return;
        setClassrooms(rows);
        setSelectedClassroomId((current) => {
          if (current && rows.some((row) => s(row.id) === current)) return current;
          if (currentClassroomId && rows.some((row) => s(row.id) === currentClassroomId)) {
            return currentClassroomId;
          }
          return s(rows[0]?.id);
        });
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error(cause);
        setError(`Check Workspace クラス読み込みエラー: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingClassrooms(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    allowedClassroomIds,
    currentClassroomId,
    fiscalYear,
    isSchoolScope,
    reportClient,
    tenantId,
  ]);

  useEffect(() => {
    if (!selectedClassroomId) {
      setSource(null);
      return;
    }

    let cancelled = false;
    setLoadingReport(true);
    setError("");

    void loadObservationReportData({ client: reportClient, context })
      .then((loaded) => {
        if (!cancelled) setSource(loaded);
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error(cause);
        setSource(null);
        setError(
          `${reportPeriodLabel(periodType)}集計エラー: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingReport(false);
      });

    return () => {
      cancelled = true;
    };
  }, [context, periodType, reportClient, selectedClassroomId]);

  function handleChangePeriod(next: ReportPeriodType) {
    setPeriodType(next);
    if (next === "YEAR") {
      setAnchorDate(`${fiscalYear}-04-01`);
    } else if (next === "TERM") {
      setAnchorDate(anchorForFiscalTerm(
        fiscalYear,
        fiscalTermForDate(defaultAnchorDate(fiscalYear), fiscalYear).termNo,
      ));
    } else {
      setAnchorDate(defaultAnchorDate(fiscalYear));
    }
  }

  function resetToCurrentPeriod() {
    if (periodType === "YEAR") {
      setAnchorDate(`${fiscalYear}-04-01`);
      return;
    }
    setAnchorDate(defaultAnchorDate(fiscalYear));
  }

  const termNo = fiscalTermForDate(anchorDate, fiscalYear).termNo;

  return (
    <div className="check-workspace">
      <header className="check-workspace-header">
        <div>
          <p className="eyebrow">Check / Observation Report</p>
          <h2>クラス{reportPeriodLabel(periodType)}基礎</h2>
          <p className="muted">
            週報は具体的なエピソードを確認し、月・期・年報はPlanアンカーと
            5領域・10の姿の計画／実績偏差を確認します。
          </p>
        </div>
      </header>

      <div className="check-period-tabs">
        {(["WEEK", "MONTH", "TERM", "YEAR"] as ReportPeriodType[]).map((item) => (
          <button
            type="button"
            disabled={periodType === item}
            onClick={() => handleChangePeriod(item)}
            key={item}
          >
            {reportPeriodLabel(item)}
          </button>
        ))}
      </div>

      <div className="check-context-card">
        <div><strong>園</strong><span>{tenantName || tenantId}</span></div>
        <div><strong>集計期間</strong><span>{reportPeriodLabel(periodType)}</span></div>
        <div><strong>集計対象</strong><span>クラス</span></div>
        <div><strong>年度</strong><span>{fiscalYear}年度</span></div>
      </div>

      <section className="check-selector-card">
        {periodType === "WEEK" ? (
          <label>
            <span>対象週に含まれる日</span>
            <input
              type="date"
              value={anchorDate}
              onChange={(event: { target: { value: string } }) => setAnchorDate(event.target.value)}
            />
          </label>
        ) : null}

        {periodType === "MONTH" ? (
          <label>
            <span>対象月</span>
            <input
              type="month"
              value={anchorDate.slice(0, 7)}
              onChange={(event: { target: { value: string } }) => setAnchorDate(`${event.target.value}-01`)}
            />
          </label>
        ) : null}

        {periodType === "TERM" ? (
          <label>
            <span>対象期</span>
            <select
              value={termNo}
              onChange={(event: { target: { value: string } }) =>
                setAnchorDate(anchorForFiscalTerm(fiscalYear, Number(event.target.value)))
              }
            >
              <option value={1}>第1期（4〜6月）</option>
              <option value={2}>第2期（7〜9月）</option>
              <option value={3}>第3期（10〜12月）</option>
              <option value={4}>第4期（1〜3月）</option>
            </select>
          </label>
        ) : null}

        {periodType === "YEAR" ? (
          <div className="check-fixed-period">
            <strong>対象年度</strong>
            <span>{fiscalYear}年度</span>
          </div>
        ) : null}

        <label>
          <span>対象クラス</span>
          <select
            value={selectedClassroomId}
            disabled={classroomSelectionLocked || loadingClassrooms}
            onChange={(event: { target: { value: string } }) => setSelectedClassroomId(event.target.value)}
          >
            {classrooms.map((classroom) => (
              <option value={s(classroom.id)} key={s(classroom.id)}>
                {s(classroom.name)}
                {classroom.ageLabel ? `（${classroom.ageLabel}）` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="check-week-actions">
          {periodType !== "YEAR" ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setAnchorDate((current) => shiftReportAnchor(current, periodType, -1))
              }
            >
              前の{periodType === "TERM" ? "期" : periodType === "MONTH" ? "月" : "週"}
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={resetToCurrentPeriod}
          >
            現在
          </button>
          {periodType !== "YEAR" ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setAnchorDate((current) => shiftReportAnchor(current, periodType, 1))
              }
            >
              次の{periodType === "TERM" ? "期" : periodType === "MONTH" ? "月" : "週"}
            </button>
          ) : null}
        </div>
      </section>

      <div className="check-period-banner">
        <strong>{selectedClassroom?.name || "対象クラス未選択"}</strong>
        <span>{formatPeriodLabel(context)}</span>
        <small>CONFIRMED Observationのみ集計</small>
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {loadingReport ? (
        <p className="muted">
          {reportPeriodLabel(periodType)}のObservationと計画を集計しています...
        </p>
      ) : null}

      {summary ? (
        <>
          <section className="check-summary-grid">
            <div><strong>確認済みObservation</strong><span>{summary.observationCount}件</span></div>
            <div><strong>観察された子ども</strong><span>{summary.observedChildCount}人 / {summary.enrolledChildCount}人</span></div>
            <div><strong>実施Practice</strong><span>{summary.practiceCount}件</span></div>
            <div><strong>Abilityリンク</strong><span>{summary.abilityLinkCount}件</span></div>
            <div><strong>AbilityなしObservation</strong><span>{summary.observationWithoutAbilityCount}件</span></div>
            <div><strong>観察されたAbility</strong><span>{summary.observedAbilityCount}件</span></div>
          </section>

          {periodType !== "WEEK" && planSummary ? (
            <>
              <section className="check-progress-grid">
                <div>
                  <strong>期間進捗</strong>
                  <span>{progress.percentage}%</span>
                  <small>{progress.elapsedDays}日 / {progress.totalDays}日</small>
                </div>
                <div>
                  <strong>完了{progress.unitLabel}</strong>
                  <span>{progress.completedUnits} / {progress.totalUnits}</span>
                  <small>現在日までに終了した{progress.unitLabel}</small>
                </div>
                <div>
                  <strong>承認済み月間計画</strong>
                  <span>{planSummary.approvedMonthlyCount} / {planSummary.requiredMonthCount}</span>
                  <small>計画値へ算入する月</small>
                </div>
                <div>
                  <strong>計画Abilityリンク</strong>
                  <span>{planSummary.planLinkCount}件</span>
                  <small>PlanPhraseAbilityLink重み集計</small>
                </div>
              </section>

              {progress.percentage < 100 ? (
                <p className="check-progress-note">
                  期間途中の暫定Checkです。計画構成比と現在までの実績構成比を比較しています。
                  実績件数が少ない時点では偏差が変動しやすいことに注意してください。
                </p>
              ) : null}

              <section className="check-card">
                <div className="check-card-header">
                  <h3>計画アンカー</h3>
                  <span>{planSummary.anchors.length}件</span>
                </div>
                {planSummary.anchors.length > 0 ? (
                  <div className="check-anchor-list">
                    {planSummary.anchors.map(renderAnchor)}
                  </div>
                ) : (
                  <p className="muted">対象期間の計画アンカーはありません。</p>
                )}
              </section>

              <section className="check-two-column">
                <article className="check-card">
                  <div className="check-card-header">
                    <h3>5領域：計画／実績</h3>
                    <span>構成比比較</span>
                  </div>
                  {domainComparison
                    ? renderComparisonRows(domainComparison, "5領域の計画・実績はありません。")
                    : null}
                </article>

                <article className="check-card">
                  <div className="check-card-header">
                    <h3>10の姿：計画／実績</h3>
                    <span>構成比比較</span>
                  </div>
                  <div className="check-comparison-scroll">
                    {postureComparison
                      ? renderComparisonRows(postureComparison, "10の姿の計画・実績はありません。")
                      : null}
                  </div>
                </article>
              </section>

              <section className="check-two-column">
                <article className="check-card">
                  <div className="check-card-header">
                    <h3>Action候補：不足傾向</h3>
                    <span>偏差 -5pt以下</span>
                  </div>
                  {domainComparison && domainComparison.underRows.length > 0 ? (
                    <div className="check-action-list">
                      {domainComparison.underRows.map((row) => (
                        <div key={row.key}>
                          <strong>{row.label}</strong>
                          <span>計画 {shareLabel(row.planShare)} / 実績 {shareLabel(row.actualShare)}</span>
                          <b>{gapLabel(row.gapPoints)}</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">5領域に大きな不足偏差はありません。</p>
                  )}

                  {postureComparison && postureComparison.underRows.length > 0 ? (
                    <>
                      <h4>10の姿</h4>
                      <div className="check-action-list">
                        {postureComparison.underRows.slice(0, 6).map((row) => (
                          <div key={row.key}>
                            <strong>{row.label}</strong>
                            <span>計画 {shareLabel(row.planShare)} / 実績 {shareLabel(row.actualShare)}</span>
                            <b>{gapLabel(row.gapPoints)}</b>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </article>

                <article className="check-card">
                  <div className="check-card-header">
                    <h3>月間計画の充足状況</h3>
                    <span>{planSummary.approvedMonthlyCount}/{planSummary.requiredMonthCount}月</span>
                  </div>
                  <div className="check-month-status-list">
                    {planSummary.monthStatuses.map((month) => (
                      <div className={month.approved ? "check-month-approved" : "check-month-missing"} key={month.monthKey}>
                        <strong>{month.label}</strong>
                        <span>{planStatusLabel(month.status)}</span>
                        <small>文例 {month.phraseCount}件</small>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              {monthlyTrends.length > 0 ? (
                <section className="check-card">
                  <div className="check-card-header">
                    <h3>月別の5領域偏差推移</h3>
                    <span>実績構成比 − 計画構成比</span>
                  </div>
                  {renderMonthlyTrendTable(monthlyTrends)}
                </section>
              ) : null}
            </>
          ) : null}

          <section className="check-two-column">
            <article className="check-card">
              <div className="check-card-header">
                <h3>実施Practice一覧</h3>
                <span>{summary.practices.length}件</span>
              </div>
              {summary.practices.length > 0 ? (
                <div className="check-table-wrap">
                  <table className="check-table">
                    <thead>
                      <tr>
                        <th>区分</th>
                        <th>Practice</th>
                        <th>実施日数</th>
                        <th>Observation</th>
                        <th>子ども</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.practices.map((practice) => (
                        <tr key={practice.key}>
                          <td>{practiceRoleLabelForReport(practice.practiceRole)}</td>
                          <td>
                            <strong>{practice.practiceName}</strong>
                            <small>{practice.practiceCode}</small>
                          </td>
                          <td>{practice.performedDateCount}日</td>
                          <td>{practice.observationCount}件</td>
                          <td>{practice.childCount}人</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">確認済みの実施Practiceはありません。</p>
              )}
            </article>

            <article className="check-card">
              <div className="check-card-header">
                <h3>子ども別観察状況</h3>
                <span>{summary.children.length}人</span>
              </div>
              <div className="check-child-list">
                {summary.children.map((child) => (
                  <div className="check-child-row" key={child.childId}>
                    <div>
                      <strong>{child.childName}</strong>
                      {child.kana ? <small>{child.kana}</small> : null}
                    </div>
                    <span className={`check-status-pill ${childObservationClass(child.observationCount)}`}>
                      {childObservationLabel(child.observationCount)}
                    </span>
                    <b>{child.observationCount}件</b>
                    <small>
                      {child.latestObservationDate
                        ? `最終 ${formatDateLabel(child.latestObservationDate, false)}`
                        : "観察なし"}
                    </small>
                  </div>
                ))}
              </div>
              {(summary.unobservedChildren.length > 0 ||
                summary.lowObservationChildren.length > 0) ? (
                <p className="check-attention-note">
                  未観察 {summary.unobservedChildren.length}人 /
                  観察1件 {summary.lowObservationChildren.length}人
                </p>
              ) : null}
            </article>
          </section>

          {periodType === "WEEK" ? (
            <>
              <section className="check-two-column">
                <article className="check-card">
                  <div className="check-card-header">
                    <h3>5領域別分布</h3>
                    <span>実績 / Abilityリンク基準</span>
                  </div>
                  <div className="check-distribution-list">
                    {summary.domains.map((row) => (
                      <div className="check-distribution-row" key={row.key}>
                        <div>
                          <strong>{row.label}</strong>
                          <small>{row.childCount}人</small>
                        </div>
                        <div className="check-bar-track">
                          <span
                            className={
                              row.observationCount === 0
                                ? "check-bar check-bar-empty"
                                : "check-bar"
                            }
                            style={{
                              width: countBarWidth(
                                row.observationCount,
                                maxWeeklyDomainCount,
                              ),
                            }}
                          />
                        </div>
                        <b>{row.observationCount}</b>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="check-card">
                  <div className="check-card-header">
                    <h3>10の姿別分布</h3>
                    <span>実績 / Abilityリンク基準</span>
                  </div>
                  <div className="check-distribution-list check-distribution-scroll">
                    {summary.postures.map((row) => (
                      <div className="check-distribution-row" key={row.key}>
                        <div>
                          <strong>{row.label}</strong>
                          <small>{row.childCount}人</small>
                        </div>
                        <div className="check-bar-track">
                          <span
                            className={
                              row.observationCount === 0
                                ? "check-bar check-bar-empty"
                                : "check-bar"
                            }
                            style={{
                              width: countBarWidth(
                                row.observationCount,
                                maxWeeklyPostureCount,
                              ),
                            }}
                          />
                        </div>
                        <b>{row.observationCount}</b>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="check-two-column">
                <article className="check-card">
                  <div className="check-card-header">
                    <h3>今週の見届けたい姿</h3>
                    <span>{summary.expectedAbilities.length}Ability</span>
                  </div>
                  <p className="muted">
                    確認済みDailyPracticeRecordの見届けたい姿と、
                    実際のObservationAbilityLinkを比較しています。
                  </p>
                  {summary.expectedAbilities.length > 0 ? (
                    <div className="check-expected-list">
                      {summary.expectedAbilities.map((ability) => (
                        <div
                          className={`check-expected-row check-expected-${ability.status.toLowerCase()}`}
                          key={ability.abilityCode}
                        >
                          <div>
                            <strong>{ability.abilityCode} {ability.abilityName}</strong>
                            <small>{ability.domain} / {ability.category}</small>
                          </div>
                          <span>予定 {ability.expectedPracticeCount}回</span>
                          <b>観察 {ability.observationCount}件</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">対象週の見届けたい姿スナップショットはありません。</p>
                  )}
                  {expectedAttention.length > 0 ? (
                    <p className="check-attention-note">
                      未観察・観察1件のAbilityが {expectedAttention.length}件あります。
                    </p>
                  ) : null}
                </article>

                <article className="check-card">
                  <div className="check-card-header">
                    <h3>Ability別観察件数</h3>
                    <span>観察あり {summary.abilities.length}件</span>
                  </div>
                  {summary.abilities.length > 0 ? (
                    <div className="check-ability-list">
                      {summary.abilities.map((ability) => (
                        <div className="check-ability-row" key={ability.abilityCode}>
                          <div>
                            <strong>{ability.abilityCode} {ability.abilityName}</strong>
                            <small>{ability.domain} / {ability.category}</small>
                          </div>
                          <span>{ability.childCount}人</span>
                          <b>{ability.observationCount}件</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">AbilityリンクのあるObservationはありません。</p>
                  )}
                </article>
              </section>

              <section className="check-card">
                <div className="check-card-header">
                  <h3>子ども別エピソード一覧</h3>
                  <span>{summary.episodes.length}件</span>
                </div>
                {summary.children.some((child) => child.episodes.length > 0) ? (
                  <div className="check-episode-groups">
                    {summary.children
                      .filter((child) => child.episodes.length > 0)
                      .map((child) => (
                        <section className="check-child-episode-group" key={child.childId}>
                          <div className="check-child-episode-heading">
                            <h4>{child.childName}</h4>
                            <span>{child.episodes.length}件</span>
                          </div>
                          <div className="check-episode-list">
                            {child.episodes.map((episode) => (
                              <article className="check-episode-card" key={episode.observationId}>
                                <div className="check-episode-meta">
                                  <strong>{formatDateLabel(episode.reportDate, false)}</strong>
                                  <span>{practiceRoleLabelForReport(episode.practiceRole)}</span>
                                  <span>{episode.practiceName}</span>
                                </div>
                                <p>{episode.episodeText}</p>
                                {episode.abilities.length > 0 ? (
                                  <div className="check-episode-abilities">
                                    {episode.abilities.map((ability) => (
                                      <span key={`${episode.observationId}-${ability.abilityCode}`}>
                                        <b>{ability.abilityCode}</b> {ability.abilityName}
                                        {ability.confidence !== null
                                          ? ` / ${ability.confidence.toFixed(3)}`
                                          : ""}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <small className="check-no-ability">
                                    Abilityなし（Observationは正常に集計されています）
                                  </small>
                                )}
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                  </div>
                ) : (
                  <p className="muted">表示できる子ども別エピソードはありません。</p>
                )}
              </section>
            </>
          ) : (
            <p className="check-long-period-note">
              月・期・年報では件数が多くなるため、子ども別エピソード本文は表示していません。
              具体的な内容は週報で確認します。
            </p>
          )}

          {[
            ...summary.warnings,
            ...(planSummary?.warnings ?? []),
          ].length > 0 ? (
            <details className="check-warning-details">
              <summary>
                集計上の注意 {
                  [...summary.warnings, ...(planSummary?.warnings ?? [])].length
                }件
              </summary>
              <ul>
                {[...summary.warnings, ...(planSummary?.warnings ?? [])]
                  .filter((warning, index, rows) => rows.indexOf(warning) === index)
                  .map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
