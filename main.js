const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const UPSTREAM_URL = "https://store.rg-adguard.net/api/GetFiles";

if (!app.isPackaged) {
  try {
    require("electron-reloader")(module, {
      debug: false,
      watchRenderer: true
    });
  } catch (error) {
    console.warn("Hot reload unavailable:", error.message);
  }
}

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

function createWindow() {
  const icon = resolveWindowIcon();
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1080,
    minHeight: 760,
    backgroundColor: "#f4f6fb",
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "src", "index.html"));
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

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
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

ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url);
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
