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

const paymentOnlySample = `
Milde Satte 11 1,39 B
Pfand 0,25 B
Fier a Boden OKT 2.49 A
Apfel Gala lky 1,79 A
Supreme R&( 2,79 4
K-U-N-D-E-N-B-E-L-E G
Bezahlung VISA PREPAID
EUR 10,30
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

function hasTotalKeyword(line) {
  return /(betrag|beitrag|summe|sum\b|gesamtbetrag|gesamt|total|final|zu zahlen|endsumme|rechnungsbetrag)/i.test(line);
}

function isPaymentLine(line) {
  return /(bezahlung|zahlung|bezahlt|visa|prepaid|debit|mastercard|maestro|amex|girocard|karte|card|ec-|barzahlung|cash|paypal|apple pay|google pay|approved)/i.test(line);
}

function isChangeOrTaxLine(line) {
  return /(rueckgeld|rückgeld|change|balance|zurueck|zurück|mwst|ust|vat|steuer|tax)/i.test(line);
}

function plausibleTotalAmounts(line) {
  if (isChangeOrTaxLine(line)) return [];
  if (/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(line) && !hasTotalKeyword(line) && !/\b(?:eur|usd|gbp|chf|€|\$|£)\b/i.test(line)) {
    return [];
  }
  return amountsInLine(line).filter((amount) => amount > 0 && amount < 10000);
}

function footerStartIndex(lines) {
  const index = lines.findIndex((line) => /(rueckgeld|rückgeld|steuer|mwst|ust|vat|datum|date|zeit|time|visa|mastercard|maestro|karte|card|ec-|girocard|bar|cash|gegeben|terminal|transaktion)/i.test(line));
  return index === -1 ? lines.length : index;
}

function findTotalAmountResult(lines) {
  for (const [index, line] of lines.entries()) {
    if (hasTotalKeyword(line) && !isChangeOrTaxLine(line)) {
      const sameLineAmounts = plausibleTotalAmounts(line);
      if (sameLineAmounts.length) return { amount: sameLineAmounts.at(-1), confidence: "high", source: "total-keyword" };

      const nearbyAmounts = [lines[index + 1] || "", lines[index - 1] || ""].flatMap(plausibleTotalAmounts);
      if (nearbyAmounts.length) return { amount: nearbyAmounts.at(-1), confidence: "medium", source: "near-total-keyword" };
    }
  }

  const paymentIndex = lines.findIndex(isPaymentLine);
  if (paymentIndex !== -1) {
    const paymentWindow = lines.slice(paymentIndex, Math.min(lines.length, paymentIndex + 7));
    const paymentAmounts = paymentWindow
      .filter((line) => !/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(line))
      .flatMap(plausibleTotalAmounts)
      .filter((amount) => amount >= 0.5 && amount < 10000);
    if (paymentAmounts.length) return { amount: paymentAmounts.at(-1), confidence: "medium", source: "payment-area" };
  }

  const bodyEnd = footerStartIndex(lines);
  const bodyAmounts = lines
    .slice(0, bodyEnd)
    .filter((line) => !/(tel|telefon|phone|www\.|http|ust|vat|steuer|mwst|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b)/i.test(line))
    .flatMap(priceAmountsInLine)
    .filter((amount) => amount > 0 && amount < 500);
  return bodyAmounts.length ? { amount: bodyAmounts.at(-1), confidence: "low", source: "last-body-price" } : { amount: "", confidence: "none", source: "" };
}

function mergeParsedReceipt(aiParsed, ruleParsed) {
  const merged = { ...ruleParsed, ...aiParsed };
  const ruleAmountIsConfident = ["high", "medium"].includes(ruleParsed._amount_confidence);
  if (ruleAmountIsConfident && ruleParsed.amount !== "" && ruleParsed.amount != null) {
    merged.amount = ruleParsed.amount;
  }
  if (Array.isArray(ruleParsed.line_items) && ruleParsed.line_items.length > 0) {
    merged.line_items = ruleParsed.line_items;
  }
  return merged;
}

function linesFrom(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

const keywordTotal = findTotalAmountResult(linesFrom(sample));
if (keywordTotal.amount !== 10.3 || keywordTotal.confidence !== "high") {
  throw new Error(`Expected high-confidence total 10.3, got ${JSON.stringify(keywordTotal)}`);
}

const paymentTotal = findTotalAmountResult(linesFrom(paymentOnlySample));
if (paymentTotal.amount !== 10.3 || paymentTotal.confidence !== "medium") {
  throw new Error(`Expected payment-area total 10.3, got ${JSON.stringify(paymentTotal)}`);
}

const weakTotal = findTotalAmountResult(linesFrom("Item one 1,00\nItem two 2,79"));
if (weakTotal.amount !== 2.79 || weakTotal.confidence !== "low") {
  throw new Error(`Expected low-confidence fallback 2.79, got ${JSON.stringify(weakTotal)}`);
}

const mergedWeak = mergeParsedReceipt({ amount: 10.3 }, { amount: 2.79, _amount_confidence: "low" });
if (mergedWeak.amount !== 10.3) {
  throw new Error(`Expected AI amount to survive weak rule amount, got ${JSON.stringify(mergedWeak)}`);
}

const mergedStrong = mergeParsedReceipt({ amount: 2.79 }, { amount: 10.3, _amount_confidence: "high" });
if (mergedStrong.amount !== 10.3) {
  throw new Error(`Expected confident rule amount to win, got ${JSON.stringify(mergedStrong)}`);
}

const weightedLinePrices = priceAmountsInLine("Apfel lose 2 x 0,69 kg 1,38");
if (weightedLinePrices.length !== 1 || weightedLinePrices[0] !== 1.38) {
  throw new Error(`Expected only rightmost line price 1.38, got ${JSON.stringify(weightedLinePrices)}`);
}

console.log("Parser regression passed:", keywordTotal, paymentTotal, "weighted:", weightedLinePrices[0]);
