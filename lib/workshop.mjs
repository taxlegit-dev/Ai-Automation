// Loads the Kalindi Tally export from data/tally_import, runs the five use cases once per instance and caches the result.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLedgers, parseVouchers } from "./tally.mjs";
import { analyse } from "./analysis.mjs";
import { config } from "./config.mjs";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "tally_import");
let cached = null;

export function getWorkshopData() {
  if (cached) return cached;
  const read = (f) => fs.readFileSync(path.join(DATA_DIR, f), "utf8");
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".xml")).sort();
  const ledgers = parseLedgers(read("01_masters.xml"));
  const vouchers = files.filter((f) => f.includes("vouchers")).flatMap((f) => parseVouchers(read(f)));
  const asOf = vouchers.reduce((m, v) => (v.date > m ? v.date : m), "");
  const result = analyse({ ledgers, vouchers, asOf });
  cached = {
    company: config().companyName,
    asOf,
    counts: { ledgers: ledgers.length, vouchers: vouchers.length, bills: result.bills.length },
    summary: result.summary,
    findings: result.findings,
    bills: result.bills,
  };
  return cached;
}

export const findFinding = (id) => getWorkshopData().findings.find((f) => f.id === id) || null;
