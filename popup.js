// popup.js — Enaj Chrome Extension
const API_URL = "https://enaj-back-production.up.railway.app";
const ENAJ_SITE = "https://www.enajhealth.com";

const $ = (id) => document.getElementById(id)
let setupScreen, userBar, noProduct, productSection, loadingEl, resultsEl

let userId = null;
let currentProduct = null;

// ════════════════════════════════════════
// Inline SVG icons (replace emoji)
// ════════════════════════════════════════
const ICONS = {
  search: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>',
  frown: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5-2 4-2 4 2 4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  bag: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2l-3 6v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8l-3-6z"/><path d="M3 8h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  alert: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  checkCircle: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  xCircle: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  bookmark: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  loader: '<svg class="icon spin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg>',
};

// ════════════════════════════════════════
// Init
// ════════════════════════════════════════
async function init() {
  const stored = await chrome.storage.local.get(["enajUserId", "enajUserName"]);

  if (stored.enajUserId) {
    userId = stored.enajUserId;
    const profileRes = await fetch(`${API_URL}/api/extension/profile?userId=${userId}`);
    if (profileRes.ok) {
      const profile = await profileRes.json();
      await chrome.storage.local.set({
        preferences: profile.preferences || [],  // [{id, name, slug}]
        ailments: profile.ailments || [],
        journal: profile.journal || [],
      });
    }
    showConnected(stored.enajUserName || "there");
    await loadProduct();
  } else {
    // Instead of showing setup, show onboarding message only
    hideAll();
    setupScreen.style.display = "block";
  }
}

// ════════════════════════════════════════
// Views
// ════════════════════════════════════════
function hideAll() {
  [setupScreen, userBar, noProduct, productSection, loadingEl, resultsEl]
    .forEach(el => el.style.display = "none");
}

function showSetup() {
  hideAll();
  setupScreen.style.display = "block";
}

function showConnected(name) {
  userBar.style.display = "flex";
  $("user-name").innerHTML = `<span class="dot"></span>Welcome, ${name}!`;
}

// ════════════════════════════════════════
// Connect / Disconnect
// ════════════════════════════════════════

$("disconnect-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove(["enajUserId", "enajUserName"]);
  userId = null;
  currentProduct = null;
  hideAll();
  showSetup();
});

// ════════════════════════════════════════
// Load product from current tab
// ════════════════════════════════════════
async function loadProduct() {
  hideAll();
  userBar.style.display = "flex";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const isWalmart = tab?.url?.includes("walmart.com/ip/");
    const isAmazon = tab?.url?.includes("amazon.com") && tab?.url?.includes("/dp/");
    const isRealeActives = tab?.url?.includes("realeactives.com");
    const isSephora = tab?.url?.includes("sephora.com/product/");
    const isUlta = tab?.url?.includes("ulta.com/p/");
    const isTarget = tab?.url?.includes("target.com/p/");

    if (!isWalmart && !isAmazon && !isRealeActives && !isSephora && !isUlta && !isTarget) {
      noProduct.style.display = "block";
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "getProductData" });
      if (response?.name) {
        currentProduct = response;
        displayProduct(response);
        return;
      }
    } catch (e) {
      console.log("Enaj: Content script not ready, waiting...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "getProductData" });
        if (response?.name) {
          currentProduct = response;
          displayProduct(response);
          return;
        }
      } catch (e) {
        console.log("Enaj: Content script not ready, checking storage");
        const debugStorage = await chrome.storage.local.get(null);
        console.log("Enaj: All storage contents:", JSON.stringify(debugStorage));
      }
    }

    const stored = await chrome.storage.local.get(["currentProduct"]);
    if (stored.currentProduct?.name) {
      currentProduct = stored.currentProduct;
      displayProduct(stored.currentProduct);
    } else {
      noProduct.style.display = "block";
    }
  } catch (err) {
    console.error("Enaj: Load error", err);
    noProduct.style.display = "block";
  }
}

function displayProduct(product) {
  $("product-brand").textContent = product.brand || "";
  $("product-name").textContent = product.name || "Unknown Product";

  const img = $("product-img");
  if (product.image) {
    img.src = product.image;
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }

  productSection.style.display = "block";
  resultsEl.style.display = "none";
}

// ════════════════════════════════════════
// Scan
// ════════════════════════════════════════
$("scan-btn").addEventListener("click", async () => {
  if (!currentProduct || !userId) return;

  const btn = $("scan-btn");
  const label = $("scan-label");
  const labelOriginal = label ? label.textContent : "";
  btn.disabled = true;
  if (label) label.textContent = "Scanning with enaJ";
  loadingEl.style.display = "block";
  productSection.style.display = "none";
  resultsEl.style.display = "none";

  let fromExternal = false;

  try {
  let ingredients = currentProduct.ingredients || [];
  let fromExternal = false;

  const possiblyIncomplete =
    currentProduct.ingredientCompleteness === "possibly_incomplete";

  // If no ingredients were found on the retailer page,
  // try looking in enaJ's external product database first.

    if (ingredients.length === 0) {
    try {
      const searchRes = await fetch(
        `${API_URL}/api/product-search?q=${encodeURIComponent(currentProduct.name)}&source=all&pageSize=5&category=${detectCategory(currentProduct)}`
        );

      if (searchRes.ok) {
        const searchData = await searchRes.json();

        if (searchData.products?.length > 0) {
          const productWords = currentProduct.name
            .toLowerCase()
            .split(" ")
            .filter((w) => w.length > 3);

          const match = searchData.products.find((p) => {
            const extName = (p.name || "").toLowerCase();
            const matchingWords = productWords.filter((w) =>
              extName.includes(w)
            );

            if (matchingWords.length < 2) return false;

            const ings = p.ingredients || [];

            if (ings.length < 3) return false;

            const hasNonEnglish = ings.some(
              (ing) => /[^\x00-\x7F]/.test(ing)
            );
            if (hasNonEnglish) return false;

            const hasGarbage = ings.some(
              (ing) =>
                ing.length > 80 ||
                /\d{5,}/.test(ing) ||
                /[A-Z]{22,}/.test(ing) ||
                ing.split(" ").length > 10
            );

            if (hasGarbage) return false;

            return true;
          });

          if (match) {
            ingredients = match.ingredients || [];
            currentProduct.ingredients = ingredients;
            currentProduct.packaging = match.packaging || [];
            currentProduct.allergens = match.allergens || [];

            fromExternal = true;
          }
        }
      }
    } catch (e) {
      console.log("Enaj: Database search failed", e);
    }
  }
  // Still couldn't find ingredients anywhere.
    if (ingredients.length === 0) {
      loadingEl.style.display = "none";
      btn.disabled = false;
      if (label) label.textContent = labelOriginal;

      showExternalPrompt(false);
      return;
    }

    // Retailer appears to provide only a partial ingredient list.
    if (possiblyIncomplete && !fromExternal) {
      loadingEl.style.display = "none";
      btn.disabled = false;
      if (label) label.textContent = labelOriginal;

      showExternalPrompt(true);
      return;
    }

    fromExternal = (currentProduct.ingredients !== ingredients);

    const importRes = await fetch(`${API_URL}/api/import-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: currentProduct.name,
        brand: currentProduct.brand || "Unknown Brand",
        image: currentProduct.image || "",
        ingredients: ingredients,
        packaging: currentProduct.packaging || [],
        allergens: currentProduct.allergens || [],
        category: detectCategory(currentProduct),
      }),
    });

    if (!importRes.ok) throw new Error("Import failed");
    const importData = await importRes.json();
    const saved = importData.product;

    const cat = saved.category.toLowerCase().replace("_", "-");
    const scanRes = await fetch(`${API_URL}/api/products/${cat}/${saved.slug}/scan?userId=${userId}`);

    if (!scanRes.ok) throw new Error("Scan failed");
    const scanData = await scanRes.json();

    loadingEl.style.display = "none";
    renderResults(scanData, ingredients, fromExternal);

  } catch (err) {
    console.error("Enaj: Scan error", err);
    loadingEl.style.display = "none";
    resultsEl.innerHTML = `
      <div class="section-pad center">
        <div class="result-badge warning">${ICONS.xCircle} Scan Failed</div>
        <p class="sub-text">Something went wrong. Please try again.</p>
      </div>
    `;
    resultsEl.style.display = "block";
  } finally {
    btn.disabled = false;
    if (label) label.textContent = labelOriginal;
  }
});

async function tryOpenBeautyFacts(name, brand) {
  const query = encodeURIComponent(`${brand} ${name}`.trim());
  const res = await fetch(
    `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&fields=product_name,brands,ingredients_text`
  );
  if (!res.ok) return null;
  const data = await res.json();
  console.log("Enaj user response:", data);
  for (const p of (data.products || []).slice(0, 3)) {
    if (p.ingredients_text?.trim().length > 20) {
      return p.ingredients_text.split(",").map(s => s.trim()).filter(s => s.length > 1);
    }
  }
  return null;
}

function showExternalPrompt(isPartial = false) {
  resultsEl.innerHTML = `
    <div class="state">
      <div class="state-icon">${ICONS.search}</div>
      <h3>${isPartial ? "This may not be the full ingredient list" : "Ingredients not found"}</h3>
      <p>
        ${
          isPartial
            ? "Amazon appears to show only key or featured ingredients. Would you like enaJ to search external sources for a more complete ingredient list?"
            : "We couldn't find ingredients on this page. Would you like enaJ to search external sources?"
        }
      </p>
      <div style="margin-top:16px;">
        <button class="btn btn-primary" id="yes-external-btn">${ICONS.search} Search external sources</button>
        <button class="btn btn-secondary" id="no-external-btn">
          ${
            isPartial
              ? "No, use the available ingredients"
              : "No, I'll look it up in enaJ Shop"
          }
        </button>
      </div>
    </div>
  `;
  resultsEl.style.display = "block";

  document.getElementById("yes-external-btn").addEventListener("click", async () => {
    const yesBtn = document.getElementById("yes-external-btn");
    const noBtn = document.getElementById("no-external-btn");
    yesBtn.disabled = true;
    yesBtn.innerHTML = `${ICONS.loader} Searching...`;
    noBtn.style.display = "none";

    try {
      const query = `${currentProduct.brand} ${currentProduct.name}`.trim();
      const searchRes = await fetch(
        `${API_URL}/api/product-search?q=${encodeURIComponent(query)}&source=all&pageSize=10&category=${detectCategory(currentProduct)}`
        );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.products?.length > 0) {
          const productWords = currentProduct.name.toLowerCase().split(' ').filter(w => w.length > 3);
          let match = searchData.products.find(p => {
            const extName = (p.name || '').toLowerCase();
            const matchingWords = productWords.filter(w => extName.includes(w));
            if (matchingWords.length < 2) return false;
            const ings = p.ingredients || [];
            if (ings.length < 3) return false;
            const hasNonEnglish = ings.some(ing => /[^\x00-\x7F]/.test(ing));
            if (hasNonEnglish) return false;
            const hasGarbage = ings.some(ing =>
              ing.length > 80 ||
              /\d{5,}/.test(ing) ||
              /[A-Z]{15,}/.test(ing) ||
              ing.split(' ').length > 10
            );
            if (hasGarbage) return false;
            return true;
          });

          if (!match) {
            const obfIngs = await tryOpenBeautyFacts(currentProduct.name, currentProduct.brand);
            if (obfIngs) {
              match = { ingredients: obfIngs, packaging: [], allergens: [] };
            }
          }

          if (!match) {
            resultsEl.innerHTML = `
              <div class="state">
                <div class="state-icon">${ICONS.frown}</div>
                <h3>Not found anywhere</h3>
                <p>We couldn't find this product's ingredients. Try searching for it in the enaJ Shop.</p>
                <div style="margin-top:16px;">
                  <a href="${ENAJ_SITE}" target="_blank" class="btn btn-primary">${ICONS.bag} Open enaJ Shop</a>
                </div>
              </div>
            `;
            return;
          }

          currentProduct.ingredients = match.ingredients || [];
          currentProduct.packaging = match.packaging || [];
          currentProduct.allergens = match.allergens || [];

          if (currentProduct.ingredients.length > 0) {
            const importRes = await fetch(`${API_URL}/api/import-product`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: currentProduct.name,
                brand: currentProduct.brand || "Unknown Brand",
                image: currentProduct.image || "",
                ingredients: currentProduct.ingredients,
                packaging: currentProduct.packaging,
                allergens: currentProduct.allergens,
                category: detectCategory(currentProduct),
              }),
            });

            if (importRes.ok) {
              const importData = await importRes.json();
              const saved = importData.product;
              const cat = saved.category.toLowerCase().replace("_", "-");
              const scanRes = await fetch(`${API_URL}/api/products/${cat}/${saved.slug}/scan?userId=${userId}`);

              if (scanRes.ok) {
                const scanData = await scanRes.json();
                renderResults(scanData, currentProduct.ingredients, true);
                return;
              }
            }
          }
        }
      }

      // Backend returned no products — try Open Beauty Facts
      const obfIngs = await tryOpenBeautyFacts(currentProduct.name, currentProduct.brand);
      if (obfIngs) {
        currentProduct.ingredients = obfIngs;
        currentProduct.packaging = [];
        currentProduct.allergens = [];

        const importRes = await fetch(`${API_URL}/api/import-product`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: currentProduct.name,
            brand: currentProduct.brand || "Unknown Brand",
            image: currentProduct.image || "",
            ingredients: currentProduct.ingredients,
            packaging: [],
            allergens: [],
            category: detectCategory(currentProduct),
          }),
        });

        if (importRes.ok) {
          const importData = await importRes.json();
          const saved = importData.product;
          const cat = saved.category.toLowerCase().replace("_", "-");
          const scanRes = await fetch(`${API_URL}/api/products/${cat}/${saved.slug}/scan?userId=${userId}`);

          if (scanRes.ok) {
            const scanData = await scanRes.json();
            renderResults(scanData, currentProduct.ingredients, true);
            return;
          }
        }
      }

      // Nothing found anywhere
      resultsEl.innerHTML = `
        <div class="state">
          <div class="state-icon">${ICONS.frown}</div>
          <h3>Not found anywhere</h3>
          <p>We couldn't find this product's ingredients. Try searching for it in the enaJ Shop.</p>
          <div style="margin-top:16px;">
            <a href="${ENAJ_SITE}" target="_blank" class="btn btn-primary">${ICONS.bag} Open enaJ Shop</a>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Enaj: External search failed", err);
      resultsEl.innerHTML = `
        <div class="section-pad center">
          <div class="result-badge warning">${ICONS.xCircle} Search Failed</div>
          <p class="sub-text">Please try again or search in the enaJ Shop.</p>
          <div style="margin-top:12px;">
            <a href="${ENAJ_SITE}" target="_blank" class="btn btn-primary">${ICONS.bag} Open enaJ Shop</a>
          </div>
        </div>
      `;
    }
  });

    document.getElementById("no-external-btn").addEventListener("click", async () => {
    if (isPartial) {
      const noBtn = document.getElementById("no-external-btn");
      const yesBtn = document.getElementById("yes-external-btn");
      if (noBtn) {
        noBtn.disabled = true;
        noBtn.innerHTML = `${ICONS.loader} Scanning...`;
      }
      if (yesBtn) yesBtn.style.display = "none";

      try {
        const ingredients = currentProduct.ingredients || [];
        const importRes = await fetch(`${API_URL}/api/import-product`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: currentProduct.name,
            brand: currentProduct.brand || "Unknown Brand",
            image: currentProduct.image || "",
            ingredients: ingredients,
            packaging: currentProduct.packaging || [],
            allergens: currentProduct.allergens || [],
            category: detectCategory(currentProduct),
          }),
        });

        if (!importRes.ok) throw new Error("Import failed");
        const importData = await importRes.json();
        const saved = importData.product;

        const cat = saved.category.toLowerCase().replace("_", "-");
        const scanRes = await fetch(`${API_URL}/api/products/${cat}/${saved.slug}/scan?userId=${userId}`);
        if (!scanRes.ok) throw new Error("Scan failed");
        const scanData = await scanRes.json();

        renderResults(scanData, ingredients, false);
      } catch (err) {
        console.error("Enaj: scan-with-available error", err);
        resultsEl.innerHTML = `
          <div class="section-pad center">
            <div class="result-badge warning">${ICONS.xCircle} Scan Failed</div>
            <p class="sub-text">Something went wrong. Please try again.</p>
          </div>
        `;
      }
      return;
    }

    resultsEl.innerHTML = `
      <div class="state">
        <div class="state-icon">${ICONS.bag}</div>
        <p>You can look up this product in the enaJ Shop to check its ingredients.</p>
        <div style="margin-top:16px;">
          <a href="${ENAJ_SITE}" target="_blank" class="btn btn-primary">${ICONS.bag} Open enaJ Shop</a>
        </div>
      </div>
    `;
  });
}

// ════════════════════════════════════════
// Render scan results
// ════════════════════════════════════════
async function renderResults(scanData, originalIngredients, fromExternal) {
  const stored = await chrome.storage.local.get(["preferences", "ailments", "journal"]);
  const storedPreferences = stored.preferences || [];
  const storedAilments = stored.ailments || [];
  const storedJournal = stored.journal || [];


  const flagged = scanData.flaggedIngredients || [];
  const flaggedNames = new Set(flagged.map(f => f.ingredient.toLowerCase()));
  const ingredients = originalIngredients || scanData.product?.ingredients || [];
  const savedSlug = scanData.product?.slug || "";

  let html = "";

  if (fromExternal) {
    html += `
      <div class="banner">
        ${ICONS.alert}
        <div>
          We couldn't find ingredients on this page. We located an ingredient list from an external source.
          <strong>Please verify with the brand or retailer.</strong>
        </div>
      </div>
    `;
  }

  if (flagged.length === 0) {
    html += `
      <div class="section-pad center">
        <div class="result-badge safe">${ICONS.checkCircle} No Alerts</div>
        <p class="sub-text">No flagged ingredients found based on your health profile.</p>
        <p class="muted-note">Informational only — not medical advice.</p>
      </div>
    `;
  } else {
    html += `<div class="flags-wrap">`;
    for (const flag of flagged) {
      const isAilment = flag.source === "ailment";
      const isJournal = flag.source === "journal";



      let learnUrl, reasonText, infoText;


      if (isAilment) {
        const slug = flag.sourceName.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        learnUrl = `https://www.enajhealth.com/education/${slug}?from=conditions`
        reasonText = `Flagged because you marked <strong>${flag.sourceName}</strong>.`
        } else if (isJournal) {
          const matchedEntry = storedJournal.find(j => {
            if (typeof j === "string") {
              return j.toLowerCase() === flag.sourceName.toLowerCase();
            }
            return j.name?.toLowerCase() === flag.sourceName.toLowerCase();
          });
          const journalSlug = (typeof matchedEntry === "object" && matchedEntry?.slug)
            ? matchedEntry.slug
            : flag.sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          learnUrl = `https://www.enajhealth.com/journal?from=journal`;
          reasonText = `Flagged because of your journal entry: <strong>${flag.sourceName}</strong>.`;
        } else {
          const matchedPref = storedPreferences.find((p) => {
            if (typeof p === "string") {
              return p.toLowerCase() === flag.sourceName.toLowerCase();
            }
            return p.name?.toLowerCase() === flag.sourceName.toLowerCase();
          });
          const prefSlug = (typeof matchedPref === "object" && matchedPref?.slug)
            ? matchedPref.slug
            : flag.sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          learnUrl = `https://www.enajhealth.com/education/${prefSlug}?from=preferences`;
          const prefLower = flag.sourceName.toLowerCase();
          reasonText = `Flagged because you marked <strong>${flag.sourceName}</strong>.`;
        }
      
        html += `
          <div class="flag-item">
            <div class="flag-head">${ICONS.alert} Ingredient Alert</div>
            <div class="ing-name">Contains: ${flag.ingredient}</div>
            <div class="reason">
              ${reasonText}
              <a href="${learnUrl}" target="_blank">Learn why →</a>
            </div>
          </div>
        `;
      }

    html += `<p class="muted-note center">Informational only — not medical advice.</p></div>`;
  }

  html += `
    <div style="padding:8px 16px 12px;">
      <button class="btn btn-secondary" id="save-product-btn" data-slug="${savedSlug}">
        ${ICONS.bookmark} Save Product
      </button>
    </div>
  `;

  if (ingredients.length > 0) {
    html += `<div class="ing-list"><h3>Full Ingredient List</h3><div>`;
    for (const ing of ingredients) {
      const isFlagged = flaggedNames.has(ing.toLowerCase()) ||
        [...flaggedNames].some(fn => ing.toLowerCase().includes(fn));
      html += `<span class="ing-tag ${isFlagged ? "flagged" : ""}">${ing}</span>`;
    }
    html += `</div></div>`;
  }

  resultsEl.innerHTML = html;
  resultsEl.style.display = "block";

  const saveBtn = document.getElementById("save-product-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const slug = saveBtn.getAttribute("data-slug");
      if (!userId || !slug) return;
      saveBtn.disabled = true;
      saveBtn.innerHTML = `${ICONS.loader} Saving...`;
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log("Saving with userId:", userId, "slug:", slug);
        const res = await fetch(API_URL + "/api/saved-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            productSlug: slug,
            productUrl: tab.url
          }),
        });
        if (res.ok) {
          saveBtn.innerHTML = `${ICONS.check} Saved to your enaJ profile!`;
          saveBtn.style.background = "var(--success-bg)";
          saveBtn.style.color = "var(--success-text)";
          saveBtn.style.borderColor = "var(--success-border)";
        } else if (res.status === 409) {
          saveBtn.innerHTML = `${ICONS.check} Already Saved`;
        } else {
          saveBtn.innerHTML = `${ICONS.x} Failed`;
        }
      } catch (e) {
        saveBtn.innerHTML = `${ICONS.x} Failed`;
      }
    });
  }
}

// ════════════════════════════════════════
// Helpers
// ════════════════════════════════════════
// Choose "a" or "an" based on whether the next word starts with a vowel sound.
function indefiniteArticle(word) {
  return /^[aeiou]/i.test((word || "").trim()) ? "an" : "a";
}

function detectCategory(product) {
  const n = (product.name || "").toLowerCase();
  if (/shampoo|conditioner|hair/.test(n)) return "haircare";
  if (/foundation|mascara|lipstick|concealer|eyeshadow|makeup|blush|primer/.test(n)) return "makeup";
  if (/perfume|cologne|fragrance|eau de/.test(n)) return "fragrance";
  if (/cleaner|detergent|dish|bleach|lysol|windex|clorox|tide|laundry|soap/.test(n)) return "cleaning";
  if (/candle|air freshener|trash bag|paper towel/.test(n)) return "household";
  if (/cleanser|moisturizer|lotion|sunscreen|body wash|deodorant|toothpaste|cream|serum/.test(n)) return "skin-body";
  if (/cereal|protein|bar|chips|cookie|bread|snack|drink|juice|milk|water/.test(n)) return "food";
  return "skin-body";
}

document.addEventListener("DOMContentLoaded", () => {
  setupScreen = $("setup-screen")
  userBar = $("user-bar")
  noProduct = $("no-product")
  productSection = $("product-section")
  loadingEl = $("loading")
  resultsEl = $("results")

  init()
  $("product-img").addEventListener("error", function() {
    this.style.display = "none";
  })
})
