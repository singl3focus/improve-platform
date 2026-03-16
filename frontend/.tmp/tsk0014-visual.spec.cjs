const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.TSK0014_BASE_URL || 'http://127.0.0.1:3010';
const EDGE_PATH = process.env.TSK0014_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const REPORT_PATH = path.resolve(__dirname, 'tsk0014-visual-report.json');

const combinations = [
  { language: 'ru', theme: 'light' },
  { language: 'ru', theme: 'dark' },
  { language: 'en', theme: 'light' },
  { language: 'en', theme: 'dark' }
];

const pages = ['/login', '/register', '/dashboard', '/roadmap', '/topics', '/tasks', '/materials', '/settings'];

const forbiddenTokensByLanguage = {
  ru: [
    'sign in',
    'create account',
    'settings',
    'language',
    'theme',
    'retry',
    'loading',
    'personal learning kanban',
    'curated materials library',
    'topic progress',
    'dependencies',
    'checklist',
    'materials',
    'tasks',
    'dashboard',
    'save',
    'cancel',
    'edit',
    'delete'
  ],
  en: [
    'вход',
    'создать аккаунт',
    'настройки',
    'язык',
    'тема',
    'повторить',
    'загрузка',
    'персональный',
    'материалы',
    'задачи',
    'темы',
    'выйти',
    'сохранить',
    'удалить',
    'изменения применяются'
  ]
};

test.use({
  launchOptions: {
    headless: true,
    executablePath: EDGE_PATH
  }
});

test('tsk-0014 visual smoke matrix', async ({ page }) => {
  const report = [];

  const email = `tsk0014_${Date.now()}@example.com`;
  const password = 'Password123!';

  await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
  await page.fill('#full-name', 'TSK 0014 Visual');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 20000 }),
    page.locator('button[type="submit"]').click()
  ]);

  for (const combo of combinations) {
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
    const selects = page.locator('select');
    await selects.nth(0).selectOption(combo.language);
    await selects.nth(1).selectOption(combo.theme);

    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(combo.language);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(combo.theme);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('select').nth(0)).toHaveValue(combo.language);
    await expect(page.locator('select').nth(1)).toHaveValue(combo.theme);

    for (const route of pages) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const redirectedToLogin = (route !== '/login' && route !== '/register') && page.url().includes('/login');
      const evalResult = await page.evaluate(({ language, forbiddenTokens }) => {
        function parseColor(input) {
          const raw = String(input || '').trim();
          if (!raw) {
            return null;
          }
          const rgba = raw.match(/^rgba?\(([^)]+)\)$/i);
          if (!rgba) {
            return null;
          }
          const parts = rgba[1].split(',').map((v) => Number.parseFloat(v.trim()));
          if (parts.length < 3) {
            return null;
          }
          return {
            r: Number.isFinite(parts[0]) ? parts[0] : 0,
            g: Number.isFinite(parts[1]) ? parts[1] : 0,
            b: Number.isFinite(parts[2]) ? parts[2] : 0,
            a: parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1
          };
        }

        function luminance({ r, g, b }) {
          const toLinear = (value) => {
            const v = value / 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        }

        function contrastRatio(fg, bg) {
          const l1 = luminance(fg);
          const l2 = luminance(bg);
          const light = Math.max(l1, l2);
          const dark = Math.min(l1, l2);
          return (light + 0.05) / (dark + 0.05);
        }

        function getBackgroundColor(element) {
          let current = element;
          while (current) {
            const style = window.getComputedStyle(current);
            const color = parseColor(style.backgroundColor);
            if (color && color.a > 0.01) {
              return color;
            }
            current = current.parentElement;
          }
          return { r: 255, g: 255, b: 255, a: 1 };
        }

        function isVisible(element) {
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }

        const selectors = ['h1','h2','h3','h4','p','span','a','button','label','li','strong'];
        const candidates = Array.from(document.querySelectorAll(selectors.join(',')));
        const textSamples = [];
        let minContrast = Number.POSITIVE_INFINITY;

        for (const el of candidates) {
          if (!isVisible(el)) {
            continue;
          }
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text) {
            continue;
          }
          if (text.length > 140) {
            continue;
          }

          textSamples.push(text.toLowerCase());

          const fg = parseColor(window.getComputedStyle(el).color);
          if (!fg) {
            continue;
          }
          const bg = getBackgroundColor(el);
          const ratio = contrastRatio(fg, bg);
          if (Number.isFinite(ratio)) {
            minContrast = Math.min(minContrast, ratio);
          }
        }

        if (!Number.isFinite(minContrast)) {
          minContrast = 0;
        }

        const joinedText = textSamples.join(' ');
        const tokenHits = forbiddenTokens.filter((token) => joinedText.includes(token));

        return {
          lang: document.documentElement.lang,
          theme: document.documentElement.dataset.theme || null,
          minContrast,
          tokenHits,
          textCount: textSamples.length,
          localStorageLanguage: window.localStorage.getItem('improve_ui_language'),
          localStorageTheme: window.localStorage.getItem('improve_ui_theme')
        };
      }, { language: combo.language, forbiddenTokens: forbiddenTokensByLanguage[combo.language] });

      const pass = !redirectedToLogin
        && evalResult.lang === combo.language
        && evalResult.theme === combo.theme
        && evalResult.localStorageLanguage === combo.language
        && evalResult.localStorageTheme === combo.theme
        && evalResult.minContrast >= 3
        && evalResult.tokenHits.length === 0;

      report.push({
        combination: `${combo.language}+${combo.theme}`,
        route,
        pass,
        redirectedToLogin,
        minContrast: Number(evalResult.minContrast.toFixed(2)),
        tokenHits: evalResult.tokenHits,
        htmlLang: evalResult.lang,
        htmlTheme: evalResult.theme,
        storageLanguage: evalResult.localStorageLanguage,
        storageTheme: evalResult.localStorageTheme,
        textCount: evalResult.textCount
      });
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify({ baseUrl: BASE_URL, report }, null, 2));
});
