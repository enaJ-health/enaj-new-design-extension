// content-walmart.js
// Runs on Walmart product pages (walmart.com/ip/*)

chrome.storage.local.remove(["currentProduct"]);

function extractProductData() {
  const data = {
    name: "",
    brand: "",
    ingredients: [],
    description: "",
    image: "",
    price: "",
    url: window.location.href,
    source: "walmart",
  };

  // ── Get name, brand, price from JSON-LD ──
  try {
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  
    for (const script of ldScripts) {
      const json = JSON.parse(script.textContent);
  
      const product =
        json["@type"] === "Product"
          ? json
          : Array.isArray(json)
            ? json.find(j => j["@type"] === "Product")
            : null;
  
      if (product) {
        data.name = data.name || product.name || "";
        data.brand = data.brand || product.brand?.name || product.brand || "";
  
        if (!data.price && product.offers) {
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          data.price = offer.price ? "$" + offer.price : "";
        }
  
        if (!data.image) {
          data.image = Array.isArray(product.image)
            ? product.image[0]
            : (product.image || "");
        }
      }
    }
  } catch (e) {
    console.warn("Enaj: JSON-LD parse failed", e);
  }

  // ── DOM fallback for image (Walmart updated layout) ──
  if (!data.image) {
    const imageSelectors = [
      'img[data-testid="hero-image"]',
      'img[data-testid="product-image"]',
      'img[loading="eager"]',
      'img[src*="i5.walmartimages.com"]',
    ];

    for (const selector of imageSelectors) {
      const img = document.querySelector(selector);
      if (!img) continue;

      let src =
        img.getAttribute("src") ||
        img.getAttribute("data-src") ||
        "";

      // Handle srcset (higher quality images)
      if (!src && img.getAttribute("srcset")) {
        src = img
          .getAttribute("srcset")
          .split(",")
          .map(s => s.trim().split(" ")[0])
          .pop();
      }

      if (src && src.includes("walmartimages")) {
        data.image = src;
        break;
      }
    }
  }

  // ── DOM fallback for name ──
  if (!data.name) {
    const h1 = document.querySelector("h1");
    if (h1) data.name = h1.textContent.trim();
  }

  // ── Extract ingredients from DOM ──
  // Walmart puts them in collapsed sections with h2/h3 "Ingredients"
  // The content is in <p> tags inside, even though the section is hidden
  
  // Method 1: Find all h2/h3 with "Ingredients" text, grab the next <p>
  const headings = document.querySelectorAll("h2, h3");
  for (const heading of headings) {
    const text = heading.textContent.trim().toLowerCase();
    if (text === "ingredients" || text === "active ingredients") {
      // Find the next sibling <p> or the <p> inside the parent
      let p = heading.nextElementSibling;
      while (p && p.tagName !== "P") {
        p = p.nextElementSibling;
      }
      if (p && p.textContent.trim().length > 5) {
        const parsed = parseIngredientText(p.textContent.trim());
        if (parsed.length > 0) {
          data.ingredients.push(...parsed);
        }
      }
    }
  }

  // Method 2: Find <p> elements near "Ingredients" sections by class
  if (data.ingredients.length === 0) {
    const allP = document.querySelectorAll("p.mid-gray, p.f6");
    for (const p of allP) {
      const prevH = p.previousElementSibling;
      if (prevH && /ingredient/i.test(prevH.textContent)) {
        const parsed = parseIngredientText(p.textContent.trim());
        if (parsed.length > 0) {
          data.ingredients.push(...parsed);
        }
      }
    }
  }

  // Method 3: Search expand-collapse sections
  if (data.ingredients.length === 0) {
    const sections = document.querySelectorAll(".expand-collapse-section, [data-testid='ui-collapse-panel']");
    for (const section of sections) {
      if (/ingredient/i.test(section.textContent.substring(0, 200))) {
        const paragraphs = section.querySelectorAll("p");
        for (const p of paragraphs) {
          if (p.textContent.trim().length > 20) {
            const parsed = parseIngredientText(p.textContent.trim());
            if (parsed.length > 0) {
              data.ingredients.push(...parsed);
            }
          }
        }
      }
    }
  }

  // Method 4: __NEXT_DATA__ deep search
  if (data.ingredients.length === 0) {
    try {
      const script = document.querySelector("script#__NEXT_DATA__");
      if (script) {
        const fullText = script.textContent;
        const patterns = [
          /(?:^Ingredients$|^INGREDIENTS$|^Active Ingredients$)\s*[:\-]?\s*([A-Z][A-Z\s\/\-\(\),\.\u2022•]+)/g,
                    /(?:\\u003cp[^>]*>)((?:AQUA|Water|Aqua)[^<\\]+)/gi,
        ];
        for (const pattern of patterns) {
          const matches = [...fullText.matchAll(pattern)];
          for (const match of matches) {
            if (match[1] && match[1].length > 20) {
              const cleaned = match[1]
                .replace(/\\u003c[^>]*>/g, " ")
                .replace(/<[^>]*>/g, " ")
                .replace(/\\n/g, " ")
                .replace(/\\"/g, '"');
              const parsed = parseIngredientText(cleaned);
              if (parsed.length >= 3) {
                data.ingredients.push(...parsed);
                break;
              }
            }
          }
          if (data.ingredients.length > 0) break;
        }
      }
    } catch (e) {}
  }

  // Method 5: Full page text scan
  if (data.ingredients.length === 0) {
    const pageText = document.body.innerText;
    const match = pageText.match(/(?:Ingredients|INGREDIENTS)\s*[:\-]?\s*((?:AQUA|Water|Aqua)[^\n]+)/i);
    if (match && match[1]) {
      const parsed = parseIngredientText(match[1]);
      if (parsed.length > 0) data.ingredients = parsed;
    }
  }

  // Deduplicate
  data.ingredients = [...new Set(data.ingredients)].filter(i => i.length > 1);

  console.log("Enaj: Extracted", {
    name: data.name,
    brand: data.brand,
    price: data.price,
    ingredientCount: data.ingredients.length,
    ingredients: data.ingredients.slice(0, 10),
  });

  return data;
}

function parseIngredientText(text) {
  let cleaned = text;

  cleaned = cleaned
    .replace(/^[A-Z0-9]+\s*INGREDIENTS?\s*[:\-]?\s*/i, "")
    .replace(/^INGREDIENTS?\s*[:\-]?\s*/i, "")
    .replace(/^ACTIVE INGREDIENTS?\s*[:\-]?\s*/i, "")
    .replace(/\(F\.I\.L\.[^)]*\)/gi, "")
    .replace(/\+\/-\s*MAY CONTAIN\s*\/?/gi, ", ")
    .replace(/MAY CONTAIN\s*\/?/gi, ", ")
    .replace(/<?\s*\d+(\.\d+)?\s*%/g, "");

  cleaned = cleaned.replace(/\s*\(/g, ", ").replace(/\)/g, "");
  cleaned = cleaned.replace(/\s*\[/g, ", ").replace(/\]/g, "");

  let items;

  if (cleaned.includes("•") || cleaned.includes("\u2022")) {
    items = cleaned.split(/[•\u2022]/);
  } else if (cleaned.includes(",") || cleaned.includes(";") || cleaned.includes("/")) {
    items = cleaned.split(/[,;\/]+/);
  } else {
    items = cleaned.split(/\s+(?=[A-Z]{2})/);
    if (items.length < 3) items = [cleaned];
  }

  return items
    .map(s => s.replace(/^\s*[-\u2013\u2014:*\u2022\u00b7\/]\s*/, "").trim())
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(s => s.length > 1 && s.length < 100)
    .filter(s => !s.match(/^\d+$/))
    .filter(s => !s.match(/^(and|or|with|from|as|the|a|an|EAU|WATER)$/i))
    .filter((value, index, self) => self.indexOf(value) === index);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProductData") {
    const data = extractProductData();
    sendResponse(data);
  }
  return true;
});

setTimeout(() => {
  const data = extractProductData();
  if (data.name) {
    chrome.storage.local.set({ currentProduct: data });
    console.log("Enaj: Stored '" + data.name + "' with " + data.ingredients.length + " ingredients");
  }
}, 2500);

let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(() => {
      const data = extractProductData();
      if (data.name) {
        chrome.storage.local.set({ currentProduct: data });
      }
    }, 2500);
  }
});
urlObserver.observe(document.body, { childList: true, subtree: true });