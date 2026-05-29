const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  moveWindow: (dx, dy) => ipcRenderer.send("move-window", dx, dy),
});
