export interface RawConversionGoal {
  Id?: string | number | null;
  Name?: string | null;
  Type?: string | null;
  GoalCategory?: string | null;
  Status?: string | null;
  Scope?: string | null;
  CountType?: string | null;
  TagId?: string | number | null;
  ConversionWindowInMinutes?: number | null;
  ExcludeFromBidding?: boolean | null;
  TrackingStatus?: string | null;
  Revenue?: { Type?: string | null; Value?: number | null; CurrencyCode?: string | null } | null;
  UrlExpression?: string | null;
  UrlOperator?: string | null;
  ActionExpression?: string | null;
  ActionOperator?: string | null;
  CategoryExpression?: string | null;
  CategoryOperator?: string | null;
  LabelExpression?: string | null;
  LabelOperator?: string | null;
  Value?: number | null;
  ValueOperator?: string | null;
  MinimumDurationInSeconds?: number | null;
  MinimumPagesViewed?: number | null;
  [key: string]: unknown;
}

export interface ConversionGoalSummary {
  id: string;
  name: string | null;
  type: string | null;
  category: string | null;
  status: string | null;
  // Detail fields appear only when Microsoft returns them for that goal type.
  scope?: string;
  count_type?: string;
  tag_id?: string;
  conversion_window_minutes?: number;
  exclude_from_bidding?: boolean;
  tracking_status?: string;
  revenue?: { type: string | null; value: number | null; currency: string | null };
  url_expression?: string;
  url_operator?: string;
  action_expression?: string;
  action_operator?: string;
  category_expression?: string;
  category_operator?: string;
  label_expression?: string;
  label_operator?: string;
  event_value?: number;
  event_value_operator?: string;
  minimum_duration_seconds?: number;
  minimum_pages_viewed?: number;
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

const present = (v: unknown): boolean => v !== undefined && v !== null && v !== "";

const DETAIL_FIELDS: Array<[keyof RawConversionGoal, keyof ConversionGoalSummary, "string" | "raw"]> = [
  ["Scope", "scope", "string"],
  ["CountType", "count_type", "string"],
  ["TagId", "tag_id", "string"],
  ["ConversionWindowInMinutes", "conversion_window_minutes", "raw"],
  ["ExcludeFromBidding", "exclude_from_bidding", "raw"],
  ["TrackingStatus", "tracking_status", "string"],
  ["UrlExpression", "url_expression", "string"],
  ["UrlOperator", "url_operator", "string"],
  ["ActionExpression", "action_expression", "string"],
  ["ActionOperator", "action_operator", "string"],
  ["CategoryExpression", "category_expression", "string"],
  ["CategoryOperator", "category_operator", "string"],
  ["LabelExpression", "label_expression", "string"],
  ["LabelOperator", "label_operator", "string"],
  ["Value", "event_value", "raw"],
  ["ValueOperator", "event_value_operator", "string"],
  ["MinimumDurationInSeconds", "minimum_duration_seconds", "raw"],
  ["MinimumPagesViewed", "minimum_pages_viewed", "raw"],
];

function addDetails(entry: RawConversionGoal, out: ConversionGoalSummary): ConversionGoalSummary {
  const target = out as unknown as Record<string, unknown>;
  for (const [rawKey, key, kind] of DETAIL_FIELDS) {
    const v = entry[rawKey];
    if (present(v)) target[key] = kind === "string" ? String(v) : v;
  }
  if (entry.Revenue && present(entry.Revenue.Type)) {
    out.revenue = {
      type: entry.Revenue.Type ?? null,
      value: entry.Revenue.Value ?? null,
      currency: entry.Revenue.CurrencyCode ?? null,
    };
  }
  return out;
}

export function mapConversionGoals(raw: RawConversionGoal[]): ConversionGoalSummary[] {
  const mapped: ConversionGoalSummary[] = [];
  for (const entry of raw) {
    if (entry.Id === undefined || entry.Id === null || entry.Id === "") continue;
    mapped.push(addDetails(entry, {
      id: String(entry.Id),
      name: entry.Name === undefined || entry.Name === null || entry.Name === "" ? null : entry.Name,
      type: entry.Type === undefined || entry.Type === null || entry.Type === "" ? null : entry.Type,
      category: entry.GoalCategory === undefined || entry.GoalCategory === null || entry.GoalCategory === "" ? null : entry.GoalCategory,
      status: entry.Status === undefined || entry.Status === null || entry.Status === "" ? null : entry.Status,
    }));
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

// ============================================
// WRITES: create / update (tracking setup)
// ============================================

export const GOAL_CATEGORIES = [
  "Purchase", "AddToCart", "BeginCheckout", "Subscribe", "SubmitLeadForm", "BookAppointment",
  "Signup", "RequestQuote", "GetDirections", "OutboundClick", "Contact", "PageView", "Download", "Other",
] as const;
export const MANAGED_GOAL_TYPES = ["Url", "Event", "Duration", "PagesViewedPerVisit"] as const;
export const EXPRESSION_OPERATORS = ["Equals", "Contains", "BeginsWith", "EndsWith", "RegularExpression"] as const;
export const VALUE_OPERATORS = ["Equals", "GreaterThan", "LessThan"] as const;
export const COUNT_TYPES = ["All", "Unique"] as const;
export const GOAL_SCOPES = ["Account", "Customer"] as const;
export const REVENUE_TYPES = ["NoValue", "FixedValue", "VariableValue"] as const;
// "Deleted" exists in Microsoft's docs but the API refuses it (InvalidConversionGoalStatus, verified live 2026-10-02): pausing is the only way to retire a goal.
export const GOAL_STATUSES = ["Active", "Paused"] as const;

export interface GoalSettings {
  name?: string;
  goal_category?: string;
  count_type?: string;
  conversion_window_minutes?: number;
  exclude_from_bidding?: boolean;
  revenue_type?: string;
  revenue_value?: number;
  revenue_currency?: string;
  url_expression?: string;
  url_operator?: string;
  action_expression?: string;
  action_operator?: string;
  category_expression?: string;
  category_operator?: string;
  label_expression?: string;
  label_operator?: string;
  event_value?: number;
  event_value_operator?: string;
  minimum_duration_seconds?: number;
  minimum_pages_viewed?: number;
}

export interface CreateGoalInput extends GoalSettings {
  goal_type: string;
  name: string;
  goal_category: string;
  tag_id: string;
  scope?: string;
}

export interface UpdateGoalInput extends GoalSettings {
  status?: string;
}

function oneOf(field: string, value: unknown, allowed: readonly string[]): string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")} (got ${JSON.stringify(value)})`);
  }
  return value;
}

function checkName(name: unknown): string {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) throw new Error("name is required (1-100 characters)");
  if (n.length > 100) throw new Error(`name is too long (${n.length} characters; the limit is 100)`);
  return n;
}

function checkTagId(tag: unknown): string {
  const t = tag === undefined || tag === null ? "" : String(tag).trim();
  if (!/^\d+$/.test(t)) throw new Error("tag_id is required and must be a numeric UET tag ID (see bing_ads_list_uet_tags)");
  return t;
}

function checkWindow(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 129600) {
    throw new Error("conversion_window_minutes must be a whole number from 1 to 129600 (90 days)");
  }
  return v;
}

function positiveInt(field: string, v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new Error(`${field} must be a whole number of 1 or more`);
  return v;
}

/** Revenue block, or undefined when the caller set no revenue_* field. */
function buildRevenue(s: GoalSettings): Record<string, unknown> | undefined {
  if (s.revenue_type === undefined && s.revenue_value === undefined && s.revenue_currency === undefined) return undefined;
  const type = s.revenue_type === undefined ? (s.revenue_value !== undefined ? "FixedValue" : "NoValue") : oneOf("revenue_type", s.revenue_type, REVENUE_TYPES);
  if (type === "NoValue" && s.revenue_value !== undefined) throw new Error("revenue_value must not be set when revenue_type is NoValue");
  if (type === "FixedValue" && s.revenue_value === undefined) throw new Error("revenue_value is required when revenue_type is FixedValue");
  if (s.revenue_value !== undefined && (typeof s.revenue_value !== "number" || s.revenue_value < 0)) {
    throw new Error("revenue_value must be a number of 0 or more");
  }
  const rev: Record<string, unknown> = { Type: type };
  if (s.revenue_value !== undefined) rev.Value = s.revenue_value;
  if (s.revenue_currency !== undefined && s.revenue_currency !== "") rev.CurrencyCode = s.revenue_currency;
  return rev;
}

type Goal = Record<string, unknown>;

const MATCH_FIELDS: Record<string, readonly string[]> = {
  Url: ["url_expression", "url_operator"],
  Event: ["action_expression", "action_operator", "category_expression", "category_operator", "label_expression", "label_operator", "event_value", "event_value_operator"],
  Duration: ["minimum_duration_seconds"],
  PagesViewedPerVisit: ["minimum_pages_viewed"],
};

/** Reject inputs that do not apply to this goal type (rather than silently ignoring them) and wrong-typed free-form inputs. */
function checkInputs(type: string, s: GoalSettings): void {
  const given = s as Record<string, unknown>;
  for (const [otherType, fields] of Object.entries(MATCH_FIELDS)) {
    if (otherType === type) continue;
    for (const f of fields) {
      if (given[f] !== undefined) throw new Error(`${f} does not apply to a ${type} goal (it is a ${otherType} goal field)`);
    }
  }
  for (const f of ["url_expression", "action_expression", "category_expression", "label_expression"]) {
    const v = given[f];
    if (v !== undefined && (typeof v !== "string" || v.length > 100 && f !== "url_expression")) {
      throw new Error(`${f} must be text${f === "url_expression" ? "" : " of 100 characters or fewer"}`);
    }
  }
  if (s.revenue_currency !== undefined && typeof s.revenue_currency !== "string") throw new Error("revenue_currency must be text, e.g. AUD");
  if (s.exclude_from_bidding !== undefined && typeof s.exclude_from_bidding !== "boolean") throw new Error("exclude_from_bidding must be true or false");
}

/** Setting fields shared by every managed goal type. */
function applyCommon(goal: Goal, type: string, s: GoalSettings): void {
  if (s.count_type !== undefined) goal.CountType = oneOf("count_type", s.count_type, COUNT_TYPES);
  if (s.conversion_window_minutes !== undefined) goal.ConversionWindowInMinutes = checkWindow(s.conversion_window_minutes);
  if (s.exclude_from_bidding !== undefined) goal.ExcludeFromBidding = s.exclude_from_bidding;
  const revenue = buildRevenue(s);
  if (revenue) {
    if (type === "Duration" || type === "PagesViewedPerVisit") {
      throw new Error("revenue cannot be set on Duration or PagesViewedPerVisit goals (Microsoft does not allow it)");
    }
    goal.Revenue = revenue;
  }
}

/** Type-specific match rule. `base` carries existing values (update) so unset pieces are kept. */
function applyMatchRule(goal: Goal, type: string, s: GoalSettings, base: RawConversionGoal | null): void {
  if (type === "Url") {
    const expr = s.url_expression ?? (base?.UrlExpression as string | undefined);
    if (!expr) throw new Error("url_expression is required for a Url goal");
    goal.UrlExpression = expr;
    goal.UrlOperator = oneOf("url_operator", s.url_operator ?? base?.UrlOperator ?? "Equals", EXPRESSION_OPERATORS);
  } else if (type === "Event") {
    let pairs = 0;
    for (const word of ["action", "category", "label"] as const) {
      const exprKey = `${word}_expression` as keyof GoalSettings;
      const opKey = `${word}_operator` as keyof GoalSettings;
      const rawExpr = `${word[0].toUpperCase()}${word.slice(1)}Expression` as keyof RawConversionGoal;
      const rawOp = `${word[0].toUpperCase()}${word.slice(1)}Operator` as keyof RawConversionGoal;
      const expr = (s[exprKey] as string | undefined) ?? (base?.[rawExpr] as string | undefined);
      if (expr) {
        goal[rawExpr as string] = expr;
        goal[rawOp as string] = oneOf(opKey as string, (s[opKey] as string | undefined) ?? (base?.[rawOp] as string | undefined) ?? "Equals", EXPRESSION_OPERATORS);
        pairs++;
      }
    }
    const value = s.event_value ?? (base?.Value as number | undefined | null);
    if (value !== undefined && value !== null) {
      if (typeof value !== "number") throw new Error("event_value must be a number");
      goal.Value = value;
      goal.ValueOperator = oneOf("event_value_operator", s.event_value_operator ?? base?.ValueOperator ?? "Equals", VALUE_OPERATORS);
      pairs++;
    }
    if (pairs === 0) {
      throw new Error("an Event goal needs at least one match rule: action_expression, category_expression, label_expression or event_value");
    }
  } else if (type === "Duration") {
    const v = s.minimum_duration_seconds ?? (base?.MinimumDurationInSeconds as number | undefined | null);
    if (v === undefined || v === null) throw new Error("minimum_duration_seconds is required for a Duration goal");
    goal.MinimumDurationInSeconds = positiveInt("minimum_duration_seconds", v);
  } else if (type === "PagesViewedPerVisit") {
    const v = s.minimum_pages_viewed ?? (base?.MinimumPagesViewed as number | undefined | null);
    if (v === undefined || v === null) throw new Error("minimum_pages_viewed is required for a PagesViewedPerVisit goal");
    goal.MinimumPagesViewed = positiveInt("minimum_pages_viewed", v);
  }
}

export function buildAddGoalBody(input: CreateGoalInput): { ConversionGoals: Goal[] } {
  const type = oneOf("goal_type", input.goal_type, MANAGED_GOAL_TYPES);
  const goal: Goal = {
    Type: type,
    Name: checkName(input.name),
    GoalCategory: oneOf("goal_category", input.goal_category, GOAL_CATEGORIES),
    TagId: checkTagId(input.tag_id),
    Scope: oneOf("scope", input.scope ?? "Account", GOAL_SCOPES),
  };
  checkInputs(type, input);
  applyCommon(goal, type, input);
  applyMatchRule(goal, type, input, null);
  return { ConversionGoals: [goal] };
}

/**
 * Builds a full-replacement update from the goal as Microsoft currently has it plus the caller's changes.
 * Microsoft deletes Event match rules that an update leaves out, so the existing ones are always re-sent.
 */
export function buildUpdateGoalBody(existing: RawConversionGoal, patch: UpdateGoalInput): { ConversionGoals: Goal[] } {
  const type = existing.Type ?? "";
  if (!(MANAGED_GOAL_TYPES as readonly string[]).includes(type)) {
    throw new Error(`this tool only edits Url, Event, Duration and PagesViewedPerVisit goals; this goal is ${type || "of unknown type"}`);
  }
  if (Object.values(patch).every((v) => v === undefined)) {
    throw new Error("nothing to update: pass at least one field to change");
  }
  const goal: Goal = { Id: String(existing.Id), Type: type };
  goal.Name = patch.name !== undefined ? checkName(patch.name) : existing.Name;
  if (patch.goal_category !== undefined) goal.GoalCategory = oneOf("goal_category", patch.goal_category, GOAL_CATEGORIES);
  else if (present(existing.GoalCategory)) goal.GoalCategory = existing.GoalCategory;
  checkInputs(type, patch);
  // Full-replacement PUT: always send the status so a rename cannot reactivate a goal that was retired.
  if (patch.status !== undefined) goal.Status = oneOf("status", patch.status, GOAL_STATUSES);
  else if (existing.Status === "Active" || existing.Status === "Paused") goal.Status = existing.Status;
  if (present(existing.TagId)) goal.TagId = String(existing.TagId);
  // Carry existing settings forward unless the patch overrides them.
  const merged: GoalSettings = {
    count_type: patch.count_type ?? (present(existing.CountType) ? String(existing.CountType) : undefined),
    conversion_window_minutes: patch.conversion_window_minutes ?? (existing.ConversionWindowInMinutes ?? undefined),
    exclude_from_bidding: patch.exclude_from_bidding ?? (existing.ExcludeFromBidding ?? undefined),
    // A value-only patch keeps a VariableValue goal VariableValue instead of defaulting to FixedValue.
    revenue_type: patch.revenue_type ?? (
      (patch.revenue_value !== undefined || patch.revenue_currency !== undefined) && existing.Revenue?.Type && existing.Revenue.Type !== "NoValue"
        ? existing.Revenue.Type
        : undefined
    ),
    revenue_value: patch.revenue_value,
    revenue_currency: patch.revenue_currency,
  };
  applyCommon(goal, type, merged);
  applyMatchRule(goal, type, patch, existing);
  return { ConversionGoals: [goal] };
}

export function extractGoalWriteErrors(response: unknown): string[] {
  if (response === null || typeof response !== "object") return [];
  const partial = (response as { PartialErrors?: unknown }).PartialErrors;
  if (!Array.isArray(partial)) return [];
  return partial.map((e: any) => `${e?.ErrorCode ?? "Error"}: ${e?.Message ?? "unknown error"}`);
}

export function extractCreatedGoalId(response: unknown): string {
  const ids = (response as { ConversionGoalIds?: unknown } | null)?.ConversionGoalIds;
  const id = Array.isArray(ids) ? ids.find((x) => x !== null && x !== undefined) : undefined;
  if (id === undefined) {
    const errors = extractGoalWriteErrors(response);
    throw new Error("Microsoft rejected the goal: " + (errors.length ? errors.join("; ") : "no goal ID and no error returned"));
  }
  return String(id);
}
