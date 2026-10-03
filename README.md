# Enaj Browser Extension

Enaj's Chrome extension scans product ingredients while you shop online, flagging items that conflict with your health conditions and preferences.

## How It Works

1. User completes their health profile on the Enaj website
2. User installs the browser extension
3. Extension auto-connects to their Enaj account (or they paste their User ID)
4. User browses a shopping site (Walmart) and clicks on a product
5. User clicks the Enaj icon in the toolbar
6. Extension reads the product's ingredients from the page
7. If ingredients aren't on the page, Enaj searches its database (Open Food Facts / Open Beauty Facts)
8. Backend scans ingredients against the user's ailments and preferences
9. Extension shows flagged ingredients, allergen warnings, and a full ingredient list

## Supported Sites

- ✅ Walmart (walmart.com/ip/*)
- 🔜 Amazon
- 🔜 Target
- 🔜 Sephora

## Files

```
enaj-extension/
├── manifest.json          # Chrome extension config (Manifest V3)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic — scan, display results
├── content-walmart.js     # Extracts product data from Walmart pages
├── content-auth.js        # Auto-grabs userId from the Enaj website
├── icons/
│   ├── logo.svg           # Enaj logo SVG
│   ├── icon16.png         # Toolbar icon
│   ├── icon32.png         # Toolbar icon (2x)
│   ├── icon48.png         # Extension management page
│   └── icon128.png        # Chrome Web Store / install dialog
└── .gitignore
```

## Installation (Development)

No payment or Chrome Web Store account needed for development.

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/enaj-extension.git
cd enaj-extension
```

### 2. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (toggle in the top right)
3. Click **"Load unpacked"**
4. Select the `enaj-extension` folder
5. The Enaj icon appears in your toolbar

### 3. Connect your account

**Automatic:** Visit your Enaj website while the extension is installed. It grabs your userId automatically from localStorage.

**Manual:** Click the Enaj icon → paste your User ID → click Connect. Find your User ID in Prisma Studio (`npx prisma studio` → UserProfile table).

### 4. Test it

1. Go to a Walmart product page, e.g.:
   `https://www.walmart.com/ip/CeraVe-Foaming-Facial-Cleanser-Daily-Face-Wash-for-Normal-to-Oily-Skin-12-fl-oz/836389588`
2. Click the Enaj icon in the toolbar
3. Click **"Scan with Enaj"**
4. See flagged ingredients based on your health profile

## Making Changes

Edit files in VS Code. To see changes:

1. Go to `chrome://extensions/`
2. Find the Enaj extension
3. Click the **refresh icon** (🔄) on the extension card
4. Reopen the popup or reload the product page

No need to remove and re-add the extension. Just refresh.

## How It Connects to the Backend

The extension calls the Enaj backend API at:
```
https://enaj-back-production.up.railway.app
```

Endpoints used:
- `GET /api/users/:userId` — verify user and get profile
- `POST /api/import-product` — save product to database
- `GET /api/products/:category/:slug/scan?userId=` — scan product
- `GET /api/product-search?q=&source=all` — search Open Food Facts if ingredients not on page

## How Ingredient Extraction Works

On Walmart, the extension tries three methods in order:

1. **JSON-LD** — Structured data in `<script type="application/ld+json">` tags. Most reliable for name, brand, and price.
2. **__NEXT_DATA__** — Walmart uses Next.js. Product data is embedded in a `<script id="__NEXT_DATA__">` tag as JSON.
3. **DOM scraping** — Falls back to reading text from the page, looking for "Ingredients:" sections.

If none of these find ingredients, the extension searches the Enaj database (Open Food Facts / Open Beauty Facts) using the product name.

## Publishing to Chrome Web Store

When ready for real users:

1. Create a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole/) ($5 one-time fee)
2. Zip the extension folder
3. Upload to the developer console
4. Fill in listing details (description, screenshots, category)
5. Submit for review (takes 1-3 days)

## Backend Dependency

This extension requires the Enaj backend to be running. Without it, scans won't work. The backend repo is at `https://github.com/amaraM76/Enaj-Back`.
