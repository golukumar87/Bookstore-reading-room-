import { defineConfig } from '@playwright/test'
import bcrypt from 'bcryptjs'
import os from 'node:os'
import path from 'node:path'

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT || 4311)
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || 4310)
const smtpPort = Number(process.env.PLAYWRIGHT_SMTP_PORT || 4312)
const smtpCapturePort = Number(process.env.PLAYWRIGHT_SMTP_CAPTURE_PORT || 4313)
const databasePath = process.env.PLAYWRIGHT_DATABASE_PATH ||
  path.join(os.tmpdir(), `bookstore-playwright-${process.pid}.sqlite`)
const jwtSecret = 'playwright-test-secret-not-for-production-123456789'
const adminEmail = 'admin-e2e@bookstore.test'
const adminPassword = 'Playwright-admin-password-47'
const adminPasswordHash = bcrypt.hashSync(adminPassword, 4)

process.env.DB_PATH = databasePath
process.env.PLAYWRIGHT_ADMIN_EMAIL = adminEmail
process.env.PLAYWRIGHT_ADMIN_PASSWORD = adminPassword

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node scripts/test-smtp.js',
      url: `http://127.0.0.1:${smtpCapturePort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PLAYWRIGHT_SMTP_PORT: String(smtpPort),
        PLAYWRIGHT_SMTP_CAPTURE_PORT: String(smtpCapturePort)
      }
    },
    {
      command: 'node scripts/test-api.js',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        API_PORT: String(apiPort),
        DB_PATH: databasePath,
        PLAYWRIGHT_CLEAN_TEST_DB: '1',
        JWT_SECRET: jwtSecret,
        ADMIN_EMAIL: adminEmail,
        ADMIN_PASSWORD_HASH: adminPasswordHash,
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtpPort),
        SMTP_SECURE: 'false',
        SMTP_FROM: 'BookStore Test <noreply@bookstore.test>',
        SMTP_USER: '',
        SMTP_PASS: '',
        RAZORPAY_KEY_ID: '',
        RAZORPAY_KEY_SECRET: '',
        SHIPROCKET_EMAIL: '',
        SHIPROCKET_PASSWORD: ''
      }
    },
    {
      command: `vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`
      }
    }
  ]
})
