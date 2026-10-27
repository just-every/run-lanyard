import { chromium } from '@playwright/test'

const browser = await chromium.launch({
  headless: true,
  // Keep local macOS probes out of the owner's keychain.
  ...(process.platform === 'darwin' ? { args: ['--use-mock-keychain', '--password-store=basic'] } : {}),
})
await browser.close()
