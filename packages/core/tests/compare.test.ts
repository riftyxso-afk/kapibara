import { describe, expect, it } from "vitest";

import {
  ComparisonError,
  compareSources,
  extractDates,
  extractMoney,
  extractNodeVersions,
} from "@kapibara/core";

describe("compareSources", () => {
  it("detects amount mismatches", () => {
    const result = compareSources([
      { name: "invoice", content: "Total: $1,200.00 due 2026-01-01" },
      { name: "email", content: "Total: $1,500.00 due 2026-01-01" },
    ]);

    expect(result.matches).toBe(false);
    expect(result.issues.map((issue) => issue.type)).toContain("amount_mismatch");
  });

  it("detects date mismatches", () => {
    const result = compareSources([
      { name: "a", content: "Delivery date: 2026-01-01" },
      { name: "b", content: "Delivery date: 2026-02-01" },
    ]);

    expect(result.issues.map((issue) => issue.type)).toContain("date_mismatch");
  });

  it("detects email mismatches", () => {
    const result = compareSources([
      { name: "a", content: "Contact billing@example.com" },
      { name: "b", content: "Contact support@example.com" },
    ]);

    expect(result.issues.map((issue) => issue.type)).toContain("email_mismatch");
  });

  it("detects Node.js version mismatches", () => {
    const result = compareSources([
      { name: "readme", content: "Requires Node.js >=20" },
      { name: "package", content: '"node": ">=22"' },
    ]);

    expect(result.issues.map((issue) => issue.type)).toContain("version_mismatch");
  });

  it("detects URL mismatches", () => {
    const result = compareSources([
      { name: "a", content: "Endpoint: https://api.example.com/v1" },
      { name: "b", content: "Endpoint: https://staging.example.com/v1" },
    ]);

    expect(result.issues.map((issue) => issue.type)).toContain("url_mismatch");
  });

  it("detects currency mismatches", () => {
    const result = compareSources([
      { name: "a", content: "Total: $1,200" },
      { name: "b", content: "Total: €1,200" },
    ]);

    expect(result.issues.map((issue) => issue.type)).toContain("currency_mismatch");
  });

  it("returns matches when sources agree", () => {
    const result = compareSources([
      { name: "a", content: "Total: $1,200 due 2026-01-01" },
      { name: "b", content: "Total: $1,200 due 2026-01-01" },
    ]);

    expect(result.matches).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.checked).toEqual(expect.arrayContaining(["amount", "date"]));
  });

  it("renames duplicate source names without losing values", () => {
    const result = compareSources([
      { name: "copy", content: "Total: $1,200" },
      { name: "copy", content: "Total: $1,500" },
    ]);

    expect(result.issues[0]?.values).toHaveProperty("copy");
    expect(result.issues[0]?.values).toHaveProperty("copy (2)");
  });

  it("requires at least two sources", () => {
    expect(() => compareSources([{ name: "only", content: "Total: $1" }])).toThrow(ComparisonError);
  });
});

describe("extractors", () => {
  it("normalizes money values", () => {
    const values = extractMoney("Total: IDR 1.200.000 and $1,500.50");
    expect(values.map((value) => value.normalized)).toEqual(
      expect.arrayContaining(["IDR:1200000.00", "USD:1500.50"]),
    );
  });

  it("normalizes dates", () => {
    const values = extractDates("Due 2026-1-5 and 05/01/2026");
    expect(values.map((value) => value.normalized)).toEqual(expect.arrayContaining(["2026-01-05"]));
  });

  it("extracts Node.js major versions", () => {
    const values = extractNodeVersions("Requires Node.js >=20 and node 22");
    expect(values.map((value) => value.normalized)).toEqual(expect.arrayContaining(["20", "22"]));
  });
});
