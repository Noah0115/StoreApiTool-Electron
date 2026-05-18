const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storeApi", {
  fetchAppMetadata(payload) {
    return ipcRenderer.invoke("fetch-store-app-metadata", payload);
  },
  queryFiles(payload) {
    return ipcRenderer.invoke("query-store-files", payload);
  },
  openExternal(url) {
    return ipcRenderer.invoke("open-external", url);
  },
  windowControls: {
    getState() {
      return ipcRenderer.invoke("window-state");
    },
    fitContent() {
      return ipcRenderer.invoke("window-fit-content");
    },
    perform(action) {
      return ipcRenderer.invoke("window-control", action);
    },
    onStateChange(listener) {
      if (typeof listener !== "function") {
        return () => {};
      }

      const wrapped = (_event, state) => {
        listener(state);
      };

      ipcRenderer.on("window-state", wrapped);
      return () => {
        ipcRenderer.removeListener("window-state", wrapped);
      };
    }
  }
});
