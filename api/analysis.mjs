// GET /api/analysis - findings with a preview of what each action will do, plus overview metrics. Requires a participant token.
import { getWorkshopData } from "../lib/workshop.mjs";
import { buildPreview } from "../lib/preview.mjs";
import { allowMethod, json, requireParticipant } from "../lib/http.mjs";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  const p = requireParticipant(req, res);
  if (!p) return;
  try {
    const d = getWorkshopData();
    const byUc = {};
    for (const f of d.findings) byUc[f.uc] = (byUc[f.uc] || 0) + 1;
    const participant = { name: p.name, email: p.email, phone: p.phone };
    return json(res, 200, {
      company: d.company,
      asOf: d.asOf,
      counts: d.counts,
      summary: d.summary,
      metrics: d.metrics,
      countsByUseCase: byUc,
      findings: d.findings.map((f) => ({ ...f, preview: buildPreview(f, d, participant) })),
      participant,
      notice: "Analysis uses sample data from a Tally test company. Tally is not connected in this workshop.",
    });
  } catch (err) {
    console.error("analysis failed:", err.message);
    return json(res, 500, { error: "The sample analysis could not be loaded." });
  }
}
