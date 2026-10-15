import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import Database from 'better-sqlite3'
import bookCatalog from '../shared/books.js'
import readerCatalog from '../src/readerCatalog.js'
import { normalizeReaderState } from '../src/readerState.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataDir = path.join(here, 'data')
fs.mkdirSync(dataDir, { recursive: true })

const isProduction = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET
if (isProduction && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in production.')
}
const tokenSecret = jwtSecret || 'local-development-secret-change-this-before-deploying-32-chars'
const db = new Database(process.env.DB_PATH || path.join(dataDir, 'bookstore.sqlite'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    image TEXT NOT NULL,
    rating REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 30 CHECK (stock >= 0),
    isbn TEXT NOT NULL DEFAULT '',
    publisher TEXT NOT NULL DEFAULT '',
    publication_year INTEGER,
    language TEXT NOT NULL DEFAULT '',
    pages INTEGER,
    format TEXT NOT NULL DEFAULT '',
    inventory_verified INTEGER NOT NULL DEFAULT 0 CHECK (inventory_verified IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (user_id, book_id)
  );
  CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id)
  );
  CREATE TABLE IF NOT EXISTS reading_states (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, book_id)
  );
  CREATE TABLE IF NOT EXISTS welcome_offers (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('placed', 'packed', 'shipped', 'delivered', 'cancelled')),
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'legacy',
    razorpay_order_id TEXT,
    payment_id TEXT,
    payment_method TEXT NOT NULL DEFAULT 'razorpay',
    payment_reference TEXT,
    shipping_name TEXT NOT NULL DEFAULT '',
    shipping_phone TEXT NOT NULL DEFAULT '',
    shipping_email TEXT NOT NULL DEFAULT '',
    shipping_line1 TEXT NOT NULL DEFAULT '',
    shipping_line2 TEXT NOT NULL DEFAULT '',
    shipping_city TEXT NOT NULL DEFAULT '',
    shipping_state TEXT NOT NULL DEFAULT '',
    shipping_postal_code TEXT NOT NULL DEFAULT '',
    shiprocket_order_id TEXT,
    shiprocket_shipment_id INTEGER,
    tracking_number TEXT,
    courier_name TEXT NOT NULL DEFAULT '',
    tracking_url TEXT NOT NULL DEFAULT '',
    tracking_status TEXT NOT NULL DEFAULT '',
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    image TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS book_reviews (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, book_id)
  );
  CREATE TABLE IF NOT EXISTS return_requests (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refunded')),
    refund_id TEXT,
    refund_status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS login_otp_challenges (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    challenge_hash TEXT NOT NULL UNIQUE,
    otp_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    resends INTEGER NOT NULL DEFAULT 0,
    sent_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_otp_delivery_limits (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    last_sent_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_email_notifications (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT,
    PRIMARY KEY (order_id, event_key)
  );
`)

const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((column) => column.name))
if (!userColumns.has('avatar')) db.exec('ALTER TABLE users ADD COLUMN avatar TEXT')

const orderColumns = new Set(db.prepare('PRAGMA table_info(orders)').all().map((column) => column.name))
const orderMigrations = [
  ['payment_status', "TEXT NOT NULL DEFAULT 'legacy'"],
  ['razorpay_order_id', 'TEXT'],
  ['payment_id', 'TEXT'],
  ['payment_method', "TEXT NOT NULL DEFAULT 'razorpay'"],
  ['payment_reference', 'TEXT'],
  ['shipping_name', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_phone', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_email', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_line1', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_line2', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_city', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_state', "TEXT NOT NULL DEFAULT ''"],
  ['shipping_postal_code', "TEXT NOT NULL DEFAULT ''"]
]
for (const [column, definition] of orderMigrations) {
  if (!orderColumns.has(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`)
}
const bookColumns = new Set(db.prepare('PRAGMA table_info(books)').all().map((column) => column.name))
const bookMigrations = [
  ['isbn', "TEXT NOT NULL DEFAULT ''"],
  ['publisher', "TEXT NOT NULL DEFAULT ''"],
  ['publication_year', 'INTEGER'],
  ['language', "TEXT NOT NULL DEFAULT ''"],
  ['pages', 'INTEGER'],
  ['format', "TEXT NOT NULL DEFAULT ''"],
  ['inventory_verified', 'INTEGER NOT NULL DEFAULT 0 CHECK (inventory_verified IN (0, 1))']
]
for (const [column, definition] of bookMigrations) {
  if (!bookColumns.has(column)) db.exec(`ALTER TABLE books ADD COLUMN ${column} ${definition}`)
}
const shipmentMigrations = [
  ['shiprocket_order_id', 'TEXT'],
  ['shiprocket_shipment_id', 'INTEGER'],
  ['tracking_number', "TEXT"],
  ['courier_name', "TEXT NOT NULL DEFAULT ''"],
  ['tracking_url', "TEXT NOT NULL DEFAULT ''"],
  ['tracking_status', "TEXT NOT NULL DEFAULT ''"],
  ['delivered_at', 'TEXT']
]
for (const [column, definition] of shipmentMigrations) {
  if (!orderColumns.has(column)) db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`)
}
db.exec("UPDATE orders SET payment_status='legacy' WHERE payment_status='paid' AND payment_id IS NULL AND razorpay_order_id IS NULL AND payment_method='razorpay'")
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_order_id ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL')

const insertBook = db.prepare(`
  INSERT OR IGNORE INTO books (id, title, author, category, price, image, rating, stock)
  VALUES (@id, @title, @author, @category, @price, @image, @rating, 30)
`)
const updateBook = db.prepare(`
  UPDATE books SET title=@title, author=@author, category=@category, price=@price,
    image=@image, rating=@rating WHERE id=@id
`)
const seedBooks = db.transaction(() => {
  for (const book of bookCatalog) {
    insertBook.run(book)
    updateBook.run(book)
  }
})
seedBooks()

const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({
  limit: '512kb',
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer)
  }
}))
app.use(cookieParser())

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false
})
const LOGIN_OTP_TTL_MS = 5 * 60 * 1000
const LOGIN_OTP_RESEND_DELAY_MS = 60 * 1000
const LOGIN_OTP_MAX_ATTEMPTS = 5
const LOGIN_OTP_MAX_RESENDS = 3

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function route(handler) {
  return (req, res, next) => {
    try {
      const result = handler(req, res)
      if (result && typeof result.then === 'function') result.catch(next)
    } catch (error) {
      next(error)
    }
  }
}

function loginOtpChallengeHash(challengeId) {
  return crypto.createHash('sha256').update(challengeId).digest('hex')
}

function loginOtpCodeHash(challengeId, code) {
  return crypto.createHmac('sha256', tokenSecret).update(`${challengeId}:${code}`).digest('hex')
}

function getSmtpSettings() {
  const host = String(process.env.SMTP_HOST || '').trim()
  const from = String(process.env.SMTP_FROM || '').trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = String(process.env.SMTP_USER || '')
  const pass = String(process.env.SMTP_PASS || '')
  const secure = process.env.SMTP_SECURE === undefined
    ? port === 465
    : process.env.SMTP_SECURE.toLowerCase() === 'true'

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535 ||
    Boolean(user) !== Boolean(pass)) {
    throw httpError(503, 'Email OTP is not configured. Set valid SMTP_HOST, SMTP_PORT, SMTP_FROM, and matching SMTP_USER/SMTP_PASS values.')
  }
  return { host, from, port, secure, user, pass }
}

const orderEmailEvents = {
  order_placed: { subject: 'Your BookStore order is confirmed', heading: 'Order confirmed' },
  packed: { subject: 'Your BookStore order has been packed', heading: 'Your order is packed' },
  shipped: { subject: 'Your BookStore order has shipped', heading: 'Your order is on its way' },
  out_for_delivery: { subject: 'Your BookStore order is out for delivery', heading: 'Out for delivery' },
  delivered: { subject: 'Your BookStore order has been delivered', heading: 'Order delivered' }
}

function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character])
}

async function sendOrderStatusEmail(orderId, eventKey, { force = false } = {}) {
  const event = orderEmailEvents[eventKey]
  if (!event) throw new Error(`Unknown order email event: ${eventKey}`)
  const previous = db.prepare('SELECT status FROM order_email_notifications WHERE order_id=? AND event_key=?').get(orderId, eventKey)
  if (previous?.status === 'sent' && !force) return { sent: true, eventKey, alreadySent: true }

  try {
    const settings = getSmtpSettings()
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId)
    if (!order) throw new Error('Order not found.')
    if (!order.shipping_email) throw new Error('Order has no customer email address.')
    const items = db.prepare('SELECT title, quantity, unit_price FROM order_items WHERE order_id=?').all(orderId)
    const itemLines = items.map((item) => `${item.title} × ${item.quantity} — ₹${item.unit_price * item.quantity}`)
    const trackingLine = order.tracking_number
      ? `Tracking: ${order.courier_name || 'Courier'} · AWB ${order.tracking_number}${order.tracking_url ? `\nTrack: ${order.tracking_url}` : ''}`
      : ''
    const text = [
      `Hello ${order.shipping_name || 'Customer'},`,
      '',
      event.heading,
      `Order: ${order.id}`,
      `Status: ${order.status}`,
      `Payment: ${order.payment_status}`,
      `Total: ₹${order.total}`,
      '',
      'Items:',
      ...itemLines,
      trackingLine,
      '',
      'Thank you for shopping with BookStore.'
    ].filter(Boolean).join('\n')
    const htmlItems = items.map((item) =>
      `<li>${escapeEmailHtml(item.title)} × ${item.quantity} — ₹${item.unit_price * item.quantity}</li>`
    ).join('')
    const trackingHtml = order.tracking_number
      ? `<p>Tracking: ${escapeEmailHtml(order.courier_name || 'Courier')} · AWB ${escapeEmailHtml(order.tracking_number)}${order.tracking_url ? `<br><a href="${escapeEmailHtml(order.tracking_url)}">Track shipment</a>` : ''}</p>`
      : ''
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      ...(settings.user ? { auth: { user: settings.user, pass: settings.pass } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    })
    try {
      await transport.sendMail({
        from: settings.from,
        to: order.shipping_email,
        subject: event.subject,
        text,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#202943"><h1>${escapeEmailHtml(event.heading)}</h1><p>Hello ${escapeEmailHtml(order.shipping_name || 'Customer')},</p><p>Order <strong>${escapeEmailHtml(order.id)}</strong> is now <strong>${escapeEmailHtml(order.status)}</strong>.</p><p>Payment status: ${escapeEmailHtml(order.payment_status)} · Total: ₹${order.total}</p><ul>${htmlItems}</ul>${trackingHtml}<p>Thank you for shopping with BookStore.</p></div>`
      })
    } finally {
      transport.close()
    }
    db.prepare(`
      INSERT INTO order_email_notifications (order_id, event_key, status, error, updated_at, sent_at)
      VALUES (?, ?, 'sent', '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(order_id, event_key) DO UPDATE SET
        status='sent', error='', updated_at=CURRENT_TIMESTAMP, sent_at=CURRENT_TIMESTAMP
    `).run(orderId, eventKey)
    return { sent: true, eventKey }
  } catch (error) {
    console.error(`Could not send ${eventKey} email for order ${orderId}:`, error.message)
    db.prepare(`
      INSERT INTO order_email_notifications (order_id, event_key, status, error, updated_at, sent_at)
      VALUES (?, ?, 'failed', ?, CURRENT_TIMESTAMP, NULL)
      ON CONFLICT(order_id, event_key) DO UPDATE SET
        status='failed', error=excluded.error, updated_at=CURRENT_TIMESTAMP
    `).run(orderId, eventKey, 'Delivery failed. Check server logs and SMTP settings.')
    return {
      sent: false,
      eventKey,
      error: 'Order updated, but its email notification could not be sent. Check SMTP settings.'
    }
  }
}

function maskEmail(email) {
  const [name, domain] = email.split('@')
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(name.length - 1, 8)))}@${domain}`
}

async function deliverLoginOtp(user, challengeId, resendCount = 0) {
  const settings = getSmtpSettings()
  const now = Date.now()
  const cooldownBoundary = now - LOGIN_OTP_RESEND_DELAY_MS
  const reservation = db.prepare(`
    INSERT INTO login_otp_delivery_limits (email, last_sent_at) VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET last_sent_at=excluded.last_sent_at
    WHERE login_otp_delivery_limits.last_sent_at <= ?
  `).run(user.email, now, cooldownBoundary)
  if (!reservation.changes) {
    const lastSent = db.prepare('SELECT last_sent_at FROM login_otp_delivery_limits WHERE email=?').get(user.email)
    const retryAfterSeconds = Math.max(1, Math.ceil((lastSent.last_sent_at + LOGIN_OTP_RESEND_DELAY_MS - now) / 1000))
    throw httpError(429, `Please wait ${retryAfterSeconds} seconds before requesting another code.`)
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const challengeHash = loginOtpChallengeHash(challengeId)
  db.prepare(`
    INSERT INTO login_otp_challenges (user_id, challenge_hash, otp_hash, expires_at, attempts, resends, sent_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      challenge_hash=excluded.challenge_hash,
      otp_hash=excluded.otp_hash,
      expires_at=excluded.expires_at,
      attempts=0,
      resends=excluded.resends,
      sent_at=excluded.sent_at
  `).run(user.id, challengeHash, loginOtpCodeHash(challengeId, code), now + LOGIN_OTP_TTL_MS, resendCount, now)

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...(settings.user ? { auth: { user: settings.user, pass: settings.pass } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  })
  try {
    await transport.sendMail({
      from: settings.from,
      to: user.email,
      subject: 'Your BookStore sign-in code',
      text: `Your BookStore verification code is ${code}. It expires in 5 minutes. If you did not try to sign in, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#20243a"><h1 style="font-size:22px">Verify your email</h1><p>Use this one-time code to finish signing in to BookStore:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f3f0e9;border-radius:10px;text-align:center">${code}</p><p>This code expires in 5 minutes and can only be used once.</p><p style="color:#667085;font-size:13px">If you did not try to sign in, you can ignore this email.</p></div>`
    })
  } catch (error) {
    db.prepare('DELETE FROM login_otp_challenges WHERE user_id=? AND challenge_hash=?').run(user.id, challengeHash)
    console.error('Could not send sign-in verification email:', error.message)
    throw httpError(502, 'We could not send your verification code. Check the SMTP configuration and try again.')
  } finally {
    transport.close()
  }
}

function safeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: user.city,
    avatar: user.avatar || null
  }
}

function validateAvatar(avatar) {
  if (avatar === undefined || avatar === null || avatar === '') return null
  const match = typeof avatar === 'string' ? avatar.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/) : null
  if (!match) throw httpError(400, 'Profile photo must be a JPEG image.')
  const imageBytes = Buffer.from(match[1], 'base64')
  if (imageBytes.length > 300_000 || imageBytes.toString('base64') !== match[1] ||
    imageBytes[0] !== 0xff || imageBytes[1] !== 0xd8 ||
    imageBytes[imageBytes.length - 2] !== 0xff || imageBytes[imageBytes.length - 1] !== 0xd9) {
    throw httpError(400, 'Profile photo is invalid or too large. Choose a smaller image.')
  }
  return avatar
}

function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, tokenSecret, { expiresIn: '7d' })
  res.cookie('bookstore_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
}

function requireAuth(req, _res, next) {
  try {
    const token = req.cookies.bookstore_token
    if (!token) throw httpError(401, 'Please log in to continue.')
    const decoded = jwt.verify(token, tokenSecret)
    const user = db.prepare('SELECT id, email, name, phone, city, avatar FROM users WHERE id = ?').get(Number(decoded.sub))
    if (!user) throw httpError(401, 'Your session has expired. Please log in again.')
    req.user = user
    next()
  } catch (error) {
    next(error.status ? error : httpError(401, 'Your session has expired. Please log in again.'))
  }
}

function requireAdmin(req, _res, next) {
  try {
    const token = req.cookies.bookstore_admin_token
    if (!token) throw httpError(401, 'Admin login is required.')
    const decoded = jwt.verify(token, tokenSecret)
    if (decoded.role !== 'admin') throw httpError(403, 'Admin access is required.')
    next()
  } catch (error) {
    next(error.status ? error : httpError(401, 'Your admin session has expired. Please log in again.'))
  }
}

function setAdminCookie(res) {
  const token = jwt.sign({ role: 'admin' }, tokenSecret, { expiresIn: '8h' })
  res.cookie('bookstore_admin_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
  })
}

function publicBook(book) {
  return { ...book, price: `₹${book.price}`, unitPrice: book.price, unitPriceDisplay: `₹${book.price}` }
}

function getCart(userId) {
  return db.prepare(`
    SELECT b.id, b.title, b.author, b.category, b.price, b.image, b.rating, b.stock, c.quantity AS qty
    FROM cart_items c JOIN books b ON b.id = c.book_id
    WHERE c.user_id = ? ORDER BY c.rowid
  `).all(userId).map((book) => ({
    ...publicBook(book),
    unitPrice: book.price,
    unitPriceDisplay: `₹${book.price}`
  }))
}

function getOffer(userId) {
  const offer = db.prepare('SELECT claimed_at, used_at FROM welcome_offers WHERE user_id = ?').get(userId)
  return {
    claimed: Boolean(offer),
    used: Boolean(offer?.used_at),
    eligible: Boolean(offer && !offer.used_at)
  }
}

function makeOrderId() {
  let orderId
  do {
    orderId = `BK-${crypto.randomInt(100000, 1000000)}`
  } while (db.prepare('SELECT 1 FROM orders WHERE id=?').get(orderId))
  return orderId
}

function signatureMatches(secret, message, signature) {
  if (!secret || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) return false
  const expected = crypto.createHmac('sha256', secret).update(message).digest()
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)
}

function validIsbn(value) {
  const isbn = String(value || '').replace(/[-\s]/g, '').toUpperCase()
  if (/^\d{9}[\dX]$/.test(isbn)) {
    return [...isbn].reduce((sum, digit, index) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0
  }
  if (/^\d{13}$/.test(isbn)) {
    return [...isbn].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0
  }
  return false
}

let shiprocketToken = ''
let shiprocketTokenExpiresAt = 0

function shiprocketApiBase() {
  const base = process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in/v1/external'
  let url
  try {
    url = new URL(base)
  } catch {
    throw httpError(500, 'SHIPROCKET_API_BASE_URL must be a valid HTTPS URL.')
  }
  if (url.protocol !== 'https:') throw httpError(500, 'SHIPROCKET_API_BASE_URL must use HTTPS.')
  return url.toString().replace(/\/+$/, '')
}

function shiprocketConfigured() {
  return Boolean(
    process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD &&
    process.env.SHIPROCKET_PICKUP_LOCATION && process.env.SHIPROCKET_PACKAGE_LENGTH_CM &&
    process.env.SHIPROCKET_PACKAGE_BREADTH_CM && process.env.SHIPROCKET_PACKAGE_HEIGHT_CM &&
    process.env.SHIPROCKET_PACKAGE_WEIGHT_KG
  )
}

async function shiprocketRequest(endpoint, { method = 'GET', body, authenticate = true } = {}) {
  const apiBase = shiprocketApiBase()
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (authenticate) {
    if (!shiprocketToken || shiprocketTokenExpiresAt < Date.now() + 60_000) {
      const loginResponse = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
        signal: AbortSignal.timeout(15_000)
      })
      const loginData = await loginResponse.json()
      if (!loginResponse.ok || typeof loginData.token !== 'string') {
        console.error('Shiprocket authentication failed with status:', loginResponse.status)
        throw httpError(502, 'Shiprocket authentication failed. Check the private API credentials.')
      }
      shiprocketToken = loginData.token
      try {
        const payload = JSON.parse(Buffer.from(shiprocketToken.split('.')[1], 'base64url').toString())
        shiprocketTokenExpiresAt = Number(payload.exp) * 1000 || Date.now() + 10 * 60_000
      } catch {
        shiprocketTokenExpiresAt = Date.now() + 10 * 60_000
      }
    }
    headers.Authorization = `Bearer ${shiprocketToken}`
  }
  const response = await fetch(`${apiBase}${endpoint}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000)
  })
  const data = await response.json()
  if (!response.ok) {
    console.error('Shiprocket request failed with status:', response.status)
    throw httpError(502, 'Shiprocket could not complete the request. Check the provider dashboard and try again.')
  }
  return data
}

async function refreshShiprocketTracking(order) {
  if (!order.tracking_number) throw httpError(409, 'This order does not have a tracking number yet.')
  const result = await shiprocketRequest(`/courier/track/awb/${encodeURIComponent(order.tracking_number)}`)
  const tracking = result.tracking_data || {}
  const shipment = Array.isArray(tracking.shipment_track) ? tracking.shipment_track[0] : null
  const providerStatus = String(shipment?.current_status || tracking.track_status || '').trim()
  const normalized = providerStatus.toLowerCase()
  const newStatus = normalized.includes('deliver') ? 'delivered'
    : normalized.includes('picked') || normalized.includes('transit') || normalized.includes('out for delivery') ? 'shipped'
      : order.status
  db.prepare(`
    UPDATE orders SET tracking_status=?, tracking_url=?, courier_name=COALESCE(NULLIF(?, ''), courier_name),
      status=CASE WHEN ?='delivered' THEN 'delivered' ELSE status END,
      delivered_at=CASE WHEN ?='delivered' THEN COALESCE(delivered_at, CURRENT_TIMESTAMP) ELSE delivered_at END
    WHERE id=?
  `).run(
    providerStatus || order.tracking_status,
    tracking.track_url || order.tracking_url,
    shipment?.courier_name || '',
    newStatus,
    newStatus,
    order.id
  )
  const notificationEvent = normalized.includes('out for delivery')
    ? 'out_for_delivery'
    : newStatus === 'delivered' ? 'delivered' : null
  const notification = notificationEvent
    ? await sendOrderStatusEmail(order.id, notificationEvent)
    : null
  const updated = db.prepare('SELECT * FROM orders WHERE id=?').get(order.id)
  return {
    status: updated.status,
    trackingStatus: updated.tracking_status,
    trackingNumber: updated.tracking_number,
    courierName: updated.courier_name,
    trackingUrl: updated.tracking_url,
    ...(notification ? { notification } : {})
  }
}

function getOrderForCustomer(orderId, userId) {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId, userId)
  if (!order) return null
  const items = db.prepare(`
    SELECT book_id AS id, title, author, image, unit_price AS unitPrice, quantity AS qty
    FROM order_items WHERE order_id=?
  `).all(order.id)
  return {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    paymentReference: order.payment_reference || '',
    createdAt: order.created_at,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    trackingNumber: order.tracking_number || '',
    courierName: order.courier_name || '',
    trackingUrl: order.tracking_url || '',
    trackingStatus: order.tracking_status || '',
    returnRequest: db.prepare(`
      SELECT id, reason, status, refund_status AS refundStatus, created_at AS createdAt
      FROM return_requests WHERE order_id=?
    `).get(order.id) || null,
    shippingAddress: {
      name: order.shipping_name,
      phone: order.shipping_phone,
      line1: order.shipping_line1,
      line2: order.shipping_line2,
      city: order.shipping_city,
      state: order.shipping_state,
      postalCode: order.shipping_postal_code
    },
    items
  }
}

function completeOrderPayment(order, paymentId) {
  if (order.payment_status === 'paid') return { found: true, paid: true, orderId: order.id }
  if (order.payment_status === 'refund_required') {
    return { found: true, paid: false, refundRequired: true, orderId: order.id }
  }
  const stockReserved = order.payment_status === 'cod_pending'
  if (order.payment_status !== 'pending' && !stockReserved) return { found: true, paid: false, orderId: order.id }

  if (!stockReserved) {
    const items = db.prepare('SELECT book_id, quantity FROM order_items WHERE order_id=?').all(order.id)
    const hasStock = items.every(({ book_id, quantity }) => {
      const book = db.prepare('SELECT stock FROM books WHERE id=?').get(book_id)
      return book && book.stock >= quantity
    })
    if (!hasStock) {
      db.prepare("UPDATE orders SET payment_status='refund_required', payment_id=? WHERE id=?").run(paymentId, order.id)
      return { found: true, paid: false, refundRequired: true, orderId: order.id }
    }

    const reduceStock = db.prepare('UPDATE books SET stock=stock-? WHERE id=? AND stock>=?')
    for (const item of items) reduceStock.run(item.quantity, item.book_id, item.quantity)
    const removePurchased = db.prepare(`
      DELETE FROM cart_items WHERE user_id=? AND book_id=? AND quantity<=?
    `)
    const reducePurchased = db.prepare(`
      UPDATE cart_items SET quantity=quantity-? WHERE user_id=? AND book_id=? AND quantity>?
    `)
    for (const item of items) {
      removePurchased.run(order.user_id, item.book_id, item.quantity)
      reducePurchased.run(item.quantity, order.user_id, item.book_id, item.quantity)
    }
  }
  db.prepare("UPDATE orders SET payment_status='paid', payment_id=? WHERE id=?").run(paymentId, order.id)
  if (order.discount) db.prepare('UPDATE welcome_offers SET used_at=CURRENT_TIMESTAMP WHERE user_id=?').run(order.user_id)
  return { found: true, paid: true, orderId: order.id }
}

const markOrderPaid = db.transaction((razorpayOrderId, paymentId) => {
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id=?').get(razorpayOrderId)
  if (!order) return { found: false }
  return completeOrderPayment(order, paymentId)
})

const markManualOrderPaid = db.transaction((orderId) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId)
  if (!order) return { found: false }
  const phonePeReady = order.payment_method === 'phonepe_qr' &&
    order.payment_status === 'pending' && Boolean(order.payment_reference)
  const codReady = order.payment_method === 'cod' &&
    order.payment_status === 'cod_pending' && order.status === 'delivered'
  if (!phonePeReady && !codReady) {
    return { found: true, paid: false, manualPaymentRequired: true, orderId: order.id }
  }
  return completeOrderPayment(order, null)
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/payments/config', (_req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || null
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  const cardEnabled = Boolean(keyId && keySecret)
  res.json({
    enabled: true,
    cardEnabled,
    keyId,
    mode: cardEnabled ? keyId.startsWith('rzp_test_') ? 'test' : 'live' : 'phonepe_qr'
  })
})
app.get('/api/books', (_req, res) => {
  const books = db.prepare(`
    SELECT id, title, author, category, price, image, rating, stock, isbn, publisher,
      publication_year AS publicationYear, language, pages, format,
      inventory_verified AS inventoryVerified
    FROM books ORDER BY rowid
  `).all()
  res.json(books.map(publicBook))
})

app.get('/api/books/:bookId/reviews', route((req, res) => {
  const book = db.prepare('SELECT id FROM books WHERE id=?').get(req.params.bookId)
  if (!book) throw httpError(404, 'Book not found.')
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.review, r.created_at AS createdAt, u.name AS customerName
    FROM book_reviews r JOIN users u ON u.id=r.user_id
    WHERE r.book_id=? ORDER BY r.created_at DESC LIMIT 50
  `).all(book.id)
  const summary = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(ROUND(AVG(rating), 1), 0) AS average
    FROM book_reviews WHERE book_id=?
  `).get(book.id)
  res.json({ reviews, summary })
}))

app.post('/api/books/:bookId/reviews', requireAuth, route((req, res) => {
  const bookId = req.params.bookId
  if (!db.prepare('SELECT 1 FROM books WHERE id=?').get(bookId)) throw httpError(404, 'Book not found.')
  const rating = Number(req.body?.rating)
  const review = String(req.body?.review || '').trim()
  const hasPurchase = db.prepare(`
    SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id
    WHERE o.user_id=? AND o.payment_status='paid' AND oi.book_id=? LIMIT 1
  `).get(req.user.id, bookId)
  if (!hasPurchase) throw httpError(403, 'Only customers who purchased this book can leave a verified review.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Choose a rating from 1 to 5 stars.')
  if (review.length < 8 || review.length > 2000) throw httpError(400, 'Review must be 8–2,000 characters.')
  db.prepare(`
    INSERT INTO book_reviews (user_id, book_id, rating, review)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
      rating=excluded.rating, review=excluded.review, updated_at=CURRENT_TIMESTAMP
  `).run(req.user.id, bookId, rating, review)
  res.status(201).json({ ok: true })
}))

app.get('/api/recommendations', route((req, res) => {
  const ids = String(req.query.bookIds || '').split(',').map((id) => id.trim()).filter(Boolean)
  if (!ids.length || ids.length > 20) throw httpError(400, 'Provide between 1 and 20 book IDs.')
  const placeholders = ids.map(() => '?').join(',')
  const recommendations = db.prepare(`
    WITH matching_orders AS (
      SELECT DISTINCT oi.order_id
      FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.payment_status='paid' AND oi.book_id IN (${placeholders})
    )
    SELECT b.id, b.title, b.author, b.category, b.price, b.image, b.rating, b.stock,
      COUNT(DISTINCT oi.order_id) AS recommendationCount
    FROM matching_orders mo
    JOIN order_items oi ON oi.order_id=mo.order_id
    JOIN books b ON b.id=oi.book_id
    WHERE b.id NOT IN (${placeholders})
    GROUP BY b.id ORDER BY recommendationCount DESC, b.rating DESC, b.title LIMIT 6
  `).all(...ids, ...ids)
  res.json(recommendations.map((book) => ({ ...publicBook(book), recommendationCount: book.recommendationCount })))
}))

app.post('/api/orders/:orderId/returns', requireAuth, route((req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.orderId.toUpperCase(), req.user.id)
  if (!order) throw httpError(404, 'Order not found.')
  if (order.payment_status !== 'paid' || order.status !== 'delivered') {
    throw httpError(409, 'A return can be requested only for a paid, delivered order.')
  }
  const deliveredAt = Date.parse(order.delivered_at || '')
  if (!Number.isFinite(deliveredAt) || Date.now() - deliveredAt > 7 * 24 * 60 * 60 * 1000) {
    throw httpError(409, 'Return requests must be submitted within 7 days of delivery.')
  }
  const reason = String(req.body?.reason || '').trim()
  if (reason.length < 10 || reason.length > 1000) throw httpError(400, 'Explain the return reason in 10–1,000 characters.')
  try {
    const result = db.prepare('INSERT INTO return_requests (order_id, user_id, reason) VALUES (?, ?, ?)').run(order.id, req.user.id, reason)
    res.status(201).json(db.prepare(`
      SELECT id, reason, status, refund_status AS refundStatus, created_at AS createdAt
      FROM return_requests WHERE id=?
    `).get(result.lastInsertRowid))
  } catch (error) {
    if (String(error.code).includes('UNIQUE')) throw httpError(409, 'A return request already exists for this order.')
    throw error
  }
}))

app.get('/api/orders/:orderId/tracking', requireAuth, route(async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.orderId.toUpperCase(), req.user.id)
  if (!order) throw httpError(404, 'Order not found.')
  if (!order.tracking_number) throw httpError(409, 'Shipment tracking is not available for this order yet.')
  if (!shiprocketConfigured()) throw httpError(503, 'Carrier tracking is not configured yet.')
  res.json(await refreshShiprocketTracking(order))
}))

app.post('/api/auth/register', authLimiter, route(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim()
  const phone = String(req.body?.phone || '').trim()
  const city = String(req.body?.city || '').trim()
  const avatar = validateAvatar(req.body?.avatar)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address.')
  if (password.length < 8 || password.length > 128) throw httpError(400, 'Password must be 8–128 characters.')
  if (name.length < 2 || name.length > 80) throw httpError(400, 'Name must be 2–80 characters.')
  if (phone && !/^[0-9]{7,15}$/.test(phone)) throw httpError(400, 'Phone must contain 7–15 digits.')
  if (city.length > 80) throw httpError(400, 'City must be 80 characters or fewer.')

  let result
  try {
    result = db.prepare(`
      INSERT INTO users (email, password_hash, name, phone, city, avatar) VALUES (?, ?, ?, ?, ?, ?)
    `).run(email, bcrypt.hashSync(password, 12), name, phone, city, avatar)
  } catch (error) {
    if (String(error.code).includes('UNIQUE')) throw httpError(409, 'An account with this email already exists.')
    throw error
  }
  const user = db.prepare('SELECT id, email, name, phone, city, avatar FROM users WHERE id = ?').get(result.lastInsertRowid)
  const challengeId = crypto.randomBytes(32).toString('base64url')
  await deliverLoginOtp(user, challengeId)
  res.status(201).json({
    otpRequired: true,
    challengeId,
    email: maskEmail(user.email),
    expiresInSeconds: LOGIN_OTP_TTL_MS / 1000,
    resendAfterSeconds: LOGIN_OTP_RESEND_DELAY_MS / 1000
  })
}))

app.post('/api/auth/login', authLimiter, route(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) throw httpError(401, 'Email or password is incorrect.')
  const challengeId = crypto.randomBytes(32).toString('base64url')
  await deliverLoginOtp(user, challengeId)
  res.json({
    otpRequired: true,
    challengeId,
    email: maskEmail(user.email),
    expiresInSeconds: LOGIN_OTP_TTL_MS / 1000,
    resendAfterSeconds: LOGIN_OTP_RESEND_DELAY_MS / 1000
  })
}))

app.post('/api/auth/login/verify', authLimiter, route((req, res) => {
  const challengeId = String(req.body?.challengeId || '')
  const code = String(req.body?.code || '')
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(challengeId) || !/^\d{6}$/.test(code)) {
    throw httpError(400, 'Enter the 6-digit verification code sent to your email.')
  }
  const challengeHash = loginOtpChallengeHash(challengeId)
  const challenge = db.prepare(`
    SELECT c.*, u.id AS id, u.email, u.name, u.phone, u.city, u.avatar
    FROM login_otp_challenges c JOIN users u ON u.id=c.user_id
    WHERE c.challenge_hash=?
  `).get(challengeHash)
  if (!challenge) throw httpError(401, 'This verification code is invalid or expired. Please log in again.')
  if (challenge.expires_at <= Date.now()) {
    db.prepare('DELETE FROM login_otp_challenges WHERE user_id=?').run(challenge.user_id)
    throw httpError(401, 'This verification code has expired. Please log in again.')
  }
  if (challenge.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
    db.prepare('DELETE FROM login_otp_challenges WHERE user_id=?').run(challenge.user_id)
    throw httpError(429, 'Too many incorrect codes. Please log in again to request a new code.')
  }

  const expected = Buffer.from(challenge.otp_hash, 'hex')
  const received = Buffer.from(loginOtpCodeHash(challengeId, code), 'hex')
  if (!crypto.timingSafeEqual(expected, received)) {
    const attempts = challenge.attempts + 1
    if (attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
      db.prepare('DELETE FROM login_otp_challenges WHERE user_id=?').run(challenge.user_id)
      throw httpError(429, 'Too many incorrect codes. Please log in again to request a new code.')
    }
    db.prepare('UPDATE login_otp_challenges SET attempts=? WHERE user_id=?').run(attempts, challenge.user_id)
    throw httpError(401, `That code is incorrect. ${LOGIN_OTP_MAX_ATTEMPTS - attempts} attempts remain.`)
  }

  db.prepare('DELETE FROM login_otp_challenges WHERE user_id=?').run(challenge.user_id)
  db.prepare('DELETE FROM login_otp_delivery_limits WHERE email=?').run(challenge.email)
  setAuthCookie(res, challenge)
  res.json({
    user: safeUser(challenge),
    offer: getOffer(challenge.user_id)
  })
}))

app.post('/api/auth/login/resend', authLimiter, route(async (req, res) => {
  const challengeId = String(req.body?.challengeId || '')
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(challengeId)) {
    throw httpError(400, 'Please log in again to request a verification code.')
  }
  const challengeHash = loginOtpChallengeHash(challengeId)
  const challenge = db.prepare(`
    SELECT c.*, u.id AS id, u.email, u.name, u.phone, u.city, u.avatar
    FROM login_otp_challenges c JOIN users u ON u.id=c.user_id
    WHERE c.challenge_hash=?
  `).get(challengeHash)
  if (!challenge || challenge.expires_at <= Date.now()) {
    if (challenge) db.prepare('DELETE FROM login_otp_challenges WHERE user_id=?').run(challenge.user_id)
    throw httpError(401, 'This verification request has expired. Please log in again.')
  }
  if (challenge.resends >= LOGIN_OTP_MAX_RESENDS) {
    throw httpError(429, 'You have used all code resends. Please log in again to start a new request.')
  }
  const nextChallengeId = crypto.randomBytes(32).toString('base64url')
  await deliverLoginOtp(challenge, nextChallengeId, challenge.resends + 1)
  res.json({
    otpRequired: true,
    challengeId: nextChallengeId,
    email: maskEmail(challenge.email),
    expiresInSeconds: LOGIN_OTP_TTL_MS / 1000,
    resendAfterSeconds: LOGIN_OTP_RESEND_DELAY_MS / 1000
  })
}))

app.get('/api/auth/me', route((req, res) => {
  const token = req.cookies.bookstore_token
  if (!token) return res.json({ user: null })
  try {
    const decoded = jwt.verify(token, tokenSecret)
    const user = db.prepare('SELECT id, email, name, phone, city, avatar FROM users WHERE id = ?').get(Number(decoded.sub))
    return res.json({ user: user ? safeUser(user) : null })
  } catch {
    res.clearCookie('bookstore_token', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' })
    return res.json({ user: null })
  }
}))

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('bookstore_token', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' })
  res.json({ ok: true })
})

app.post('/api/admin/login', authLimiter, route((req, res) => {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || ''
  if (!adminEmail || !passwordHash) throw httpError(503, 'Admin login is not configured on the server.')
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  let passwordMatches = false
  try {
    passwordMatches = bcrypt.compareSync(password, passwordHash)
  } catch {
    throw httpError(503, 'Admin login configuration is invalid.')
  }
  if (email !== adminEmail || !passwordMatches) throw httpError(401, 'Email or password is incorrect.')
  setAdminCookie(res)
  res.json({ ok: true })
}))

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('bookstore_admin_token', { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' })
  res.json({ ok: true })
})

app.get('/api/admin/session', (req, res) => {
  try {
    const decoded = jwt.verify(req.cookies.bookstore_admin_token || '', tokenSecret)
    return res.json({ authenticated: decoded.role === 'admin' })
  } catch {
    return res.json({ authenticated: false })
  }
})

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const customers = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.city, u.created_at AS createdAt,
      COUNT(o.id) AS orderCount
    FROM users u LEFT JOIN orders o ON o.user_id=u.id
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200
  `).all()
  const orders = db.prepare(`
    SELECT o.id AS orderId, o.status, o.payment_status AS paymentStatus,
      o.payment_method AS paymentMethod, o.payment_reference AS paymentReference, o.subtotal,
      o.discount, o.total, o.created_at AS createdAt, o.shipping_name AS recipientName,
      o.shipping_email AS recipientEmail, o.shipping_phone AS recipientPhone,
      o.shipping_line1 AS addressLine1, o.shipping_line2 AS addressLine2,
      o.shipping_city AS city, o.shipping_state AS state, o.shipping_postal_code AS postalCode,
      o.tracking_number AS trackingNumber, o.courier_name AS courierName,
      o.tracking_url AS trackingUrl, o.tracking_status AS trackingStatus,
      u.id AS customerId, u.name AS accountName, u.email AS accountEmail,
      u.phone AS accountPhone, u.city AS accountCity
    FROM orders o JOIN users u ON u.id=o.user_id
    ORDER BY o.created_at DESC LIMIT 100
  `).all()
  const orderIds = orders.map((order) => order.orderId)
  const items = orderIds.length
    ? db.prepare(`
      SELECT order_id AS orderId, book_id AS id, title, author, unit_price AS unitPrice, quantity AS qty
      FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')}) ORDER BY id
    `).all(...orderIds)
    : []
  const recentOrders = orders.map((order) => ({
    ...order,
    items: items.filter((item) => item.orderId === order.orderId),
    returnRequest: db.prepare(`
      SELECT id, reason, status, refund_id AS refundId, refund_status AS refundStatus
      FROM return_requests WHERE order_id=?
    `).get(order.orderId) || null
  }))
  const inventory = db.prepare(`
    SELECT id, title, author, category, price, stock, isbn, publisher,
      publication_year AS publicationYear, language, pages, format,
      inventory_verified AS inventoryVerified
    FROM books ORDER BY category, title
  `).all()
  const returns = db.prepare(`
    SELECT r.id, r.order_id AS orderId, r.reason, r.status, r.refund_id AS refundId,
      r.refund_status AS refundStatus, r.created_at AS createdAt,
      u.name AS customerName, u.email AS customerEmail, o.total, o.payment_id AS paymentId
    FROM return_requests r
    JOIN users u ON u.id=r.user_id JOIN orders o ON o.id=r.order_id
    ORDER BY r.created_at DESC LIMIT 100
  `).all()
  const reviews = db.prepare(`
    SELECT r.id, r.book_id AS bookId, b.title AS bookTitle, r.rating, r.review,
      r.created_at AS createdAt, u.name AS customerName, u.email AS customerEmail
    FROM book_reviews r
    JOIN books b ON b.id=r.book_id
    JOIN users u ON u.id=r.user_id
    ORDER BY r.created_at DESC LIMIT 200
  `).all()
  res.json({
    customerCount: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    orderCount: db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,
    paidRevenue: db.prepare("SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE payment_status='paid'").get().total,
    shippingEnabled: shiprocketConfigured(),
    customers,
    orders: recentOrders,
    inventory,
    unverifiedInventoryCount: db.prepare('SELECT COUNT(*) AS count FROM books WHERE inventory_verified=0').get().count,
    returns,
    reviews,
    reviewCount: db.prepare('SELECT COUNT(*) AS count FROM book_reviews').get().count
  })
})

app.get('/api/admin/reports/sales', requireAdmin, route((req, res) => {
  const days = Number(req.query.days || 7)
  if (![7, 30, 90].includes(days)) throw httpError(400, 'Report period must be 7, 30, or 90 days.')
  const modifier = `-${days} days`
  const summary = db.prepare(`
    SELECT COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE payment_status='paid' AND created_at >= datetime('now', ?)
  `).get(modifier)
  const daily = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue
    FROM orders
    WHERE payment_status='paid' AND created_at >= datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY date(created_at)
  `).all(modifier)
  res.json({
    days,
    orderCount: summary.orderCount,
    revenue: summary.revenue,
    averageOrderValue: summary.orderCount ? Math.round(summary.revenue / summary.orderCount) : 0,
    daily
  })
}))

app.delete('/api/admin/reviews/:reviewId', requireAdmin, route((req, res) => {
  const reviewId = Number(req.params.reviewId)
  if (!Number.isSafeInteger(reviewId) || reviewId < 1) throw httpError(400, 'Review ID is invalid.')
  const result = db.prepare('DELETE FROM book_reviews WHERE id=?').run(reviewId)
  if (!result.changes) throw httpError(404, 'Review not found.')
  res.json({ ok: true, reviewId })
}))

app.get('/api/admin/books/:bookId/lookup', requireAdmin, route(async (req, res) => {
  const isbn = String(req.query.isbn || '').replace(/[-\s]/g, '').toUpperCase()
  if (!validIsbn(isbn)) throw httpError(400, 'Enter a valid ISBN-10 or ISBN-13.')
  const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, {
    headers: { Accept: 'application/json', 'User-Agent': 'BookStore/1.0 (catalog metadata lookup)' },
    signal: AbortSignal.timeout(12_000)
  })
  if (response.status === 404) throw httpError(404, 'Open Library has no edition for that ISBN.')
  if (!response.ok) throw httpError(502, 'Book metadata lookup failed. Try again later.')
  const edition = await response.json()
  res.json({
    isbn: (edition.isbn_13 || edition.isbn_10 || [isbn])[0] || isbn,
    publisher: Array.isArray(edition.publishers) ? edition.publishers[0] || '' : '',
    publicationYear: Number(String(edition.publish_date || '').match(/\d{4}/)?.[0]) || null,
    language: Array.isArray(edition.languages) ? edition.languages.map((item) => item.key?.split('/').pop()).filter(Boolean).join(', ') : '',
    pages: Number.isInteger(edition.number_of_pages) ? edition.number_of_pages : null,
    format: String(edition.physical_format || '')
  })
}))

app.patch('/api/admin/books/:bookId', requireAdmin, route((req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id=?').get(req.params.bookId)
  if (!book) throw httpError(404, 'Book not found.')
  const title = String(req.body?.title ?? book.title).trim()
  const author = String(req.body?.author ?? book.author).trim()
  const category = String(req.body?.category ?? book.category).trim()
  const price = Number(req.body?.price ?? book.price)
  if (!title || title.length > 180 || !author || author.length > 120 || !category || category.length > 80) {
    throw httpError(400, 'Book title, author, or category is invalid.')
  }
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
    throw httpError(400, 'Price must be a whole number from 0 to 1,000,000.')
  }
  const stock = Number(req.body?.stock)
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw httpError(400, 'Stock must be a whole number from 0 to 1,000,000.')
  const isbn = String(req.body?.isbn ?? book.isbn).replace(/[-\s]/g, '').toUpperCase()
  if (isbn && !validIsbn(isbn)) throw httpError(400, 'Enter a valid ISBN-10 or ISBN-13.')
  const publisher = String(req.body?.publisher ?? book.publisher).trim()
  const language = String(req.body?.language ?? book.language).trim()
  const format = String(req.body?.format ?? book.format).trim()
  const publicationYear = req.body?.publicationYear === null || req.body?.publicationYear === ''
    ? null : Number(req.body?.publicationYear ?? book.publication_year)
  const pages = req.body?.pages === null || req.body?.pages === ''
    ? null : Number(req.body?.pages ?? book.pages)
  if (publisher.length > 160 || language.length > 80 || format.length > 80) throw httpError(400, 'Book metadata exceeds the allowed length.')
  if (publicationYear !== null && (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > 2100)) {
    throw httpError(400, 'Publication year must be between 1000 and 2100.')
  }
  if (pages !== null && (!Number.isInteger(pages) || pages < 1 || pages > 100_000)) throw httpError(400, 'Page count must be a positive whole number.')
  const duplicateIsbn = isbn && db.prepare('SELECT id FROM books WHERE isbn=? AND id<>?').get(isbn, book.id)
  if (duplicateIsbn) throw httpError(409, 'That ISBN is already assigned to another book.')
  const verified = req.body?.inventoryVerified === true ? 1 : 0
  db.prepare(`
    UPDATE books SET title=?, author=?, category=?, price=?, stock=?, isbn=?, publisher=?, publication_year=?, language=?, pages=?, format=?,
      inventory_verified=? WHERE id=?
  `).run(title, author, category, price, stock, isbn, publisher, publicationYear, language, pages, format, verified, book.id)
  res.json(db.prepare(`
    SELECT id, title, author, category, price, stock, isbn, publisher,
      publication_year AS publicationYear, language, pages, format,
      inventory_verified AS inventoryVerified
    FROM books WHERE id=?
  `).get(book.id))
}))

app.post('/api/admin/orders/:orderId/shipment', requireAdmin, route(async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.orderId.toUpperCase())
  if (!order) throw httpError(404, 'Order not found.')
  if (!['paid', 'cod_pending'].includes(order.payment_status) || !['packed', 'shipped'].includes(order.status)) {
    throw httpError(409, 'Only paid or COD orders that are packed can be shipped.')
  }
  if (!shiprocketConfigured()) throw httpError(503, 'Set Shiprocket credentials, pickup location, and package dimensions in the private environment first.')
  let shipmentId = order.shiprocket_shipment_id
  if (!shipmentId) {
    const items = db.prepare(`
      SELECT oi.book_id, oi.title, oi.quantity, oi.unit_price, b.isbn
      FROM order_items oi JOIN books b ON b.id=oi.book_id WHERE oi.order_id=?
    `).all(order.id)
    const providerOrder = await shiprocketRequest('/orders/create/adhoc', {
      method: 'POST',
      body: {
        order_id: order.id,
        order_date: order.created_at,
        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
        billing_customer_name: order.shipping_name,
        billing_last_name: '',
        billing_address: order.shipping_line1,
        billing_address_2: order.shipping_line2,
        billing_city: order.shipping_city,
        billing_pincode: order.shipping_postal_code,
        billing_state: order.shipping_state,
        billing_country: 'India',
        billing_email: order.shipping_email,
        billing_phone: order.shipping_phone,
        shipping_is_billing: true,
        order_items: items.map((item) => ({
          name: item.title,
          sku: item.isbn || item.book_id,
          units: item.quantity,
          selling_price: item.unit_price,
          discount: 0,
          tax: 0,
          hsn: ''
        })),
        payment_method: order.payment_method === 'cod' ? 'COD' : 'Prepaid',
        sub_total: order.subtotal,
        length: Number(process.env.SHIPROCKET_PACKAGE_LENGTH_CM),
        breadth: Number(process.env.SHIPROCKET_PACKAGE_BREADTH_CM),
        height: Number(process.env.SHIPROCKET_PACKAGE_HEIGHT_CM),
        weight: Number(process.env.SHIPROCKET_PACKAGE_WEIGHT_KG)
      }
    })
    if (!providerOrder.shipment_id) throw httpError(502, 'Shiprocket created no shipment ID. Check the provider response and order dashboard.')
    shipmentId = Number(providerOrder.shipment_id)
    db.prepare('UPDATE orders SET shiprocket_order_id=?, shiprocket_shipment_id=? WHERE id=?')
      .run(String(providerOrder.order_id || order.id), shipmentId, order.id)
  }
  const assignment = await shiprocketRequest('/courier/assign/awb', {
    method: 'POST',
    body: {
      shipment_id: shipmentId,
      ...(process.env.SHIPROCKET_COURIER_ID ? { courier_id: Number(process.env.SHIPROCKET_COURIER_ID) } : {})
    }
  })
  const awb = assignment.response?.data?.awb_code || assignment.awb_code
  if (!awb) throw httpError(502, 'Shiprocket has not assigned an AWB yet. Check courier serviceability and retry.')
  const courierName = assignment.response?.data?.courier_name || assignment.courier_name || ''
  const trackingUrl = assignment.response?.data?.tracking_url || assignment.tracking_url || ''
  db.prepare(`
    UPDATE orders SET tracking_number=?, courier_name=?, tracking_url=?, tracking_status='Shipment created',
      status='shipped'
    WHERE id=?
  `).run(String(awb), String(courierName), String(trackingUrl), order.id)
  const notification = await sendOrderStatusEmail(order.id, 'shipped', { force: true })
  res.json({
    orderId: order.id,
    status: 'shipped',
    trackingNumber: String(awb),
    courierName: String(courierName),
    trackingUrl: String(trackingUrl),
    notification
  })
}))

app.patch('/api/admin/returns/:returnId', requireAdmin, route(async (req, res) => {
  const nextStatus = String(req.body?.status || '')
  const returnRequest = db.prepare(`
    SELECT r.*, o.payment_id, o.payment_method, o.total FROM return_requests r
    JOIN orders o ON o.id=r.order_id WHERE r.id=?
  `).get(Number(req.params.returnId))
  if (!returnRequest) throw httpError(404, 'Return request not found.')
  const allowed = {
    requested: ['approved', 'rejected'],
    approved: ['received'],
    received: ['refunded'],
    rejected: []
  }
  if (!allowed[returnRequest.status]?.includes(nextStatus)) throw httpError(409, 'This return request cannot move to that status.')
  if (nextStatus !== 'refunded') {
    db.prepare('UPDATE return_requests SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(nextStatus, returnRequest.id)
    return res.json({ id: returnRequest.id, status: nextStatus })
  }
  if (returnRequest.refund_id) {
    throw httpError(409, `A refund request already exists (${returnRequest.refund_id}). Check Razorpay before retrying.`)
  }
  if (returnRequest.payment_method !== 'razorpay') {
    throw httpError(409, 'Manual PhonePe payments must be refunded outside the dashboard.')
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !returnRequest.payment_id) {
    throw httpError(503, 'A verified Razorpay payment is required before processing an automatic refund.')
  }
  const refundResponse = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(returnRequest.payment_id)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: returnRequest.total * 100, notes: { bookstore_order_id: returnRequest.order_id } }),
      signal: AbortSignal.timeout(20_000)
    }
  )
  const refund = await refundResponse.json()
  if (!refundResponse.ok || !refund.id) {
    console.error('Razorpay refund request failed with status:', refundResponse.status)
    throw httpError(502, 'Razorpay could not process the refund. Check the payment dashboard before retrying.')
  }
  const refundStatus = String(refund.status || 'pending')
  const status = refundStatus === 'processed' ? 'refunded' : 'received'
  db.prepare(`
    UPDATE return_requests SET refund_id=?, refund_status=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(refund.id, refundStatus, status, returnRequest.id)
  res.json({ id: returnRequest.id, status, refundId: refund.id, refundStatus })
}))

app.patch('/api/admin/orders/:orderId/status', requireAdmin, route(async (req, res) => {
  const nextStatus = String(req.body?.status || '')
  const nextStatuses = { placed: 'packed', packed: 'shipped', shipped: 'delivered' }
  const order = db.prepare('SELECT id, status, payment_status, payment_method FROM orders WHERE id=?').get(req.params.orderId.toUpperCase())
  if (!order) throw httpError(404, 'Order not found.')
  const canFulfill = order.payment_status === 'paid' ||
    (order.payment_status === 'cod_pending' && order.payment_method === 'cod')
  if (!canFulfill) throw httpError(409, 'Only paid or cash-on-delivery orders can be processed for delivery.')
  if (nextStatuses[order.status] !== nextStatus) throw httpError(409, 'Orders must move one delivery step at a time.')
  db.prepare(`
    UPDATE orders SET status=?,
      delivered_at=CASE WHEN ?='delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
    WHERE id=?
  `).run(nextStatus, nextStatus, order.id)
  const notification = await sendOrderStatusEmail(order.id, nextStatus === 'packed' ? 'packed' : nextStatus)
  res.json({ orderId: order.id, status: nextStatus, notification })
}))

app.post('/api/admin/orders/:orderId/notifications/:eventKey', requireAdmin, route(async (req, res) => {
  const { orderId, eventKey } = req.params
  if (!orderEmailEvents[eventKey]) throw httpError(400, 'Order notification type is invalid.')
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId.toUpperCase())
  if (!order) throw httpError(404, 'Order not found.')
  const canSend = (order.payment_status === 'paid' || order.payment_status === 'cod_pending') && (
    eventKey === 'order_placed' ||
    (eventKey === 'packed' && ['packed', 'shipped', 'delivered'].includes(order.status)) ||
    (eventKey === 'shipped' && ['shipped', 'delivered'].includes(order.status)) ||
    (eventKey === 'out_for_delivery' && /out for delivery/i.test(order.tracking_status)) ||
    (eventKey === 'delivered' && order.status === 'delivered')
  )
  if (!canSend) throw httpError(409, 'This order is not currently eligible for that email update.')
  const notification = await sendOrderStatusEmail(order.id, eventKey)
  res.json({ orderId: order.id, notification })
}))

app.get('/api/profile', requireAuth, (req, res) => res.json(safeUser(req.user)))
app.put('/api/profile', requireAuth, route((req, res) => {
  const name = String(req.body?.name || '').trim()
  const phone = String(req.body?.phone || '').trim()
  const city = String(req.body?.city || '').trim()
  if (name.length < 2 || name.length > 80) throw httpError(400, 'Name must be 2–80 characters.')
  if (phone && !/^[0-9]{7,15}$/.test(phone)) throw httpError(400, 'Phone must contain 7–15 digits.')
  if (city.length > 80) throw httpError(400, 'City must be 80 characters or fewer.')
  const avatar = validateAvatar(req.body?.avatar)
  db.prepare('UPDATE users SET name=?, phone=?, city=?, avatar=? WHERE id=?').run(name, phone, city, avatar || null, req.user.id)
  res.json(safeUser(db.prepare('SELECT id, email, name, phone, city, avatar FROM users WHERE id=?').get(req.user.id)))
}))

app.get('/api/cart', requireAuth, (req, res) => res.json(getCart(req.user.id)))
app.put('/api/cart', requireAuth, route((req, res) => {
  const items = req.body?.items
  if (!Array.isArray(items) || items.length > 50) throw httpError(400, 'Cart items must be an array of up to 50 books.')
  const quantities = new Map()
  for (const item of items) {
    const id = String(item?.id || '')
    const qty = Number(item?.qty)
    const book = db.prepare('SELECT stock FROM books WHERE id=?').get(id)
    if (!book) throw httpError(400, `Unknown book: ${id}`)
    if (!Number.isInteger(qty) || qty < 1 || qty > Math.min(20, book.stock)) {
      throw httpError(400, 'Book quantity is invalid or exceeds available stock.')
    }
    quantities.set(id, (quantities.get(id) || 0) + qty)
  }
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id)
    const insert = db.prepare('INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, ?)')
    for (const [id, quantity] of quantities) {
      if (quantity > 20) throw httpError(400, 'Maximum quantity per book is 20.')
      insert.run(req.user.id, id, quantity)
    }
  })
  transaction()
  res.json(getCart(req.user.id))
}))

app.get('/api/wishlist', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT book_id AS id FROM wishlist_items WHERE user_id=? ORDER BY created_at DESC').all(req.user.id).map((row) => row.id))
})
app.put('/api/wishlist', requireAuth, route((req, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || ids.length > 100) throw httpError(400, 'Wishlist IDs must be an array of up to 100 books.')
  const uniqueIds = [...new Set(ids.map((id) => String(id)))]
  const exists = db.prepare('SELECT 1 FROM books WHERE id=?')
  for (const id of uniqueIds) {
    if (!exists.get(id)) throw httpError(400, `Unknown book: ${id}`)
  }
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM wishlist_items WHERE user_id=?').run(req.user.id)
    const insert = db.prepare('INSERT INTO wishlist_items (user_id, book_id) VALUES (?, ?)')
    uniqueIds.forEach((id) => insert.run(req.user.id, id))
  })
  transaction()
  res.json(uniqueIds)
}))

const readableBookIds = new Set(readerCatalog.map((entry) => entry.bookId))
app.get('/api/reading/:bookId/text', route(async (req, res) => {
  const reader = readerCatalog.find((entry) => entry.bookId === req.params.bookId)
  if (!reader) throw httpError(404, 'Reading edition not found.')

  let sourceUrl
  let textFormat = 'plain'
  if (reader.gutenbergId) {
    sourceUrl = `https://www.gutenberg.org/cache/epub/${reader.gutenbergId}/pg${reader.gutenbergId}.txt`
    textFormat = 'gutenberg'
  } else if (reader.sourceUrl) {
    const source = new URL(reader.sourceUrl)
    if (!['en.wikisource.org', 'hi.wikisource.org'].includes(source.hostname)) {
      throw httpError(400, 'This reading source is not supported.')
    }
    const page = decodeURIComponent(source.pathname.split('/wiki/')[1] || '')
    if (!page) throw httpError(400, 'This reading source does not have a valid page.')
    const apiUrl = new URL('/w/api.php', source.origin)
    apiUrl.search = new URLSearchParams({
      action: 'parse',
      page,
      prop: 'text',
      format: 'json',
      formatversion: '2',
      disablelimitreport: '1'
    }).toString()
    sourceUrl = apiUrl.toString()
    textFormat = 'html'
  } else {
    throw httpError(404, 'This reading edition does not have a text source.')
  }

  let response
  try {
    response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'BookStoreReader/1.0 (public-domain reading edition)' },
      signal: AbortSignal.timeout(20_000)
    })
  } catch (error) {
    console.error(`Could not fetch reading edition for ${reader.bookId}:`, error)
    return res.status(502).json({ error: 'The reading edition source is temporarily unavailable. Please try again.' })
  }
  if (!response.ok) {
    console.error(`Reading edition source returned ${response.status} for ${reader.bookId}.`)
    return res.status(502).json({ error: 'The reading edition source could not provide this book. Please try again later.' })
  }

  let text
  try {
    if (textFormat === 'gutenberg') {
      text = await response.text()
    } else {
      const payload = await response.json()
      if (payload.error || typeof payload.parse?.text !== 'string') {
        console.error(`Reading edition source returned no page content for ${reader.bookId}.`)
        return res.status(502).json({ error: 'The reading edition source could not provide this book. Please try again later.' })
      }
      text = payload.parse.text
    }
  } catch (error) {
    console.error(`Could not read reading edition response for ${reader.bookId}:`, error)
    return res.status(502).json({ error: 'The reading edition source returned an invalid response. Please try again later.' })
  }
  if (text.length > 20_000_000) {
    return res.status(502).json({ error: 'This reading edition is too large to open in the reader.' })
  }
  res.json({ text, textFormat })
}))

app.get('/api/reading/history', requireAuth, (req, res) => {
  const savedStates = db.prepare('SELECT book_id, state_json FROM reading_states WHERE user_id=?').all(req.user.id)
  const bookIds = savedStates
    .filter(({ book_id, state_json }) => {
      if (!readableBookIds.has(book_id)) return false
      const state = JSON.parse(state_json)
      return Number(state.position) > 0 || Number(state.paragraphPosition) > 0
    })
    .map(({ book_id }) => book_id)
  res.json({ bookIds })
})

app.get('/api/reading/:bookId', requireAuth, (req, res) => {
  if (!readableBookIds.has(req.params.bookId)) throw httpError(404, 'Reading edition not found.')
  const saved = db.prepare('SELECT state_json FROM reading_states WHERE user_id=? AND book_id=?')
    .get(req.user.id, req.params.bookId)
  res.json({ state: saved ? JSON.parse(saved.state_json) : null })
})

app.put('/api/reading/:bookId', requireAuth, route((req, res) => {
  if (!readableBookIds.has(req.params.bookId)) throw httpError(404, 'Reading edition not found.')
  const input = req.body?.state
  const isSafeText = (value, maxLength) => value === undefined ||
    (typeof value === 'string' && value.length <= maxLength)
  const validTimestamp = (value) => value === undefined ||
    (typeof value === 'string' && Number.isFinite(Date.parse(value)))
  const validBookmark = (bookmark) => bookmark && typeof bookmark === 'object' &&
    typeof bookmark.id === 'string' && bookmark.id.length > 0 && bookmark.id.length <= 80 &&
    Number.isInteger(bookmark.sectionIndex) && bookmark.sectionIndex >= 0 && bookmark.sectionIndex <= 100_000 &&
    isSafeText(bookmark.title, 160) && isSafeText(bookmark.note, 500) && validTimestamp(bookmark.createdAt)
  const validHighlight = (highlight) => highlight && typeof highlight === 'object' &&
    typeof highlight.id === 'string' && highlight.id.length > 0 && highlight.id.length <= 80 &&
    Number.isInteger(highlight.sectionIndex) && highlight.sectionIndex >= 0 && highlight.sectionIndex <= 100_000 &&
    Number.isInteger(highlight.paragraphIndex) && highlight.paragraphIndex >= 0 && highlight.paragraphIndex <= 100_000 &&
    Number.isInteger(highlight.startOffset) && highlight.startOffset >= 0 &&
    Number.isInteger(highlight.endOffset) && highlight.endOffset > highlight.startOffset &&
    typeof highlight.quote === 'string' && highlight.quote.length > 0 && highlight.quote.length <= 2_000 &&
    highlight.quote.length === highlight.endOffset - highlight.startOffset &&
    ['yellow', 'blue', 'green', 'pink'].includes(highlight.color || 'yellow') &&
    isSafeText(highlight.note, 500) && validTimestamp(highlight.createdAt)
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !Number.isInteger(input.position) || input.position < 0 || input.position > 100_000 ||
      (input.paragraphPosition !== undefined &&
        (!Number.isInteger(input.paragraphPosition) || input.paragraphPosition < 0 || input.paragraphPosition > 100_000)) ||
      !Array.isArray(input.bookmarks) || input.bookmarks.length > 100 ||
      !input.bookmarks.every(validBookmark) ||
      !Array.isArray(input.highlights) || input.highlights.length > 100 ||
      !input.highlights.every(validHighlight)) {
    throw httpError(400, 'Reading progress or annotations are invalid.')
  }
  const state = normalizeReaderState(input)
  if (state.bookmarks.length !== input.bookmarks.length || state.highlights.length !== input.highlights.length) {
    throw httpError(400, 'A bookmark or highlight is invalid.')
  }
  const stateJson = JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
  db.prepare(`
    INSERT INTO reading_states (user_id, book_id, state_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
      state_json=excluded.state_json, updated_at=CURRENT_TIMESTAMP
  `).run(req.user.id, req.params.bookId, stateJson)
  res.json({ state: JSON.parse(stateJson) })
}))

app.get('/api/offer', requireAuth, (req, res) => res.json(getOffer(req.user.id)))
app.post('/api/offer/claim', requireAuth, route((req, res) => {
  const priorOrder = db.prepare('SELECT 1 FROM orders WHERE user_id=? LIMIT 1').get(req.user.id)
  if (priorOrder) throw httpError(409, 'Welcome offer is only available before your first order.')
  db.prepare('INSERT OR IGNORE INTO welcome_offers (user_id) VALUES (?)').run(req.user.id)
  const offer = getOffer(req.user.id)
  if (!offer.eligible) throw httpError(409, 'This welcome offer has already been used.')
  res.json(offer)
}))

app.post('/api/payments/order', requireAuth, route(async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  const paymentMethod = String(req.body?.paymentMethod || '')
  if (!['phonepe_qr', 'cod', 'razorpay'].includes(paymentMethod)) {
    throw httpError(400, 'Choose a supported payment method.')
  }
  if (paymentMethod === 'razorpay' && (!keyId || !keySecret)) {
    throw httpError(503, 'Card payments require both Razorpay API keys.')
  }

  const shipping = req.body?.shipping || {}
  const address = {
    name: String(shipping.name || '').trim(),
    phone: String(shipping.phone || '').replace(/\D/g, ''),
    line1: String(shipping.line1 || '').trim(),
    line2: String(shipping.line2 || '').trim(),
    city: String(shipping.city || '').trim(),
    state: String(shipping.state || '').trim(),
    postalCode: String(shipping.postalCode || '').trim()
  }
  if (address.name.length < 2 || address.name.length > 80) throw httpError(400, 'Enter a valid recipient name.')
  if (!/^\d{10}$/.test(address.phone)) throw httpError(400, 'Enter a valid 10-digit delivery phone number.')
  if (address.line1.length < 5 || address.line1.length > 160) throw httpError(400, 'Enter a complete delivery address.')
  if (address.line2.length > 160) throw httpError(400, 'Address line 2 must be 160 characters or fewer.')
  if (address.city.length < 2 || address.city.length > 80) throw httpError(400, 'Enter a valid city.')
  if (address.state.length < 2 || address.state.length > 80) throw httpError(400, 'Enter a valid state.')
  if (!/^\d{6}$/.test(address.postalCode)) throw httpError(400, 'Enter a valid 6-digit PIN code.')
  const paymentReference = String(req.body?.paymentReference || '').trim()
  if (paymentMethod === 'phonepe_qr' && !/^[A-Za-z0-9-]{6,40}$/.test(paymentReference)) {
    throw httpError(400, 'Enter a valid UPI transaction reference (6–40 letters or numbers).')
  }

  const items = getCart(req.user.id)
  if (!items.length) throw httpError(400, 'Your cart is empty.')
  for (const item of items) {
    if (item.qty > item.stock) throw httpError(409, `${item.title} does not have enough stock.`)
  }
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  const offer = getOffer(req.user.id)
  const discount = offer.eligible ? Math.round(subtotal * 0.2) : 0
  const total = subtotal - discount
  const orderId = makeOrderId()

  let providerResponse = null
  if (paymentMethod === 'razorpay') {
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: total * 100,
          currency: 'INR',
          receipt: orderId,
          notes: { bookstore_order_id: orderId }
        })
      })
      providerResponse = await response.json()
      if (!response.ok) {
        console.error('Razorpay order creation failed with status:', response.status)
        throw httpError(502, 'Payment provider could not start checkout. Please try again.')
      }
    } catch (error) {
      if (error.status) throw error
      console.error('Razorpay order creation failed:', error)
      throw httpError(502, 'Could not connect to the payment provider. Please try again.')
    }
  }

  const createOrder = db.transaction(() => {
    const currentItems = getCart(req.user.id)
    if (!currentItems.length) throw httpError(409, 'Your cart changed. Please try checkout again.')
    if (currentItems.some((item, index) => item.id !== items[index]?.id || item.qty !== items[index]?.qty)) {
      throw httpError(409, 'Your cart changed. Please try checkout again.')
    }
    const freshOffer = getOffer(req.user.id)
    const currentSubtotal = currentItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
    const currentDiscount = freshOffer.eligible ? Math.round(currentSubtotal * 0.2) : 0
    if (currentSubtotal - currentDiscount !== total) throw httpError(409, 'Your total changed. Please try checkout again.')

    db.prepare(`
      INSERT INTO orders (
        id, user_id, status, subtotal, discount, total, payment_status, razorpay_order_id,
        payment_method, payment_reference,
        shipping_name, shipping_phone, shipping_email, shipping_line1, shipping_line2,
        shipping_city, shipping_state, shipping_postal_code
      ) VALUES (?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, req.user.id, subtotal, discount, total,
      paymentMethod === 'cod' ? 'cod_pending' : 'pending',
      providerResponse?.id || null,
      paymentMethod, paymentMethod === 'phonepe_qr' ? paymentReference : null,
      address.name, address.phone, req.user.email, address.line1, address.line2,
      address.city, address.state, address.postalCode
    )
    const addItem = db.prepare(`
      INSERT INTO order_items (order_id, book_id, title, author, image, unit_price, quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const item of currentItems) addItem.run(orderId, item.id, item.title, item.author, item.image, item.unitPrice, item.qty)
    if (paymentMethod === 'cod') {
      const reserveStock = db.prepare('UPDATE books SET stock=stock-? WHERE id=? AND stock>=?')
      for (const item of currentItems) {
        const result = reserveStock.run(item.qty, item.id, item.qty)
        if (result.changes !== 1) throw httpError(409, `${item.title} no longer has enough stock.`)
      }
      db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id)
      if (discount) db.prepare('UPDATE welcome_offers SET used_at=CURRENT_TIMESTAMP WHERE user_id=?').run(req.user.id)
    }
  })
  createOrder()

  if (paymentMethod === 'phonepe_qr' || paymentMethod === 'cod') {
    const notification = paymentMethod === 'cod'
      ? await sendOrderStatusEmail(orderId, 'order_placed')
      : undefined
    return res.status(201).json({
      mode: paymentMethod,
      total,
      order: { id: orderId, amount: total * 100, currency: 'INR', receipt: orderId },
      ...(paymentMethod === 'phonepe_qr' ? { qrImage: '/payments/phonepe-qr.png' } : {}),
      ...(notification ? { notification } : {}),
      ...getOrderForCustomer(orderId, req.user.id)
    })
  }

  res.status(201).json({
    mode: 'razorpay',
    keyId,
    order: {
      id: providerResponse.id,
      amount: providerResponse.amount,
      currency: providerResponse.currency,
      receipt: orderId
    },
    customer: { name: address.name, email: req.user.email, phone: address.phone },
    total
  })
}))

app.post('/api/admin/orders/:orderId/confirm-manual-payment', requireAdmin, route(async (req, res) => {
  const orderId = req.params.orderId.toUpperCase()
  const result = markManualOrderPaid(orderId)
  if (!result.found) throw httpError(404, 'Order not found.')
  if (result.manualPaymentRequired) {
    throw httpError(409, 'Only a submitted PhonePe payment or a delivered COD order can be confirmed.')
  }
  if (result.refundRequired) throw httpError(409, 'Payment could not be confirmed because stock needs review.')
  if (!result.paid) throw httpError(409, 'This order is no longer awaiting payment confirmation.')
  const notification = await sendOrderStatusEmail(orderId, 'order_placed')
  res.json({ orderId, paymentStatus: 'paid', notification })
}))

app.post('/api/payments/verify', requireAuth, route(async (req, res) => {
  const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {}
  if (![razorpayOrderId, paymentId, signature].every((value) => typeof value === 'string' && value.length < 256)) {
    throw httpError(400, 'Payment verification details are incomplete.')
  }
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id=? AND user_id=?').get(razorpayOrderId, req.user.id)
  if (!order) throw httpError(404, 'Payment order not found.')
  if (!signatureMatches(process.env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${paymentId}`, signature)) {
    throw httpError(400, 'Payment signature could not be verified.')
  }

  let payment
  try {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`
      }
    })
    payment = await response.json()
    if (!response.ok) {
      console.error('Razorpay payment verification failed with status:', response.status)
      throw httpError(502, 'Payment status could not be confirmed. Please check your orders before retrying.')
    }
  } catch (error) {
    if (error.status) throw error
    console.error('Razorpay payment verification failed:', error)
    throw httpError(502, 'Could not confirm payment with the provider. Please check your orders before retrying.')
  }
  if (payment.order_id !== razorpayOrderId || payment.amount !== order.total * 100 || payment.currency !== 'INR') {
    throw httpError(400, 'Payment details do not match this order.')
  }
  if (payment.status !== 'captured') throw httpError(409, 'Payment is not captured yet. Please refresh your orders shortly.')

  const result = markOrderPaid(razorpayOrderId, paymentId)
  if (!result.found) throw httpError(404, 'Payment order not found.')
  if (result.refundRequired) throw httpError(409, 'Payment was received, but stock needs review. Please contact support.')
  if (!result.paid) throw httpError(409, 'This payment order is no longer active.')
  const notification = await sendOrderStatusEmail(result.orderId, 'order_placed')
  res.json({ ...getOrderForCustomer(result.orderId, req.user.id), notification })
}))

app.post('/api/payments/webhook', route(async (req, res) => {
  if (!signatureMatches(process.env.RAZORPAY_WEBHOOK_SECRET, req.rawBody, req.get('x-razorpay-signature'))) {
    throw httpError(400, 'Invalid payment webhook signature.')
  }
  const event = req.body?.event
  const paymentEntity = req.body?.payload?.payment?.entity
  if (!paymentEntity?.order_id) return res.json({ ok: true })
  if (event === 'payment.captured') {
    const result = markOrderPaid(paymentEntity.order_id, paymentEntity.id)
    if (!result.found) console.error('Captured Razorpay payment has no matching bookstore order:', paymentEntity.order_id)
    if (result.refundRequired) console.error('Captured payment requires a stock review:', result.orderId)
    if (result.paid) await sendOrderStatusEmail(result.orderId, 'order_placed')
  } else if (event === 'payment.failed') {
    db.prepare(`
      UPDATE orders SET payment_status='failed', payment_id=?
      WHERE razorpay_order_id=? AND payment_status='pending'
    `).run(paymentEntity.id || null, paymentEntity.order_id)
  }
  res.json({ ok: true })
}))

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)
  res.json(orders.map((order) => getOrderForCustomer(order.id, req.user.id)))
})

app.get('/api/orders/:orderId', requireAuth, route((req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.orderId.toUpperCase(), req.user.id)
  if (!order) throw httpError(404, 'Order not found.')
  res.json(getOrderForCustomer(order.id, req.user.id))
}))

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))

if (isProduction) {
  app.use(express.static(path.join(root, 'dist')))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    return res.sendFile(path.join(root, 'dist', 'index.html'))
  })
}

app.use((error, _req, res, _next) => {
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message })
  if (error.status === 502 || error.status === 503) return res.status(error.status).json({ error: error.message })
  console.error(error)
  return res.status(500).json({ error: 'An unexpected server error occurred.' })
})

const port = Number(process.env.API_PORT || 3001)
app.listen(port, isProduction ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`BookStore API listening on http://127.0.0.1:${port}`)
})
