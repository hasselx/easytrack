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

function receiptPrompt(text, fileName) {
  return `Extract structured receipt expense data as valid JSON only.

Return exactly these keys:
merchant, date, time, amount, currency, category, tax, payment_method, cash_paid, change_amount, telephone, address, line_items, notes.

Receipt topology:
- Header: store name, branch address, phone or website.
- Body: purchased item lines. A line can contain an item ID, item name, and price.
- Quantifiers: lines may show multipliers such as "3 * 0,99"; use quantity 3 and the final calculated line total.
- Footer: Summe/Total, payment method such as Visa Debit or Visa Prepaid, date, and time.

Rules:
- date must be YYYY-MM-DD or empty string
- time must be HH:MM or empty string
- amount is the final receipt total, not phone number, address, tax id, cash paid, or change
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

async function parseWithHuggingFace(text, fileName) {
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
      inputs: receiptPrompt(text, fileName),
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

async function parseWithOpenAI(text, fileName) {
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
            "You extract structured expense data from noisy OCR German retail receipt text. Use receipt topology: header has store, address, phone; body has purchased items; footer has Summe/total, payment, date, and time. Distinguish final total from item prices, phone numbers, addresses, tax IDs, cash tendered, and returned change. For line items, capture quantity from multipliers like '2 * 2,49' and total_price as the final calculated line price. Exclude subtotals, tax breakdowns, VAT IDs, payment lines, phone, address, and receipt metadata from line_items. Use -1 for unknown numeric values, empty strings for unknown text values, and '[Unclear]' for obscured item fields."
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

  try {
    let parsed;
    let provider = "";
    if (process.env.HUGGINGFACE_API_KEY) {
      parsed = await parseWithHuggingFace(text, request.body?.fileName);
      provider = "huggingface";
    } else {
      parsed = await parseWithOpenAI(text, request.body?.fileName);
      provider = "openai";
    }
    return response.status(200).json({ ...parsed, provider });
  } catch (error) {
    return response.status(502).json({ error: error.message || "AI receipt parser failed." });
  }
}
