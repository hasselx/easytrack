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

const aldiSplitLineSample = `
Aldi Süd
Ostallee 3
54290 Trier
229350 Kneblauch weiß200g FOR A
2x 0,99 ;
665548 Wraps Weizen 1,98 A
ALDI PREIS 2,97
] 3 Artikel
Kartenzahlung EUR 2,97
A 07,0% Netto 2,78 MwSt 0,19
x8626 BC86/006/802 19.05.26 15:50
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

function isSummaryLine(line) {
  return /(\baldi\s+preis\b|\b\d+\s+artikel\b|kundenbeleg|k-u-n-d-e-n-b-e-l-e-g|kartenzahlung)/i.test(line);
}

function plausibleTotalAmounts(line) {
  if (isChangeOrTaxLine(line)) return [];
  if (/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(line) && !hasTotalKeyword(line) && !/\b(?:eur|usd|gbp|chf|€|\$|£)\b/i.test(line)) {
    return [];
  }
  return amountsInLine(line).filter((amount) => amount > 0 && amount < 10000);
}

function isReceiptMetadataLine(line) {
  return isSummaryLine(line) || /(summe|gesamt|total|betrag|zu zahlen|subtotal|zwischensumme|mwst|ust|vat|steuer|tax|visa|mastercard|maestro|amex|karte|card|ec-|girocard|bar|cash|gegeben|rueckgeld|rückgeld|zurueck|zurück|change|balance|datum|date|zeit|time|bon|beleg|rechnung|terminal|transaktion|trace|auth|iban|bic|ust-id|ustid|tel|telefon|phone|www\.|http|kunden|filiale|öffnungszeiten|oeffnungszeiten)/i.test(line);
}

function footerStartIndex(lines) {
  const index = lines.findIndex((line) => isSummaryLine(line) || /(rueckgeld|rückgeld|steuer|mwst|ust|vat|datum|date|zeit|time|visa|mastercard|maestro|karte|card|ec-|girocard|bar|cash|gegeben|terminal|transaktion)/i.test(line));
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

function extractLineItems(lines) {
  const items = [];
  const amountPattern = /(?:eur|usd|gbp|chf|\$|£)?\s*(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2,3}))\s*(?:eur|usd|gbp|chf|\$|£)?/gi;
  const cleanItemName = (line) =>
    line
      .replace(amountPattern, "")
      .replace(/\d+(?:[,.]\d+)?\s*[*xX]\s*\d{1,4}(?:[,.]\d{2,3})/g, "")
      .replace(/^\s*[A-Z]{0,3}\d{3,}[A-Z0-9-]*\s+/i, "")
      .replace(/\b(?:FOR|VON|STK|KG|G|L|ML)\b/gi, " ")
      .replace(/\b[A-Z]\b\s*$/g, "")
      .replace(/[^\wÄÖÜäöüß .-]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  const isLikelyItemName = (itemName) =>
    /[a-zA-ZÄÖÜäöüß]{2,}/.test(itemName) &&
    itemName.replace(/[^a-zA-ZÄÖÜäöüß]/g, "").length >= 3 &&
    /[aeiouäöüAEIOUÄÖÜ]/.test(itemName) &&
    !isReceiptMetadataLine(itemName);
  const pushItem = (itemName, quantity, totalPrice) => {
    if (!totalPrice || totalPrice > 200 || !isLikelyItemName(itemName)) return;
    items.push({
      item_name: itemName || "[Unclear]",
      item_name_en: itemName || "[Unclear]",
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      total_price: Number(totalPrice.toFixed(2)),
      unclear: !itemName
    });
  };

  let pendingName = "";
  lines.slice(0, footerStartIndex(lines)).forEach((line) => {
    if (isReceiptMetadataLine(line)) {
      pendingName = "";
      return;
    }
    const multiplierMatch = line.match(/(\d+(?:[,.]\d+)?)\s*[*xX]\s*(\d{1,4}(?:[,.]\d{2,3}))/);
    const amounts = priceAmountsInLine(line);
    if (!amounts.length && multiplierMatch && pendingName) {
      const quantity = Number(multiplierMatch[1].replace(",", "."));
      const unitPrice = normalizeAmount(multiplierMatch[2]);
      pushItem(pendingName, quantity, quantity * unitPrice);
      pendingName = "";
      return;
    }
    const totalPrice = amounts.at(-1);
    if (!totalPrice) {
      const candidateName = cleanItemName(line);
      if (isLikelyItemName(candidateName)) pendingName = candidateName;
      return;
    }
    const quantityMatch = line.match(/(\d+(?:[,.]\d+)?)\s*[*xX]\s*\d{1,4}(?:[,.]\d{2})/);
    const quantity = quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : 1;
    pushItem(cleanItemName(line), quantity, totalPrice);
    pendingName = "";
  });
  return items;
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

const aldiLines = linesFrom(aldiSplitLineSample);
const aldiTotal = findTotalAmountResult(aldiLines);
const aldiItems = extractLineItems(aldiLines);
if (aldiTotal.amount !== 2.97) {
  throw new Error(`Expected Aldi payment total 2.97, got ${JSON.stringify(aldiTotal)}`);
}
if (!aldiItems.some((item) => /kneblauch|knoblauch/i.test(item.item_name) && item.quantity === 2 && item.total_price === 1.98)) {
  throw new Error(`Expected split-line Knoblauch item, got ${JSON.stringify(aldiItems)}`);
}
if (aldiItems.some((item) => /aldi\s+preis/i.test(item.item_name))) {
  throw new Error(`ALDI PREIS should not be a line item, got ${JSON.stringify(aldiItems)}`);
}

console.log("Parser regression passed:", keywordTotal, paymentTotal, "weighted:", weightedLinePrices[0], "aldi items:", aldiItems.length);
