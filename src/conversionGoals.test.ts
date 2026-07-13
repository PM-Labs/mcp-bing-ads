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
