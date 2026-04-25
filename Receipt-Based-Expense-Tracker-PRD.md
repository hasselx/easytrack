# Product Requirements Document

## Receipt-Based Expense Tracker

**Version:** MVP v1  
**Platform:** Web App, PWA-ready

## 1. Objective

Build a web application that allows users to upload receipts and automatically extract, structure, correct, store, and visualize their expenses in a dashboard.

**Core value:** Reduce manual expense entry to near zero.

## 2. Problem Statement

Users currently:

- Manually enter expenses, which is time-consuming.
- Lose receipts or fail to track spending consistently.
- Lack clear visibility into spending patterns.

Receipts contain structured financial data, but extracting it manually is inefficient and error-prone.

## 3. Goals And Success Metrics

### Primary Goals

- Automate expense entry from receipts.
- Provide clear spending insights.
- Preserve user trust through review and manual correction before saving.

### Success Metrics

- At least 85% accurate extraction for merchant, date, and total.
- Less than 5 seconds processing time per receipt.
- At least 70% of uploads require no manual correction.
- Weekly active usage retention.

## 4. Target Users

- Students managing budgets.
- Young professionals.
- Frequent travelers.
- Anyone tracking daily expenses.

## 5. MVP Features

### 5.1 Receipt Upload

Users can upload receipts through:

- JPG images.
- PNG images.
- PDF files.
- Drag-and-drop upload.
- File picker upload.

Future PWA enhancement:

- Mobile camera capture.

### 5.2 OCR And Data Extraction

#### Step 1: OCR

Extract raw text from receipts using one of:

- Google Cloud Vision API.
- AWS Textract.

The OCR service should support multi-language receipts, especially German receipts.

#### Step 2: AI Parsing

Convert raw OCR text into structured JSON using the OpenAI API.

Required extracted fields:

- Merchant name.
- Date.
- Total amount.
- Currency.

Optional extracted fields:

- Tax.
- Line items.

Line-item extraction is out of strict MVP scope but may be stored later if available with high confidence.

### 5.3 Expense Dashboard

Dashboard views:

- Monthly total spending summary.
- Category breakdown chart.
- Recent transactions list.

Dashboard filters:

- Date range.
- Category.

### 5.4 Auto Categorization

Initial MVP approach:

- Rule-based category mapping.

Example mappings:

- Grocery stores -> Food.
- Transport services -> Travel.

Future enhancement:

- AI-based classification.

### 5.5 Manual Correction UI

This is a critical MVP requirement.

Users must be able to:

- Review extracted receipt data before saving.
- Edit extracted fields.
- Correct OCR or parsing errors.
- Save updated values.

The app should not assume extracted data is correct without user review.

### 5.6 Data Storage

Each expense record should contain:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "merchant": "string",
  "date": "date",
  "amount": "float",
  "currency": "string",
  "category": "string",
  "raw_text": "text",
  "receipt_url": "string",
  "created_at": "timestamp"
}
```

## 6. User Flow

1. User logs in.
2. User uploads a receipt.
3. OCR extracts raw receipt text.
4. AI parser converts raw text into structured expense data.
5. User reviews and edits extracted fields.
6. User saves the expense.
7. Dashboard updates with the new transaction.

## 7. Functional Requirements

### 7.1 Upload Service

- Accept files up to 10 MB.
- Validate file type.
- Store original receipt file.
- Return clear errors for unsupported or oversized files.

### 7.2 OCR Service

- Extract readable text from image and PDF receipts.
- Handle multi-language receipts, especially German.
- Return raw text and processing status.
- Handle low-confidence OCR cases gracefully.

### 7.3 AI Parsing Service

- Convert raw receipt text into structured JSON.
- Handle missing fields.
- Handle multiple date and currency formats.
- Handle currency symbols.
- Validate parsed outputs.
- Ensure amount fields are numeric.
- Provide fallback behavior when parsing confidence is low.

### 7.4 Dashboard Service

- Aggregate expenses by day, week, and month.
- Compute total spending per category.
- Support date range and category filters.
- Display recent saved transactions.

### 7.5 Authentication

- Support email/password authentication or Google OAuth.
- Ensure user data isolation.
- Prevent users from accessing receipts or expenses owned by other users.

## 8. Non-Functional Requirements

### Performance

- Receipt processing should complete in less than 5 seconds for typical uploads.

### Scalability

- Support concurrent uploads.
- Design OCR and AI parsing as retryable background-safe operations.

### Security

- Encrypt sensitive user data and receipt files.
- Secure API keys and third-party credentials.
- Restrict receipt file access to the owning user.

### Reliability

- Retry failed OCR and AI calls.
- Surface processing failures clearly to the user.
- Preserve uploaded receipts when downstream processing fails.

## 9. Recommended MVP Tech Stack

### Frontend

- Next.js.
- React.
- Recharts or Chart.js.

### Backend

- FastAPI.
- Python.

### Database

- PostgreSQL.

### Storage

- AWS S3 or Google Cloud Storage.

### Processing

- OCR: Google Cloud Vision API.
- AI parsing: OpenAI API.

## 10. Risks And Mitigation

### Risk 1: OCR Inaccuracies

Mitigation:

- Use a high-quality OCR API.
- Show extracted data before saving.
- Include manual correction UI.

### Risk 2: Incorrect Parsing

Mitigation:

- Validate structured outputs.
- Ensure totals are numeric.
- Add fallback parsing rules.
- Require user review before saving.

### Risk 3: Poor User Trust

Mitigation:

- Make extracted data visible.
- Allow edits before save.
- Show original receipt alongside extracted fields where practical.

## 11. Future Enhancements

- Multi-currency tracking with FX API integration.
- Budget goals and alerts.
- Subscription detection.
- Email receipt parsing.
- Mobile app using React Native.
- Analytics insights, such as: "You spent 20% more on food this month."
- AI-based expense categorization.
- Mobile camera capture through PWA capabilities.

## 12. Strict MVP Scope

### Include

- Receipt upload.
- OCR.
- AI parsing.
- Manual edit and correction.
- Basic dashboard.

### Exclude For Now

- Line-item extraction.
- AI-generated spending insights.
- Social or sharing features.
- Native mobile app.
- Advanced budgeting.

## 13. MVP Acceptance Criteria

- A user can sign up or log in.
- A user can upload a JPG, PNG, or PDF receipt up to 10 MB.
- The app extracts raw text from the receipt.
- The app converts extracted text into merchant, date, amount, currency, and category fields.
- The user can review and edit extracted fields before saving.
- The saved expense appears in the recent transactions list.
- The dashboard total updates after the expense is saved.
- The dashboard can show category breakdown and monthly total spending.
- Users cannot view or modify another user's expenses or receipt files.

