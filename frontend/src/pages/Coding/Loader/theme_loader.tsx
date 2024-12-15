import React, { useEffect, useState } from "react";
import { Variants, motion, useAnimation } from "framer-motion";
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
  const controls = useAnimation();

  const { registerCallback, unregisterCallback } = useWebSocket();

  const handleWebSocketMessage = (message: string) => {
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
    registerCallback("theme-loader", handleWebSocketMessage);
    logger.info("Loaded Theme Loader Page");

    return () => {
      unregisterCallback("theme-loader");
      logger.info("Unloaded Theme Loader Page");
    };
  }, [logger]);

  useEffect(() => {
  if (stage === "Uploading files") {
    let isMounted = true;

    const startAnimationLoop = async () => {
      while (isMounted) {
        await controls.start("animate"); // Wait for the animation to complete
        await new Promise((resolve) => setTimeout(resolve, 500)); // Optional delay between loops
      }
    };

    startAnimationLoop();

    return () => {
      isMounted = false; // Clean up loop when component unmounts or stage changes
    };
  }
}, [stage, controls]);


  // Variants for staggered animation
  const staggeredFiles: Variants = {
    initial: { opacity: 0, x: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3, // Delay between each file animation
      },
    },
  };

  const fileVariants: Variants = {
    initial: { x: 0, opacity: 1 },
    animate: {
      x: [0, 550],
      opacity: [1, 0],
      transition: {
        duration: 4, // Full animation cycle
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="h-[calc(100vh-48px)] w-full flex flex-col gap-6 items-center justify-center">
      {stage !== "Generating Themes" && (
        <h1 className="text-2xl font-bold text-center mb-6">{stage}</h1>
      )}

      {stage === "Uploading files" && (
        <div className="relative flex items-center justify-between w-2/3 h-32">
          <div className="flex items-center justify-center w-20 h-20 text-blue-600">
            <FaLaptop size={50} />
          </div>

          {/* Center: Staggered Moving Files */}
          <motion.div
            className="relative flex gap-4 items-center w-full"
            variants={staggeredFiles}
            initial="initial"
            animate={controls}
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

          <div className="flex flex-col items-center justify-center w-24 h-24 bg-gray-300 rounded-md shadow-md text-gray-800">
            <FaToolbox size={30} className="mb-2" />
            <span className="text-sm font-bold">Toolkit</span>
          </div>
        </div>
      )}

      {stage === "Generating Themes" && (
        <div className="relative w-full h-[calc(100vh-48px)] flex items-center justify-center overflow-hidden">
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
                  width: `${rect.size}px`,
                  height: `${rect.size}px`,
                  backgroundColor: `rgba(${Math.floor(Math.random() * 150 + 100)}, ${Math.floor(
                    Math.random() * 150 + 100
                  )}, ${Math.floor(Math.random() * 150 + 100)}, 1)`,
                }}
                initial={{
                  opacity: 0,
                  scale: 0.8,
                  x: 0,
                  y: 0,
                }}
                animate={{
                  opacity: [0, 0.8, 0],
                  scale: [0.8, 1.2, 0.8],
                  x: rect.x,
                  y: rect.y,
                }}
                transition={{
                  delay: rect.delay,
                  duration: 5,
                  repeat: Infinity,
                  repeatType: "loop",
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      )}

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
