const STORAGE_KEY = "receiptflow.expenses.v1";
const VISION_KEY_STORAGE = "receiptflow.googleVisionApiKey.v1";

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
  pages: Array.from(document.querySelectorAll("[data-page]")),
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
  amount: document.querySelector("#amount"),
  currency: document.querySelector("#currency"),
  category: document.querySelector("#category"),
  rawText: document.querySelector("#rawText"),
  resetFormButton: document.querySelector("#resetFormButton"),
  visionForm: document.querySelector("#visionForm"),
  visionApiKey: document.querySelector("#visionApiKey"),
  visionStatus: document.querySelector("#visionStatus"),
  clearVisionKeyButton: document.querySelector("#clearVisionKeyButton"),
  monthlyTotal: document.querySelector("#monthlyTotal"),
  monthlyCount: document.querySelector("#monthlyCount"),
  averageReceipt: document.querySelector("#averageReceipt"),
  topCategory: document.querySelector("#topCategory"),
  topCategoryAmount: document.querySelector("#topCategoryAmount"),
  categoryChart: document.querySelector("#categoryChart"),
  chartLegend: document.querySelector("#chartLegend"),
  transactionsBody: document.querySelector("#transactionsBody"),
  emptyState: document.querySelector("#emptyState"),
  filterStart: document.querySelector("#filterStart"),
  filterEnd: document.querySelector("#filterEnd"),
  filterCategory: document.querySelector("#filterCategory"),
  steps: Array.from(document.querySelectorAll("#steps li")),
  seedButton: document.querySelector("#seedButton")
};

let cameraStream = null;

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

function getVisionApiKey() {
  return localStorage.getItem(VISION_KEY_STORAGE) || "";
}

function updateVisionSettings() {
  const hasKey = Boolean(getVisionApiKey());
  els.visionStatus.textContent = hasKey ? "Connected" : "Not connected";
  els.visionStatus.style.background = hasKey ? "#e8f4ed" : "#eef1ed";
  els.visionStatus.style.color = hasKey ? "#2f8f68" : "#66717a";
  els.visionApiKey.placeholder = hasKey ? "Saved locally. Paste a new key to replace it." : "Paste Google Cloud Vision API key";
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
  const knownPage = els.pages.some((item) => item.dataset.page === page) ? page : "dashboard";
  state.activePage = knownPage;
  els.pages.forEach((item) => item.classList.toggle("active", item.dataset.page === knownPage));
  els.pageLinks.forEach((link) => link.classList.toggle("active", link.dataset.pageLink === knownPage));
  els.pageTitle.textContent = knownPage === "upload" ? "Scan Receipt" : knownPage[0].toUpperCase() + knownPage.slice(1);
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
    amount: Number(data.amount),
    currency: data.currency,
    category: data.category,
    raw_text: data.rawText,
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
  const keywordLines = lines.filter((line) => /(total|summe|gesamt|betrag|zu zahlen|amount|balance|karten?|cash|bar)/i.test(line));
  const keywordAmounts = keywordLines.flatMap((line) => Array.from(line.matchAll(amountPattern)).map((match) => normalizeAmount(match[1])));
  const allAmounts = Array.from(joined.matchAll(amountPattern)).map((match) => normalizeAmount(match[1])).filter(Boolean);
  const amount = keywordAmounts.filter(Boolean).at(-1) || Math.max(0, ...allAmounts);
  const merchant = lines.find((line) => {
    const lower = line.toLowerCase();
    return !/(receipt|beleg|bon|rechnung|tax|mwst|datum|date|total|summe|gesamt|eur|usd|gbp|chf|tel|ust|vat|iban|karte|visa|mastercard)/i.test(lower) && /[a-zA-Z]{2,}/.test(line);
  }) || fileName.replace(/\.[^.]+$/, "") || "Unknown merchant";

  return {
    merchant,
    date: normalizeDate(dateMatch?.[0]) || todayISO(),
    amount: amount || "",
    currency,
    category: categorize(merchant),
    rawText: text
  };
}

async function runImageOcr(file) {
  const ocrImage = await prepareImageForOcr(file);
  const visionApiKey = getVisionApiKey();
  if (visionApiKey) {
    return runGoogleVisionOcr(ocrImage, visionApiKey);
  }

  if (!window.Tesseract) {
    throw new Error("OCR engine is still loading. Try again in a moment.");
  }

  const result = await window.Tesseract.recognize(ocrImage, "eng", {
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

async function runGoogleVisionOcr(imageBlob, apiKey) {
  setBadge("Google OCR", "busy");
  const content = await blobToBase64(imageBlob);
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content },
          features: [{ type: "TEXT_DETECTION" }]
        }
      ]
    })
  });
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || "Google Vision OCR failed.");
  }

  const result = payload.responses?.[0];
  if (result?.error) {
    throw new Error(result.error.message || "Google Vision could not read this image.");
  }

  return result?.textAnnotations?.[0]?.description || "";
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
  els.amount.value = expense.amount || "";
  els.currency.value = expense.currency || "EUR";
  els.category.value = expense.category || "Other";
  els.rawText.value = expense.rawText || expense.raw_text || "";
}

function clearForm() {
  state.editingId = null;
  state.activeReceiptUrl = "";
  els.expenseForm.reset();
  els.currency.value = "EUR";
  els.category.value = "Food";
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
      setBadge("Parsing", "busy");
      extracted = parseReceiptText(text, file.name);
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

window.addEventListener("popstate", () => {
  setPage(location.hash.replace("#", "") || "dashboard");
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
    amount: Number(formData.get("amount")),
    currency: formData.get("currency"),
    category: formData.get("category"),
    rawText: formData.get("rawText"),
    receiptUrl: state.activeReceiptUrl
  };

  if (!data.merchant || !data.date || !Number.isFinite(data.amount)) return;

  if (state.editingId) {
    state.expenses = state.expenses.map((expense) =>
      expense.id === state.editingId
        ? { ...expense, ...data, raw_text: data.rawText, receipt_url: data.receiptUrl || expense.receipt_url }
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

els.resetFormButton.addEventListener("click", clearForm);

els.visionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = els.visionApiKey.value.trim();
  if (!key) return;
  localStorage.setItem(VISION_KEY_STORAGE, key);
  els.visionApiKey.value = "";
  updateVisionSettings();
});

els.clearVisionKeyButton.addEventListener("click", () => {
  localStorage.removeItem(VISION_KEY_STORAGE);
  els.visionApiKey.value = "";
  updateVisionSettings();
});

els.transactionsBody.addEventListener("click", (event) => {
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
});

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
updateVisionSettings();
setPage(location.hash.replace("#", "") || "dashboard");
render();
