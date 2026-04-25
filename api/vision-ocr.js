export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: "GOOGLE_VISION_API_KEY is not configured on the server." });
  }

  const image = request.body?.image;
  if (!image || typeof image !== "string") {
    return response.status(400).json({ error: "Missing base64 image payload." });
  }

  try {
    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [{ type: "TEXT_DETECTION" }]
          }
        ]
      })
    });

    const payload = await visionResponse.json();
    if (!visionResponse.ok || payload.error) {
      return response.status(visionResponse.status || 502).json({
        error: payload.error?.message || "Google Vision request failed."
      });
    }

    const result = payload.responses?.[0];
    if (result?.error) {
      return response.status(502).json({ error: result.error.message || "Google Vision could not read this image." });
    }

    return response.status(200).json({
      text: result?.textAnnotations?.[0]?.description || ""
    });
  } catch (error) {
    return response.status(502).json({ error: error.message || "OCR service failed." });
  }
}
