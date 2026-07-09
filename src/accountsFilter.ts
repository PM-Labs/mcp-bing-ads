export interface RawAccountInfo {
  Id?: string | number | null;
  Name?: string | null;
  Number?: string | number | null;
  AccountLifeCycleStatus?: string | null;
}

export interface MappedAccount {
  account_id: string;
  account_number: string;
  account_name: string;
  status: string;
}

export function extractAccountInfoArray(response: unknown): RawAccountInfo[] {
  if (response === null || typeof response !== "object") {
    throw new Error("Malformed GetAccountsInfo response: expected an object");
  }
  if (!("AccountInfo" in response)) {
    throw new Error("Malformed GetAccountsInfo response: missing AccountInfo key");
  }
  const raw = (response as { AccountInfo: unknown }).AccountInfo;
  if (raw === null || raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error("Malformed GetAccountsInfo response: AccountInfo is not an array");
  }
  return raw as RawAccountInfo[];
}

export function mapAccountInfo(raw: RawAccountInfo[]): MappedAccount[] {
  const mapped: MappedAccount[] = [];
  for (const entry of raw) {
    if (entry.Id === undefined || entry.Id === null || entry.Id === "") continue;
    if (entry.Name === undefined || entry.Name === null || entry.Name === "") continue;
    const number = entry.Number === undefined || entry.Number === null || entry.Number === "" ? "0" : String(entry.Number);
    const status = entry.AccountLifeCycleStatus === undefined || entry.AccountLifeCycleStatus === null || entry.AccountLifeCycleStatus === "" ? "Unknown" : entry.AccountLifeCycleStatus;
    mapped.push({
      account_id: String(entry.Id),
      account_number: number,
      account_name: entry.Name,
      status,
    });
  }
  return mapped;
}

export function filterAccounts(
  accounts: MappedAccount[],
  opts: { nameFilter?: string; accountId?: string | number },
): MappedAccount[] {
  const hasAccountId = opts.accountId !== undefined && opts.accountId !== null && String(opts.accountId).length > 0;
  if (hasAccountId) {
    const target = String(opts.accountId);
    return accounts.filter((a) => a.account_id === target);
  }
  const hasNameFilter = typeof opts.nameFilter === "string" && opts.nameFilter.length > 0;
  if (hasNameFilter) {
    const needle = opts.nameFilter!.toLowerCase();
    return accounts.filter((a) => a.account_name.toLowerCase().includes(needle));
  }
  return accounts;
}
