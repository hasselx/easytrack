# Receipt-Based Expense Tracker

A static MVP prototype for uploading receipts, reviewing extracted expense data, and viewing spending in a dashboard.

## Features

- Mobile-style app navigation with a hamburger menu.
- Upload a receipt image, choose a file, or take a photo on mobile.
- Server-side Google Cloud Vision OCR through `/api/vision-ocr`.
- Server-side AI receipt understanding through `/api/parse-receipt`.
- Browser-side OCR fallback for JPG/PNG receipts using Tesseract.js.
- Automatic parsing for merchant, date, amount, currency, category, tax, phone, address, payment method, cash paid, and change.
- Manual correction before saving.
- Local dashboard and transaction history.

## Notes

- The camera works best on a live HTTPS deployment.
- Gallery uploads are downscaled before OCR to reduce browser memory use.
- If OCR cannot read a receipt clearly, the app leaves fields editable instead of inserting fake values.
- Do not hardcode API keys into this repo. Add `GOOGLE_VISION_API_KEY` and `OPENAI_API_KEY` as server environment variables.

## Run locally as static UI

Open `index.html` in a browser.

The Google Vision endpoint will not run from `file://`; the app falls back to browser OCR there.

## Run with server OCR

Use a serverless host such as Vercel.

1. Install Vercel CLI:

```powershell
npm install -g vercel
```

2. Add these environment variables in Vercel:

```text
GOOGLE_VISION_API_KEY=your_google_cloud_vision_key
OPENAI_API_KEY=your_openai_api_key
```

Optional:

```text
OPENAI_MODEL=gpt-4o-mini
```

3. Run locally through Vercel:

```powershell
vercel dev
```

4. Deploy:

```powershell
vercel
```

## Publish static-only with GitHub Pages

1. Create a new empty GitHub repository.
2. Copy the repository URL.
3. Add it as this project's remote:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

4. In GitHub, open the repo settings.
5. Go to **Pages**.
6. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/** root
7. Save. GitHub will provide the live URL after deployment.

GitHub Pages cannot securely store server environment variables, so Google Vision server OCR will not work on GitHub Pages alone.
