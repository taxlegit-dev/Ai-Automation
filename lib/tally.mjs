// Reads Tally XML exports (masters + vouchers) into plain objects.
// Only the fields the workshop analysis needs are read.

const text = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decodeXml(m[1].trim()) : "";
};

export function decodeXml(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const num = (s) => {
  const n = parseFloat(String(s || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function parseCreditDays(s) {
  const m = String(s || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export function parseLedgers(xml) {
  const out = [];
  const re = /<LEDGER NAME="([^"]*)"[^>]*>([\s\S]*?)<\/LEDGER>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[2];
    const name = decodeXml(m[1]);
    out.push({
      name,
      parent: text(b, "PARENT"),
      billWise: text(b, "ISBILLWISEON") === "Yes",
      creditDays: parseCreditDays(text(b, "BILLCREDITPERIOD")),
      creditLimit: num(text(b, "CREDITLIMIT")),
      gstin: text(b, "PARTYGSTIN"),
      contact: text(b, "LEDGERCONTACT"),
      mobile: text(b, "LEDGERMOBILE"),
      email: text(b, "EMAIL"),
      address: (b.match(/<ADDRESS>([\s\S]*?)<\/ADDRESS>/) || [])[1] ? decodeXml(b.match(/<ADDRESS>([\s\S]*?)<\/ADDRESS>/)[1]) : "",
    });
  }
  return out;
}

// Splits one voucher into its ledger entries, each with bill allocations.
function parseEntries(vb) {
  const entries = [];
  const parts = vb.split("<ALLLEDGERENTRIES.LIST>").slice(1);
  for (const p of parts) {
    const body = p.split("</ALLLEDGERENTRIES.LIST>")[0];
    const bills = [];
    const bre = /<BILLALLOCATIONS\.LIST>([\s\S]*?)<\/BILLALLOCATIONS\.LIST>/g;
    let bm;
    while ((bm = bre.exec(body))) {
      bills.push({
        name: text(bm[1], "NAME"),
        type: text(bm[1], "BILLTYPE"),
        amount: num(text(bm[1], "AMOUNT")),
      });
    }
    const bodyNoBills = body.replace(bre, "");
    entries.push({
      ledger: text(bodyNoBills, "LEDGERNAME"),
      isParty: text(bodyNoBills, "ISPARTYLEDGER") === "Yes",
      amount: num(text(bodyNoBills, "AMOUNT")),
      bills,
    });
  }
  return entries;
}

export function parseVouchers(xml) {
  const out = [];
  const re = /<VOUCHER [^>]*>([\s\S]*?)<\/VOUCHER>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const date = text(b, "DATE");
    out.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      type: text(b, "VOUCHERTYPENAME"),
      number: text(b, "VOUCHERNUMBER"),
      party: text(b, "PARTYLEDGERNAME"),
      narration: text(b, "NARRATION"),
      entries: parseEntries(b),
    });
  }
  return out;
}
