const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storeApi", {
  queryFiles(payload) {
    return ipcRenderer.invoke("query-store-files", payload);
  },
  openExternal(url) {
    return ipcRenderer.invoke("open-external", url);
  }
});
