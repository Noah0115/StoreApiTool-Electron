const submitButton = document.getElementById("submit");
const openStoreButton = document.getElementById("open-store");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const countEl = document.getElementById("count");
const tbody = document.getElementById("tbody");
const urlInput = document.getElementById("url");
const MICROSOFT_STORE_HOME = "https://apps.microsoft.com/home?hl=zh-CN&gl=CN";

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRows(files) {
  return files.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.file)}</td>
      <td>${escapeHtml(item.expire)}</td>
      <td>${escapeHtml(item.sha1)}</td>
      <td>${escapeHtml(item.size)}</td>
      <td>
        <button class="link-button" type="button" data-url="${escapeHtml(item.url)}" data-index="${index}">
          下载
        </button>
      </td>
    </tr>
  `).join("");
}

async function queryFiles() {
  const payload = {
    url: urlInput.value.trim(),
    ring: document.getElementById("ring").value,
    lang: document.getElementById("lang").value.trim(),
    gl: document.getElementById("gl").value.trim()
  };

  if (!payload.url) {
    setStatus("请先输入商店链接。", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("正在请求接口...", "");

  try {
    const data = await window.storeApi.queryFiles(payload);
    countEl.textContent = String(data.files.length);
    tbody.innerHTML = buildRows(data.files);
    resultEl.classList.remove("hidden");
    setStatus(`查询完成，拿到 ${data.files.length} 个文件。`, "ok");
  } catch (error) {
    setStatus(error.message || "请求失败。", "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function openStoreEntry() {
  const rawUrl = urlInput.value.trim();
  const targetUrl = rawUrl || MICROSOFT_STORE_HOME;
  await window.storeApi.openExternal(targetUrl);
}

submitButton.addEventListener("click", queryFiles);
openStoreButton.addEventListener("click", () => {
  openStoreEntry().catch((error) => {
    setStatus(error.message || "打开微软商店失败。", "error");
  });
});

urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    queryFiles();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const openable = target.closest("[data-url]");
  if (!openable) {
    return;
  }

  event.preventDefault();
  const url = openable.getAttribute("data-url");
  if (!url) {
    return;
  }
  await window.storeApi.openExternal(url);
});
