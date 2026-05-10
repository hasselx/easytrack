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

function priceAmountsInLine(line) {
  const pattern = /(?:eur|usd|gbp|chf|\$|£)?\s*(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2,3}))\s*(?:eur|usd|gbp|chf|\$|£)?/gi;
  return Array.from(line.matchAll(pattern))
    .filter((match) => {
      const before = line.slice(Math.max(0, match.index - 4), match.index);
      const after = line.slice(match.index + match[0].length, match.index + match[0].length + 6);
      return !/[*xX]\s*$/.test(before) && !/^\s*(kg|g|l|ml|stk|x\b|\*)/i.test(after);
    })
    .map((match) => normalizeAmount(match[1]))
    .filter((amount) => Number.isFinite(amount));
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

function mergeParsedReceipt(aiParsed, ruleParsed) {
  const merged = { ...ruleParsed, ...aiParsed };
  if (ruleParsed.amount !== "" && ruleParsed.amount != null) {
    merged.amount = ruleParsed.amount;
  }
  if (Array.isArray(ruleParsed.line_items) && ruleParsed.line_items.length > 0) {
    merged.line_items = ruleParsed.line_items;
  }
  return merged;
}

const lines = sample.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const total = findTotalAmount(lines);
if (total !== 10.3) {
  throw new Error(`Expected 10.3, got ${total}`);
}

const merged = mergeParsedReceipt(
  { amount: 2.79, line_items: [{ item_name: "wrong", total_price: 2.79 }] },
  {
    amount: total,
    line_items: [
      { item_name: "Milde Satte 11", total_price: 1.39 },
      { item_name: "Pfand", total_price: 0.25 }
    ]
  }
);

if (merged.amount !== 10.3 || merged.line_items.length !== 2) {
  throw new Error(`Expected rule parser to win. Got ${JSON.stringify(merged)}`);
}

const weightedLinePrices = priceAmountsInLine("Apfel lose 2 x 0,69 kg 1,38");
if (weightedLinePrices.length !== 1 || weightedLinePrices[0] !== 1.38) {
  throw new Error(`Expected only rightmost line price 1.38, got ${JSON.stringify(weightedLinePrices)}`);
}

console.log("Parser regression passed:", total, "items:", merged.line_items.length, "weighted:", weightedLinePrices[0]);
