const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const UPSTREAM_URL = "https://store.rg-adguard.net/api/GetFiles";
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const STORE_PAGE_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";
const DEFAULT_WINDOW_WIDTH = 1460;
const DEFAULT_WINDOW_HEIGHT = 980;
const DEFAULT_MIN_WIDTH = 1080;
const DEFAULT_MIN_HEIGHT = 760;

function resolveWindowIcon() {
  const candidates = process.platform === "win32"
    ? ["icon.ico", "icon-512.png"]
    : ["icon-512.png", "icon.ico"];

  for (const fileName of candidates) {
    const assetPath = path.join(__dirname, "assets", fileName);
    if (fs.existsSync(assetPath)) {
      return assetPath;
    }
  }

  return undefined;
}

async function fitWindowToContent(win) {
  if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) {
    return;
  }

  const contentBounds = win.getContentBounds();
  const windowBounds = win.getBounds();
  const display = screen.getDisplayMatching(windowBounds);
  const frameHeight = windowBounds.height - contentBounds.height;
  const minContentHeight = Math.min(DEFAULT_MIN_HEIGHT, display.workAreaSize.height);
  const maxContentHeight = Math.max(minContentHeight, display.workAreaSize.height - frameHeight);
  const measured = await win.webContents.executeJavaScript(`
    (() => ({
      scrollHeight: Math.ceil(document.documentElement.scrollHeight),
      clientHeight: Math.ceil(document.documentElement.clientHeight)
    }))();
  `, true).catch(() => null);

  if (!measured) {
    return;
  }

  const nextContentHeight = Math.min(Math.max(measured.scrollHeight, minContentHeight), maxContentHeight);

  if (Math.abs(nextContentHeight - contentBounds.height) > 1) {
    win.setContentSize(contentBounds.width, nextContentHeight);
  }

  if (measured.scrollHeight > nextContentHeight + 1 && win.isMaximizable()) {
    win.maximize();
  }
}

function createWindow() {
  const icon = resolveWindowIcon();
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = Math.min(DEFAULT_WINDOW_WIDTH, workAreaSize.width);
  const height = Math.min(DEFAULT_WINDOW_HEIGHT, workAreaSize.height);
  const minWidth = Math.min(DEFAULT_MIN_WIDTH, width);
  const minHeight = Math.min(DEFAULT_MIN_HEIGHT, height);

  const win = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    show: false,
    backgroundColor: "#f4f6fb",
    autoHideMenuBar: true,
    frame: false,
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const emitWindowState = () => {
    if (!win.isDestroyed()) {
      win.webContents.send("window-state", getWindowState(win));
    }
  };

  win.once("ready-to-show", async () => {
    await fitWindowToContent(win);
    if (!win.isDestroyed()) {
      win.show();
      emitWindowState();
    }

    setTimeout(() => {
      void fitWindowToContent(win);
    }, 180);

    setTimeout(() => {
      void fitWindowToContent(win);
    }, 520);
  });

  win.on("focus", emitWindowState);
  win.on("blur", emitWindowState);
  win.on("maximize", emitWindowState);
  win.on("unmaximize", emitWindowState);
  win.on("enter-full-screen", emitWindowState);
  win.on("leave-full-screen", emitWindowState);
  win.on("restore", emitWindowState);
  win.on("ready-to-show", emitWindowState);

  if (!app.isPackaged && DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    return;
  }

  win.loadFile(path.join(__dirname, "dist", "index.html"));
}

function getWindowState(win) {
  return {
    focused: win.isFocused(),
    maximized: win.isMaximized(),
    fullScreen: win.isFullScreen(),
    minimizable: win.isMinimizable(),
    maximizable: win.isMaximizable(),
    closable: win.isClosable()
  };
}

function normalizeStoreDetailUrl(storeUrl, lang, gl) {
  let parsed;

  try {
    parsed = new URL(storeUrl);
  } catch {
    throw new Error("请输入有效的 Microsoft Store 应用详情链接。");
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error("仅支持 http 或 https 的 Microsoft Store 链接。");
  }

  if (!/(^|\.)apps\.microsoft\.com$/i.test(parsed.hostname) || !/^\/detail\//i.test(parsed.pathname)) {
    throw new Error("请输入 Microsoft Store 的应用详情页链接。");
  }

  if (lang) {
    parsed.searchParams.set("hl", lang);
  }

  if (gl) {
    parsed.searchParams.set("gl", gl.toUpperCase());
  }

  return parsed;
}

function parseResultPage(content) {
  const rowRe = /<tr style="[^"]*"><td><a href="(?<url>[^"]+)"[^>]*>(?<file>[^<]+)<\/a><\/td><td align="center">(?<expire>[^<]+)<\/td><td align="center">(?<sha1>[^<]+)<\/td><td align="center">(?<size>[^<]+)<\/td><\/tr>/gi;
  const categoryRe = /<b>CategoryID:<\/b>\s*<i>(?<category>[^<]+)<\/i>/i;
  const files = [];

  for (const match of content.matchAll(rowRe)) {
    files.push({
      file: decodeHtml(match.groups.file),
      url: decodeHtml(match.groups.url),
      expire: decodeHtml(match.groups.expire),
      sha1: decodeHtml(match.groups.sha1),
      size: decodeHtml(match.groups.size)
    });
  }

  const categoryMatch = content.match(categoryRe);
  return {
    categoryId: categoryMatch ? decodeHtml(categoryMatch.groups.category) : null,
    files,
    rawHtml: content
  };
}

function parseStoreAppPage(content) {
  const structuredData = extractStructuredAppData(content);
  const pageMetadata = extractJsonAssignment(content, "window.pageMetadata");
  const productSnapshot = extractProductSnapshot(content);

  const title = firstNonEmpty(
    normalizeText(productSnapshot?.title),
    cleanStoreDisplayName(structuredData?.name),
    cleanStoreDisplayName(extractMetaContent(content, "property", "og:title")),
    cleanStoreDisplayName(extractTitleText(content))
  );
  const description = firstNonEmpty(
    normalizeText(pageMetadata?.shortDescription),
    normalizeText(productSnapshot?.description),
    normalizeText(structuredData?.description),
    normalizeText(extractMetaContent(content, "name", "description"))
  );
  const image = firstNonEmpty(
    normalizeText(productSnapshot?.pdpImageUrl),
    normalizeText(structuredData?.image),
    normalizeText(extractMetaContent(content, "property", "og:image"))
  );
  const developer = firstNonEmpty(
    normalizeText(pageMetadata?.developerName),
    normalizeText(productSnapshot?.publisherName),
    normalizeText(structuredData?.author?.name)
  );
  const category = firstNonEmpty(
    normalizeText(structuredData?.applicationCategory),
    normalizeText(productSnapshot?.categories?.[0]),
    normalizeText(pageMetadata?.categoryId)
  );
  const subcategory = firstNonEmpty(
    normalizeText(structuredData?.applicationSubCategory),
    normalizeText(pageMetadata?.subcategoryName)
  );
  const ratingValue = asNumberOrNull(
    structuredData?.aggregateRating?.ratingValue
  );
  const ratingCount = asNumberOrNull(
    pageMetadata?.ratingCount ?? structuredData?.aggregateRating?.ratingCount
  );
  const operatingSystem = firstNonEmpty(
    normalizeText(structuredData?.operatingSystem)
  );
  const websiteUrl = firstNonEmpty(
    normalizeText(pageMetadata?.appWebsiteUrl)
  );
  const features = firstNonEmptyArray(pageMetadata?.features, structuredData?.featureList)
    .map((feature) => normalizeText(feature))
    .filter(Boolean)
    .slice(0, 3);

  return {
    title,
    description,
    image,
    developer,
    category,
    subcategory,
    ratingValue,
    ratingCount,
    operatingSystem,
    websiteUrl,
    features
  };
}

function extractStructuredAppData(content) {
  const marker = "\"@type\":\"SoftwareApplication\"";
  const markerIndex = content.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const startIndex = content.lastIndexOf("{", markerIndex);
  return startIndex === -1 ? null : parseJsonObjectAt(content, startIndex);
}

function extractJsonAssignment(content, name) {
  const marker = `${name} =`;
  const markerIndex = content.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const startIndex = content.indexOf("{", markerIndex);
  return startIndex === -1 ? null : parseJsonObjectAt(content, startIndex);
}

function extractProductSnapshot(content) {
  const marker = "\"pdpImageUrl\":\"";
  let markerIndex = content.indexOf(marker);

  while (markerIndex !== -1) {
    const startIndex = content.lastIndexOf("{", markerIndex);
    const parsed = startIndex === -1 ? null : parseJsonObjectAt(content, startIndex);

    if (parsed && typeof parsed.title === "string" && typeof parsed.pdpImageUrl === "string") {
      return parsed;
    }

    markerIndex = content.indexOf(marker, markerIndex + marker.length);
  }

  return null;
}

function parseJsonObjectAt(content, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        try {
          return JSON.parse(content.slice(startIndex, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractMetaContent(content, attributeName, attributeValue) {
  const escapedValue = escapeRegExp(attributeValue);
  const re = new RegExp(`<meta[^>]*${attributeName}=["']${escapedValue}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const match = content.match(re);
  return match ? decodeHtml(match[1]) : null;
}

function extractTitleText(content) {
  const match = content.match(/<title>([^<]+)<\/title>/i);
  return match ? decodeHtml(match[1]) : null;
}

function cleanStoreDisplayName(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  if (!normalized.includes("Microsoft Store")) {
    return normalized;
  }

  const segments = normalized.split(" | ").map((segment) => segment.trim()).filter(Boolean);
  const candidate = segments[0] || normalized;

  return candidate.replace(/\s+-\s+Windows.*$/i, "").trim() || candidate;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return null;
}

function firstNonEmptyArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }

  return [];
}

function asNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

ipcMain.handle("query-store-files", async (_event, payload) => {
  const storeUrl = String(payload?.url || "").trim();
  const ring = String(payload?.ring || "Retail").trim() || "Retail";
  const lang = String(payload?.lang || "zh-CN").trim() || "zh-CN";
  const gl = String(payload?.gl || "CN").trim() || "CN";

  if (!storeUrl) {
    throw new Error("请先输入 Microsoft Store 链接。");
  }

  const body = new URLSearchParams({
    type: "url",
    url: storeUrl,
    ring,
    lang,
    gl
  });

  const response = await fetch(UPSTREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://store.rg-adguard.net",
      "Referer": "https://store.rg-adguard.net/",
      "User-Agent": STORE_PAGE_USER_AGENT
    },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`上游接口返回 HTTP ${response.status}\n${text}`);
  }

  const html = await response.text();
  return parseResultPage(html);
});

ipcMain.handle("fetch-store-app-metadata", async (_event, payload) => {
  const lang = String(payload?.lang || "zh-CN").trim() || "zh-CN";
  const gl = String(payload?.gl || "CN").trim() || "CN";
  const detailUrl = normalizeStoreDetailUrl(String(payload?.url || "").trim(), lang, gl);

  const response = await fetch(detailUrl, {
    headers: {
      "Accept-Language": `${lang},${lang.split("-")[0]};q=0.9,en;q=0.7`,
      "User-Agent": STORE_PAGE_USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`应用详情页返回 HTTP ${response.status}`);
  }

  const html = await response.text();
  const metadata = parseStoreAppPage(html);

  if (!metadata.title && !metadata.description && !metadata.image) {
    throw new Error("未能从该页面提取应用信息。");
  }

  return {
    ...metadata,
    sourceUrl: detailUrl.toString()
  };
});

ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle("window-state", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("无法读取窗口状态。");
  }

  return getWindowState(win);
});

ipcMain.handle("window-fit-content", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("无法调整当前窗口大小。");
  }

  await fitWindowToContent(win);
  return getWindowState(win);
});

ipcMain.handle("window-control", (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("无法控制当前窗口。");
  }

  switch (action) {
    case "minimize":
      if (win.isMinimizable()) {
        win.minimize();
      }
      break;
    case "toggle-maximize":
      if (win.isMaximizable()) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
      break;
    case "close":
      if (win.isClosable()) {
        win.close();
      }
      break;
    default:
      throw new Error(`未知窗口操作: ${action}`);
  }

  return getWindowState(win);
});

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.noah0115.storeapitool");
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
