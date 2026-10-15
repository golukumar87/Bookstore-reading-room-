import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const child = spawn(process.execPath, ['server/index.js'], {
  env: process.env,
  stdio: 'inherit'
})
let shuttingDown = false

function cleanTestDatabase() {
  const databasePath = process.env.DB_PATH
  if (process.env.PLAYWRIGHT_CLEAN_TEST_DB !== '1' || !databasePath ||
      path.dirname(databasePath) !== os.tmpdir() ||
      !/^bookstore-playwright-[\w-]+\.sqlite$/.test(path.basename(databasePath))) return
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true })
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shuttingDown = true
    child.kill(signal)
  })
}

child.on('error', (error) => {
  console.error('Could not start the isolated Playwright API server:', error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  try {
    cleanTestDatabase()
  } catch (error) {
    console.error('Could not remove the isolated Playwright test database:', error)
    process.exitCode = 1
  }
  if (!shuttingDown || (code !== null && code !== 0)) {
    process.exitCode = code || 1
  }
  if (signal && !shuttingDown) process.exitCode = 1
})
