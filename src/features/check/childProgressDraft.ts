import type {
  ChildProgressComparisonSummary,
  ChildProgressEvidenceSnapshot,
  ChildProgressEvidenceRow,
} from "./types";

const DOMAIN_LABELS: Record<string, string> = {
  健康: "生活と健康",
  人間関係: "人との関わり",
  環境: "身近な環境との関わり",
  言葉: "言葉による伝え合い",
  表現: "感性と表現",
};

function joinNames(rows: Array<{ abilityName: string }>, limit = 3): string {
  return rows
    .slice(0, limit)
    .map((row) => row.abilityName)
    .join("、");
}

function representativeEpisodes(
  rows: ChildProgressEvidenceRow[],
  limit = 2,
): ChildProgressEvidenceRow[] {
  return rows
    .filter((row) => row.abilities.some((ability) => {
      const code = ability.abilityCode;
      return Boolean(code);
    }))
    .filter((row) =>
      row.abilities.some((ability) => {
        // The domain is not duplicated on EpisodeAbilitySummary, so domain
        // matching is resolved through the ability comparison rows before this
        // function is called. The caller supplies already filtered evidence.
        return Boolean(ability.abilityCode);
      }),
    )
    .slice(0, limit);
}

function episodeSentence(row: ChildProgressEvidenceRow): string {
  const practice = row.practiceName || "生活や遊び";
  const text = row.episodeText.replace(/\s+/g, " ").trim();
  return `${row.reportDate}の${practice}では、${text}`;
}

export function buildChildProgressDraft(
  summary: ChildProgressComparisonSummary,
): string {
  const lines: string[] = [];
  lines.push(`【保育経過記録支援：${summary.childName}】`);
  lines.push(
    `対象期間：${summary.current.periodStart}〜${summary.current.periodEnd}`,
  );
  lines.push(
    `比較期間：${summary.previous.periodStart}〜${summary.previous.periodEnd}`,
  );
  lines.push("");
  lines.push(
    "※この内容は、保育360に登録された確認済み観察記録をもとにした保育士確認前の下書きです。児童票へ転記する前に、根拠エピソードを確認し、必要に応じて修正・追記してください。",
  );
  lines.push("");

  for (const domainRow of summary.domainRows) {
    const currentAbilities = summary.current.abilities
      .filter((row) => row.domain === domainRow.key)
      .sort((a, b) => b.observationCount - a.observationCount);
    if (currentAbilities.length === 0) continue;

    const domainEvidence = summary.evidenceRows.filter((episode) =>
      episode.abilities.some((ability) =>
        currentAbilities.some((row) => row.abilityCode === ability.abilityCode),
      ),
    );
    lines.push(`■ ${DOMAIN_LABELS[domainRow.key] ?? domainRow.label}`);
    lines.push(
      `「${joinNames(currentAbilities)}」に関わる姿が、生活や遊びの中で記録されています。`,
    );
    for (const episode of representativeEpisodes(domainEvidence)) {
      lines.push(`・${episodeSentence(episode)}`);
    }
    lines.push("");
  }

  lines.push("■ 期間を通した育ちの姿");
  if (summary.newAbilities.length > 0) {
    lines.push(
      `現在期間には、「${joinNames(summary.newAbilities)}」に関わる姿が新たに記録されています。`,
    );
  }
  if (summary.moreRecordedAbilities.length > 0) {
    lines.push(
      `比較期間と比べ、「${joinNames(summary.moreRecordedAbilities)}」に関わる場面が複数記録されています。`,
    );
  }
  const continuing = [
    ...summary.continuedAbilities,
    ...summary.moreRecordedAbilities,
    ...summary.lessRecordedAbilities,
  ];
  if (continuing.length > 0) {
    lines.push(
      `「${joinNames(continuing)}」に関わる姿は、比較期間から継続して記録されています。`,
    );
  }
  if (summary.previous.observationCount === 0) {
    lines.push(
      "比較期間の記録がないため、今回は現在期間に見られた姿を中心に整理しています。",
    );
  }
  lines.push("");

  if (summary.current.practices.length > 0) {
    lines.push("■ 遊び・生活場面とのつながり");
    for (const practice of summary.current.practices.slice(0, 5)) {
      lines.push(
        `・${practice.practiceName}：${practice.performedDateCount}日、${practice.observationCount}件のエピソードが記録されています。`,
      );
    }
    lines.push("");
  }

  if (summary.evidenceRows.length > 0) {
    lines.push("■ 根拠エピソード");
    for (const episode of summary.evidenceRows.slice(0, 8)) {
      const abilityNames = episode.abilities
        .map((ability) => ability.abilityName)
        .filter(Boolean)
        .join("、");
      lines.push(
        `・${episode.reportDate} ${episode.practiceName}：${episode.episodeText}${
          abilityNames ? `（育ちの観点：${abilityNames}）` : ""
        }`,
      );
    }
    lines.push("");
  }

  lines.push("■ 今後見届けたい視点");
  lines.push(
    "現在期間に見られた姿が、どのような遊びや人との関わりの中で続いていくかを見届けます。記録件数が少ない姿や現在期間に記録されなかった姿は、育ちの後退を示すものではありません。今後の活動や観察機会の中で、保育士が必要に応じて確認してください。",
  );

  return lines.join("\n");
}

export function buildChildProgressSnapshot(input: {
  summary: ChildProgressComparisonSummary;
  classroomId: string;
  generatedAt: string;
}): ChildProgressEvidenceSnapshot {
  return {
    snapshotVersion: "phase9d1-v1",
    generatedAt: input.generatedAt,
    childId: input.summary.childId,
    childName: input.summary.childName,
    classroomId: input.classroomId,
    currentPeriodStart: input.summary.current.periodStart,
    currentPeriodEnd: input.summary.current.periodEnd,
    comparisonPeriodStart: input.summary.previous.periodStart,
    comparisonPeriodEnd: input.summary.previous.periodEnd,
    sourceObservationIds: input.summary.sourceObservationIds,
    sourceAbilityCodes: input.summary.sourceAbilityCodes,
    domainRows: input.summary.domainRows,
    abilityRows: input.summary.abilityRows,
    practiceRows: input.summary.current.practices,
    evidenceRows: input.summary.evidenceRows,
  };
}

export function childProgressSourceSignature(input: {
  observationIds: string[];
  abilityCodes: string[];
}): string {
  return JSON.stringify({
    observationIds: [...input.observationIds].sort(),
    abilityCodes: [...input.abilityCodes].sort(),
  });
}
