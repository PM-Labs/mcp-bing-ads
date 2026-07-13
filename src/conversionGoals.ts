export interface RawConversionGoal {
  Id?: string | number | null;
  Name?: string | null;
  Type?: string | null;
  GoalCategory?: string | null;
  Status?: string | null;
}

export interface ConversionGoalSummary {
  id: string;
  name: string | null;
  type: string | null;
  category: string | null;
  status: string | null;
}

export interface GoalWarning {
  message: string;
  error_code?: string;
}

export function extractConversionGoalsArray(response: unknown): RawConversionGoal[] {
  if (response === null || typeof response !== "object") {
    throw new Error("Malformed GetConversionGoalsByIds response: expected an object");
  }
  if (!("ConversionGoals" in response)) {
    throw new Error("Malformed GetConversionGoalsByIds response: missing ConversionGoals key");
  }
  const raw = (response as { ConversionGoals: unknown }).ConversionGoals;
  if (raw === null || raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error("Malformed GetConversionGoalsByIds response: ConversionGoals is not an array");
  }
  return raw as RawConversionGoal[];
}

export function mapConversionGoals(raw: RawConversionGoal[]): ConversionGoalSummary[] {
  const mapped: ConversionGoalSummary[] = [];
  for (const entry of raw) {
    if (entry.Id === undefined || entry.Id === null || entry.Id === "") continue;
    mapped.push({
      id: String(entry.Id),
      name: entry.Name === undefined || entry.Name === null || entry.Name === "" ? null : entry.Name,
      type: entry.Type === undefined || entry.Type === null || entry.Type === "" ? null : entry.Type,
      category: entry.GoalCategory === undefined || entry.GoalCategory === null || entry.GoalCategory === "" ? null : entry.GoalCategory,
      status: entry.Status === undefined || entry.Status === null || entry.Status === "" ? null : entry.Status,
    });
  }
  return mapped;
}

export function extractGoalWarnings(response: unknown): GoalWarning[] {
  if (response === null || typeof response !== "object") return [];
  const partial = (response as { PartialErrors?: unknown }).PartialErrors;
  if (!Array.isArray(partial)) return [];
  return partial.map((e: any) => ({
    message: typeof e?.Message === "string" ? e.Message : "Unknown error",
    ...(typeof e?.ErrorCode === "string" ? { error_code: e.ErrorCode } : {}),
  }));
}

export function buildConversionColumns(byGoal: boolean): string[] {
  const base = [
    "AccountId",
    "CampaignId",
    "CampaignName",
    "ConversionsQualified",
    "AllConversionsQualified",
    "ConversionRate",
    "CostPerConversion",
    "Revenue",
    "ReturnOnAdSpend",
  ];
  return byGoal ? [...base, "Goal", "GoalId", "GoalType"] : base;
}
