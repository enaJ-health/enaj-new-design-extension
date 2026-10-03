// content-amazon.js
// Runs on Amazon product pages

console.log("Enaj: content-amazon.js LOADED on", window.location.href);

// ============================================================
// EXTRACT PRODUCT DATA
// ============================================================

function extractProductData() {
  // Always create a fresh object so an old Amazon product
  // can never leak into the new product.
  const data = {
    name: "",
    brand: "",
    ingredients: [],
    description: "",
    image: "",
    price: "",
    url: window.location.href,
    source: "amazon",
    ingredientCompleteness: "complete",
    ingredientCompletenessReason: "",
  };

  // ─────────────────────────────────────────────
  // Product name
  // ─────────────────────────────────────────────

  const titleEl = document.querySelector("#productTitle");

  if (titleEl) {
    data.name = titleEl.textContent.trim();
  }

  // ─────────────────────────────────────────────
  // Brand
  // ─────────────────────────────────────────────

  const brandEl = document.querySelector(
    "#bylineInfo, .po-brand .a-span9"
  );

  if (brandEl) {
    data.brand = brandEl.textContent
      .replace("Brand:", "")
      .replace("Visit the", "")
      .replace("Store", "")
      .trim();
  }

  // ─────────────────────────────────────────────
  // Price
  // ─────────────────────────────────────────────

  const priceEl = document.querySelector(
    ".a-price .a-offscreen, #priceblock_ourprice"
  );

  if (priceEl) {
    data.price = priceEl.textContent.trim();
  }

  // ─────────────────────────────────────────────
  // Image
  // ─────────────────────────────────────────────

  const imgEl = document.querySelector(
    "#landingImage, #imgBlkFront"
  );

  if (imgEl) {
    data.image =
      imgEl.src ||
      imgEl.getAttribute("data-old-hires") ||
      "";
  }

  // ============================================================
  // METHOD 1
  // Amazon Important Information → Ingredients
  // ============================================================

  if (data.ingredients.length === 0) {
    const importantInfoSection =
      document.querySelector("#updatedAmlIngredients_feature_div") ||
      document.querySelector("#ingredients-container") ||
      document.querySelector("#importantInformation_feature_div") ||
      document.querySelector("#important-information") ||
      document.querySelector(
        "[data-feature-name='importantInformation']"
      ) ||
      document.querySelector(
        "[data-feature-name='important-information']"
      );

    if (importantInfoSection) {
      const labels = Array.from(
        importantInfoSection.querySelectorAll(
          "span, b, strong, h2, h3, h4"
        )
      );

      const ingredientLabel = labels.find((el) => {
        const label = el.textContent?.trim().toLowerCase();

        return (
          label === "ingredients" ||
          label === "ingredient" ||
          label === "active ingredients"
        );
      });

      if (ingredientLabel) {
        const parentBlock =
          ingredientLabel.closest(".a-section-content") ||
          ingredientLabel.closest(".a-expander-content") ||
          ingredientLabel.closest(".a-section") ||
          ingredientLabel.parentElement;

        const candidates = [];

        if (parentBlock) {
          candidates.push(
            ...Array.from(
              parentBlock.querySelectorAll("p, span")
            )
          );
        }

        if (
          ingredientLabel.parentElement?.nextElementSibling
        ) {
          candidates.push(
            ingredientLabel.parentElement.nextElementSibling
          );
        }

        if (parentBlock?.nextElementSibling) {
          candidates.push(parentBlock.nextElementSibling);
        }

        for (const candidate of candidates) {
          const text = candidate?.textContent?.trim();

          if (!text) continue;

          if (
            /^(ingredients?|active ingredients?)$/i.test(text)
          ) {
            continue;
          }

          if (
            /safety information|directions|legal disclaimer|our huge range|splurgiest|high-quality at prices/i.test(
              text
            )
          ) {
            continue;
          }

          const parsed = parseIngredientText(text);

          if (parsed.length >= 1) {
            data.ingredients.push(...parsed);
            break;
          }
        }
      }
    }
  }

  // ============================================================
  // METHOD 2
  // Product details tables
  // ============================================================

  if (data.ingredients.length === 0) {
    const rows = document.querySelectorAll(
      "#productDetails_techSpec_section_1 tr, " +
        "#productDetails_db_sections tr, " +
        ".a-expander-content tr, " +
        "#prodDetails tr"
    );

    for (const row of rows) {
      const label = row.querySelector(
        "th, td:first-child"
      );

      const value = row.querySelector(
        "td:last-child"
      );

      if (!label || !value) continue;

      const labelText =
        label.textContent?.trim() || "";

      if (!/ingredient/i.test(labelText)) {
        continue;
      }

      // Do not treat explicitly marketed subsets as full lists.
      if (
        /special|key|featured|highlighted|top ingredients/i.test(
          labelText
        )
      ) {
        continue;
      }

      const parsed = parseIngredientText(
        value.textContent.trim()
      );

      if (parsed.length >= 1) {
        data.ingredients.push(...parsed);
        break;
      }
    }
  }

  // ============================================================
  // METHOD 3
  // Find a normal Ingredients section in page text
  // ============================================================

  if (data.ingredients.length === 0) {
    const pageText = document.body.innerText || "";

    const match = pageText.match(
      /(?:^|\n)\s*ingredients?\s*[:\-]?\s*([A-Za-z(][^\n]{25,})/i
    );

    if (match?.[1]) {
      const parsed = parseIngredientText(
        match[1]
      );

      if (parsed.length >= 3) {
        data.ingredients.push(...parsed);
      }
    }
  }

  // ============================================================
  // METHOD 4
  // Search ingredient-looking paragraphs
  // ============================================================

  if (data.ingredients.length === 0) {
    const blocks = document.querySelectorAll(
      ".a-section p, " +
        ".a-row p, " +
        "[data-feature-name='important-information'] p"
    );

    for (const block of blocks) {
      const text =
        block.textContent?.trim() || "";

      if (
        !/ingredient/i.test(text) ||
        text.length < 40
      ) {
        continue;
      }

      // Don't scrape obvious key/featured ingredient marketing.
      if (
        /key ingredients?|featured ingredients?|highlighted ingredients?|top ingredients?/i.test(
          text
        )
      ) {
        continue;
      }

      const cleaned = text.replace(
        /(?:active\s+)?ingredients?\s*[:\-]?\s*/i,
        ""
      );

      const parsed = parseIngredientText(
        cleaned
      );

      if (parsed.length >= 3) {
        data.ingredients.push(...parsed);
        break;
      }
    }
  }

  // ============================================================
  // METHOD 5
  // Ingredient accordion / headings
  // ============================================================

  if (data.ingredients.length === 0) {
    const labels = document.querySelectorAll(
      "h2, h3, h4, .a-text-bold, span.a-text-bold"
    );

    for (const label of labels) {
      const labelText =
        label.textContent?.trim() || "";

      if (
        !/^(ingredients?|active ingredients?)$/i.test(
          labelText
        )
      ) {
        continue;
      }

      let next =
        label.parentElement?.nextElementSibling ||
        label.nextElementSibling;

      while (next) {
        const text =
          next.textContent?.trim() || "";

        if (text.length > 3) {
          const parsed =
            parseIngredientText(text);

          if (parsed.length >= 1) {
            data.ingredients.push(...parsed);
            break;
          }
        }

        next = next.nextElementSibling;
      }

      if (data.ingredients.length > 0) {
        break;
      }
    }
  }

  // ============================================================
  // CLEAN / DEDUPLICATE
  // ============================================================

  data.ingredients = [
    ...new Set(data.ingredients),
  ].filter((ingredient) => ingredient.length > 1);

  // ============================================================
  // DETERMINE WHETHER INGREDIENT LIST LOOKS COMPLETE
  // ============================================================

  const completeness =
    detectIngredientCompleteness(
      data.ingredients
    );

  data.ingredientCompleteness =
    completeness.completeness;

  data.ingredientCompletenessReason =
    completeness.reason;

  console.log("Enaj: Amazon extracted", {
    name: data.name,
    brand: data.brand,
    ingredientCount:
      data.ingredients.length,
    ingredientCompleteness:
      data.ingredientCompleteness,
    ingredientCompletenessReason:
      data.ingredientCompletenessReason,
    url: data.url,
  });

  return data;
}

// ============================================================
// INGREDIENT COMPLETENESS
// ============================================================

function detectIngredientCompleteness(
  ingredients
) {
  const pageText =
    document.body.innerText || "";

  if (!ingredients.length) {
    return {
      completeness: "missing",
      reason:
        "Amazon did not provide an ingredient list.",
    };
  }

  // These labels are strong evidence Amazon is only showing
  // part of the formulation.
  const strongPartialPatterns = [
    /key ingredients?/i,
    /featured ingredients?/i,
    /highlighted ingredients?/i,
    /top ingredients?/i,
    /hero ingredients?/i,
    /see (?:product )?packaging for (?:the )?full ingredient list/i,
    /full ingredient list (?:is )?on (?:the )?product/i,
    /refer to (?:the )?product packaging for (?:the )?full ingredient list/i,
  ];

  const hasStrongPartialSignal =
    strongPartialPatterns.some((pattern) =>
      pattern.test(pageText)
    );

  if (hasStrongPartialSignal) {
    return {
      completeness:
        "possibly_incomplete",
      reason:
        "Amazon appears to show only key or featured ingredients.",
    };
  }

  // "Active Ingredients" is ambiguous.
  // Some Amazon pages put a complete formulation there,
  // while others only show a few highlighted actives.
  const hasActiveIngredients =
    /active ingredients?/i.test(
      pageText
    );

  // A short Active Ingredients list is suspicious,
  // but we are NOT declaring it incomplete.
  if (
    hasActiveIngredients &&
    ingredients.length <= 8
  ) {
    return {
      completeness:
        "possibly_incomplete",
      reason:
        "Amazon may be showing only active ingredients rather than the complete formulation.",
    };
  }

  return {
    completeness: "complete",
    reason: "",
  };
}

// ============================================================
// INGREDIENT TEXT PARSER
// ============================================================

function parseIngredientText(text) {
  if (!text) return [];

  let cleaned = text.trim();

  // Remove OTC-style headings
  cleaned = cleaned.replace(
    /\.?\s*Purpose\s*:[^.]+\./gi,
    ""
  );

  cleaned = cleaned.replace(
    /Inactive\s+ingredients?\s*:/gi,
    ","
  );

  cleaned = cleaned.replace(
    /Active\s+ingredients?\s*:/gi,
    ""
  );

  cleaned = cleaned.replace(
    /Other\s+ingredients?\s*:/gi,
    ","
  );

  cleaned = cleaned.replace(
    /^[\s*]*ingredients?\s*[:\-]?\s*/i,
    ""
  );

  // Remove percentages while keeping ingredient names
  cleaned = cleaned.replace(
    /\s*\(?\s*\d+(?:\.\d+)?\s*%\s*\)?/g,
    ""
  );

  // Remove F.I.L. notes
  cleaned = cleaned.replace(
    /\(F\.I\.L\.[^)]*\)/gi,
    ""
  );

  // Flatten useful parenthetical ingredient information
  cleaned = cleaned.replace(
    /\s*\(/g,
    ", "
  );

  cleaned = cleaned.replace(
    /\)/g,
    ""
  );

  let items = [];

  if (
    cleaned.includes("•") ||
    cleaned.includes("\u2022")
  ) {
    items = cleaned.split(/[•\u2022]/);
  } else if (
    cleaned.includes(",") ||
    cleaned.includes(";")
  ) {
    items = cleaned.split(
      /[,;]|\.\s+/
    );
  } else {
    items = [
      cleaned,
    ];
  }

  return items
    .map((item) =>
      item
        .replace(
          /^\s*[-–—:*•·/]\s*/,
          ""
        )
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(
      (item) =>
        item.length > 1 &&
        item.length < 100
    )
    .filter(
      (item) => !/^\d+$/.test(item)
    )
    .filter(
      (item) =>
        !/^(and|or|with|from|as|the|a|an)$/i.test(
          item
        )
    )
    .filter(
      (item) =>
        !/^(any oil will|statements regarding|cool dry|do not leave|do not heat|safety information|legal disclaimer|directions|from the manufacturer)/i.test(
          item
        )
    )
    .filter(
      (item) =>
        !/biodiversity|genetic engineering|conserve|synthetic materials|artificial colours|preservatives|flavours or/i.test(
          item
        )
    )
    .filter(
      (value, index, self) =>
        self.indexOf(value) === index
    );
}

// ============================================================
// POPUP REQUEST
// ============================================================

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if (
      request.action ===
      "getProductData"
    ) {
      const product =
        extractProductData();

      sendResponse(product);
    }

    return true;
  }
);

// ============================================================
// STORE CURRENT PRODUCT
// ============================================================

async function tryExtractAndStore() {
  const product =
    extractProductData();

  if (!product.name) {
    return false;
  }

  // Store even if ingredients are missing.
  // The popup can then offer external search.
  await chrome.storage.local.set({
    currentProduct: product,
  });

  console.log(
    `Enaj: Stored Amazon "${product.name}" with ${product.ingredients.length} ingredients (${product.ingredientCompleteness})`
  );

  return true;
}

// ============================================================
// INITIAL EXTRACTION RETRIES
// ============================================================

let attempts = 0;

const retryInterval = setInterval(
  async () => {
    attempts++;

    console.log(
      `Enaj: Attempt ${attempts} to extract Amazon product...`
    );

    const success =
      await tryExtractAndStore();

    if (
      success ||
      attempts >= 30
    ) {
      clearInterval(
        retryInterval
      );

      if (!success) {
        console.log(
          "Enaj: Gave up after 30 attempts"
        );
      }
    }
  },
  500
);

// ============================================================
// AMAZON DYNAMIC PAGE CHANGES
// ============================================================

let lastUrl =
  window.location.href;

let updateTimer = null;

const ingredientObserver =
  new MutationObserver(() => {
    // Amazon modifies the DOM constantly.
    // Debounce so we don't scrape hundreds of times.
    clearTimeout(updateTimer);

    updateTimer = setTimeout(
      () => {
        tryExtractAndStore();
      },
      500
    );
  });

ingredientObserver.observe(
  document.body,
  {
    childList: true,
    subtree: true,
  }
);

// ============================================================
// AMAZON URL / PRODUCT CHANGES
// ============================================================

setInterval(() => {
  if (
    window.location.href !==
    lastUrl
  ) {
    lastUrl =
      window.location.href;

    console.log(
      "Enaj: Amazon product URL changed:",
      lastUrl
    );

    // Remove old stored product immediately so popup
    // cannot accidentally show the previous Amazon item.
    chrome.storage.local.remove(
      "currentProduct"
    );

    setTimeout(() => {
      tryExtractAndStore();
    }, 750);
  }
}, 500);