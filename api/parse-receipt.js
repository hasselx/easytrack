const receiptSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "merchant",
    "date",
    "amount",
    "currency",
    "category",
    "tax",
    "payment_method",
    "cash_paid",
    "change_amount",
    "telephone",
    "address",
    "notes"
  ],
  properties: {
    merchant: { type: "string" },
    date: { type: "string", description: "ISO date YYYY-MM-DD, or empty string if unknown." },
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
    amount: cleanNumber(receipt.amount),
    currency: receipt.currency || "EUR",
    category: categories.includes(receipt.category) ? receipt.category : "Other",
    tax: cleanNumber(receipt.tax),
    payment_method: receipt.payment_method || "",
    cash_paid: cleanNumber(receipt.cash_paid),
    change_amount: cleanNumber(receipt.change_amount),
    telephone: receipt.telephone || "",
    address: receipt.address || "",
    notes: receipt.notes || ""
  };
}

function receiptPrompt(text, fileName) {
  return `Extract structured receipt expense data as valid JSON only.

Return exactly these keys:
merchant, date, amount, currency, category, tax, payment_method, cash_paid, change_amount, telephone, address, notes.

Rules:
- date must be YYYY-MM-DD or empty string
- amount is the final receipt total, not phone number, address, tax id, cash paid, or change
- category must be one of Food, Travel, Shopping, Health, Housing, Utilities, Other
- unknown numeric values must be -1
- unknown text values must be empty strings
- currency should be EUR unless another currency is clearly present

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
            "You extract structured expense data from noisy OCR receipt text. Return only fields supported by the schema. Distinguish the final total from phone numbers, addresses, tax IDs, cash tendered, and returned change. Use -1 for unknown numeric values and empty strings for unknown text values."
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
