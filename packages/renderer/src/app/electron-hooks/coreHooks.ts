import { IpcRenderer } from "electron";

import { CoreHooks } from "./types";

export default (ipcRenderer: IpcRenderer): CoreHooks => {
  return {
    login: async (username: string, password: string) => {
      const response = await ipcRenderer.invoke("login", username, password);
      return response;
    },
  };
};
