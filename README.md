<div align="center">

# BookStore

### Discover a book. Start a new story.

An online bookstore and reading room built to bring book discovery, shopping, and reading together in one place.

<img src="./assets/bookstore-hero.svg" alt="BookStore 3D-style banner — Golu Kumar, Full Stack Developer" width="100%" />

**React · Express · SQLite · Three.js · Razorpay · Shiprocket**

**Developed by Golu Kumar · Full Stack Developer**

</div>

---

## About the project

BookStore ek full-stack web application hai jahan readers books explore aur purchase kar sakte hain, wishlist/cart manage kar sakte hain, aur supported public-domain editions ko online padh sakte hain. Is project ka focus sirf ek book listing page banana nahi tha—goal tha discovery se lekar order tracking aur reading progress tak ek connected experience banana.

> **Project type:** Full-stack e-commerce web app  
> **Status:** Local development and provider-configurable integrations

## Problem

Readers ko aksar books discover karne, editions compare karne, favorites save karne, order status dekhne, aur reading progress continue karne ke liye alag-alag experiences use karne padte hain. Ek basic storefront in needs ko connect nahi karta; aur payment/shipping jaise real integrations ko demo mein safely represent karna bhi zaroori hai.

## Objective

- Book discovery aur shopping ko ek responsive, reader-friendly interface mein lana.
- Accounts ke saath cart, wishlist, profile, orders, aur reading progress ko save karna.
- Local aur credited public-domain reading editions ke liye in-app reader dena.
- Store operations ke liye protected admin dashboard banana.
- Payments aur shipping ko real credentials ke bina fake success dikhane ke bajay optional, server-configured integrations rakhna.

## Solution

BookStore ek React storefront ko Express API aur SQLite database ke saath combine karta hai. Customers category/search se catalog browse karte hain, account bana kar shopping data save karte hain, aur supported editions ke liye Reading Room khol sakte hain. Admin dashboard inventory, orders, reviews, returns, aur sales reports manage karta hai. Razorpay aur Shiprocket tabhi kaam karte hain jab valid provider settings privately configure ki gayi hon.

## Highlights

- **Book discovery:** seeded catalog with 340 titles across 11 categories, including Indian and international books.
- **Search and browse:** text search, category filters, sorting, featured books, ratings, and recommendations.
- **Customer account:** registration/login, profile details and photo, wishlist, persistent cart, order history, and welcome offers.
- **Two-step sign-in:** new and existing customers must enter a short-lived email OTP; a session is created only after successful verification.
- **Checkout and payments:** delivery address flow and optional Razorpay Checkout; payment verification and webhooks are handled by the backend.
- **Order lifecycle:** customer order details, payment and delivery status, address, tracking, and admin-managed fulfillment.
- **Order email updates:** SMTP notifications for confirmed, packed, shipped, out-for-delivery, and delivered events, with admin retry when delivery fails.
- **Reading Room:** `/read` library with search/category filters, source credits, and supported Project Gutenberg/Wikisource editions.
- **In-app reader:** bundled texts support saved progress, bookmarks, and highlights; signed-in users can sync supported reading state.
- **Admin dashboard:** protected login, inventory and stock tools, sales reports, order management, reviews, returns, and optional ISBN lookup; open it from **More → Features → Open admin dashboard**.
- **Animated 3D storefront hero:** lazy-loaded Three.js book scene with floating books, pointer-responsive movement, reduced-motion support, and a WebGL fallback.
- **Cinematic welcome page:** root URL opens a responsive 3D welcome screen with an animated developer character, a six-second automatic entrance, an Enter button, and a non-WebGL fallback; the existing storefront stays at `/`.
- **Accessibility and responsive UI:** keyboard-friendly controls, accessibility preferences, and layouts designed for different screen sizes.
- **Automated checks:** Vitest unit tests and Playwright end-to-end tests.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Icons |
| 3D visual | Three.js |
| Backend | Node.js, Express 5 |
| Database | SQLite with `better-sqlite3` |
| Authentication | bcrypt password hashing, signed HTTP-only cookies, JWT |
| Security middleware | Helmet, rate limiting |
| Payments | Optional Razorpay Checkout integration |
| Shipping | Optional Shiprocket integration |
| Testing | Vitest, Testing Library, Playwright |

## Getting started

### Requirements

- Node.js and npm
- Git (to clone the repository)

### Install and run

```bash
git clone <your-repository-url>
cd <repository-folder>
npm install
```

Create a private local environment file from the template:

```powershell
Copy-Item .env.example .env
```

Then start the frontend and API together:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The development command starts both Vite and the Express API; Vite proxies `/api` requests to the backend. SQLite creates `server/data/bookstore.sqlite` on startup.

The storefront can be browsed without an account. Sign in or create an account to save a cart, wishlist, profile, orders, or synced reading state.

### Email OTP sign-in

Registration and password sign-in both require an OTP delivered to the account's email over SMTP. Configure the SMTP values in `.env` before testing; if the OTP cannot be delivered, the server does not issue a login session.

For example, Gmail SMTP uses `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, your full Gmail address as `SMTP_USER` and `SMTP_FROM`, and a Google **App Password** as `SMTP_PASS` (not your regular Gmail password). Enable 2-Step Verification on the Google account before creating an App Password. For Brevo or another provider, use the SMTP host, port, username, password/API key, and sender address supplied by that provider. Keep these values private and use an authorized sender address.

Login OTPs expire after 5 minutes, are single-use, allow at most 5 incorrect attempts, and can be resent after 60 seconds (up to 3 resends per challenge). The server stores only a keyed hash of the code and a hash of the challenge token. Never log or share OTPs, SMTP passwords, or app passwords.

### Order details and email updates

Signed-in customers can open **Orders** to see each order's items, totals, payment status, delivery address, fulfillment steps, and carrier tracking. The protected admin dashboard is available from **More → Features → Open admin dashboard**; an administrator can advance paid orders one step at a time and create Shiprocket shipments when configured. Order-confirmation email is sent after payment is verified. Fulfillment emails are sent when the admin updates an order; out-for-delivery and delivered carrier updates are emailed when Shiprocket tracking is refreshed. If an email send fails, the admin dashboard shows the failure and a retry action.

## Environment configuration

`.env.example` documents the supported settings. Add only the values you need to your local `.env`; **never commit `.env` or real credentials**.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode; use `production` for production deployment. |
| `API_PORT` | Express API port (defaults to `3001`). |
| `DB_PATH` | Optional SQLite database file path. |
| `JWT_SECRET` | Signing secret; production requires a random secret of at least 32 characters. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Optional Razorpay credentials. Without both keys, checkout offers PhonePe QR (manually verified) and cash on delivery. Both keys enable secure automatic card/UPI checkout. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret used to verify Razorpay payment webhooks when Razorpay checkout is enabled. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | Credentials for the private admin dashboard. Store a bcrypt password hash, not a plaintext password. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP server address, port, and TLS setting for customer OTP and order email delivery. |
| `SMTP_USER`, `SMTP_PASS` | Optional SMTP authentication pair; set both or leave both blank if your SMTP server does not require authentication. |
| `SMTP_FROM` | Verified sender address/name used for OTP and order-status emails. |
| `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | Optional Shiprocket API credentials. |
| `SHIPROCKET_API_BASE_URL`, `SHIPROCKET_PICKUP_LOCATION` | Optional API endpoint and configured pickup location. |
| `SHIPROCKET_PACKAGE_LENGTH_CM`, `SHIPROCKET_PACKAGE_BREADTH_CM`, `SHIPROCKET_PACKAGE_HEIGHT_CM`, `SHIPROCKET_PACKAGE_WEIGHT_KG` | Actual parcel dimensions and weight required for shipment booking. |
| `SHIPROCKET_COURIER_ID` | Optional courier selection. |

Checkout first collects delivery details and then asks the customer to choose a payment method. For PhonePe QR, customers submit their UPI transaction reference and orders remain pending until an admin verifies the payment in PhonePe and confirms it in the admin dashboard. A submitted reference alone is not proof of payment. COD stock is reserved when the order is placed; the admin can progress its delivery and must confirm cash collection after delivery. Manual QR/COD refunds are handled outside the dashboard. Card payments require configured Razorpay keys.

For an admin password hash, run locally and replace the example password before execution:

```bash
node -e "import('bcryptjs').then(({ default: bcrypt }) => console.log(bcrypt.hashSync('REPLACE_WITH_A_STRONG_PASSWORD', 12)))"
```

Paste the generated hash into your private `.env` as `ADMIN_PASSWORD_HASH`. Never publish the password or hash.

## Useful commands

Install the project dependencies from the repository root before running it:

```bash
npm install
npm run dev
```

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite frontend and Express API for local development. |
| `npm run build` | Build the production frontend into `dist/`. |
| `npm run preview` | Preview the Vite production build locally. |
| `npm start` | Start the Express server; in production it serves the built frontend and API. |
| `npm test` | Run Vitest unit tests. |
| `npm run test:e2e` | Run Playwright browser end-to-end tests. |
| `npm run providers:preflight` | Check local Razorpay/Shiprocket configuration readiness without calling provider APIs. |

For browser tests, install Chromium once with `npx playwright install chromium`. The E2E suite uses a temporary SQLite database and does not submit payments or book shipments.

## Main routes

| Route | Page |
| --- | --- |
| `/` | 3D welcome page first; automatically enters the existing storefront after 6 seconds or immediately with **Enter Website** |
| `/welcome` | Welcome page |
| `/admin` | Protected admin dashboard |
| `/read` | Reading Room library |
| `/read/:bookId` | Supported in-app reading edition |
| **More → Features → Open admin dashboard** | Private admin dashboard |

## Project structure

```text
Booking/
├── assets/
│   └── bookstore-hero.svg   # README 3D storefront illustration
├── public/reader/            # Bundled reader text editions
├── server/
│   ├── index.js              # Express API and SQLite persistence
│   └── data/                 # Local SQLite database (generated)
├── shared/books.js           # Seed book catalog
├── src/
│   ├── components/           # Storefront, reader, checkout, and admin UI
│   ├── readerCatalog.js      # Reading editions and source attribution
│   └── App.jsx               # Main storefront experience
├── .env.example              # Safe environment-variable template
└── package.json              # Scripts and dependencies
```

## Payments, shipping, and production notes

- Payment and shipping integrations are **not simulated**. A real Razorpay merchant setup and valid private credentials are needed before checkout can be enabled.
- Configure the Razorpay webhook at `https://YOUR_DOMAIN/api/payments/webhook` for `payment.captured` and `payment.failed`. Webhooks require a publicly reachable HTTPS deployment.
- Shiprocket shipment creation can book a real shipment. Use production credentials only when you intend to fulfill the order; use a separate, provider-provisioned sandbox endpoint for safe testing.
- Seeded stock values are demo values, not verified physical inventory. Confirm counts before accepting real orders.
- Public-domain availability can vary by country; the Reading Room shows edition/source information. Provider-hosted reader pages run in a cross-origin frame and cannot expose page position or annotations to this app.
- Before production, build with `npm run build`, set `NODE_ENV=production`, configure a strong `JWT_SECRET`, secure provider/admin settings, deploy behind HTTPS, and validate integrations with the relevant providers.

## Notes

The banner above is a responsive, custom 3D-style SVG illustration made for this README. GitHub README images are static; the live Three.js animation appears in the storefront when you run the app. Replace the clone URL with your GitHub repository URL before publishing.

---

<div align="center">

Made for readers, one page at a time.

</div>
