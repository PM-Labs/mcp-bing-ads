import { describe, it, expect } from "vitest";
import { extractAccountInfoArray, mapAccountInfo, filterAccounts } from "./accountsFilter.js";

describe("extractAccountInfoArray", () => {
  it("returns the AccountInfo array when present", () => {
    const response = { AccountInfo: [{ Id: 1, Name: "A" }] };
    expect(extractAccountInfoArray(response)).toEqual([{ Id: 1, Name: "A" }]);
  });

  it("returns an empty array when AccountInfo is null", () => {
    const response = { AccountInfo: null };
    expect(extractAccountInfoArray(response)).toEqual([]);
  });

  it("throws when the AccountInfo key is absent entirely", () => {
    expect(() => extractAccountInfoArray({})).toThrow(/missing AccountInfo key/);
  });

  it("throws when the response is not an object", () => {
    expect(() => extractAccountInfoArray(null)).toThrow(/expected an object/);
    expect(() => extractAccountInfoArray("oops")).toThrow(/expected an object/);
  });

  it("throws when AccountInfo is present but not an array or null", () => {
    expect(() => extractAccountInfoArray({ AccountInfo: "not-an-array" })).toThrow(/not an array/);
  });
});

describe("mapAccountInfo", () => {
  it("maps a well-formed record", () => {
    const result = mapAccountInfo([{ Id: 176795228, Name: "Area Office", Number: "C123ABC", AccountLifeCycleStatus: "Active" }]);
    expect(result).toEqual([{ account_id: "176795228", account_number: "C123ABC", account_name: "Area Office", status: "Active" }]);
  });

  it("skips a record missing Id", () => {
    const result = mapAccountInfo([{ Name: "No ID" } as any]);
    expect(result).toEqual([]);
  });

  it("skips a record missing Name", () => {
    const result = mapAccountInfo([{ Id: 1 } as any]);
    expect(result).toEqual([]);
  });

  it("defaults a missing Number to '0'", () => {
    const result = mapAccountInfo([{ Id: 1, Name: "No Number" }]);
    expect(result[0].account_number).toBe("0");
  });

  it("defaults a missing AccountLifeCycleStatus to 'Unknown', not 'Active'", () => {
    const result = mapAccountInfo([{ Id: 1, Name: "No Status" }]);
    expect(result[0].status).toBe("Unknown");
  });

  it("coerces numeric Id and Number to strings", () => {
    const result = mapAccountInfo([{ Id: 42, Name: "Numeric", Number: 999 }]);
    expect(result[0].account_id).toBe("42");
    expect(result[0].account_number).toBe("999");
  });
});

describe("filterAccounts", () => {
  const accounts = [
    { account_id: "1", account_number: "A1", account_name: "Area Office", status: "Active" },
    { account_id: "2", account_number: "A2", account_name: "Pathfinder Test Client", status: "Paused" },
    { account_id: "3", account_number: "A3", account_name: "area rug company", status: "Active" },
  ];

  it("returns all accounts when neither filter is supplied", () => {
    expect(filterAccounts(accounts, {})).toEqual(accounts);
  });

  it("treats an empty-string nameFilter as not supplied", () => {
    expect(filterAccounts(accounts, { nameFilter: "" })).toEqual(accounts);
  });

  it("treats an empty-string accountId as not supplied", () => {
    expect(filterAccounts(accounts, { accountId: "" })).toEqual(accounts);
  });

  it("matches by case-insensitive substring on name", () => {
    const result = filterAccounts(accounts, { nameFilter: "area" });
    expect(result.map((a) => a.account_id)).toEqual(["1", "3"]);
  });

  it("returns an empty array when no name matches", () => {
    expect(filterAccounts(accounts, { nameFilter: "nonexistent-brand" })).toEqual([]);
  });

  it("matches by exact account_id", () => {
    const result = filterAccounts(accounts, { accountId: "2" });
    expect(result).toEqual([accounts[1]]);
  });

  it("coerces a numeric accountId before matching", () => {
    const result = filterAccounts(accounts, { accountId: 2 });
    expect(result).toEqual([accounts[1]]);
  });

  it("accountId takes precedence over nameFilter when both are supplied", () => {
    const result = filterAccounts(accounts, { accountId: "2", nameFilter: "area" });
    expect(result).toEqual([accounts[1]]);
  });
});
