const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const BASE_URL = process.env.TSK0014_BASE_URL || 'http://127.0.0.1:3010';
const EDGE_PATH = process.env.TSK0014_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const REPORT_PATH = path.resolve(__dirname, 'tsk0014-visual-report.json');

const combinations = [
  { language: 'ru', theme: 'light' },
  { language: 'ru', theme: 'dark' },
  { language: 'en', theme: 'light' },
  { language: 'en', theme: 'dark' }
];

const guestRoutes = ['/login', '/register'];
const privateRoutes = ['/dashboard', '/roadmap', '/topics', '/tasks', '/materials', '/settings'];

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

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function applySettingsCombo(page, combo) {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  await page.waitForFunction(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    if (selects.length < 2) {
      return false;
    }
    return selects.every((element) =>
      Object.keys(element).some((key) => key.startsWith('__reactProps$'))
    );
  });

  const languageSelect = page
    .locator('select')
    .filter({ has: page.locator('option[value="ru"]') })
    .first();
  const themeSelect = page
    .locator('select')
    .filter({ has: page.locator('option[value="dark"]') })
    .first();

  await languageSelect.selectOption(combo.language);
  await themeSelect.selectOption(combo.theme);

  await page.waitForFunction(
    ({ language, theme }) =>
      window.localStorage.getItem('improve_ui_language') === language &&
      window.localStorage.getItem('improve_ui_theme') === theme &&
      document.documentElement.lang === language &&
      document.documentElement.dataset.theme === theme,
    combo,
    { timeout: 10000 }
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    ({ language, theme }) =>
      window.localStorage.getItem('improve_ui_language') === language &&
      window.localStorage.getItem('improve_ui_theme') === theme &&
      document.documentElement.lang === language &&
      document.documentElement.dataset.theme === theme,
    combo,
    { timeout: 10000 }
  );
}

async function evaluateRoute(page, combo, route, mode) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });

  try {
    await page.waitForFunction(
      ({ language, theme }) =>
        window.localStorage.getItem('improve_ui_language') === language &&
        window.localStorage.getItem('improve_ui_theme') === theme &&
        document.documentElement.lang === language &&
        document.documentElement.dataset.theme === theme,
      combo,
      { timeout: 6000 }
    );
  } catch {
    await page.waitForTimeout(1000);
  }

  const redirectedToLogin = mode === 'private' && page.url().includes('/login');

  const evalResult = await page.evaluate(({ forbiddenTokens }) => {
    function parseColor(input) {
      const raw = String(input || '').trim();
      const hex = raw.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const value = hex[1];
        return {
          r: Number.parseInt(value.slice(0, 2), 16),
          g: Number.parseInt(value.slice(2, 4), 16),
          b: Number.parseInt(value.slice(4, 6), 16),
          a: 1
        };
      }
      const rgba = raw.match(/^rgba?\(([^)]+)\)$/i);
      if (!rgba) {
        return null;
      }
      const parts = rgba[1].split(',').map((value) => Number.parseFloat(value.trim()));
      return {
        r: Number.isFinite(parts[0]) ? parts[0] : 0,
        g: Number.isFinite(parts[1]) ? parts[1] : 0,
        b: Number.isFinite(parts[2]) ? parts[2] : 0,
        a: parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1
      };
    }

    function toLinear(value) {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }

    function luminance(color) {
      return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
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
      const rootStyle = window.getComputedStyle(document.documentElement);
      const rootBg = parseColor(rootStyle.getPropertyValue('--bg'));
      if (rootBg) {
        return rootBg;
      }
      const bodyBg = parseColor(window.getComputedStyle(document.body).backgroundColor);
      if (bodyBg) {
        return bodyBg;
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

    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,label,li,strong'));
    const textSamples = [];
    let minContrast = Number.POSITIVE_INFINITY;
    let worstText = '';
    let worstFg = '';
    let worstBg = '';

    for (const element of candidates) {
      if (!isVisible(element)) {
        continue;
      }
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 160) {
        continue;
      }
      textSamples.push(text.toLowerCase());

      const fg = parseColor(window.getComputedStyle(element).color);
      if (!fg) {
        continue;
      }
      const bg = getBackgroundColor(element);
      const ratio = contrastRatio(fg, bg);
      if (Number.isFinite(ratio)) {
        if (ratio < minContrast) {
          minContrast = ratio;
          worstText = text;
          worstFg = `rgb(${fg.r},${fg.g},${fg.b})`;
          worstBg = `rgb(${bg.r},${bg.g},${bg.b})`;
        }
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
      localStorageTheme: window.localStorage.getItem('improve_ui_theme'),
      worstText,
      worstFg,
      worstBg
    };
  }, { forbiddenTokens: forbiddenTokensByLanguage[combo.language] });

  const pass =
    !redirectedToLogin &&
    evalResult.lang === combo.language &&
    evalResult.theme === combo.theme &&
    evalResult.localStorageLanguage === combo.language &&
    evalResult.localStorageTheme === combo.theme &&
    evalResult.minContrast >= 3 &&
    evalResult.tokenHits.length === 0;

  return {
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
    textCount: evalResult.textCount,
    worstText: evalResult.worstText,
    worstFg: evalResult.worstFg,
    worstBg: evalResult.worstBg
  };
}

async function createAuthenticatedContext(browser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  const email = `tsk0014_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`;
  const password = 'Password123!';

  const registerResponse = await context.request.post('/api/auth/register', {
    data: {
      full_name: 'TSK 0014 Visual',
      email,
      password
    }
  });
  if (registerResponse.status() !== 200) {
    throw new Error(`register failed with status ${registerResponse.status()}`);
  }

  const loginResponse = await context.request.post('/api/auth/login', {
    data: { email, password }
  });
  if (loginResponse.status() !== 200) {
    throw new Error(`login failed with status ${loginResponse.status()}`);
  }

  const setCookieHeader = loginResponse.headers()['set-cookie'];
  if (!setCookieHeader) {
    throw new Error('login response has no set-cookie header');
  }

  const accessMatch = setCookieHeader.match(/improve_access_token=([^;]+)/);
  const refreshMatch = setCookieHeader.match(/improve_refresh_token=([^;]+)/);
  if (!accessMatch || !refreshMatch) {
    throw new Error('auth cookies not found in login set-cookie header');
  }

  const url = new URL(BASE_URL);
  await context.addCookies([
    {
      name: 'improve_access_token',
      value: accessMatch[1],
      domain: url.hostname,
      path: '/'
    },
    {
      name: 'improve_refresh_token',
      value: refreshMatch[1],
      domain: url.hostname,
      path: '/'
    }
  ]);

  return { context, page };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const report = [];

  try {
    for (const combo of combinations) {
      const guestContext = await browser.newContext({ baseURL: BASE_URL });
      await guestContext.addInitScript(
        ({ language, theme }) => {
          window.localStorage.setItem('improve_ui_language', language);
          window.localStorage.setItem('improve_ui_theme', theme);
          document.documentElement.lang = language;
          document.documentElement.dataset.theme = theme;
        },
        combo
      );
      const guestPage = await guestContext.newPage();

      for (const route of guestRoutes) {
        const result = await evaluateRoute(guestPage, combo, route, 'guest');
        report.push(result);
        log(`${combo.language}+${combo.theme} ${route} :: ${result.pass ? 'PASS' : 'FAIL'}`);
      }

      await guestContext.close();

      const { context: authContext, page: authPage } = await createAuthenticatedContext(browser);
      await applySettingsCombo(authPage, combo);

      for (const route of privateRoutes) {
        const result = await evaluateRoute(authPage, combo, route, 'private');
        report.push(result);
        log(`${combo.language}+${combo.theme} ${route} :: ${result.pass ? 'PASS' : 'FAIL'}`);
      }

      await authContext.close();
    }

    fs.writeFileSync(REPORT_PATH, JSON.stringify({ baseUrl: BASE_URL, report }, null, 2));

    const failed = report.filter((entry) => !entry.pass);
    log(`REPORT_PATH=${REPORT_PATH}`);
    log(`TOTAL=${report.length}; FAILED=${failed.length}`);
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
