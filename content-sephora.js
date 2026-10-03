// content-sephora.js
// Runs on Sephora product pages (sephora.com/product/*)

console.log("Enaj: content-sephora.js LOADED on", window.location.href);

function extractProductData() {
  const data = {
    name: "",
    brand: "",
    ingredients: [],
    description: "",
    image: "",
    price: "",
    url: window.location.href,
    source: "sephora",
  };

  // Name
  const nameEl = document.querySelector(
    "span[data-at='product_name'], h1[data-comp*='ProductName'], h1"
  );
  if (nameEl) data.name = nameEl.textContent.trim();

  // Brand
  const brandEl = document.querySelector(
    "a[data-at='brand_name'], span[data-at='brand_name'], [data-at='brand_name']"
  );
  if (brandEl) data.brand = brandEl.textContent.trim();

  // Price
  const priceEl = document.querySelector(
    "[data-at='price_amount'], [data-comp*='Price'] span"
  );
  if (priceEl) data.price = priceEl.textContent.trim();

  // Image
  const imgEl = document.querySelector(
    'img[src*="productimages"], [data-comp*="ProductImage"] img'
  );
  if (imgEl) data.image = imgEl.src || imgEl.getAttribute('data-src') || "";
  

  const ingSection = document.querySelector('#ingredients');
  if (ingSection) {
    const clone = ingSection.cloneNode(true);
    clone.querySelectorAll('i').forEach(el => el.remove());
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    const lines = clone.textContent.split('\n').map(l => l.trim()).filter(Boolean);
  
    for (const line of lines) {
      if (line.startsWith('-')) continue;
      if (line.length >= 20) {
        const parsed = parseIngredientText(line);
        if (parsed.length >= 5) {
          data.ingredients = parsed;
          break;
        }
      }
    }
  }
  
  

  // Fallback: look for button/section with "Ingredients" heading
  if (data.ingredients.length === 0) {
    const buttons = document.querySelectorAll("button[data-at='ingredients'], button[aria-controls*='ingredient']");
    for (const btn of buttons) {
      const controlsId = btn.getAttribute("aria-controls");
      const section = controlsId ? document.getElementById(controlsId) : null;
      if (section) {
        for (const p of section.querySelectorAll("p")) {
          const text = p.textContent.trim();
          if (text.length > 20) {
            const parsed = parseIngredientText(text);
            if (parsed.length >= 3) {
              data.ingredients = parsed;
              break;
            }
          }
        }
      }
      if (data.ingredients.length > 0) break;
    }
  }

  data.ingredients = [...new Set(data.ingredients)].filter(i => i.length > 1);

  console.log("Enaj: Sephora extracted", {
    name: data.name,
    brand: data.brand,
    ingredientCount: data.ingredients.length,
  });

  return data;
}

function parseIngredientText(text) {
  let cleaned = text;

  cleaned = cleaned.replace(/\.?\s*Purpose\s*:[^.]+\./gi, "");
  cleaned = cleaned.replace(/Inactive\s+ingredients?\s*:/gi, ",");
  cleaned = cleaned.replace(/Active\s+ingredients?\s*:/gi, "");
  cleaned = cleaned.replace(/Other\s+ingredients?\s*:/gi, ",");
  cleaned = cleaned.replace(/May\s+Contain[^:]*:/gi, ",");
  cleaned = cleaned.replace(/\s*\(?\s*\d+(\.\d+)?\s*%\s*\)?/g, "");
  cleaned = cleaned.replace(/\(F\.I\.L\.[^)]*\)/g, "");
  cleaned = cleaned.replace(/\s*\(/g, ", ");
  cleaned = cleaned.replace(/\)/g, "");

  let items;
  if (cleaned.includes("•") || cleaned.includes("\u2022")) {
    items = cleaned.split(/[•\u2022]/);
  } else if (cleaned.includes(",")) {
    items = cleaned.split(/[,;]|\.\s+/);
  } else {
    items = cleaned.split(/\s+(?=[A-Z]{2})/);
    if (items.length < 3) items = [cleaned];
  }

  return items
    .map(s => s.replace(/^\s*[-\u2013\u2014:*\u2022\u00b7\/]\s*/, "").trim())
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(s => s.length > 1 && s.length < 60)
    .filter(s => s.split(' ').length <= 7)
    .filter(s => !/^(its|now|the|this|our|we|you|get|a |an |is |are )/i.test(s))
    .filter(s => !s.match(/^\d+$/))
    .filter(s => !s.match(/^(and|or|with|from|as|the|a|an)$/i))
    .filter((value, index, self) => self.indexOf(value) === index);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProductData") {
    const data = extractProductData();
    sendResponse(data);
  }
  return true;
});

function tryExtractAndStore() {
  const data = extractProductData();
  if (data.name && data.ingredients.length > 1) {
    chrome.storage.local.set({ currentProduct: data });
    console.log("Enaj: Stored Sephora '" + data.name + "' with " + data.ingredients.length + " ingredients");
    return true;
  }
  return false;
}

let attempts = 0;
const retryInterval = setInterval(() => {
  attempts++;
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
