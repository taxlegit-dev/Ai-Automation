// GET /api/analysis - the five use cases, findings and summary for the sample company. Requires a participant token.
import { getWorkshopData } from "../lib/workshop.mjs";
import { allowMethod, json, requireParticipant } from "../lib/http.mjs";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  const p = requireParticipant(req, res);
  if (!p) return;
  try {
    const d = getWorkshopData();
    const byUc = {};
    for (const f of d.findings) byUc[f.uc] = (byUc[f.uc] || 0) + 1;
    return json(res, 200, {
      company: d.company,
      asOf: d.asOf,
      counts: d.counts,
      summary: d.summary,
      countsByUseCase: byUc,
      findings: d.findings,
      participant: { name: p.name, email: p.email, phone: p.phone },
      notice: "Analysis uses sample data from a Tally test company. Tally is not connected in this workshop.",
    });
  } catch (err) {
    console.error("analysis failed:", err.message);
    return json(res, 500, { error: "The sample analysis could not be loaded." });
  }
}
