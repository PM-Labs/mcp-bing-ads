import { describe, it, expect } from "vitest";
import {
  buildAddGoalBody,
  buildUpdateGoalBody,
  extractCreatedGoalId,
  extractGoalWriteErrors,
} from "./conversionGoals.js";

const URL_GOAL = {
  goal_type: "Url",
  name: "ZZZ | MCP TEST | URL",
  goal_category: "PageView",
  tag_id: "111",
  url_expression: "https://example.com/thanks",
  url_operator: "BeginsWith",
} as const;

describe("buildAddGoalBody", () => {
  it("builds a Url goal with Account scope by default", () => {
    expect(buildAddGoalBody({ ...URL_GOAL })).toEqual({
      ConversionGoals: [
        {
          Type: "Url",
          Name: "ZZZ | MCP TEST | URL",
          GoalCategory: "PageView",
          TagId: "111",
          Scope: "Account",
          UrlExpression: "https://example.com/thanks",
          UrlOperator: "BeginsWith",
        },
      ],
    });
  });

  it("defaults the url operator to Equals", () => {
    const { url_operator, ...rest } = URL_GOAL;
    const body = buildAddGoalBody({ ...rest }) as any;
    expect(body.ConversionGoals[0].UrlOperator).toBe("Equals");
  });

  it("passes through optional settings", () => {
    const body = buildAddGoalBody({
      ...URL_GOAL,
      scope: "Customer",
      count_type: "Unique",
      conversion_window_minutes: 1440,
      exclude_from_bidding: true,
      revenue_type: "FixedValue",
      revenue_value: 25,
      revenue_currency: "AUD",
    }) as any;
    expect(body.ConversionGoals[0]).toMatchObject({
      Scope: "Customer",
      CountType: "Unique",
      ConversionWindowInMinutes: 1440,
      ExcludeFromBidding: true,
      Revenue: { Type: "FixedValue", Value: 25, CurrencyCode: "AUD" },
    });
  });

  it("builds an Event goal and defaults expression operators to Equals", () => {
    const body = buildAddGoalBody({
      goal_type: "Event",
      name: "E",
      goal_category: "SubmitLeadForm",
      tag_id: "111",
      action_expression: "zzz_mcp_test",
      event_value: 5,
      event_value_operator: "GreaterThan",
    }) as any;
    expect(body.ConversionGoals[0]).toMatchObject({
      Type: "Event",
      ActionExpression: "zzz_mcp_test",
      ActionOperator: "Equals",
      Value: 5,
      ValueOperator: "GreaterThan",
    });
  });

  it("builds Duration and PagesViewedPerVisit goals", () => {
    const d = buildAddGoalBody({ goal_type: "Duration", name: "D", goal_category: "Other", tag_id: "1", minimum_duration_seconds: 60 }) as any;
    expect(d.ConversionGoals[0]).toMatchObject({ Type: "Duration", MinimumDurationInSeconds: 60 });
    const p = buildAddGoalBody({ goal_type: "PagesViewedPerVisit", name: "P", goal_category: "Other", tag_id: "1", minimum_pages_viewed: 3 }) as any;
    expect(p.ConversionGoals[0]).toMatchObject({ Type: "PagesViewedPerVisit", MinimumPagesViewed: 3 });
  });

  it.each([
    ["empty name", { name: " " }, /name/i],
    ["name over 100", { name: "x".repeat(101) }, /100/],
    ["unknown category", { goal_category: "Nonsense" }, /goal_category/],
    ["missing tag", { tag_id: "" }, /tag_id/],
    ["non-numeric tag", { tag_id: "abc" }, /tag_id/],
    ["unknown goal type", { goal_type: "Offline" }, /goal_type/],
    ["bad count type", { count_type: "Some" }, /count_type/],
    ["window too big", { conversion_window_minutes: 129601 }, /conversion_window_minutes/],
    ["window zero", { conversion_window_minutes: 0 }, /conversion_window_minutes/],
    ["fixed revenue without value", { revenue_type: "FixedValue" }, /revenue_value/],
    ["no-value revenue with value", { revenue_type: "NoValue", revenue_value: 3 }, /revenue_value/],
    ["bad scope", { scope: "Global" }, /scope/],
    ["missing url expression", { url_expression: "" }, /url_expression/],
    ["bad url operator", { url_operator: "Like" }, /url_operator/],
  ])("rejects %s before calling Microsoft", (_label, override, pattern) => {
    expect(() => buildAddGoalBody({ ...URL_GOAL, ...(override as object) } as any)).toThrow(pattern);
  });

  it("rejects an Event goal with no match rule", () => {
    expect(() => buildAddGoalBody({ goal_type: "Event", name: "E", goal_category: "Other", tag_id: "1" } as any)).toThrow(/action_expression|category_expression|label_expression|event_value/);
  });

  it("rejects Duration without minimum_duration_seconds and Pages without minimum_pages_viewed", () => {
    expect(() => buildAddGoalBody({ goal_type: "Duration", name: "D", goal_category: "Other", tag_id: "1" } as any)).toThrow(/minimum_duration_seconds/);
    expect(() => buildAddGoalBody({ goal_type: "PagesViewedPerVisit", name: "P", goal_category: "Other", tag_id: "1" } as any)).toThrow(/minimum_pages_viewed/);
  });

  it("rejects revenue on Duration/PagesViewedPerVisit goals (Microsoft does not allow it)", () => {
    expect(() =>
      buildAddGoalBody({ goal_type: "Duration", name: "D", goal_category: "Other", tag_id: "1", minimum_duration_seconds: 60, revenue_type: "FixedValue", revenue_value: 1 } as any),
    ).toThrow(/revenue/i);
  });
});

describe("buildUpdateGoalBody", () => {
  const EXISTING_EVENT = {
    Id: "500",
    Type: "Event",
    Name: "Old name",
    GoalCategory: "SubmitLeadForm",
    Status: "Active",
    Scope: "Account",
    TagId: "111",
    CountType: "Unique",
    ConversionWindowInMinutes: 43200,
    ExcludeFromBidding: false,
    TrackingStatus: "NoRecentConversions",
    Revenue: { Type: "NoValue", Value: null, CurrencyCode: null },
    ActionExpression: "lead",
    ActionOperator: "Equals",
    CategoryExpression: null,
    CategoryOperator: null,
    LabelExpression: null,
    LabelOperator: null,
    Value: null,
    ValueOperator: null,
  };

  it("keeps an Event goal's existing match rule (Microsoft deletes omitted ones) and drops read-only fields", () => {
    const body = buildUpdateGoalBody(EXISTING_EVENT, { name: "New name" }) as any;
    const g = body.ConversionGoals[0];
    expect(g).toMatchObject({ Id: "500", Type: "Event", Name: "New name", ActionExpression: "lead", ActionOperator: "Equals" });
    expect(g).not.toHaveProperty("TrackingStatus");
    expect(g).not.toHaveProperty("Scope");
    expect(g).not.toHaveProperty("CategoryExpression");
    expect(g).not.toHaveProperty("Revenue");
  });

  it("sets status Paused and Active", () => {
    expect((buildUpdateGoalBody(EXISTING_EVENT, { status: "Paused" }) as any).ConversionGoals[0].Status).toBe("Paused");
    expect((buildUpdateGoalBody(EXISTING_EVENT, { status: "Active" }) as any).ConversionGoals[0].Status).toBe("Active");
  });

  it("rejects Deleted, which Microsoft refuses through the API", () => {
    expect(() => buildUpdateGoalBody(EXISTING_EVENT, { status: "Deleted" as any })).toThrow(/status must be one of: Active, Paused/);
  });

  it("rejects the value operators Microsoft does not support", () => {
    expect(() => buildAddGoalBody({ goal_type: "Event", name: "E", goal_category: "Other", tag_id: "1", event_value: 5, event_value_operator: "GreaterThanEqualTo" } as any)).toThrow(/event_value_operator/);
  });

  it("lets a patch override the match rule and settings", () => {
    const g = (buildUpdateGoalBody(EXISTING_EVENT, {
      action_expression: "lead2",
      count_type: "All",
      conversion_window_minutes: 100,
      revenue_type: "FixedValue",
      revenue_value: 9,
      revenue_currency: "AUD",
    }) as any).ConversionGoals[0];
    expect(g).toMatchObject({
      ActionExpression: "lead2",
      ActionOperator: "Equals",
      CountType: "All",
      ConversionWindowInMinutes: 100,
      Revenue: { Type: "FixedValue", Value: 9, CurrencyCode: "AUD" },
    });
  });

  it("rejects an empty patch", () => {
    expect(() => buildUpdateGoalBody(EXISTING_EVENT, {})).toThrow(/nothing to update/i);
  });

  it("rejects a bad status", () => {
    expect(() => buildUpdateGoalBody(EXISTING_EVENT, { status: "Gone" as any })).toThrow(/status/);
  });

  it("refuses goal types this tool does not manage", () => {
    expect(() => buildUpdateGoalBody({ ...EXISTING_EVENT, Type: "OfflineConversion" }, { name: "x" })).toThrow(/OfflineConversion/);
  });

  it("keeps a Url goal's expression", () => {
    const g = (buildUpdateGoalBody({ Id: "7", Type: "Url", Name: "U", UrlExpression: "/thanks", UrlOperator: "Contains" }, { status: "Paused" }) as any).ConversionGoals[0];
    expect(g).toMatchObject({ Id: "7", Type: "Url", UrlExpression: "/thanks", UrlOperator: "Contains", Status: "Paused" });
  });
});

describe("extractCreatedGoalId", () => {
  it("returns the new id as a string", () => {
    expect(extractCreatedGoalId({ ConversionGoalIds: [12345], PartialErrors: [] })).toBe("12345");
  });

  it("throws with Microsoft's message when rejected", () => {
    expect(() =>
      extractCreatedGoalId({ ConversionGoalIds: [null], PartialErrors: [{ ErrorCode: "InvalidGoalCategory", Message: "The Goal Category is invalid." }] }),
    ).toThrow(/InvalidGoalCategory.*Goal Category is invalid/);
  });
});

describe("extractGoalWriteErrors", () => {
  it("returns an empty list when there are none", () => {
    expect(extractGoalWriteErrors({ PartialErrors: [] })).toEqual([]);
    expect(extractGoalWriteErrors({})).toEqual([]);
  });

  it("formats each partial error", () => {
    expect(extractGoalWriteErrors({ PartialErrors: [{ ErrorCode: "X", Message: "bad", Index: 0 }] })).toEqual(["X: bad"]);
  });
});
