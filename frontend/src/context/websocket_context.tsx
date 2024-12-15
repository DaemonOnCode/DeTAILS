import { FC, createContext, useContext, useEffect, useRef, useState } from "react";
import { ILayout } from "../types/Coding/shared";
import { toast } from "react-toastify";

const { ipcRenderer } = window.require("electron");

type CallbackFn = (message: string) => void;

const WebSocketContext = createContext({
  registerCallback: (event: string, callback: CallbackFn) => {},
  unregisterCallback: (event: string) => {},
});

export const WebSocketProvider: FC<ILayout> = ({ children }) => {
  const messageCallbacks = useRef<{ [key: string]: CallbackFn }>({});
  const [networkOnline, setNetworkOnline] = useState<boolean>(navigator.onLine);
  const lastPingRef = useRef<Date | null>(null);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const retryCountRef = useRef<number>(0); // Track retry attempts
  const maxRetries = 3; // Max retries allowed

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
    //   return;
    }
    if (message.startsWith("WARNING:")) {
      console.log("WARNING message:", message);
      toast.warning(message);
    //   return;
    }

    console.log("Registered callbacks before triggering:", messageCallbacks.current);
    Object.values(messageCallbacks.current).forEach((value) => value(message));
  };

  const checkPingTimeout = () => {
    const now = new Date();
    if (lastPingRef.current && now.getTime() - lastPingRef.current.getTime() > 60000) {
      toast.error("No response from backend in the last 60 seconds. Attempting to reconnect...");
      reconnectWebSocket();
    }
  };

  const resetPingTimeout = () => {
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
    }
    pingTimeoutRef.current = setTimeout(checkPingTimeout, 60000);
  };

  const reconnectWebSocket = () => {
    if (retryCountRef.current >= maxRetries) {
      toast.error("Network issue detected. Please restart the app.");
      return;
    }

    retryCountRef.current += 1;
    console.log(`Reconnecting WebSocket... Attempt ${retryCountRef.current}`);
    ipcRenderer.invoke("disconnect-ws", "").then(() => {
      ipcRenderer.invoke("connect-ws", "").then(() => {
        // Reset retry count on successful connection
        retryCountRef.current = 0;
        toast.success("Reconnected to WebSocket successfully.");
        lastPingRef.current = new Date();
        resetPingTimeout();
      }).catch(() => {
        console.error("Failed to reconnect WebSocket.");
        reconnectWebSocket(); // Retry connection
      });
    });
  };

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        // First, clean up any previous listeners
        ipcRenderer.removeAllListeners("ws-message");

        // Establish WebSocket connection
        await ipcRenderer.invoke("connect-ws", "");

        // Attach the message handler
        ipcRenderer.on("ws-message", handleMessage);

        // Attach a listener for WebSocket closure
        ipcRenderer.once("ws-closed", () => {
          toast.warning("WebSocket connection closed. Attempting to reconnect...");
          reconnectWebSocket();
        });

        // Set initial ping state
        lastPingRef.current = new Date();
        resetPingTimeout();
      } catch (error) {
        console.error("Initial WebSocket connection failed.");
        reconnectWebSocket();
      }
    };

    connectWebSocket();

    return () => {
      ipcRenderer.removeListener("ws-message", handleMessage); // Cleanup specific listener
      ipcRenderer.invoke("disconnect-ws", "").then(() => {
        console.log("Disconnected from WebSocket");
      });

      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
      }
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
