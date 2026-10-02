export interface RawUetTag {
  Id?: string | number | null;
  Name?: string | null;
  Description?: string | null;
  TrackingStatus?: string | null;
  TrackingScript?: string | null;
  CustomerShare?: { OwnerCustomerId?: string | number | null } | null;
}

export interface UetTagSummary {
  id: string;
  name: string | null;
  description: string | null;
  status: string | null;
  owner_customer_id: string | null;
}

export interface CreatedUetTag {
  id: string;
  name: string | null;
  description: string | null;
  status: string | null;
  tracking_script: string | null;
}

const orNull = (v: unknown): string | null =>
  v === undefined || v === null || v === "" ? null : String(v);

export function extractUetTagsArray(response: unknown): RawUetTag[] {
  if (response === null || typeof response !== "object") {
    throw new Error("Malformed GetUetTagsByIds response: expected an object");
  }
  if (!("UetTags" in response)) {
    throw new Error("Malformed GetUetTagsByIds response: missing UetTags key");
  }
  const raw = (response as { UetTags: unknown }).UetTags;
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new Error("Malformed GetUetTagsByIds response: UetTags is not an array");
  }
  return raw as RawUetTag[];
}

/** The tracking script is deliberately left out: it is large and only needed once, at creation. */
export function mapUetTags(raw: RawUetTag[]): UetTagSummary[] {
  const mapped: UetTagSummary[] = [];
  for (const t of raw) {
    if (t.Id === undefined || t.Id === null || t.Id === "") continue;
    mapped.push({
      id: String(t.Id),
      name: orNull(t.Name),
      description: orNull(t.Description),
      status: orNull(t.TrackingStatus),
      owner_customer_id: orNull(t.CustomerShare?.OwnerCustomerId),
    });
  }
  return mapped;
}

export function findTagByName(tags: UetTagSummary[], name: string): UetTagSummary | null {
  const wanted = (name ?? "").trim().toLowerCase();
  return tags.find((t) => (t.name ?? "").trim().toLowerCase() === wanted) ?? null;
}

export function buildAddUetTagBody(name: string, description?: string): { UetTags: Array<{ Name: string; Description?: string }> } {
  if (description !== undefined && (typeof description !== "string" || description.length > 1024)) {
    throw new Error("description must be text of 1024 characters or fewer");
  }
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new Error("name is required (1-100 characters)");
  if (trimmed.length > 100) throw new Error(`name is too long (${trimmed.length} characters; the limit is 100)`);
  const tag: { Name: string; Description?: string } = { Name: trimmed };
  if (description !== undefined && description !== "") tag.Description = description;
  return { UetTags: [tag] };
}

export function extractCreatedUetTag(response: unknown): CreatedUetTag {
  const r = (response ?? {}) as { UetTags?: unknown; PartialErrors?: unknown };
  const errors = Array.isArray(r.PartialErrors) ? (r.PartialErrors as any[]) : [];
  const tags = Array.isArray(r.UetTags) ? (r.UetTags as Array<RawUetTag | null>) : [];
  const tag = tags.find((t) => t && t.Id !== undefined && t.Id !== null);
  if (!tag) {
    if (errors.length > 0) {
      throw new Error(
        "Microsoft rejected the tag: " +
          errors.map((e) => `${e?.ErrorCode ?? "Error"}: ${e?.Message ?? "unknown"}`).join("; "),
      );
    }
    throw new Error("Microsoft returned no tag and no error");
  }
  return {
    id: String(tag.Id),
    name: orNull(tag.Name),
    description: orNull(tag.Description),
    status: orNull(tag.TrackingStatus),
    tracking_script: orNull(tag.TrackingScript),
  };
}
