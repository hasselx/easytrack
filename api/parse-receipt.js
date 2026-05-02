const receiptSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "merchant",
    "date",
    "time",
    "amount",
    "currency",
    "category",
    "tax",
    "payment_method",
    "cash_paid",
    "change_amount",
    "telephone",
    "address",
    "line_items",
    "notes"
  ],
  properties: {
    merchant: { type: "string" },
    date: { type: "string", description: "ISO date YYYY-MM-DD, or empty string if unknown." },
    time: { type: "string", description: "Receipt time in HH:MM, or empty string if unknown." },
    amount: { type: "number", description: "Final receipt total. Use -1 if unknown." },
    currency: { type: "string", description: "ISO currency code, for example EUR." },
    category: {
      type: "string",
      enum: ["Food", "Travel", "Shopping", "Health", "Housing", "Utilities", "Other"]
    },
    tax: { type: "number", description: "Tax/VAT amount. Use -1 if unknown." },
    payment_method: { type: "string", description: "Card, cash, wallet, or empty string." },
    cash_paid: { type: "number", description: "Cash tendered/given. Use -1 if unknown." },
    change_amount: { type: "number", description: "Returned balance/change. Use -1 if unknown." },
    telephone: { type: "string" },
    address: { type: "string" },
    line_items: {
      type: "array",
      description: "Main purchased items only. Exclude subtotals, tax/VAT lines, VAT IDs, payment lines, phone numbers, address lines, and receipt metadata.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item_name", "item_name_en", "quantity", "total_price", "unclear"],
        properties: {
          item_name: { type: "string", description: "Original item name from receipt, or [Unclear]." },
          item_name_en: { type: "string", description: "English item name if useful, or [Unclear]." },
          quantity: { type: "number", description: "Multiplier quantity when shown, otherwise 1." },
          total_price: { type: "number", description: "Final calculated price paid for this line item. Use -1 if unclear." },
          unclear: { type: "boolean" }
        }
      }
    },
    notes: { type: "string", description: "Short note about ambiguous or missing fields." }
  }
};

const categories = ["Food", "Travel", "Shopping", "Health", "Housing", "Utilities", "Other"];

function normalizeParsedReceipt(receipt) {
  const cleanNumber = (value) => {
    const number = typeof value === "number" ? value : Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) && number >= 0 ? number : "";
  };
  return {
    merchant: receipt.merchant || "",
    date: receipt.date || "",
    time: receipt.time || "",
    amount: cleanNumber(receipt.amount),
    currency: receipt.currency || "EUR",
    category: categories.includes(receipt.category) ? receipt.category : "Other",
    tax: cleanNumber(receipt.tax),
    payment_method: receipt.payment_method || "",
    cash_paid: cleanNumber(receipt.cash_paid),
    change_amount: cleanNumber(receipt.change_amount),
    telephone: receipt.telephone || "",
    address: receipt.address || "",
    line_items: Array.isArray(receipt.line_items)
      ? receipt.line_items.map((item) => ({
          item_name: item.item_name || "[Unclear]",
          item_name_en: item.item_name_en || item.item_name || "[Unclear]",
          quantity: cleanNumber(item.quantity) || 1,
          total_price: cleanNumber(item.total_price),
          unclear: Boolean(item.unclear)
        }))
      : [],
    notes: receipt.notes || ""
  };
}

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

function normalizeDate(value) {
  if (!value) return "";
  const isoMatch = value.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const localMatch = value.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!localMatch) return "";
  let [, day, month, year] = localMatch;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function amountsInLine(line) {
  const pattern = /(?:eur|usd|gbp|chf|\$|£)?\s*(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2,3}))\s*(?:eur|usd|gbp|chf|\$|£)?/gi;
  return Array.from(line.matchAll(pattern)).map((match) => normalizeAmount(match[1])).filter((amount) => Number.isFinite(amount));
}

function isReceiptMetadataLine(line) {
  return /(summe|gesamt|total|betrag|zu zahlen|subtotal|zwischensumme|mwst|ust|vat|steuer|tax|visa|mastercard|maestro|amex|karte|card|ec-|girocard|bar|cash|gegeben|rueckgeld|rückgeld|zurueck|zurück|change|balance|datum|date|zeit|time|bon|beleg|rechnung|terminal|transaktion|trace|auth|iban|bic|ust-id|ustid|tel|telefon|phone|www\.|http|kunden|filiale|öffnungszeiten|oeffnungszeiten)/i.test(line);
}

function footerStartIndex(lines) {
  const index = lines.findIndex((line) => /(rueckgeld|rückgeld|steuer|mwst|ust|vat|datum|date|zeit|time|visa|mastercard|maestro|karte|card|ec-|girocard|bar|cash|gegeben|terminal|transaktion)/i.test(line));
  return index === -1 ? lines.length : index;
}

function findTotalAmount(lines) {
  const totalCandidates = [];
  lines.forEach((line, index) => {
    if (/(betrag|beitrag|summe|sum\b|gesamtbetrag|gesamt|total|final|zu zahlen)/i.test(line) && !/(rueckgeld|rückgeld|change|balance)/i.test(line)) {
      const sameLineAmounts = amountsInLine(line);
      totalCandidates.push(...(sameLineAmounts.length ? sameLineAmounts : amountsInLine([lines[index + 1] || "", lines[index - 1] || ""].join(" "))));
    }
  });
  if (totalCandidates.length) return totalCandidates.at(-1);

  const bodyEnd = footerStartIndex(lines);
  const bodyAmounts = lines
    .slice(0, bodyEnd)
    .filter((line) => !/(tel|telefon|phone|www\.|http|ust|vat|steuer|mwst)/i.test(line))
    .flatMap(amountsInLine)
    .filter((amount) => amount > 0 && amount < 500);
  return bodyAmounts.length ? bodyAmounts.at(-1) : "";
}

function extractLineItems(lines) {
  const items = [];
  const amountPattern = /(?:eur|usd|gbp|chf|\$|£)?\s*(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2,3}))\s*(?:eur|usd|gbp|chf|\$|£)?/gi;

  lines.slice(0, footerStartIndex(lines)).forEach((line) => {
    if (isReceiptMetadataLine(line)) return;
    const amounts = amountsInLine(line);
    const totalPrice = amounts.at(-1);
    if (!totalPrice || totalPrice > 200) return;

    const quantityMatch = line.match(/(\d+(?:[,.]\d+)?)\s*[*xX]\s*\d{1,4}(?:[,.]\d{2})/);
    const quantity = quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : 1;
    const itemName = line
      .replace(amountPattern, "")
      .replace(/\d+(?:[,.]\d+)?\s*[*xX]\s*\d{1,4}(?:[,.]\d{2})/g, "")
      .replace(/^\d{3,}\s+/, "")
      .replace(/[^\wÄÖÜäöüß .-]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!/[a-zA-ZÄÖÜäöüß]{2,}/.test(itemName) || itemName.replace(/[^a-zA-ZÄÖÜäöüß]/g, "").length < 3 || !/[aeiouäöüAEIOUÄÖÜ]/.test(itemName)) return;
    items.push({
      item_name: itemName || "[Unclear]",
      item_name_en: itemName || "[Unclear]",
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      total_price: totalPrice,
      unclear: !itemName
    });
  });

  return items;
}

function parseReceiptByRules(text, fileName = "") {
  const lines = text
    .replace(/[|]/g, "1")
    .replace(/[€]/g, " EUR ")
    .replace(/\bO(?=\d)/g, "0")
    .replace(/(?<=\d)O\b/g, "0")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  const joined = lines.join("\n");
  const merchant = lines.find((line) => !isReceiptMetadataLine(line) && /[a-zA-ZÄÖÜäöüß]{2,}/.test(line)) || fileName.replace(/\.[^.]+$/, "") || "Unknown merchant";
  const dateMatch = joined.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/);
  const taxLine = lines.find((line) => /(tax|mwst|ust|vat)/i.test(line));
  const cashLine = lines.find((line) => /(cash|bar|gegeben|received|tendered)/i.test(line));
  const changeLine = lines.find((line) => /(change|rueckgeld|rückgeld|balance|zurueck|zurück)/i.test(line));
  const paymentLine = lines.find((line) => /(visa|mastercard|maestro|amex|card|karte|ec|cash|bar|paypal|apple pay|google pay)/i.test(line));
  const telephoneMatch = joined.match(/(?:tel\.?|telefon|phone)[:\s]*([+()0-9][+()0-9\s/-]{5,})/i) || joined.match(/(\+?\d[\d\s()/.-]{7,}\d)/);
  const addressLine = lines.find((line) => /\b\d{5}\b/.test(line) || /\b(strasse|straße|str\.|platz|allee|road|street|st\.)\b/i.test(line));
  const amount = findTotalAmount(lines);
  const lineItems = extractLineItems(lines).filter((item) => !amount || item.total_price <= amount + 0.01);

  return normalizeParsedReceipt({
    merchant,
    date: normalizeDate(dateMatch?.[0]),
    time: joined.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || "",
    amount,
    currency: /(?:eur)/i.test(joined) ? "EUR" : "EUR",
    category: "Other",
    tax: amountsInLine(taxLine || "").at(-1) ?? -1,
    payment_method: paymentLine || "",
    cash_paid: amountsInLine(cashLine || "").at(-1) ?? -1,
    change_amount: amountsInLine(changeLine || "").at(-1) ?? -1,
    telephone: telephoneMatch?.[1]?.trim() || "",
    address: addressLine || "",
    line_items: lineItems,
    notes: ""
  });
}

function mergeParsedReceipt(aiParsed, ruleParsed) {
  const merged = { ...ruleParsed, ...aiParsed };
  ["merchant", "date", "time", "amount", "currency", "tax", "payment_method", "cash_paid", "change_amount", "telephone", "address"].forEach((key) => {
    if (merged[key] === "" || merged[key] == null) merged[key] = ruleParsed[key];
  });
  if (!Array.isArray(merged.line_items) || merged.line_items.length === 0) {
    merged.line_items = ruleParsed.line_items;
  }
  return normalizeParsedReceipt(merged);
}

function receiptPrompt(text, fileName, language = "de") {
  const languageInstruction =
    language === "de"
      ? "The receipt is expected to be German. Interpret German retail terms first: Summe, Gesamtbetrag, Rückgeld, Steuer, MwSt, Bar, Karte, Datum, Zeit. Do not force English linguistic assumptions onto item names."
      : "The receipt is expected to be English. Interpret English receipt terms first, but still handle German words if present.";
  return `Extract structured receipt expense data as valid JSON only.

Return exactly these keys:
merchant, date, time, amount, currency, category, tax, payment_method, cash_paid, change_amount, telephone, address, line_items, notes.

Language:
- ${languageInstruction}

Receipt topology:
- Header: store name, branch address, phone or website.
- Body: purchased item lines. A line can contain an item ID, item name, and price.
- Quantifiers: lines may show multipliers such as "3 * 0,99"; use quantity 3 and the final calculated line total.
- Footer: Summe/Total, payment method such as Visa Debit or Visa Prepaid, date, and time.

Rules:
- date must be YYYY-MM-DD or empty string
- time must be HH:MM or empty string
- amount is the final receipt total. Treat Betrag, OCR typo Beitrag, Summe, Sum, Total, Final, Gesamtbetrag, Gesamt, and Zu zahlen as amount keywords. Do not use phone number, address, tax id, cash paid, returned change, or VAT table values as amount
- category must be one of Food, Travel, Shopping, Health, Housing, Utilities, Other
- unknown numeric values must be -1
- unknown text values must be empty strings
- currency should be EUR unless another currency is clearly present
- line_items must include only purchased items, not subtotal, tax, VAT ID, payment, phone, address, or receipt metadata rows
- if a line item has a calculation such as "2 * 2,49", quantity is 2 and total_price is the final calculated price paid for that item
- translate German item names to English in item_name_en when helpful
- if text is cropped or obscured, use "[Unclear]" for that item field and set unclear true

File name: ${fileName || "receipt"}

OCR text:
${text}`;
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("");
}

function extractJson(text) {
  const cleaned = String(text || "").replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI parser did not return JSON.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function parseWithHuggingFace(text, fileName, language) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY is not configured on the server.");
  }

  const model = process.env.HUGGINGFACE_MODEL || "google/flan-t5-large";
  const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: receiptPrompt(text, fileName, language),
      parameters: {
        max_new_tokens: 350,
        temperature: 0.1,
        return_full_text: false
      },
      options: {
        wait_for_model: true
      }
    })
  });

  const payload = await hfResponse.json();
  if (!hfResponse.ok || payload.error) {
    throw new Error(payload.error || "Hugging Face receipt parser failed.");
  }

  const generated = Array.isArray(payload) ? payload[0]?.generated_text : payload.generated_text;
  return normalizeParsedReceipt(extractJson(generated));
}

async function parseWithOpenAI(text, fileName, language) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            `You extract structured expense data from noisy OCR receipt text. Receipt language preference: ${language === "de" ? "German first" : "English first"}. If German, interpret Summe, Gesamt, Rückgeld, Steuer, MwSt, Bar, Karte, Datum, and Zeit before English terms. Use receipt topology: header has store, address, phone; body has purchased items; footer has total, payment, date, and time. Distinguish final total from item prices, phone numbers, addresses, tax IDs, cash tendered, and returned change. For line items, capture quantity from multipliers like '2 * 2,49' and total_price as the final calculated line price. Exclude subtotals, tax breakdowns, VAT IDs, payment lines, phone, address, and receipt metadata from line_items. Use -1 for unknown numeric values, empty strings for unknown text values, and '[Unclear]' for obscured item fields.`
        },
        {
          role: "user",
          content: `File name: ${fileName || "receipt"}\n\nOCR text:\n${text}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_expense",
          strict: true,
          schema: receiptSchema
        }
      }
    })
  });

  const payload = await openaiResponse.json();
  if (!openaiResponse.ok || payload.error) {
    throw new Error(payload.error?.message || "OpenAI receipt parser failed.");
  }

  const outputText = extractOutputText(payload);
  return normalizeParsedReceipt(JSON.parse(outputText));
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({
      configured: Boolean(process.env.HUGGINGFACE_API_KEY || process.env.OPENAI_API_KEY),
      provider: process.env.HUGGINGFACE_API_KEY ? "huggingface" : process.env.OPENAI_API_KEY ? "openai" : ""
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.HUGGINGFACE_API_KEY && !process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: "HUGGINGFACE_API_KEY or OPENAI_API_KEY is not configured on the server." });
  }

  const text = request.body?.text;
  if (!text || typeof text !== "string") {
    return response.status(400).json({ error: "Missing OCR text payload." });
  }

  const ruleParsed = parseReceiptByRules(text, request.body?.fileName);
  const language = request.body?.language === "en" ? "en" : "de";

  try {
    let parsed;
    let provider = "";
    if (process.env.HUGGINGFACE_API_KEY) {
      parsed = await parseWithHuggingFace(text, request.body?.fileName, language);
      provider = "huggingface";
    } else {
      parsed = await parseWithOpenAI(text, request.body?.fileName, language);
      provider = "openai";
    }
    return response.status(200).json({ ...mergeParsedReceipt(parsed, ruleParsed), provider });
  } catch (error) {
    return response.status(200).json({
      ...ruleParsed,
      provider: "rules",
      notes: `AI parser fallback used: ${error.message || "AI receipt parser failed."}`
    });
  }
}
