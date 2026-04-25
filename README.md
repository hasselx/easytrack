# Receipt-Based Expense Tracker

A static MVP prototype for uploading receipts, reviewing extracted expense data, and viewing spending in a dashboard.

## Features

- Mobile-style app navigation with a hamburger menu.
- Upload a receipt image, choose a file, or take a photo on mobile.
- Server-side Google Cloud Vision OCR through `/api/vision-ocr`.
- Browser-side OCR fallback for JPG/PNG receipts using Tesseract.js.
- Automatic parsing for merchant, date, amount, currency, and category.
- Manual correction before saving.
- Local dashboard and transaction history.

## Notes

- The camera works best on a live HTTPS deployment.
- Gallery uploads are downscaled before OCR to reduce browser memory use.
- If OCR cannot read a receipt clearly, the app leaves fields editable instead of inserting fake values.
- Do not hardcode API keys into this repo. Add `GOOGLE_VISION_API_KEY` as a server environment variable.

## Run locally as static UI

Open `index.html` in a browser.

The Google Vision endpoint will not run from `file://`; the app falls back to browser OCR there.

## Run with server OCR

Use a serverless host such as Vercel.

1. Install Vercel CLI:

```powershell
npm install -g vercel
```

2. Add an environment variable named `GOOGLE_VISION_API_KEY` in Vercel.
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
