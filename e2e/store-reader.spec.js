import { expect, test } from '@playwright/test'
import Database from 'better-sqlite3'

async function dismissSignIn(page) {
  const signInDialog = page.getByRole('dialog', { name: 'Welcome back' })
  await expect(signInDialog).toBeVisible()
  await signInDialog.getByRole('button', { name: 'Close sign in' }).click()
}

async function openHomepage(page) {
  await page.goto('/')
  const enterButton = page.getByRole('button', { name: 'ENTER WEBSITE' })
  await expect(enterButton).toBeVisible()
  await enterButton.click()
}

async function registerTestAccount(page) {
  await openHomepage(page)
  const signInDialog = page.getByRole('dialog', { name: 'Welcome back' })
  await expect(signInDialog).toBeVisible()
  await signInDialog.getByRole('button', { name: 'Create an account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create your account' })
  const email = `reader-${Date.now()}@example.test`
  await dialog.getByLabel('Full name').fill('Browser Test Reader')
  await dialog.getByLabel('Email address').fill(email)
  await dialog.getByLabel('Password').fill('Playwright-password-47')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  const verification = page.getByRole('dialog', { name: 'Verify your email' })
  await expect(verification).toBeVisible()
  await verification.getByLabel('Email verification code').fill(await readLoginOtp(email))
  await verification.getByRole('button', { name: 'Verify and log in' }).click()
  await expect(page.getByRole('heading', { name: /Welcome to BookStore/ })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'close' }).click()
  await expect(page.getByRole('button', { name: 'Profile for Browser Test Reader' })).toBeVisible()
  return email
}

async function readLoginOtp(email) {
  const url = `http://127.0.0.1:${process.env.PLAYWRIGHT_SMTP_CAPTURE_PORT || 4313}/latest?email=${encodeURIComponent(email)}`
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(url)
    if (response.ok) return (await response.json()).code
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`No login OTP email was captured for ${email}.`)
}

function seedPaidOrder(email) {
  const database = new Database(process.env.PLAYWRIGHT_DATABASE_PATH)
  try {
    const user = database.prepare('SELECT id FROM users WHERE email=?').get(email)
    const book = database.prepare('SELECT id, title, author, image, price FROM books ORDER BY rowid LIMIT 1').get()
    const orderId = `BK-E2E-${Date.now()}`
    database.prepare(`
      INSERT INTO orders (
        id, user_id, status, subtotal, discount, total, payment_status, payment_id,
        shipping_name, shipping_phone, shipping_email, shipping_line1, shipping_city,
        shipping_state, shipping_postal_code
      ) VALUES (?, ?, 'placed', ?, 0, ?, 'paid', ?, 'Test Customer', '9876543210', ?, '10 Test Street', 'Test City', 'Test State', '123456')
    `).run(orderId, user.id, book.price * 2, book.price * 2, `pay_${Date.now()}`, email)
    database.prepare(`
      INSERT INTO order_items (order_id, book_id, title, author, image, unit_price, quantity)
      VALUES (?, ?, ?, ?, ?, ?, 2)
    `).run(orderId, book.id, book.title, book.author, book.image, book.price)
    return orderId
  } finally {
    database.close()
  }
}

async function getCapturedEmails(email) {
  const url = `http://127.0.0.1:${process.env.PLAYWRIGHT_SMTP_CAPTURE_PORT || 4313}/messages?email=${encodeURIComponent(email)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not retrieve captured email for ${email}.`)
  return (await response.json()).messages
}

test('shows the welcome page before entering the existing storefront', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /WELCOME TO MY WEBSITE/i })).toBeVisible()
  await page.getByRole('button', { name: 'ENTER WEBSITE' }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible()
})

test('automatically enters the existing storefront after six seconds', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /WELCOME TO MY WEBSITE/i })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Welcome back' })).toBeVisible({ timeout: 10000 })
})

test('searches and filters Reading Room editions and shows an empty state', async ({ page }) => {
  await page.goto('/read')
  await dismissSignIn(page)
  await expect(page.getByRole('heading', { name: 'Read a little. Discover a lot.' })).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'Search books' })
  await search.fill('Pride and Prejudice')
  await expect(page.getByRole('status').filter({ hasText: 'Showing 1 of' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pride and Prejudice' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Category' }).selectOption('World Classics')
  await search.fill('no-such-reading-edition')
  await expect(page.getByText('No books match these filters.')).toBeVisible()
})

test('opens the customer orders view and explains when there are no orders', async ({ page }) => {
  await registerTestAccount(page)
  await page.getByRole('button', { name: 'Orders' }).click()
  const orders = page.getByRole('dialog', { name: 'Orders and delivery tracking' })
  await expect(orders).toBeVisible()
  await expect(orders).toHaveAttribute('aria-modal', 'true')
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  const overlayBounds = await page.locator('.customer-orders-page').evaluate((element) => {
    const { left, top, right, bottom } = element.getBoundingClientRect()
    return { left, top, right, bottom }
  })
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  expect(overlayBounds).toEqual({ left: 0, top: 0, right: viewport.width, bottom: viewport.height })
  await expect(orders.getByRole('heading', { name: 'Your orders' })).toBeVisible()
  await expect(orders.getByText(/You have no orders yet/)).toBeVisible()
  await expect(orders.getByRole('button', { name: 'Done' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(orders).toBeHidden()
})

test('shows order details and lets an admin advance fulfillment with customer email updates', async ({ page }) => {
  const email = await registerTestAccount(page)
  const orderId = seedPaidOrder(email)

  await page.getByRole('button', { name: 'Orders' }).click()
  const orders = page.getByRole('dialog', { name: 'Orders and delivery tracking' })
  const savedOrder = orders.getByRole('button', { name: new RegExp(orderId) })
  await expect(savedOrder).toBeVisible()
  await savedOrder.click()
  await expect(orders.getByRole('heading', { name: 'Items in this order' })).toBeVisible()
  await expect(orders.getByText('Test Customer')).toBeVisible()
  await expect(orders.getByText(/10 Test Street/)).toBeVisible()
  await expect(orders.getByText(/Carrier tracking will appear here/)).toBeVisible()
  await orders.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Open admin dashboard' }).click()
  await page.getByLabel('Email', { exact: true }).fill(process.env.PLAYWRIGHT_ADMIN_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  const orderRow = page.locator('.admin-table tbody tr').filter({ hasText: orderId })
  await expect(orderRow).toBeVisible()
  const origin = new URL(page.url()).origin
  const placedEmail = await page.request.post(`${origin}/api/admin/orders/${encodeURIComponent(orderId)}/notifications/order_placed`)
  expect(placedEmail.status()).toBe(200)
  expect((await placedEmail.json()).notification.sent).toBe(true)
  await expect.poll(async () => (await getCapturedEmails(email)).some((message) => message.includes('Order confirmed'))).toBe(true)
  await orderRow.getByLabel(`Update ${orderId} fulfillment status`).selectOption('packed')
  await expect(orderRow.getByRole('status')).toContainText('Email update sent: packed')
  await expect.poll(async () => {
    const emails = await getCapturedEmails(email)
    return emails.some((message) => message.includes('Your order is packed'))
  }).toBe(true)
  await orderRow.getByLabel(`Update ${orderId} fulfillment status`).selectOption('shipped')
  await expect(orderRow.getByRole('status')).toContainText('Email update sent: shipped')
  await orderRow.getByLabel(`Update ${orderId} fulfillment status`).selectOption('delivered')
  await expect(orderRow.getByRole('status')).toContainText('Email update sent: delivered')
  await expect.poll(async () => {
    const emails = await getCapturedEmails(email)
    return emails.some((message) => message.includes('Order delivered'))
  }).toBe(true)
})

test('registers, adds a book to cart, and saves a reader bookmark to the account', async ({ page }) => {
  const email = await registerTestAccount(page)

  await page.goto('/read')
  const onlineBuy = page.locator('.reader-buy-button:not(:disabled)').first()
  await expect(onlineBuy).toBeVisible()
  await onlineBuy.click()
  const onlineBuyCart = page.getByRole('dialog', { name: 'cart' })
  await expect(onlineBuyCart.getByText(/1 item/)).toBeVisible()
  await onlineBuyCart.getByRole('button', { name: 'close cart' }).click()

  await openHomepage(page)
  await page.locator('.book-card .add-to-cart').first().click()
  await expect(page.getByRole('button', { name: 'Cart, 2 items' })).toBeVisible()
  await page.getByRole('button', { name: 'Cart, 2 items' }).click()
  const cart = page.getByRole('dialog', { name: 'cart' })
  await expect(cart.getByText(/2 items/)).toBeVisible()
  await expect(cart.getByText('Cart is empty')).toHaveCount(0)
  await cart.getByRole('button', { name: 'close cart' }).click()

  await page.getByRole('button', { name: 'Logout' }).click()
  const login = page.getByRole('dialog', { name: 'Welcome back' })
  await login.getByLabel('Email address').fill(email)
  await login.getByLabel('Password').fill('Playwright-password-47')
  await login.getByRole('button', { name: 'Log in' }).click()
  const verification = page.getByRole('dialog', { name: 'Verify your email' })
  await expect(verification).toBeVisible()
  const otp = await readLoginOtp(email)
  await verification.getByLabel('Email verification code').fill(otp === '000000' ? '000001' : '000000')
  await verification.getByRole('button', { name: 'Verify and log in' }).click()
  await expect(verification.getByRole('alert')).toContainText('code is incorrect')
  await expect.poll(() => page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user)).toBeNull()
  await verification.getByLabel('Email verification code').fill(otp)
  await verification.getByRole('button', { name: 'Verify and log in' }).click()
  await expect(page.getByRole('button', { name: 'Profile for Browser Test Reader' })).toBeVisible()
  await page.getByRole('button', { name: 'Cart, 2 items' }).click()
  await expect(page.getByRole('dialog', { name: 'cart' }).getByText(/2 items/)).toBeVisible()
  await page.getByRole('button', { name: 'close cart' }).click()

  await page.goto('/read/pride')
  await expect(page.getByRole('button', { name: 'Bookmark this section' })).toBeVisible()
  await page.getByRole('button', { name: 'Bookmark this section' }).click()
  const paragraph = page.locator('.reader-page p').first()
  await paragraph.evaluate((element) => {
    const text = element.firstChild
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, Math.min(12, text.textContent.length))
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    element.closest('.reader-page').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Highlight selected text' }).click()
  await expect(page.locator('.reader-highlight')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your reading notes' })).toBeVisible()
  await expect(page.getByText(/Progress synced with your account|Saved on this device; syncing/)).toBeVisible()
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch('/api/reading/pride')
    const payload = await response.json()
    return { bookmarks: payload.state?.bookmarks?.length || 0, highlights: payload.state?.highlights?.length || 0 }
  })).toEqual({ bookmarks: 1, highlights: 1 })

  const secondaryContext = await page.context().browser().newContext()
  const base = new URL(page.url()).origin
  const secondEmail = `reader-isolation-${Date.now()}@example.test`
  const secondAccount = await secondaryContext.request.post(`${base}/api/auth/register`, {
    data: {
      name: 'Separate Test Account',
      email: secondEmail,
      password: 'Playwright-password-47'
    }
  })
  expect(secondAccount.status()).toBe(201)
  const secondChallenge = await secondAccount.json()
  expect(secondChallenge.otpRequired).toBe(true)
  const unauthenticatedSession = await secondaryContext.request.get(`${base}/api/auth/me`)
  expect(await unauthenticatedSession.json()).toEqual({ user: null })
  const secondOtp = await readLoginOtp(secondEmail)
  const secondVerification = await secondaryContext.request.post(`${base}/api/auth/login/verify`, {
    data: { challengeId: secondChallenge.challengeId, code: secondOtp }
  })
  expect(secondVerification.status()).toBe(200)
  const isolatedRead = await secondaryContext.request.get(`${base}/api/reading/pride`)
  expect(await isolatedRead.json()).toEqual({ state: null })
  const invalidState = await secondaryContext.request.put(`${base}/api/reading/pride`, {
    data: { state: { position: 0, bookmarks: [{}], highlights: [] } }
  })
  expect(invalidState.status()).toBe(400)
  await secondaryContext.close()
})
