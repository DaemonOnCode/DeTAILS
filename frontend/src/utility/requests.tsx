import { REMOTE_SERVER_BASE_URL, SERVER_ROUTES, SERVER_ROUTE_MAP, USE_LOCAL_SERVER } from "../constants/Shared";
import { RouteArgs, RouteResponse } from "../types/Shared";

const { ipcRenderer } = window.require("electron");

export const makeRequest = async <T extends SERVER_ROUTES>(
  route: T,
  args: RouteArgs[T]["server"] | RouteArgs[T]["local"],
  headers?: Record<string, string>,
  formdata?: FormData
): Promise<RouteResponse[T]> => {
  const routeInfo = SERVER_ROUTE_MAP[route];

  if (!routeInfo) {
    throw new Error(`Route "${route}" not found in SERVER_ROUTE_MAP.`);
  }

  if (USE_LOCAL_SERVER) {
    try {
      const result: RouteResponse[T] = await ipcRenderer.invoke(routeInfo.local, args);
      return result;
    } catch (error) {
      console.error("Error during local processing:", error);
    //   throw error;
    }
  } else if (!USE_LOCAL_SERVER) {
    try {
      const response = await fetch(`${REMOTE_SERVER_BASE_URL}/${routeInfo.server}`, {
        method: "POST",
        headers: headers || { "Content-Type": "application/json" },
        body: headers ? formdata : JSON.stringify(args),
      });
      const data = await response.json() as RouteResponse[T];
      return data;
    } catch (error) {
      console.error("Error during server processing:", error);
    //   throw error;
    }
  } else {
    throw new Error(`Invalid processing type`);
  }

    return new Promise(()=>{});
};
