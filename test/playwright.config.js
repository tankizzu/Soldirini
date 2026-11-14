// Configurazione delle prove automatiche di Soldirini.
// Le prove con la lettura delle foto (OCR) non sono qui: sono lente e restano da avviare a mano.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 60000,
  fullyParallel: true,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  outputDir: 'risultati',
  use: { browserName: 'chromium', trace: 'retain-on-failure' }
});
