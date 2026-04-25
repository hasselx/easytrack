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

function normalizeParsedReceipt(receipt) {
  const cleanNumber = (value) => (typeof value === "number" && value >= 0 ? value : "");
  return {
    merchant: receipt.merchant || "",
    date: receipt.date || "",
    amount: cleanNumber(receipt.amount),
    currency: receipt.currency || "EUR",
    category: receipt.category || "Other",
    tax: cleanNumber(receipt.tax),
    payment_method: receipt.payment_method || "",
    cash_paid: cleanNumber(receipt.cash_paid),
    change_amount: cleanNumber(receipt.change_amount),
    telephone: receipt.telephone || "",
    address: receipt.address || "",
    notes: receipt.notes || ""
  };
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("");
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({
      configured: Boolean(process.env.OPENAI_API_KEY)
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  const text = request.body?.text;
  if (!text || typeof text !== "string") {
    return response.status(400).json({ error: "Missing OCR text payload." });
  }

  try {
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
            content: `File name: ${request.body?.fileName || "receipt"}\n\nOCR text:\n${text}`
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
      return response.status(openaiResponse.status || 502).json({
        error: payload.error?.message || "AI receipt parser failed."
      });
    }

    const outputText = extractOutputText(payload);
    const parsed = JSON.parse(outputText);
    return response.status(200).json(normalizeParsedReceipt(parsed));
  } catch (error) {
    return response.status(502).json({ error: error.message || "AI receipt parser failed." });
  }
}
