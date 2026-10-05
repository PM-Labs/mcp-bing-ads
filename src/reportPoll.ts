export type PollDecision =
  | { action: "download"; url: string }
  | { action: "empty" }
  | { action: "error" }
  | { action: "wait" };

// What waitForReport should do with one PollGenerateReport result.
// Bing reports a finished request with no rows (no activity in the period) as
// Status "Success" with no ReportDownloadUrl. Treating that as "keep polling"
// spun every such call out to the 120s timeout -- seen 2026-10-05 on five
// accounts whose campaigns were all paused, so their report was simply empty.
export function decidePollOutcome(status: string, url?: string): PollDecision {
  if (status === "Success") {
    return url ? { action: "download", url } : { action: "empty" };
  }
  if (status === "Error") return { action: "error" };
  return { action: "wait" };
}
