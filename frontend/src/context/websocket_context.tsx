import { FC, createContext, useContext, useEffect, useRef, useState } from "react";
import { ILayout } from "../types/Coding/shared";
import { toast } from "react-toastify";

const { ipcRenderer } = window.require("electron");

type CallbackFn = (message: string) => void;

const WebSocketContext = createContext({
  registerCallback: (event: string, callback: CallbackFn) => {},
  unregisterCallback: (event: string) => {},
});

// Singleton to ensure WebSocket setup happens only once
const WebSocketSingleton = (() => {
  let isInitialized = false;

  const initialize = (handleMessage: (event: any, message: string) => void) => {
    if (isInitialized) return;

    ipcRenderer.removeAllListeners("ws-message");
    ipcRenderer.on("ws-message", handleMessage);

    ipcRenderer.once("ws-closed", () => {
      toast.warning("WebSocket connection closed. Attempting to reconnect...");
      setTimeout(() => {
        ipcRenderer.invoke("connect-ws", "").then(() => {
          toast.success("WebSocket reconnected");
          console.log("WebSocket reconnected");
        }).catch((error: any) => {
          toast.error("Failed to reconnect WebSocket.");
          console.error("Failed to reconnect WebSocket:", error);
        });
      }, 5000);
    });

    isInitialized = true;
    console.log("WebSocket singleton initialized");
  };

  return {
    initialize,
  };
})();

export const WebSocketProvider: FC<ILayout> = ({ children }) => {
  const messageCallbacks = useRef<{ [key: string]: CallbackFn }>({});
  const lastPingRef = useRef<Date | null>(null);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const registerCallback = (event: string, callback: CallbackFn) => {
    console.log(`Registering callback for event: ${event}`);
    if (!messageCallbacks.current[event]) {
      messageCallbacks.current[event] = callback;
    }
    console.log("Current registered callbacks:", messageCallbacks.current);
  };

  const unregisterCallback = (event: string) => {
    console.log(`Unregistering callback for event: ${event}`);
    delete messageCallbacks.current[event];
    console.log("Current registered callbacks after removal:", messageCallbacks.current);
  };

  const handleMessage = (event: any, message: string) => {
    console.log("Received WebSocket message:", message);

    if (message === "ping") {
      lastPingRef.current = new Date();
      resetPingTimeout();
      return;
    }

    if (message.startsWith("ERROR:")) {
      console.log("ERROR message:", message);
      toast.error(message);
    }

    if (message.startsWith("WARNING:")) {
      console.log("WARNING message:", message);
      toast.warning(message);
    }

    console.log("Registered callbacks before triggering:", messageCallbacks.current);
    Object.values(messageCallbacks.current).forEach((callback) => callback(message));
  };

  const resetPingTimeout = () => {
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
    }

    pingTimeoutRef.current = setTimeout(() => {
      const now = new Date();
      if (lastPingRef.current && now.getTime() - lastPingRef.current.getTime() > 60000) {
        toast.error("No response from backend in the last 60 seconds.");
      }
    }, 30*1000);
  };

  const handleOnline = () => {
    toast.success("Back Online");
  };
  const handleOffline = () => {
    toast.error("Going offline. Check network connection.");
  };

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Ensure singleton WebSocket initialization
    WebSocketSingleton.initialize(handleMessage);

    ipcRenderer.invoke("connect-ws", "").then(() => {
      console.log("WebSocket connected");
      lastPingRef.current = new Date();
      resetPingTimeout();
    }).catch((error: any) => {
      console.error("Failed to connect WebSocket:", error);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }
      console.log("WebSocketProvider unmounted");
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        registerCallback,
        unregisterCallback,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  return useContext(WebSocketContext);
};
