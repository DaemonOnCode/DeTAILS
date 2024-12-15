import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaLaptop, FaToolbox, FaFileAlt } from "react-icons/fa";
import { useLogger } from "../../../context/logging_context";
import { useWebSocket } from "../../../context/websocket_context";

// Electron's IPC Renderer
const { ipcRenderer } = window.require("electron");

// Generate rectangles for the theme generation animation
const generateRectangles = () => {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `rectangle-${index}`,
    size: Math.random() * 50 + 20, // Random size between 20px to 70px
    x: Math.random() * 1200 - 600, // Horizontal spread
    y: Math.random() * 800 - 400, // Vertical spread
    delay: Math.random() * 2, // Random delay
  }));
};

const rectangles = generateRectangles();

const ThemeLoaderPage = () => {
  const logger = useLogger();
  const [stage, setStage] = useState("Starting");

  const { registerCallback, unregisterCallback } = useWebSocket();

  const handleWebSocketMessage = (message: string) => {
    // Map backend events to stages
    if (message.includes("Uploading files")) {
      setStage("Uploading files");
    } else if (message.includes("Files uploaded successfully")) {
      setStage("Files Uploaded");
    } else if (message.includes("Generating Themes")) {
      setStage("Generating Themes");
    } else if (message.includes("Processing complete")) {
      setStage("Processing Complete");
    } else if (message.includes("Error encountered")) {
      setStage("Error: Check Server Logs");
    }
  };

  useEffect(() => {
    // Log when the component is mounted
    const startTimer = Date.now();
    registerCallback(handleWebSocketMessage);
    logger.info("Loaded Theme Loader Page");

    // Cleanup and log when the component is unmounted
    return () => {
      unregisterCallback(handleWebSocketMessage);
      logger.info("Unloaded Theme Loader Page").then(() => {
        const elapsedTime = (Date.now() - startTimer) / 1000;
        logger.time("Theme Loader Page stay time", { time: elapsedTime });
      });
    };
  }, [logger]);

  // File movement animation for Stage 2
  const fileVariants = {
    initial: { x: 0, opacity: 1 },
    animate: {
      x: [0, 550], // Moving from left to right
      opacity: [1, 0], // Fades out near the end
      transition: {
        duration: 4, // Smooth animation
        ease: "easeInOut",
        repeat: Infinity, // Infinite loop
      },
    },
  };

  const staggeredFiles = {
    animate: {
      transition: {
        staggerChildren: 0.5, // Delay between each icon
      },
    },
  };

  return (
    <div className="h-[calc(100vh-48px)] w-full flex flex-col gap-6 items-center justify-center">
      {/* Dynamic Stage Heading */}
      {stage !== "Generating Themes" && (
        <h1 className="text-2xl font-bold text-center mb-6">{stage}</h1>
      )}

      {/* Stage 2: Uploading Files (File Animation) */}
      {stage === "Uploading files" && (
        <div className="relative flex items-center justify-between w-2/3 h-32">
          {/* Left: Laptop Icon */}
          <div className="flex items-center justify-center w-20 h-20 text-blue-600">
            <FaLaptop size={40} />
          </div>

          {/* Center: Moving Files */}
          <motion.div
            className="relative flex gap-4 items-center w-full"
            variants={staggeredFiles}
            initial="initial"
            animate="animate"
          >
            {[1, 2, 3].map((_, index) => (
              <motion.div
                key={index}
                className="absolute text-blue-500 text-3xl"
                variants={fileVariants}
              >
                <FaFileAlt />
              </motion.div>
            ))}
          </motion.div>

          {/* Right: Toolkit Box */}
          <div className="flex flex-col items-center justify-center w-24 h-24 bg-gray-300 rounded-md shadow-md text-gray-800">
            <FaToolbox size={30} className="mb-2" />
            <span className="text-sm font-bold">Toolkit</span>
          </div>
        </div>
      )}

      {/* Stage 3: Generating Themes (Rectangle Animation) */}
      {stage === "Generating Themes" && (
        <div className="relative w-full h-[calc(100vh-48px)] flex items-center justify-center overflow-hidden">
          {/* Central Word */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5 }}
            className="text-gray-800 text-4xl font-bold tracking-wide z-10"
          >
            Generating Words
          </motion.h1>

          {/* Dynamic Rectangles */}
          <div className="absolute">
            {rectangles.map((rect) => (
              <motion.div
                key={rect.id}
                className="absolute rounded-md"
                style={{
                  width: rect.size + "px",
                  height: rect.size + "px",
                  backgroundColor: `rgba(${Math.floor(Math.random() * 150 + 100)}, ${Math.floor(
                    Math.random() * 150 + 100
                  )}, ${Math.floor(Math.random() * 150 + 100)}, 1)`, // Light colors
                }}
                initial={{
                  opacity: 0,
                  scale: 0.8,
                  x: 0,
                  y: 0,
                }}
                animate={{
                  opacity: [0, 0.8, 0], // Fade in and out
                  scale: [0.8, 1.2, 0.8], // Bounce effect
                  x: rect.x,
                  y: rect.y,
                }}
                transition={{
                  delay: rect.delay, // Random delay
                  duration: 5, // Animation duration
                  repeat: Infinity,
                  repeatType: "loop", // Smooth looping
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completion State */}
      {stage === "Processing Complete" && (
        <motion.div
          className="text-green-600 text-6xl flex flex-col items-center"
          initial="initial"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
            transition: { duration: 1, repeat: Infinity },
          }}
        >
          <span className="text-lg font-bold mt-2">Words Generated!</span>
        </motion.div>
      )}

      {/* Error State */}
      {stage.includes("Error") && (
        <motion.div
          className="text-red-600 text-6xl flex flex-col items-center"
          initial="initial"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
            transition: { duration: 1, repeat: Infinity },
          }}
        >
          <span className="text-lg font-bold mt-2">An error occurred</span>
        </motion.div>
      )}
    </div>
  );
};

export default ThemeLoaderPage;
