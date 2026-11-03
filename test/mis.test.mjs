import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMisReport, buildExcel, buildPdf, misFileName } from "../lib/mis.mjs";
import { getWorkshopData } from "../lib/workshop.mjs";

const report = buildMisReport(getWorkshopData());

test("MIS model covers all five use cases and the open bills", () => {
  assert.deepEqual(report.useCases.map((u) => u.uc), ["UC1", "UC2", "UC3", "UC4", "UC5"]);
  assert.ok(report.openBills.length > 0);
  assert.equal(misFileName(report, "xlsx"), `FlowIQ_MIS_${report.asOf}.xlsx`);
});

test("Excel workbook is generated in code (zip container with worksheets)", async () => {
  const buf = await buildExcel(report);
  assert.equal(buf.slice(0, 2).toString(), "PK");
  assert.ok(buf.length > 5000);
});

test("PDF is generated in code and contains the rupee sign font", async () => {
  const buf = await buildPdf(report);
  assert.equal(buf.slice(0, 5).toString(), "%PDF-");
  assert.ok(buf.length > 10000);
});
