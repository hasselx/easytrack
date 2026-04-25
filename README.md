# Receipt-Based Expense Tracker

A static MVP prototype for uploading receipts, reviewing extracted expense data, and viewing spending in a dashboard.

## Features

- Mobile-style app navigation with a hamburger menu.
- Upload a receipt image, choose a file, or take a photo on mobile.
- Browser-side OCR for JPG/PNG receipts using Tesseract.js.
- Optional Google Cloud Vision OCR through a locally saved API key.
- Automatic parsing for merchant, date, amount, currency, and category.
- Manual correction before saving.
- Local dashboard and transaction history.

## Notes

- The camera works best on the live HTTPS GitHub Pages URL.
- Gallery uploads are downscaled before OCR to reduce browser memory use.
- If OCR cannot read a receipt clearly, the app leaves fields editable instead of inserting fake values.
- Do not hardcode API keys into this repo. Add the Google Cloud Vision key in the app's Settings page.

## Run locally

Open `index.html` in a browser.

## Publish with GitHub Pages

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
