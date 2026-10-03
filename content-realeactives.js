function extractProductData() {
    const data = {
      name: "",
      brand: "Reale Actives",
      ingredients: [],
      image: "",
      price: "",
      url: window.location.href,
      source: "realeactives",
    };
  
    // Shopify product name
    const titleEl = document.querySelector(".product__title h1, h1.product__title, h1");
    if (titleEl) data.name = titleEl.textContent.trim();
  
    // Shopify price
    const priceEl = document.querySelector(".price__regular .price-item--regular, .product__price");
    if (priceEl) data.price = priceEl.textContent.trim();
  
    // Shopify image
    const imgEl = document.querySelector(".product__media img, .product-single__photo img");
    if (imgEl) data.image = imgEl.src || "";
  
    console.log("Enaj: Reale Actives extracted", {
      name: data.name,
      url: data.url
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
  
  setTimeout(() => {
    const data = extractProductData();
    if (data.name) {
      chrome.storage.local.set({ currentProduct: data });
      console.log("Enaj: Stored Reale Actives '" + data.name + "'");
    }
  }, 2500);
  
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(() => {
        const data = extractProductData();
        if (data.name) chrome.storage.local.set({ currentProduct: data });
      }, 2500);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });