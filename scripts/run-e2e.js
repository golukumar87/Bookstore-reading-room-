import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const databasePath = path.join(os.tmpdir(), `bookstore-playwright-${randomUUID()}.sqlite`)
const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js')
const child = spawn(process.execPath, [playwrightCli, 'test'], {
  env: { ...process.env, PLAYWRIGHT_DATABASE_PATH: databasePath },
  stdio: 'inherit'
})

child.on('error', (error) => {
  console.error('Could not start Playwright:', error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  let cleanupFailed = false
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      fs.rmSync(`${databasePath}${suffix}`, { force: true })
    } catch (error) {
      cleanupFailed = true
      console.error(`Could not remove the temporary browser-test database${suffix}:`, error.message)
    }
  }
  process.exitCode = cleanupFailed ? 1 : code ?? (signal ? 1 : 0)
})
