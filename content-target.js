// content-target.js
// Runs on Target product pages (target.com/p/*)

console.log("Enaj: content-target.js LOADED on", window.location.href);

function parseIngredientText(text) {
  let cleaned = text;
  cleaned = cleaned.replace(/\[[^\]]+\]/g, "");   // remove [*footnote] notes
  cleaned = cleaned.replace(/\*/g, "");             // remove asterisks
  cleaned = cleaned.replace(/Inactive\s+ingredients?\s*:/gi, ",");
  cleaned = cleaned.replace(/Active\s+ingredients?\s*:/gi, "");
  cleaned = cleaned.replace(/Other\s+ingredients?\s*:/gi, ",");

  return cleaned.split(/[,;]/)
    .map(s => s.trim())
    .map(s => s.charAt(0).toUpperCase() + s.slice(1)) // capitalize (text is stored lowercase)
    .filter(s => s.length > 1 && s.length < 60)
    .filter(s => s.split(' ').length <= 7)
    .filter(s => !/^(its|now|the|this|our|we|you|get|a |an |is |are )/i.test(s))
    .filter(s => !s.match(/^\d+$/))
    .filter((v, i, self) => self.indexOf(v) === i);
}

function extractProductData() {
  const data = {
    name: "",
    brand: "",
    ingredients: [],
    image: "",
    price: "",
    url: window.location.href,
    source: "target",
  };

  // Name
  const nameEl = document.querySelector('h1[data-test="product-title"], h1');
  if (nameEl) data.name = nameEl.textContent.trim();

  // Brand
  const brandEl = document.querySelector('[data-test="product-brand-link"], [data-test="product-brand"]');
  if (brandEl) data.brand = brandEl.textContent.trim();

  // Price
  const priceEl = document.querySelector('[data-test="product-price"]');
  if (priceEl) data.price = priceEl.textContent.trim();

  // Image — Target uses scene7.com CDN
  const imgEl = document.querySelector('img[src*="scene7.com/is/image/Target"]');
  if (imgEl) data.image = imgEl.src || "";

  // Ingredients — inside Label info accordion
  const ingDiv = document.querySelector(
    '[data-test="productDetailTabs-nutritionFactsTab"] .h-text-transform-caps'
  );
  if (ingDiv) {
    const text = ingDiv.textContent.trim();
    if (text.length > 10) {
      data.ingredients = parseIngredientText(text);
    }
  }

  console.log("Enaj: Target extracted", {
    name: data.name,
    brand: data.brand,
    ingredientCount: data.ingredients.length,
  });

  return data;
}

function tryExtractAndStore() {
  const data = extractProductData();
  if (data.name && data.ingredients.length > 0) {
    chrome.storage.local.set({ currentProduct: data });
    console.log("Enaj: Stored Target '" + data.name + "' with " + data.ingredients.length + " ingredients");
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProductData") {
    const data = extractProductData();
    sendResponse(data);
  }
  return true;
});

let attempts = 0;
const retryInterval = setInterval(() => {
  attempts++;

  // Auto-expand Label info accordion if it's collapsed
  const labelBtn = document.querySelector('button[href*="labelInfo"]');
  if (labelBtn && labelBtn.getAttribute('aria-expanded') === 'false') {
    labelBtn.click();
  }

  const success = tryExtractAndStore();
  if (success || attempts >= 30) {
    if (!success) console.log("Enaj: Gave up after 30 attempts");
    clearInterval(retryInterval);
  }
}, 500);

const ingredientObserver = new MutationObserver(() => {
  const success = tryExtractAndStore();
  if (success) ingredientObserver.disconnect();
});
ingredientObserver.observe(document.body, { childList: true, subtree: true });
