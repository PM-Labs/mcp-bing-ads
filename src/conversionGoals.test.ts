import { describe, it, expect } from "vitest";
import {
  extractConversionGoalsArray,
  mapConversionGoals,
  extractGoalWarnings,
  buildConversionColumns,
} from "./conversionGoals.js";

describe("extractConversionGoalsArray", () => {
  it("returns the ConversionGoals array when present", () => {
    const response = { ConversionGoals: [{ Id: 1, Name: "Purchase" }] };
    expect(extractConversionGoalsArray(response)).toEqual([{ Id: 1, Name: "Purchase" }]);
  });

  it("returns an empty array when ConversionGoals is null", () => {
    const response = { ConversionGoals: null };
    expect(extractConversionGoalsArray(response)).toEqual([]);
  });

  it("throws when the ConversionGoals key is absent entirely", () => {
    expect(() => extractConversionGoalsArray({})).toThrow(/missing ConversionGoals key/);
  });

  it("throws when the response is not an object", () => {
    expect(() => extractConversionGoalsArray(null)).toThrow(/expected an object/);
    expect(() => extractConversionGoalsArray("oops")).toThrow(/expected an object/);
  });

  it("throws when ConversionGoals is present but not an array or null", () => {
    expect(() => extractConversionGoalsArray({ ConversionGoals: "not-an-array" })).toThrow(/not an array/);
  });
});

describe("mapConversionGoals", () => {
  it("maps a well-formed goal", () => {
    const result = mapConversionGoals([
      { Id: 501, Name: "Purchase", Type: "UrlGoal", GoalCategory: "Purchase", Status: "Active" },
    ]);
    expect(result).toEqual([{ id: "501", name: "Purchase", type: "UrlGoal", category: "Purchase", status: "Active" }]);
  });

  it("maps goals of different derived types to the same flat shape", () => {
    const result = mapConversionGoals([
      { Id: 1, Name: "Signup", Type: "EventGoal", GoalCategory: "Signup", Status: "Active" },
      { Id: 2, Name: "Call", Type: "OfflineConversionGoal", GoalCategory: "Contact", Status: "Paused" },
    ]);
    expect(result).toEqual([
      { id: "1", name: "Signup", type: "EventGoal", category: "Signup", status: "Active" },
      { id: "2", name: "Call", type: "OfflineConversionGoal", category: "Contact", status: "Paused" },
    ]);
  });

  it("returns null (not a placeholder string) for a missing Name/Type/GoalCategory/Status", () => {
    const result = mapConversionGoals([{ Id: 3 }]);
    expect(result).toEqual([{ id: "3", name: null, type: null, category: null, status: null }]);
  });

  it("drops a goal missing Id", () => {
    const result = mapConversionGoals([{ Name: "No ID" } as any]);
    expect(result).toEqual([]);
  });

  it("coerces a numeric Id to string", () => {
    const result = mapConversionGoals([{ Id: 42, Name: "X" }]);
    expect(result[0].id).toBe("42");
  });
});

describe("mapConversionGoals (detail fields)", () => {
  it("adds the settings and match rule when Microsoft returns them", () => {
    const [g] = mapConversionGoals([
      {
        Id: "176021739", Name: "PM | Submit Lead Form", Type: "Event", GoalCategory: "SubmitLeadForm", Status: "Active",
        Scope: "Account", CountType: "Unique", TagId: "73011782", ConversionWindowInMinutes: 43200, ExcludeFromBidding: true,
        TrackingStatus: "NoRecentConversions",
        Revenue: { Type: "VariableValue", Value: 1, CurrencyCode: "AUD" },
        ActionExpression: "lead", ActionOperator: "Equals", CategoryExpression: null, Value: null,
      } as any,
    ]);
    expect(g).toMatchObject({
      id: "176021739", scope: "Account", count_type: "Unique", tag_id: "73011782",
      conversion_window_minutes: 43200, exclude_from_bidding: true, tracking_status: "NoRecentConversions",
      revenue: { type: "VariableValue", value: 1, currency: "AUD" },
      action_expression: "lead", action_operator: "Equals",
    });
    expect(g).not.toHaveProperty("category_expression");
    expect(g).not.toHaveProperty("event_value");
  });

  it("maps Url, Duration and PagesViewedPerVisit specifics", () => {
    const [u, d, p] = mapConversionGoals([
      { Id: 1, Type: "Url", UrlExpression: "/thanks", UrlOperator: "Contains" } as any,
      { Id: 2, Type: "Duration", MinimumDurationInSeconds: 60 } as any,
      { Id: 3, Type: "PagesViewedPerVisit", MinimumPagesViewed: 3 } as any,
    ]);
    expect(u).toMatchObject({ url_expression: "/thanks", url_operator: "Contains" });
    expect(d).toMatchObject({ minimum_duration_seconds: 60 });
    expect(p).toMatchObject({ minimum_pages_viewed: 3 });
  });
});

describe("extractGoalWarnings", () => {
  it("returns an empty array when PartialErrors is absent", () => {
    expect(extractGoalWarnings({ ConversionGoals: [] })).toEqual([]);
  });

  it("returns an empty array when PartialErrors is not an array", () => {
    expect(extractGoalWarnings({ PartialErrors: "oops" })).toEqual([]);
  });

  it("maps PartialErrors entries to Message/ErrorCode", () => {
    const response = {
      PartialErrors: [{ Message: "Goal not found", ErrorCode: "GoalNotFound", Index: 0 }],
    };
    expect(extractGoalWarnings(response)).toEqual([{ message: "Goal not found", error_code: "GoalNotFound" }]);
  });

  it("falls back to a default message when Message is missing", () => {
    const response = { PartialErrors: [{}] };
    expect(extractGoalWarnings(response)).toEqual([{ message: "Unknown error" }]);
  });

  it("returns an empty array for a non-object response", () => {
    expect(extractGoalWarnings(null)).toEqual([]);
    expect(extractGoalWarnings("oops")).toEqual([]);
  });
});

describe("buildConversionColumns", () => {
  it("returns exactly the 9 base columns when byGoal is false", () => {
    expect(buildConversionColumns(false)).toEqual([
      "AccountId",
      "CampaignId",
      "CampaignName",
      "ConversionsQualified",
      "AllConversionsQualified",
      "ConversionRate",
      "CostPerConversion",
      "Revenue",
      "ReturnOnAdSpend",
    ]);
  });

  it("appends Goal/GoalId/GoalType when byGoal is true", () => {
    const columns = buildConversionColumns(true);
    expect(columns).toEqual([
      "AccountId",
      "CampaignId",
      "CampaignName",
      "ConversionsQualified",
      "AllConversionsQualified",
      "ConversionRate",
      "CostPerConversion",
      "Revenue",
      "ReturnOnAdSpend",
      "Goal",
      "GoalId",
      "GoalType",
    ]);
  });
});
