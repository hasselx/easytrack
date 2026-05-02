const STORAGE_KEY = "receiptflow.expenses.v1";
const LANGUAGE_KEY = "receiptflow.receiptLanguage.v1";
const USER_KEY = "receiptflow.user.v1";
const categoryColors = {
  Food: "#2f8f68",
  Travel: "#167d8f",
  Shopping: "#4b6fb8",
  Health: "#c0564a",
  Housing: "#8b6f47",
  Utilities: "#c38a16",
  Other: "#66717a"
};

const sampleReceipts = [
  {
    merchant: "REWE Berlin Mitte",
    date: "2026-04-21",
    amount: 32.48,
    currency: "EUR",
    category: "Food",
    rawText: "REWE Berlin Mitte\nBon Nr. 4821\n21.04.2026\nSumme EUR 32,48\nVielen Dank fuer Ihren Einkauf"
  },
  {
    merchant: "BVG Fahrinfo",
    date: "2026-04-18",
    amount: 3.50,
    currency: "EUR",
    category: "Travel",
    rawText: "BVG\nEinzelfahrschein Berlin AB\n18.04.2026\nTotal 3,50 EUR"
  },
  {
    merchant: "dm drogerie markt",
    date: "2026-04-12",
    amount: 18.95,
    currency: "EUR",
    category: "Health",
    rawText: "dm drogerie markt\n12.04.2026\nGesamtbetrag 18,95 EUR"
  }
];

const receiptExamples = [
  {
    merchant: "EDEKA Friedrichstrasse",
    amount: 27.84,
    category: "Food",
    rawText: "EDEKA Friedrichstrasse\nKassenbon\nDatum {date}\nMilch 1,49\nBrot 2,79\nObst 4,20\nGesamt EUR 27,84"
  },
  {
    merchant: "DB Reisezentrum",
    amount: 49.90,
    category: "Travel",
    rawText: "Deutsche Bahn\nReisezentrum Berlin Hbf\nDatum {date}\nTicket ICE\nTotal 49,90 EUR"
  },
  {
    merchant: "MediaMarkt",
    amount: 89.99,
    category: "Shopping",
    rawText: "MediaMarkt\nBeleg\nDatum {date}\nZubehoer\nSumme 89,99 EUR"
  },
  {
    merchant: "Apotheke am Markt",
    amount: 14.60,
    category: "Health",
    rawText: "Apotheke am Markt\nDatum {date}\nMwSt enthalten\nZu zahlen 14,60 EUR"
  }
];

const state = {
  expenses: loadExpenses(),
  activeReceiptUrl: "",
  editingId: null,
  activePage: "dashboard"
};

const els = {
  sidebar: document.querySelector("#sidebar"),
  scrim: document.querySelector("#scrim"),
  menuButton: document.querySelector("#menuButton"),
  pageTitle: document.querySelector("#pageTitle"),
  pageLinks: Array.from(document.querySelectorAll("[data-page-link]")),
  pageButtons: Array.from(document.querySelectorAll("[data-page-button]")),
  privateLinks: Array.from(document.querySelectorAll("[data-private-link]")),
  pages: Array.from(document.querySelectorAll("[data-page]")),
  loginForm: document.querySelector("#loginForm"),
  loginTitle: document.querySelector("#loginTitle"),
  loginSubtitle: document.querySelector("#loginSubtitle"),
  loginName: document.querySelector("#loginName"),
  loginEmail: document.querySelector("#loginEmail"),
  nameField: document.querySelector("#nameField"),
  authSubmitButton: document.querySelector("#authSubmitButton"),
  authToggles: Array.from(document.querySelectorAll("[data-auth-toggle]")),
  receiptLanguage: document.querySelector("#receiptLanguage"),
  languageStatus: document.querySelector("#languageStatus"),
  receiptInput: document.querySelector("#receiptInput"),
  openCameraButton: document.querySelector("#openCameraButton"),
  closeCameraButton: document.querySelector("#closeCameraButton"),
  capturePhotoButton: document.querySelector("#capturePhotoButton"),
  cameraPanel: document.querySelector("#cameraPanel"),
  cameraVideo: document.querySelector("#cameraVideo"),
  cameraCanvas: document.querySelector("#cameraCanvas"),
  cameraError: document.querySelector("#cameraError"),
  dropZone: document.querySelector("#dropZone"),
  receiptPreview: document.querySelector("#receiptPreview"),
  receiptThumb: document.querySelector("#receiptThumb"),
  fileName: document.querySelector("#fileName"),
  fileMeta: document.querySelector("#fileMeta"),
  processingBadge: document.querySelector("#processingBadge"),
  expenseForm: document.querySelector("#expenseForm"),
  merchant: document.querySelector("#merchant"),
  date: document.querySelector("#date"),
  time: document.querySelector("#time"),
  amount: document.querySelector("#amount"),
  currency: document.querySelector("#currency"),
  category: document.querySelector("#category"),
  tax: document.querySelector("#tax"),
  paymentMethod: document.querySelector("#paymentMethod"),
  cashPaid: document.querySelector("#cashPaid"),
  changeAmount: document.querySelector("#changeAmount"),
  telephone: document.querySelector("#telephone"),
  address: document.querySelector("#address"),
  lineItemsBody: document.querySelector("#lineItemsBody"),
  lineItemsJson: document.querySelector("#lineItemsJson"),
  rawText: document.querySelector("#rawText"),
  resetFormButton: document.querySelector("#resetFormButton"),
  visionStatus: document.querySelector("#visionStatus"),
  parserStatus: document.querySelector("#parserStatus"),
  monthlyTotal: document.querySelector("#monthlyTotal"),
  monthlyCount: document.querySelector("#monthlyCount"),
  averageReceipt: document.querySelector("#averageReceipt"),
  topCategory: document.querySelector("#topCategory"),
  topCategoryAmount: document.querySelector("#topCategoryAmount"),
  categoryChart: document.querySelector("#categoryChart"),
  chartLegend: document.querySelector("#chartLegend"),
  transactionsBody: document.querySelector("#transactionsBody"),
  transactionCards: document.querySelector("#transactionCards"),
  emptyState: document.querySelector("#emptyState"),
  filterStart: document.querySelector("#filterStart"),
  filterEnd: document.querySelector("#filterEnd"),
  filterCategory: document.querySelector("#filterCategory"),
  steps: Array.from(document.querySelectorAll("#steps li")),
  seedButton: document.querySelector("#seedButton")
};

let cameraStream = null;
let authMode = "signup";

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
}

function getReceiptLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) || "de";
}

function setReceiptLanguage(language) {
  const normalized = language === "en" ? "en" : "de";
  localStorage.setItem(LANGUAGE_KEY, normalized);
  els.receiptLanguage.value = normalized;
  els.languageStatus.textContent = normalized === "de" ? "German" : "English";
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function isAuthenticated() {
  return Boolean(getUser()?.email);
}

function updateAuthUi() {
  const authed = isAuthenticated();
  els.privateLinks.forEach((link) => {
    link.hidden = !authed;
  });
}

function setAuthMode(mode) {
  authMode = mode === "login" ? "login" : "signup";
  els.loginTitle.textContent = authMode === "signup" ? "Sign up" : "Login";
  els.loginSubtitle.textContent = authMode === "signup" ? "Create a local demo profile for this MVP." : "Login to your local demo profile.";
  els.authSubmitButton.textContent = authMode === "signup" ? "Create account" : "Login";
  els.nameField.hidden = authMode === "login";
  els.authToggles.forEach((button) => {
    button.classList.toggle("active", button.dataset.authToggle === authMode);
  });
}

function updateVisionSettings() {
  if (location.protocol === "file:") {
    els.visionStatus.textContent = "Needs deployed server";
    els.visionStatus.style.background = "#fff7e6";
    els.visionStatus.style.color = "#8a5d08";
    return;
  }

  els.visionStatus.textContent = "Checking";
  els.visionStatus.style.background = "#eef1ed";
  els.visionStatus.style.color = "#66717a";

  fetch("/api/vision-ocr")
    .then((response) => response.json())
    .then((payload) => {
      els.visionStatus.textContent = payload.configured ? "Connected" : "Missing key";
      els.visionStatus.style.background = payload.configured ? "#e8f4ed" : "#fff7e6";
      els.visionStatus.style.color = payload.configured ? "#2f8f68" : "#8a5d08";
    })
    .catch(() => {
      els.visionStatus.textContent = "Server unavailable";
      els.visionStatus.style.background = "#fbebea";
      els.visionStatus.style.color = "#c0564a";
    });
}

function setStatusBadge(element, text, mode) {
  element.textContent = text;
  element.style.background = mode === "ok" ? "#e8f4ed" : mode === "warn" ? "#fff7e6" : mode === "bad" ? "#fbebea" : "#eef1ed";
  element.style.color = mode === "ok" ? "#2f8f68" : mode === "warn" ? "#8a5d08" : mode === "bad" ? "#c0564a" : "#66717a";
}

function updateParserSettings() {
  if (location.protocol === "file:") {
    setStatusBadge(els.parserStatus, "Needs deployed server", "warn");
    return;
  }

  setStatusBadge(els.parserStatus, "Checking", "neutral");
  fetch("/api/parse-receipt")
    .then((response) => response.json())
    .then((payload) => {
      const provider = payload.provider === "huggingface" ? "Hugging Face" : payload.provider === "openai" ? "OpenAI" : "";
      setStatusBadge(els.parserStatus, payload.configured ? provider : "Missing key", payload.configured ? "ok" : "warn");
    })
    .catch(() => {
      setStatusBadge(els.parserStatus, "Server unavailable", "bad");
    });
}

function formatMoney(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(Number(amount) || 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function setBadge(text, mode = "ready") {
  els.processingBadge.textContent = text;
  const color = mode === "busy" ? "#fff7e6" : mode === "done" ? "#e8f4ed" : "#eef1ed";
  const ink = mode === "busy" ? "#8a5d08" : mode === "done" ? "#2f8f68" : "#66717a";
  els.processingBadge.style.background = color;
  els.processingBadge.style.color = ink;
}

function setPage(page) {
  const privatePages = ["dashboard", "upload", "transactions", "settings"];
  let knownPage = els.pages.some((item) => item.dataset.page === page) ? page : "home";
  if (privatePages.includes(knownPage) && !isAuthenticated()) {
    knownPage = "login";
    history.replaceState(null, "", "#login");
  }
  state.activePage = knownPage;
  els.pages.forEach((item) => item.classList.toggle("active", item.dataset.page === knownPage));
  els.pageLinks.forEach((link) => link.classList.toggle("active", link.dataset.pageLink === knownPage));
  const titles = {
    home: "Home",
    login: "Login",
    dashboard: "Dashboard",
    upload: "Scan Receipt",
    transactions: "Transactions",
    settings: "Settings"
  };
  els.pageTitle.textContent = titles[knownPage] || "Home";
  updateAuthUi();
  closeMenu();
}

function openMenu() {
  document.body.classList.add("menu-open");
  els.scrim.hidden = false;
  els.menuButton.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  els.scrim.hidden = true;
  els.menuButton.setAttribute("aria-expanded", "false");
}

function setStep(index) {
  els.steps.forEach((step, stepIndex) => {
    step.classList.toggle("done", stepIndex <= index);
  });
}

function createExpense(data) {
  return {
    id: crypto.randomUUID(),
    user_id: "local-user",
    merchant: data.merchant,
    date: data.date,
    time: data.time || "",
    amount: Number(data.amount),
    currency: data.currency,
    category: data.category,
    raw_text: data.rawText,
    tax: data.tax || null,
    payment_method: data.paymentMethod || "",
    cash_paid: data.cashPaid || null,
    change_amount: data.changeAmount || null,
    telephone: data.telephone || "",
    address: data.address || "",
    line_items: Array.isArray(data.lineItems) ? data.lineItems : [],
    receipt_url: data.receiptUrl || "",
    created_at: new Date().toISOString()
  };
}

function categorize(merchant) {
  const text = merchant.toLowerCase();
  if (/(rewe|edeka|aldi|lidl|kaufland|grocery|market)/.test(text)) return "Food";
  if (/(bvg|db|uber|bahn|taxi|train|flight)/.test(text)) return "Travel";
  if (/(dm|apotheke|pharmacy|arzt)/.test(text)) return "Health";
  if (/(media|amazon|store|shop)/.test(text)) return "Shopping";
  return "Other";
}

function fallbackExtraction(file) {
  return {
    merchant: file.name.replace(/\.[^.]+$/, "") || "Unknown merchant",
    date: todayISO(),
    amount: "",
    currency: "EUR",
    category: "Other",
    rawText: `Source file: ${file.name}`
  };
}

function normalizeAmount(value) {
  if (!value) return "";
  const compact = value.replace(/\s/g, "");
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
  const cleaned = value.trim();
  const isoMatch = cleaned.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const localMatch = cleaned.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
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
    if (/(summe|gesamtbetrag|gesamt|total|zu zahlen)/i.test(line) && !/(rueckgeld|rückgeld|change|balance)/i.test(line)) {
      const nearby = [line, lines[index + 1] || "", lines[index - 1] || ""].join(" ");
      totalCandidates.push(...amountsInLine(nearby));
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

function parseReceiptText(text, fileName = "") {
  const cleanedText = text
    .replace(/[|]/g, "1")
    .replace(/[€]/g, " EUR ")
    .replace(/\bO(?=\d)/g, "0")
    .replace(/(?<=\d)O\b/g, "0");
  const lines = cleanedText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
  const joined = lines.join("\n");
  const currency = /(?:€|eur)/i.test(joined) ? "EUR" : /\busd|\$/i.test(joined) ? "USD" : /\bgbp|£/i.test(joined) ? "GBP" : /\bchf\b/i.test(joined) ? "CHF" : "EUR";
  const dateMatch = joined.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/);
  const amountPattern = /(?:eur|usd|gbp|chf|\$|£)?\s*(\d{1,4}(?:[ .]\d{3})*(?:[,.]\d{2}))\s*(?:eur|usd|gbp|chf|\$|£)?/gi;
  const amount = findTotalAmount(lines);
  const taxLine = lines.find((line) => /(tax|mwst|ust|vat)/i.test(line) && /[\d][\d\s.,]*\d/.test(line));
  const taxMatch = taxLine?.match(amountPattern);
  const cashLine = lines.find((line) => /(cash|bar|gegeben|received|tendered)/i.test(line) && /[\d][\d\s.,]*\d/.test(line));
  const cashMatch = cashLine?.match(amountPattern);
  const changeLine = lines.find((line) => /(change|rueckgeld|rückgeld|balance|zurueck|zurück)/i.test(line) && /[\d][\d\s.,]*\d/.test(line));
  const changeMatch = changeLine?.match(amountPattern);
  const telephoneMatch = joined.match(/(?:tel\.?|telefon|phone)[:\s]*([+()0-9][+()0-9\s/-]{5,})/i) || joined.match(/(\+?\d[\d\s()/.-]{7,}\d)/);
  const paymentLine = lines.find((line) => /(visa|mastercard|maestro|amex|card|karte|ec|cash|bar|paypal|apple pay|google pay)/i.test(line));
  const addressLine = lines.find((line) => /\b\d{5}\b/.test(line) || /\b(strasse|straße|str\.|platz|allee|road|street|st\.)\b/i.test(line));
  const merchant = lines.find((line) => {
    const lower = line.toLowerCase();
    return !/(receipt|beleg|bon|rechnung|tax|mwst|datum|date|total|summe|gesamt|eur|usd|gbp|chf|tel|ust|vat|iban|karte|visa|mastercard)/i.test(lower) && /[a-zA-Z]{2,}/.test(line);
  }) || fileName.replace(/\.[^.]+$/, "") || "Unknown merchant";
  const lineItems = extractLineItems(lines).filter((item) => !amount || item.total_price <= amount + 0.01);

  return {
    merchant,
    date: normalizeDate(dateMatch?.[0]) || todayISO(),
    time: joined.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || "",
    amount: amount || "",
    currency,
    category: categorize(merchant),
    tax: normalizeAmount(taxMatch?.[0]) || "",
    paymentMethod: paymentLine || "",
    cashPaid: normalizeAmount(cashMatch?.[0]) || "",
    changeAmount: normalizeAmount(changeMatch?.[0]) || "",
    telephone: telephoneMatch?.[1]?.trim() || "",
    address: addressLine || "",
    lineItems,
    rawText: text
  };
}

async function parseReceiptWithAi(text, fileName = "") {
  if (location.protocol === "file:") {
    throw new Error("AI parser requires the deployed server.");
  }

  const response = await fetch("/api/parse-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, fileName, language: getReceiptLanguage() })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "AI receipt parser failed.");
  }
  return {
    merchant: payload.merchant || "",
    date: payload.date || todayISO(),
    time: payload.time || "",
    amount: payload.amount ?? "",
    currency: payload.currency || "EUR",
    category: payload.category || categorize(payload.merchant || ""),
    tax: payload.tax ?? "",
    paymentMethod: payload.payment_method || "",
    cashPaid: payload.cash_paid ?? "",
    changeAmount: payload.change_amount ?? "",
    telephone: payload.telephone || "",
    address: payload.address || "",
    lineItems: Array.isArray(payload.line_items) ? payload.line_items : [],
    rawText: text
  };
}

async function runImageOcr(file) {
  const ocrImage = await prepareImageForOcr(file);
  try {
    return await runServerVisionOcr(ocrImage);
  } catch (error) {
    console.info("Server OCR unavailable, falling back to browser OCR.", error);
  }

  if (!window.Tesseract) {
    throw new Error("OCR engine is still loading. Try again in a moment.");
  }

  const result = await window.Tesseract.recognize(ocrImage, getReceiptLanguage() === "de" ? "deu+eng" : "eng", {
    logger(progress) {
      if (progress.status === "recognizing text") {
        setBadge(`${Math.round(progress.progress * 100)}%`, "busy");
      }
    }
  });

  return result.data.text;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function runServerVisionOcr(imageBlob) {
  setBadge("Google OCR", "busy");
  const content = await blobToBase64(imageBlob);
  const response = await fetch("/api/vision-ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ image: content })
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Server OCR failed.");
  }

  return payload.text || "";
}

async function prepareImageForOcr(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1500;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const gray = imageData.data[index] * 0.299 + imageData.data[index + 1] * 0.587 + imageData.data[index + 2] * 0.114;
    const contrast = gray > 170 ? 255 : gray < 80 ? 0 : gray;
    imageData.data[index] = contrast;
    imageData.data[index + 1] = contrast;
    imageData.data[index + 2] = contrast;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.86);
  });
}

async function openCamera() {
  els.cameraError.hidden = true;
  els.cameraPanel.hidden = false;
  setBadge("Camera", "busy");

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    });
    els.cameraVideo.srcObject = cameraStream;
    await els.cameraVideo.play();
  } catch (error) {
    els.cameraError.textContent = "Camera could not open in this browser. Use Choose file from gallery instead.";
    els.cameraError.hidden = false;
    setBadge("Camera blocked", "ready");
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  els.cameraVideo.srcObject = null;
  els.cameraPanel.hidden = true;
  setBadge("Ready");
}

async function captureCameraPhoto() {
  if (!cameraStream) return;
  const width = els.cameraVideo.videoWidth || 1280;
  const height = els.cameraVideo.videoHeight || 960;
  els.cameraCanvas.width = width;
  els.cameraCanvas.height = height;
  els.cameraCanvas.getContext("2d").drawImage(els.cameraVideo, 0, 0, width, height);

  const blob = await new Promise((resolve) => els.cameraCanvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) return;
  const file = new File([blob], `receipt-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
  closeCamera();
  handleFile(file);
}

function populateForm(expense) {
  els.merchant.value = expense.merchant || "";
  els.date.value = expense.date || todayISO();
  els.time.value = expense.time || "";
  els.amount.value = expense.amount || "";
  els.currency.value = expense.currency || "EUR";
  els.category.value = expense.category || "Other";
  els.tax.value = expense.tax || "";
  els.paymentMethod.value = expense.paymentMethod || expense.payment_method || "";
  els.cashPaid.value = expense.cashPaid || expense.cash_paid || "";
  els.changeAmount.value = expense.changeAmount || expense.change_amount || "";
  els.telephone.value = expense.telephone || "";
  els.address.value = expense.address || "";
  const lineItems = expense.lineItems || expense.line_items || [];
  els.lineItemsJson.value = JSON.stringify(lineItems, null, 2);
  renderLineItems(lineItems);
  els.rawText.value = expense.rawText || expense.raw_text || "";
}

function renderLineItems(lineItems) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  els.lineItemsBody.innerHTML = items.length
    ? items
        .map((item) => `
          <tr>
            <td>${item.item_name_en || item.item_name || "[Unclear]"}</td>
            <td>${item.quantity || 1}</td>
            <td>${item.total_price === "" || item.total_price == null ? "[Unclear]" : formatMoney(item.total_price, "EUR")}</td>
          </tr>
        `)
        .join("")
    : '<tr><td colspan="3">No line items extracted.</td></tr>';
}

function clearForm() {
  state.editingId = null;
  state.activeReceiptUrl = "";
  els.expenseForm.reset();
  els.currency.value = "EUR";
  els.category.value = "Food";
  els.lineItemsJson.value = "[]";
  renderLineItems([]);
  els.rawText.value = "";
  els.receiptPreview.hidden = true;
  els.receiptThumb.innerHTML = "";
  setBadge("Ready");
  setStep(0);
}

function validateFile(file) {
  const allowed = ["image/png", "image/jpeg", "application/pdf"];
  if (!allowed.includes(file.type)) {
    throw new Error("Unsupported file type. Use JPG, PNG, or PDF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File is larger than 10 MB.");
  }
}

function showFilePreview(file) {
  els.receiptPreview.hidden = false;
  els.fileName.textContent = file.name;
  els.fileMeta.textContent = `${file.type || "Unknown type"} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  els.receiptThumb.innerHTML = "";

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.alt = "";
    const url = URL.createObjectURL(file);
    img.src = url;
    state.activeReceiptUrl = url;
    els.receiptThumb.appendChild(img);
  } else {
    els.receiptThumb.textContent = "PDF";
    state.activeReceiptUrl = "";
  }
}

async function handleFile(file) {
  try {
    validateFile(file);
  } catch (error) {
    alert(error.message);
    return;
  }

  showFilePreview(file);
  setStep(0);
  setBadge(file.type.startsWith("image/") ? "Scanning" : "PDF fallback", "busy");

  try {
    let extracted;
    if (file.type.startsWith("image/")) {
      const text = await runImageOcr(file);
      setStep(1);
      setBadge("AI parsing", "busy");
      try {
        extracted = await parseReceiptWithAi(text, file.name);
      } catch (error) {
        console.info("AI parser unavailable, using local parser.", error);
        extracted = parseReceiptText(text, file.name);
      }
    } else {
      extracted = fallbackExtraction(file);
      extracted.rawText = `${extracted.rawText}\n\nPDF OCR is not enabled in this static MVP. Enter the values manually before saving.`;
    }

    populateForm(extracted);
    setStep(2);
    setBadge("Review", "done");
    setPage("upload");
  } catch (error) {
    const extracted = fallbackExtraction(file);
    extracted.rawText = `${extracted.rawText}\n\nOCR could not read this image: ${error.message}\nTry a brighter, closer photo or use the live HTTPS site instead of opening the local file.`;
    populateForm(extracted);
    setStep(2);
    setBadge("Review", "done");
  }
}

function filteredExpenses() {
  return state.expenses
    .filter((expense) => {
      const afterStart = !els.filterStart.value || expense.date >= els.filterStart.value;
      const beforeEnd = !els.filterEnd.value || expense.date <= els.filterEnd.value;
      const categoryMatch = !els.filterCategory.value || expense.category === els.filterCategory.value;
      return afterStart && beforeEnd && categoryMatch;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function totalsByCategory(expenses) {
  return expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount);
    return acc;
  }, {});
}

function drawChart(expenses) {
  const ctx = els.categoryChart.getContext("2d");
  const size = els.categoryChart.width;
  const center = size / 2;
  const radius = center - 12;
  const totals = totalsByCategory(expenses);
  const entries = Object.entries(totals).filter(([, amount]) => amount > 0);
  const grandTotal = entries.reduce((sum, [, amount]) => sum + amount, 0);

  ctx.clearRect(0, 0, size, size);

  if (!entries.length) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#eef1ed";
    ctx.fill();
    ctx.fillStyle = "#66717a";
    ctx.font = "700 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No data", center, center + 5);
    els.chartLegend.innerHTML = '<p class="empty-state">Save expenses to build the chart.</p>';
    return;
  }

  let start = -Math.PI / 2;
  entries.forEach(([category, amount]) => {
    const angle = (amount / grandTotal) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = categoryColors[category] || categoryColors.Other;
    ctx.fill();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(center, center, radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#182027";
  ctx.font = "800 20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(formatMoney(grandTotal, "EUR"), center, center + 6);

  els.chartLegend.innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      const color = categoryColors[category] || categoryColors.Other;
      return `
        <div class="legend-row">
          <span class="legend-dot" style="background:${color}"></span>
          <span>${category}</span>
          <strong>${formatMoney(amount, "EUR")}</strong>
        </div>
      `;
    })
    .join("");
}

function updateMetrics(expenses) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthly = state.expenses.filter((expense) => expense.date.startsWith(currentMonth));
  const monthlyTotal = monthly.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const allTotal = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const categoryTotals = totalsByCategory(expenses);
  const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  els.monthlyTotal.textContent = formatMoney(monthlyTotal, "EUR");
  els.monthlyCount.textContent = `${monthly.length} expense${monthly.length === 1 ? "" : "s"} this month`;
  els.averageReceipt.textContent = formatMoney(state.expenses.length ? allTotal / state.expenses.length : 0, "EUR");
  els.topCategory.textContent = top ? top[0] : "None";
  els.topCategoryAmount.textContent = top ? formatMoney(top[1], "EUR") : "No category data yet";
}

function renderTransactions(expenses) {
  els.transactionsBody.innerHTML = expenses
    .map((expense) => `
      <tr>
        <td>${formatDate(expense.date)}</td>
        <td>${expense.merchant}</td>
        <td><span class="category-pill">${expense.category}</span></td>
        <td>${formatMoney(expense.amount, expense.currency)}</td>
        <td>
          <button class="secondary-button" type="button" data-edit="${expense.id}">Edit</button>
          <button class="danger-button" type="button" data-delete="${expense.id}">Delete</button>
        </td>
      </tr>
    `)
    .join("");
  els.transactionCards.innerHTML = expenses
    .map((expense) => `
      <article class="transaction-card">
        <div class="transaction-card-main">
          <div>
            <strong>${expense.merchant}</strong>
            <span>${formatDate(expense.date)} · ${expense.category}</span>
          </div>
          <strong>${formatMoney(expense.amount, expense.currency)}</strong>
        </div>
        <div class="transaction-card-actions">
          <button class="secondary-button" type="button" data-edit="${expense.id}">Edit</button>
          <button class="danger-button" type="button" data-delete="${expense.id}">Delete</button>
        </div>
      </article>
    `)
    .join("");
  els.emptyState.hidden = expenses.length > 0;
}

function render() {
  const expenses = filteredExpenses();
  updateMetrics(expenses);
  drawChart(expenses);
  renderTransactions(expenses);
}

els.menuButton.addEventListener("click", () => {
  if (document.body.classList.contains("menu-open")) {
    closeMenu();
  } else {
    openMenu();
  }
});

els.scrim.addEventListener("click", closeMenu);

els.pageLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const page = link.dataset.pageLink;
    history.pushState(null, "", `#${page}`);
    setPage(page);
  });
});

els.pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.pageButton;
    if (button.dataset.authMode) setAuthMode(button.dataset.authMode);
    history.pushState(null, "", `#${page}`);
    setPage(page);
  });
});

els.authToggles.forEach((button) => {
  button.addEventListener("click", () => {
    setAuthMode(button.dataset.authToggle);
  });
});

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      name: els.loginName.value.trim(),
      email: els.loginEmail.value.trim(),
      mode: authMode,
      loggedInAt: new Date().toISOString()
    })
  );
  updateAuthUi();
  history.pushState(null, "", "#dashboard");
  setPage("dashboard");
});

els.receiptLanguage.addEventListener("change", () => {
  setReceiptLanguage(els.receiptLanguage.value);
});

window.addEventListener("popstate", () => {
  setPage(location.hash.replace("#", "") || "home");
});

els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("dragging");
});

els.dropZone.addEventListener("dragleave", () => {
  els.dropZone.classList.remove("dragging");
});

els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  if (file) handleFile(file);
});

els.receiptInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) handleFile(file);
});

els.openCameraButton.addEventListener("click", openCamera);
els.closeCameraButton.addEventListener("click", closeCamera);
els.capturePhotoButton.addEventListener("click", captureCameraPhoto);

els.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(els.expenseForm);
  const data = {
    merchant: formData.get("merchant").trim(),
    date: formData.get("date"),
    time: formData.get("time"),
    amount: Number(formData.get("amount")),
    currency: formData.get("currency"),
    category: formData.get("category"),
    tax: formData.get("tax") ? Number(formData.get("tax")) : null,
    paymentMethod: formData.get("paymentMethod").trim(),
    cashPaid: formData.get("cashPaid") ? Number(formData.get("cashPaid")) : null,
    changeAmount: formData.get("changeAmount") ? Number(formData.get("changeAmount")) : null,
    telephone: formData.get("telephone").trim(),
    address: formData.get("address").trim(),
    lineItems: parseLineItemsJson(formData.get("lineItemsJson")),
    rawText: formData.get("rawText"),
    receiptUrl: state.activeReceiptUrl
  };

  if (!data.merchant || !data.date || !Number.isFinite(data.amount)) return;

  if (state.editingId) {
    state.expenses = state.expenses.map((expense) =>
      expense.id === state.editingId
        ? {
            ...expense,
            ...data,
            raw_text: data.rawText,
            payment_method: data.paymentMethod,
            cash_paid: data.cashPaid,
            change_amount: data.changeAmount,
            line_items: data.lineItems,
            receipt_url: data.receiptUrl || expense.receipt_url
          }
        : expense
    );
  } else {
    state.expenses.unshift(createExpense(data));
  }

  saveExpenses();
  clearForm();
  setStep(3);
  render();
});

els.lineItemsJson.addEventListener("input", () => {
  renderLineItems(parseLineItemsJson(els.lineItemsJson.value));
});

function parseLineItemsJson(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

els.resetFormButton.addEventListener("click", clearForm);

function handleTransactionAction(event) {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const expense = state.expenses.find((item) => item.id === editId);
    if (!expense) return;
    state.editingId = editId;
    state.activeReceiptUrl = expense.receipt_url;
    populateForm({
      ...expense,
      rawText: expense.raw_text
    });
    setBadge("Editing", "busy");
    setStep(2);
    history.pushState(null, "", "#upload");
    setPage("upload");
    document.querySelector("#reviewTitle").scrollIntoView({ behavior: "smooth" });
  }

  if (deleteId) {
    state.expenses = state.expenses.filter((item) => item.id !== deleteId);
    saveExpenses();
    render();
  }
}

els.transactionsBody.addEventListener("click", handleTransactionAction);
els.transactionCards.addEventListener("click", handleTransactionAction);

[els.filterStart, els.filterEnd, els.filterCategory].forEach((filter) => {
  filter.addEventListener("input", render);
});

els.seedButton.addEventListener("click", () => {
  const existingSample = state.expenses.some((expense) => expense.raw_text.includes("Bon Nr. 4821"));
  if (!existingSample) {
    state.expenses = [...sampleReceipts.map(createExpense), ...state.expenses];
    saveExpenses();
  }
  render();
});

clearForm();
setReceiptLanguage(getReceiptLanguage());
setAuthMode("signup");
updateAuthUi();
updateVisionSettings();
updateParserSettings();
setPage(location.hash.replace("#", "") || "home");
render();
