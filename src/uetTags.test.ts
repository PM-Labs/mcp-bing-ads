import { describe, it, expect } from "vitest";
import {
  findTagByName,
  extractUetTagsArray,
  mapUetTags,
  buildAddUetTagBody,
  extractCreatedUetTag,
} from "./uetTags.js";

describe("extractUetTagsArray", () => {
  it("returns the UetTags array when present", () => {
    expect(extractUetTagsArray({ UetTags: [{ Id: 1 }] })).toEqual([{ Id: 1 }]);
  });

  it("returns an empty array when UetTags is null", () => {
    expect(extractUetTagsArray({ UetTags: null })).toEqual([]);
  });

  it("throws when the UetTags key is absent", () => {
    expect(() => extractUetTagsArray({})).toThrow(/missing UetTags key/);
  });

  it("throws on a non-object response", () => {
    expect(() => extractUetTagsArray(null)).toThrow(/expected an object/);
  });

  it("throws when UetTags is not an array", () => {
    expect(() => extractUetTagsArray({ UetTags: "x" })).toThrow(/not an array/);
  });
});

describe("mapUetTags", () => {
  it("maps a tag to a flat summary and never includes the tracking script", () => {
    const result = mapUetTags([
      {
        Id: "73011782",
        Name: "Pathfinder AI UET Tag",
        Description: "d",
        TrackingStatus: "Active",
        TrackingScript: "<script>big</script>",
        CustomerShare: { OwnerCustomerId: "159333588" },
      },
    ]);
    expect(result).toEqual([
      { id: "73011782", name: "Pathfinder AI UET Tag", description: "d", status: "Active", owner_customer_id: "159333588" },
    ]);
  });

  it("uses null for missing fields and drops tags without an Id", () => {
    expect(mapUetTags([{ Id: 5 }, { Name: "no id" } as any])).toEqual([
      { id: "5", name: null, description: null, status: null, owner_customer_id: null },
    ]);
  });
});

describe("buildAddUetTagBody", () => {
  it("builds a one-tag request", () => {
    expect(buildAddUetTagBody("ZZZ | MCP TEST", "desc")).toEqual({
      UetTags: [{ Name: "ZZZ | MCP TEST", Description: "desc" }],
    });
  });

  it("omits the description when not given", () => {
    expect(buildAddUetTagBody("T")).toEqual({ UetTags: [{ Name: "T" }] });
  });

  it("rejects an empty or over-long name before calling Microsoft", () => {
    expect(() => buildAddUetTagBody("")).toThrow(/name/i);
    expect(() => buildAddUetTagBody("   ")).toThrow(/name/i);
    expect(() => buildAddUetTagBody("x".repeat(101))).toThrow(/100/);
  });
});

describe("buildAddUetTagBody (description checks)", () => {
  it("rejects a non-string or over-long description", () => {
    expect(() => buildAddUetTagBody("T", 5 as any)).toThrow(/description/);
    expect(() => buildAddUetTagBody("T", "x".repeat(1025))).toThrow(/description/);
  });
});

describe("findTagByName", () => {
  const tags = [{ id: "1", name: "Pathfinder AI UET Tag", description: null, status: null, owner_customer_id: null }];
  it("matches case-insensitively and ignores surrounding spaces", () => {
    expect(findTagByName(tags, "  pathfinder ai uet tag ")?.id).toBe("1");
  });
  it("returns null when there is no tag with that name", () => {
    expect(findTagByName(tags, "other")).toBeNull();
  });
});

describe("extractCreatedUetTag", () => {
  it("returns the created tag including its tracking script", () => {
    const tag = extractCreatedUetTag({
      UetTags: [{ Id: "999", Name: "T", Description: "d", TrackingStatus: "Unverified", TrackingScript: "<script>ti:\"999\"</script>" }],
      PartialErrors: [],
    });
    expect(tag).toEqual({
      id: "999",
      name: "T",
      description: "d",
      status: "Unverified",
      tracking_script: "<script>ti:\"999\"</script>",
    });
  });

  it("throws with Microsoft's message when the tag was rejected", () => {
    expect(() =>
      extractCreatedUetTag({
        UetTags: [null],
        PartialErrors: [{ ErrorCode: "InvalidUetTagName", Message: "The UET Tag name is empty or exceeds the length limit." }],
      }),
    ).toThrow(/InvalidUetTagName.*exceeds the length limit/);
  });

  it("throws when nothing came back at all", () => {
    expect(() => extractCreatedUetTag({ UetTags: [], PartialErrors: [] })).toThrow(/no tag/i);
  });
});
