import { ComparisonError } from "./errors.js";
import type { ComparisonIssue, ComparisonResult, ComparisonSource, RiskLevel } from "./types.js";

export interface ExtractedValue {
  raw: string;
  normalized: string;
  start: number;
  end: number;
  currency?: string;
  isTotal?: boolean;
}

const CURRENCY_CODES = [
  "IDR",
  "USD",
  "EUR",
  "GBP",
  "SGD",
  "MYR",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "INR",
  "KRW",
  "THB",
  "PHP",
  "VND",
];

const SYMBOL_CURRENCY: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

function normalizeAmount(raw: string): number | null {
  let value = raw.replace(/[^\d.,+-]/g, "").trim();
  if (!value) return null;

  const negative = value.startsWith("-");
  value = value.replace(/^[+-]/, "");
  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    value = value.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") {
      value = value.replace(",", ".");
    }
  } else if (lastDot !== -1) {
    if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
      value = value.replace(/\./g, "");
    }
  } else if (lastComma !== -1) {
    if (/^\d{1,3}(,\d{3})+$/.test(value)) {
      value = value.replace(/,/g, "");
    } else {
      value = value.replace(",", ".");
    }
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

function addMoney(
  values: ExtractedValue[],
  raw: string,
  displayRaw: string,
  currency: string,
  start: number,
  end: number,
  content: string,
): void {
  const amount = normalizeAmount(raw);
  if (amount === null) return;
  const context = content.slice(Math.max(0, start - 80), Math.min(content.length, end + 20));
  values.push({
    raw: displayRaw,
    normalized: `${currency}:${amount.toFixed(2)}`,
    start,
    end,
    currency,
    isTotal: /\b(total|amount|grand total|balance|due|jumlah|tagihan|harga|price|subtotal)\b/i.test(
      context,
    ),
  });
}

export function extractMoney(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const codePattern = CURRENCY_CODES.join("|");

  const prefix = new RegExp(`\\b(${codePattern})\\s*([-+]?\\d[\\d.,]*)`, "gi");
  let match: RegExpExecArray | null;
  while ((match = prefix.exec(content)) !== null) {
    addMoney(
      values,
      match[2] ?? "",
      match[0],
      match[1] ?? "",
      match.index,
      match.index + match[0].length,
      content,
    );
  }

  const suffix = new RegExp(`([-+]?\\d[\\d.,]*)\\s*(${codePattern})\\b`, "gi");
  while ((match = suffix.exec(content)) !== null) {
    addMoney(
      values,
      match[1] ?? "",
      match[0],
      match[2] ?? "",
      match.index,
      match.index + match[0].length,
      content,
    );
  }

  const symbols = /([$€£¥])\s*([-+]?\d[\d.,]*)/g;
  while ((match = symbols.exec(content)) !== null) {
    addMoney(
      values,
      match[2] ?? "",
      match[0],
      SYMBOL_CURRENCY[match[1] ?? ""] ?? "USD",
      match.index,
      match.index + match[0].length,
      content,
    );
  }

  return dedupeExtracted(values);
}

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

export function extractDates(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];

  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = iso.exec(content)) !== null) {
    values.push({
      raw: match[0],
      normalized: `${match[1]}-${match[2]?.padStart(2, "0")}-${match[3]?.padStart(2, "0")}`,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const numeric = /\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2}|\d{2})\b/g;
  while ((match = numeric.exec(content)) !== null) {
    let day = Number(match[1]);
    let month = Number(match[2]);
    if (day > 12 && month <= 12) {
      // Day-first input.
    } else if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    values.push({
      raw: match[0],
      normalized: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const named =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
  while ((match = named.exec(content)) !== null) {
    const month = MONTHS[(match[1] ?? "").toLowerCase()] ?? "01";
    values.push({
      raw: match[0],
      normalized: `${match[3]}-${month}-${match[2]?.padStart(2, "0")}`,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return dedupeExtracted(values);
}

export function extractNodeVersions(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const patterns = [
    /\bnode(?:\.js)?\b[^\n]{0,30}?(?:>=|>|=|v)?\s*(\d{1,2})(?:\.\d+)?/gi,
    /"node"\s*:\s*"[^"]*?(\d{1,2})(?:\.\d+)?"/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const major = Number(match[1]);
      if (!Number.isFinite(major)) continue;
      values.push({
        raw: match[0].trim(),
        normalized: String(major),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return dedupeExtracted(values);
}

export function extractVersions(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const moneySpans = extractMoney(content);
  const pattern = /\bv?(\d+\.\d+(?:\.\d+)?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const before = content.slice(Math.max(0, match.index - 12), match.index);
    const after = content.slice(match.index + match[0].length, match.index + match[0].length + 4);
    if (/\d{4}-$/.test(before) || /^-\d{2}/.test(after)) {
      continue;
    }
    if (/(?:Rp|IDR|USD|EUR|GBP|SGD|MYR|JPY|[$€£¥])\s*$/i.test(before)) {
      continue;
    }
    if (
      moneySpans.some(
        (span) => match && match.index < span.end && match.index + match[0].length > span.start,
      )
    ) {
      continue;
    }
    values.push({
      raw: match[0],
      normalized: match[1] ?? match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return dedupeExtracted(values);
}

export function extractUrls(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const pattern = /\bhttps?:\/\/[^\s"'<>)\]]+/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[0].replace(/[.,;:]+$/, "");
    values.push({
      raw,
      normalized: raw.toLowerCase(),
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return dedupeExtracted(values);
}

export function extractEmails(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const pattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    values.push({
      raw: match[0],
      normalized: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return dedupeExtracted(values);
}

export function extractFilenames(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const pattern =
    /\b(?:attachment|file|filename|document)\s*[:=]\s*["']?([\w.-]+\.(?:pdf|csv|xlsx?|docx?|zip|sql|json|yaml|yml|txt|png|jpe?g))["']?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1] ?? "";
    const start = match.index + match[0].indexOf(raw);
    values.push({
      raw,
      normalized: raw.toLowerCase(),
      start,
      end: start + raw.length,
    });
  }
  return dedupeExtracted(values);
}

export function extractIds(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const pattern =
    /\b(?:invoice|order|reference|ref|transaction|ticket)\s*(?:number|no\.?|#|:|=)?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[1] ?? "";
    const start = match.index + match[0].indexOf(raw);
    values.push({
      raw,
      normalized: raw.toUpperCase(),
      start,
      end: start + raw.length,
    });
  }
  return dedupeExtracted(values);
}

export function extractPercentages(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const pattern = /\b(\d+(?:\.\d+)?)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[0];
    values.push({
      raw,
      normalized: `${Number(match[1])}`,
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return dedupeExtracted(values);
}

export function extractQuantities(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  const pattern =
    /\b(\d[\d,.]*)\s*(files?|items?|units?|pcs|pieces?|kg|gb|mb|users?|records?|rows?|pages?)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const amount = (match[1] ?? "").replace(/,/g, "");
    const unit = (match[2] ?? "").toLowerCase().replace(/s$/, "");
    values.push({
      raw: match[0],
      normalized: `${amount}:${unit}`,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return dedupeExtracted(values);
}

function dedupeExtracted(values: ExtractedValue[]): ExtractedValue[] {
  const sorted = [...values].sort((a, b) => a.start - b.start);
  const kept: ExtractedValue[] = [];
  for (const value of sorted) {
    const duplicate = kept.some(
      (existing) =>
        existing.normalized === value.normalized && Math.abs(existing.start - value.start) < 2,
    );
    if (!duplicate) kept.push(value);
  }
  return kept;
}

function sourceValues(
  sources: ComparisonSource[],
  extractor: (content: string) => ExtractedValue[],
): Map<string, ExtractedValue[]> {
  const map = new Map<string, ExtractedValue[]>();
  for (const source of sources) {
    map.set(source.name, extractor(source.content));
  }
  return map;
}

function valuesBySource(map: Map<string, ExtractedValue[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, values] of map) {
    result[name] = [...new Set(values.map((value) => value.raw))].join(", ");
  }
  return result;
}

function hasEverySource(map: Map<string, ExtractedValue[]>, sourceCount: number): boolean {
  let populated = 0;
  for (const values of map.values()) {
    if (values.length > 0) populated += 1;
  }
  return populated === sourceCount;
}

function noIntersection(map: Map<string, ExtractedValue[]>): boolean {
  const sets = [...map.values()]
    .filter((values) => values.length > 0)
    .map((values) => new Set(values.map((value) => value.normalized)));
  if (sets.length < 2) return false;
  const [first, ...rest] = sets;
  if (!first) return false;
  return ![...first].some((value) => rest.every((set) => set.has(value)));
}

function exactlyOne(map: Map<string, ExtractedValue[]>): boolean {
  for (const values of map.values()) {
    const unique = new Set(values.map((value) => value.normalized));
    if (unique.size !== 1) return false;
  }
  return true;
}

function pushSetIssue(
  issues: ComparisonIssue[],
  type: string,
  severity: RiskLevel,
  message: string,
  map: Map<string, ExtractedValue[]>,
  recommendation: string,
  options: { requireExactlyOne?: boolean } = {},
): void {
  if (!hasEverySource(map, map.size)) return;
  if (options.requireExactlyOne && !exactlyOne(map)) return;
  if (!noIntersection(map)) return;
  issues.push({
    type,
    severity,
    message,
    values: valuesBySource(map),
    recommendation,
  });
}

export function compareSources(sources: ComparisonSource[]): ComparisonResult {
  if (sources.length < 2) {
    throw new ComparisonError("At least two sources are required for comparison.");
  }

  const usedNames = new Map<string, number>();
  const normalizedSources = sources.map((source) => {
    const count = usedNames.get(source.name) ?? 0;
    usedNames.set(source.name, count + 1);
    return count === 0 ? source : { ...source, name: `${source.name} (${count + 1})` };
  });

  const issues: ComparisonIssue[] = [];
  const checked = new Set<string>();

  const money = sourceValues(normalizedSources, extractMoney);
  const moneySources = [...money.values()].filter((values) => values.length > 0);
  if (moneySources.length >= 2) {
    checked.add("amount");
    const currencies = new Map<string, Set<string>>();
    for (const [name, values] of money) {
      const unique = new Set(values.map((value) => value.currency ?? "unknown"));
      if (unique.size === 1) {
        currencies.set(name, unique);
      }
    }
    if (currencies.size === money.size && currencies.size >= 2) {
      const all = new Set([...currencies.values()].flatMap((set) => [...set]));
      if (all.size > 1) {
        const values: Record<string, string> = {};
        for (const [name, set] of currencies) values[name] = [...set].join(", ");
        issues.push({
          type: "currency_mismatch",
          severity: "high",
          message: "The sources use different currencies.",
          values,
          recommendation: "Confirm the intended currency before acting on the amount.",
        });
      }
    }

    const selected = new Map<string, ExtractedValue[]>();
    for (const [name, values] of money) {
      if (values.length === 0) continue;
      const totals = values.filter((value) => value.isTotal);
      selected.set(name, totals.length > 0 ? totals : values);
    }
    if (selected.size >= 2 && noIntersection(selected)) {
      issues.push({
        type: "amount_mismatch",
        severity: "high",
        message: "The sources report different amounts.",
        values: valuesBySource(selected),
        recommendation: "Stop and confirm the correct amount with the user or source document.",
      });
    }
  }

  const dates = sourceValues(normalizedSources, extractDates);
  if ([...dates.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("date");
    pushSetIssue(
      issues,
      "date_mismatch",
      "high",
      "The sources report different dates.",
      dates,
      "Confirm the intended date before acting.",
    );
  }

  const nodeVersions = sourceValues(normalizedSources, extractNodeVersions);
  if ([...nodeVersions.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("node_version");
    pushSetIssue(
      issues,
      "version_mismatch",
      "high",
      "The sources disagree about the required Node.js version.",
      nodeVersions,
      "Align the documented runtime version with the project configuration.",
    );
  }

  const versions = sourceValues(normalizedSources, extractVersions);
  if ([...versions.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("version");
    pushSetIssue(
      issues,
      "version_mismatch",
      "high",
      "The sources report different versions.",
      versions,
      "Confirm which version is authoritative.",
    );
  }

  const urls = sourceValues(normalizedSources, extractUrls);
  if ([...urls.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("url");
    pushSetIssue(
      issues,
      "url_mismatch",
      "medium",
      "The sources point to different URLs.",
      urls,
      "Confirm the intended destination before acting.",
      { requireExactlyOne: true },
    );
  }

  const emails = sourceValues(normalizedSources, extractEmails);
  if ([...emails.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("email");
    pushSetIssue(
      issues,
      "email_mismatch",
      "medium",
      "The sources use different email addresses.",
      emails,
      "Confirm the intended recipient before sending.",
      { requireExactlyOne: true },
    );
  }

  const filenames = sourceValues(normalizedSources, extractFilenames);
  if ([...filenames.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("filename");
    pushSetIssue(
      issues,
      "filename_mismatch",
      "medium",
      "The sources reference different files.",
      filenames,
      "Confirm the intended attachment before acting.",
      { requireExactlyOne: true },
    );
  }

  const ids = sourceValues(normalizedSources, extractIds);
  if ([...ids.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("identifier");
    pushSetIssue(
      issues,
      "id_mismatch",
      "medium",
      "The sources reference different identifiers.",
      ids,
      "Confirm the intended record before acting.",
    );
  }

  const percentages = sourceValues(normalizedSources, extractPercentages);
  if ([...percentages.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("percentage");
    pushSetIssue(
      issues,
      "percentage_mismatch",
      "medium",
      "The sources report different percentages.",
      percentages,
      "Confirm the intended percentage before acting.",
    );
  }

  const quantities = sourceValues(normalizedSources, extractQuantities);
  if ([...quantities.values()].filter((values) => values.length > 0).length >= 2) {
    checked.add("quantity");
    pushSetIssue(
      issues,
      "quantity_mismatch",
      "medium",
      "The sources report different quantities.",
      quantities,
      "Confirm the intended quantity before acting.",
    );
  }

  return {
    matches: issues.length === 0,
    issues,
    checked: [...checked].sort(),
  };
}
