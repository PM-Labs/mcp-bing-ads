import { describe, it, expect } from "vitest";
import { decidePollOutcome } from "./reportPoll.js";

describe("decidePollOutcome", () => {
  it("downloads when the report succeeded with a URL", () => {
    expect(decidePollOutcome("Success", "https://example.test/report.zip")).toEqual({
      action: "download",
      url: "https://example.test/report.zip",
    });
  });

  it("returns empty when the report succeeded without a URL (no data in the period)", () => {
    expect(decidePollOutcome("Success", undefined)).toEqual({ action: "empty" });
    expect(decidePollOutcome("Success", "")).toEqual({ action: "empty" });
  });

  it("fails when Bing reports an error", () => {
    expect(decidePollOutcome("Error", undefined)).toEqual({ action: "error" });
  });

  it("keeps waiting while the report is still being generated", () => {
    expect(decidePollOutcome("Pending", undefined)).toEqual({ action: "wait" });
    expect(decidePollOutcome("InProgress", undefined)).toEqual({ action: "wait" });
  });
});
