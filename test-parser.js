const sample = `
54290 Trier
EUR
293179 Milde Satte 11 1,39 B
DO00291 Pfand 0,25 B
205266 Fier a Boden OKT 2.49 A
653219 GE oBriegel Mi 1,59 A
2205502 Apfel Gala lky 1,79 A
191415 Supreme R&( 2,79 4
K-U-N-D-E-N-B-E-L-E G
Bezahlung VISA PREPAID
Beitrag 10,30 EUR
25.04.2026 14:59 T-1D 65119766
`;

function normalizeAmount(value) {
  if (!value) return "";
  const compact = String(value).replace(/\s/g, "");
  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  const decimalIndex = Math.max(commaIndex, dotIndex);
  if (decimalIndex === -1) return Number(compact.replace(/[^\d]/g, ""));
  const whole = compact.slice(0, decimalIndex).replace(/[^\d]/g, "");
  const cents = compact.slice(decimalIndex + 1).replace(/[^\d]/g, "").slice(0, 2);
  return Number(`${whole}.${cents.padEnd(2, "0")}`);
}

function amountsInLine(line) {
  const pattern = /(?:eur|usd|gbp|chf|\$|£)?\s*(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2,3}))\s*(?:eur|usd|gbp|chf|\$|£)?/gi;
  return Array.from(line.matchAll(pattern)).map((match) => normalizeAmount(match[1])).filter((amount) => Number.isFinite(amount));
}

function findTotalAmount(lines) {
  const totalCandidates = [];
  lines.forEach((line, index) => {
    if (/(betrag|beitrag|summe|sum\b|gesamtbetrag|gesamt|total|final|zu zahlen)/i.test(line) && !/(rueckgeld|rückgeld|change|balance)/i.test(line)) {
      const sameLineAmounts = amountsInLine(line);
      totalCandidates.push(...(sameLineAmounts.length ? sameLineAmounts : amountsInLine([lines[index + 1] || "", lines[index - 1] || ""].join(" "))));
    }
  });
  return totalCandidates.at(-1);
}

const lines = sample.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const total = findTotalAmount(lines);
if (total !== 10.3) {
  throw new Error(`Expected 10.3, got ${total}`);
}
console.log("Parser regression passed:", total);
