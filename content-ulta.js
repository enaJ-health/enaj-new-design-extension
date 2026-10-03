// content-ulta.js
// Runs on Ulta product pages (ulta.com/p/*)

console.log("Enaj: content-ulta.js LOADED on", window.location.href);

function looksLikeIngredients(parsed) {
  if (parsed.length < 5) return false;
  const avgWords = parsed.reduce((sum, s) => sum + s.split(' ').length, 0) / parsed.length;
  if (avgWords > 3.5) return false;
  const hasActionVerbs = parsed.some(s =>
    /\b(apply|use|rinse|wash|massage|leave|mix|shake|spray|avoid|skip|gently|carefully)\b/i.test(s)
  );
  if (hasActionVerbs) return false;
  return true;
}

function parseIngredientText(text) {
  let cleaned = text;

  cleaned = cleaned.replace(/\.?\s*Purpose\s*:[^.]+\./gi, "");
  cleaned = cleaned.replace(/Inactive\s+ingredients?\s*:/gi, ",");
  cleaned = cleaned.replace(/Active\s+ingredients?\s*:/gi, "");
  cleaned = cleaned.replace(/Other\s+ingredients?\s*:/gi, ",");
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

function extractProductData() {
  const data = {
    name: "",
    brand: "",
    ingredients: [],
    description: "",
    image: "",
    price: "",
    url: window.location.href,
    source: "ulta",
  };

  // Name
  const nameEl = document.querySelector("h1[class*='ProductName'], h1[class*='productName'], h1");
  if (nameEl) data.name = nameEl.textContent.trim();

  // Brand
  const brandEl = document.querySelector(
    "a[class*='ProductBrand'], span[class*='brand'], a[class*='brand']"
  );
  if (brandEl) data.brand = brandEl.textContent.trim();

  // Price
  const priceEl = document.querySelector("span[class*='Price'], p[class*='price'], [class*='price']");
  if (priceEl) data.price = priceEl.textContent.trim();

  // Image
  const imgEl = document.querySelector("div.Image img, [aria-label*='Slide 1'] img");
  if (imgEl) data.image = imgEl.src || "";

  // Ingredients — accordion with aria-label or text "Ingredients"
  const accordionBtns = document.querySelectorAll(
    "button.pal-c-Accordion__button, button[class*='Accordion__button']"
  );
  for (const btn of accordionBtns) {
    const label = btn.getAttribute("aria-label") || btn.textContent || "";
    if (/^ingredients?$/i.test(label.trim())) {
      const accordionDiv = btn.closest("[class*='pal-c-Accordion']") ||
                           btn.closest("[class*='Accordion']");
      if (accordionDiv) {
        const bodyEl = accordionDiv.querySelector(
          "section[class*='Accordion__body'], div[class*='Accordion__body']"
        );
        if (bodyEl) {
          // Join ALL paragraphs so "Other Ingredients" second <p> is included
          const allText = Array.from(
            bodyEl.querySelectorAll("div.Markdown p, div[class*='Markdown'] p, p")
          )
            .map(p => p.textContent.trim())
            .filter(t => t.length > 1)
            .join(", ");
          if (allText) {
            const parsed = parseIngredientText(allText);
            if (looksLikeIngredients(parsed)) {
              data.ingredients = parsed;
            }
          }
          if (data.ingredients.length > 0) break;
        }
      }
    }
  }

  // Fallback: any Markdown p with comma-separated content
// Fallback: iterate Markdown containers, joining all <p> in each
if (data.ingredients.length === 0) {
    const markdownDivs = document.querySelectorAll("div.Markdown, div[class*='Markdown']");
    for (const div of markdownDivs) {
      const allText = Array.from(div.querySelectorAll("p"))
        .map(p => p.textContent.trim())
        .filter(t => t.length > 1)
        .join(", ");
      if (!allText || !allText.includes(',')) continue;
      const parsed = parseIngredientText(allText);
      if (looksLikeIngredients(parsed)) {
        data.ingredients = parsed;
        break;
      }
    }
  }
  

  data.ingredients = [...new Set(data.ingredients)].filter(i => i.length > 1);

  console.log("Enaj: Ulta extracted", {
    name: data.name,
    brand: data.brand,
    ingredientCount: data.ingredients.length,
  });

  return data;
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
    console.log("Enaj: Stored Ulta '" + data.name + "' with " + data.ingredients.length + " ingredients");
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
