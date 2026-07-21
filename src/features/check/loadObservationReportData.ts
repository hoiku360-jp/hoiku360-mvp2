import type {
  AbilityCodeRow,
  ChildClassroomEnrollmentRow,
  ChildRow,
  ClassroomRow,
  DailyPracticeRecordRow,
  ObservationAbilityLinkRow,
  ObservationRecordRow,
  ObservationReportSourceData,
  PlanDocumentRow,
  PlanPhraseAbilityLinkRow,
  PlanPhraseRow,
  ReportAggregationContext,
} from "./types";

type ModelError = { message?: string | null };

type ListResult<T> = {
  data?: T[] | null;
  nextToken?: string | null;
  errors?: ReadonlyArray<ModelError> | null;
};

type ListModel<T> = {
  list: (input?: Record<string, unknown>) => Promise<ListResult<T>>;
};

export type ObservationReportClient = {
  Classroom: ListModel<ClassroomRow>;
  Child: ListModel<ChildRow>;
  ChildClassroomEnrollment: ListModel<ChildClassroomEnrollmentRow>;
  ObservationRecord: ListModel<ObservationRecordRow>;
  ObservationAbilityLink: ListModel<ObservationAbilityLinkRow>;
  AbilityCode: ListModel<AbilityCodeRow>;
  DailyPracticeRecord: ListModel<DailyPracticeRecordRow>;
  PlanDocument: ListModel<PlanDocumentRow>;
  PlanPhrase: ListModel<PlanPhraseRow>;
  PlanPhraseAbilityLink: ListModel<PlanPhraseAbilityLinkRow>;
};

function s(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return s(value).toUpperCase();
}

function errorText(errors: ReadonlyArray<ModelError> | null | undefined, fallback: string): string {
  const message = (errors ?? [])
    .map((error) => s(error.message))
    .filter(Boolean)
    .join("\n");
  return message || fallback;
}

export async function listAll<T>(
  model: ListModel<T>,
  input?: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  let nextToken: string | null | undefined;

  do {
    const result = await model.list({
      ...(input ?? {}),
      limit: 1000,
      nextToken,
    });

    if (result.errors?.length) {
      throw new Error(errorText(result.errors, "一覧取得に失敗しました。"));
    }

    rows.push(...(result.data ?? []));
    nextToken = result.nextToken ?? null;
  } while (nextToken);

  return rows;
}

export async function loadReportClassrooms(input: {
  client: ObservationReportClient;
  tenantId: string;
  fiscalYear: number;
  allowedClassroomIds?: string[] | null;
  isSchoolScope?: boolean;
}): Promise<ClassroomRow[]> {
  const rows = await listAll(input.client.Classroom, {
    filter: {
      tenantId: { eq: input.tenantId },
      fiscalYear: { eq: input.fiscalYear },
    },
  });

  const allowed = new Set((input.allowedClassroomIds ?? []).map(s).filter(Boolean));
  return rows
    .filter((row) => upper(row.status) === "ACTIVE")
    .filter((row) => input.isSchoolScope || allowed.has(s(row.id)))
    .sort((a, b) => s(a.name).localeCompare(s(b.name), "ja"));
}

function enrollmentOverlapsPeriod(
  row: ChildClassroomEnrollmentRow,
  context: ReportAggregationContext,
): boolean {
  const startDate = s(row.startDate);
  const endDate = s(row.endDate);
  if (!startDate || startDate > context.periodEnd) return false;
  if (endDate && endDate < context.periodStart) return false;
  return upper(row.status) !== "INACTIVE";
}

export async function loadObservationReportData(input: {
  client: ObservationReportClient;
  context: ReportAggregationContext;
}): Promise<ObservationReportSourceData> {
  const { client, context } = input;
  if (!context.classroomId) {
    throw new Error("対象クラスが指定されていません。");
  }

  const shouldLoadPlan = ["MONTH", "TERM", "YEAR"].includes(context.periodType);

  const [
    observations,
    abilityLinks,
    abilityCodes,
    enrollments,
    children,
    practiceRecords,
    planDocuments,
    planPhrases,
    planPhraseAbilityLinks,
  ] = await Promise.all([
    listAll(client.ObservationRecord, {
      filter: {
        tenantId: { eq: context.tenantId },
        classroomId: { eq: context.classroomId },
      },
    }),
    listAll(client.ObservationAbilityLink, {
      filter: { tenantId: { eq: context.tenantId } },
    }),
    listAll(client.AbilityCode),
    listAll(client.ChildClassroomEnrollment, {
      filter: {
        tenantId: { eq: context.tenantId },
        classroomId: { eq: context.classroomId },
        fiscalYear: { eq: context.fiscalYear },
      },
    }),
    listAll(client.Child, {
      filter: { tenantId: { eq: context.tenantId } },
    }),
    listAll(client.DailyPracticeRecord, {
      filter: {
        tenantId: { eq: context.tenantId },
        classroomId: { eq: context.classroomId },
        fiscalYear: { eq: context.fiscalYear },
      },
    }),
    shouldLoadPlan
      ? listAll(client.PlanDocument, {
          filter: {
            tenantId: { eq: context.tenantId },
            classroomId: { eq: context.classroomId },
            fiscalYear: { eq: context.fiscalYear },
            planLevel: { eq: "LONG_TERM" },
          },
        })
      : Promise.resolve([] as PlanDocumentRow[]),
    shouldLoadPlan
      ? listAll(client.PlanPhrase)
      : Promise.resolve([] as PlanPhraseRow[]),
    shouldLoadPlan
      ? listAll(client.PlanPhraseAbilityLink)
      : Promise.resolve([] as PlanPhraseAbilityLinkRow[]),
  ]);

  const activeEnrollmentChildIds = new Set(
    enrollments
      .filter((row) => enrollmentOverlapsPeriod(row, context))
      .map((row) => s(row.childId))
      .filter(Boolean),
  );

  const childById = new Map(
    children.filter((child) => s(child.id)).map((child) => [s(child.id), child] as const),
  );
  const enrolledChildren = [...activeEnrollmentChildIds].map(
    (childId) => childById.get(childId) ?? {
      id: childId,
      tenantId: context.tenantId,
      displayName: childId,
      status: "UNKNOWN",
    },
  );

  return {
    enrolledChildren,
    observations,
    abilityLinks,
    abilityCodes,
    practiceRecords,
    planDocuments,
    planPhrases,
    planPhraseAbilityLinks,
  };
}
