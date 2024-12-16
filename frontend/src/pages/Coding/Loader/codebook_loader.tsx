import React, { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";

const CodebookAnimation: React.FC = () => {
  const numPages = 6; // Number of pages in the codebook
  const colors = ["#4F46E5", "#3B82F6", "#6366F1", "#93C5FD", "#A78BFA", "#C084FC"]; // Page colors

  const [isStacking, setIsStacking] = useState(true); // Track stacking phase
  const [isTransitioning, setIsTransitioning] = useState(false); // Track transition phase
  const [isMovingRight, setIsMovingRight] = useState(false); // Track moving right phase
  const [isFlipping, setIsFlipping] = useState(false); // Track flipping phase
  const [writing, setWriting] = useState(false); // Writing state
  const [currentText, setCurrentText] = useState(""); // Current text being written
  const [flippedPages, setFlippedPages] = useState<number[]>([]); // Flipped pages
  const [unflippedPages, setUnflippedPages] = useState<number[]>(
    Array.from({ length: numPages }, (_, i) => i)
  ); // Unflipped pages

  const typingTexts = [
    "-------- -----\n-- --- --\n-- ----------\n- - - - - -",
    "----- ----- -\n----------\n- - - - -\n -- -- --",
    "--- --- ---\n- -- --- --\n---- ---- --\n- - -- -----",
    "--- ----- --\n-- ----------\n-----------\n---- -- ----",
    "--- ---- -----\n- - -- -- -\n- -- -- --\n- - - - -",
    "--------------\n-- -- --- --\n - ---- -- --\n-- -- --",
  ]; // Texts to display during flipping

  // --- Animation Phase Management ---

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isStacking) {
      console.log("Phase 1: Stacking");
      timer = setTimeout(() => {
        setIsStacking(false);
        setIsTransitioning(true);
      }, 2000); // Stacking lasts 2 seconds
    }
    return () => clearTimeout(timer);
  }, [isStacking]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTransitioning) {
      console.log("Phase 2: Transitioning to a single stack");
      timer = setTimeout(() => {
        setIsTransitioning(false);
        setIsMovingRight(true);
      }, 1000); // Transition lasts 1 second
    }
    return () => clearTimeout(timer);
  }, [isTransitioning]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMovingRight) {
      console.log("Phase 3: Moving stack to the right");
      timer = setTimeout(() => {
        setIsMovingRight(false);
        setIsFlipping(true);
      }, 1000); // Moving Right lasts 1 second
    }
    return () => clearTimeout(timer);
  }, [isMovingRight]);

  // Flipping Pages with Writing
  useEffect(() => {
    if (isFlipping) {
      console.log("Phase 4: Writing and Flipping");
      flipPages();
    }
  }, [isFlipping]);

  const flipPages = async () => {
    for (let i = unflippedPages.length - 1; i >= 0; i--) {
      // Typing Effect
      setWriting(true);
      setCurrentText("");

      // Simulate typing text
      for (let j = 0; j <= typingTexts[i].length; j++) {
        setCurrentText(typingTexts[i].slice(0, j));
        await new Promise((resolve) => setTimeout(resolve, 20)); // Typing delay
      }

    //   console.log("Typing:", typingTexts[i].length*20);

      setWriting(false);
      await new Promise((resolve) => setTimeout(resolve, 2000-(typingTexts[i].length*15))); // Pause after typing

      // Flip page
      setFlippedPages((prev) => [unflippedPages[i], ...prev]);
      setUnflippedPages((prev) => prev.slice(0, -1));

    //   console.log("Flipping:", flippedPages, "Unflipped:", unflippedPages);
    }

    setTimeout(() => resetAnimation(), 1000); // Reset animation after flipping all pages
  };

  const resetAnimation = () => {
    console.log("Resetting animation");
    setIsStacking(true);
    setIsTransitioning(false);
    setIsMovingRight(false);
    setIsFlipping(false);
    setWriting(false);
    setFlippedPages([]);
    setUnflippedPages(Array.from({ length: numPages }, (_, i) => i));
    setCurrentText("");
  };

  // --- Animation Variants ---

  const stackingVariants: Variants = {
    initial: { y: 200, opacity: 0 },
    animate: (custom: number) => ({
      y: custom * -10,
      opacity: 1,
      transition: { delay: custom * 0.2, duration: 0.8, ease: "easeInOut" },
    }),
  };

  const transitionVariants: Variants = {
    initial: (custom: number) => ({ y: custom * -10 }),
    animate: { y: 0, transition: { duration: 1, ease: "easeInOut" } },
  };

  const moveRightVariants: Variants = {
    initial: { x: 0 },
    animate: { x: 113, transition: { duration: 1, ease: "easeInOut" } },
  };

  const flipVariants: Variants = {
    initial: { rotateY: 0 },
    animate: {
      x: -2,
      rotateY: -180,
      transition: { duration: 2.5, ease: "linear" },
    },
  };

  // --- JSX ---

  return (
    <div className="h-[calc(100vh-48px)] w-full flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-16 text-gray-900">Generating Codebook</h1>

      {/* Stacking Phase */}
      {isStacking && (
        <div className="relative w-56 h-72">
          {unflippedPages.map((index) => (
            <motion.div
              key={index}
              className="absolute w-full h-full rounded-lg"
              style={{
                backgroundColor: colors[index % colors.length],
                boxShadow: `0 ${index * 2}px ${index * 5}px rgba(0, 0, 0, 0.2)`,
                zIndex: index,
              }}
              custom={index}
              initial="initial"
              animate="animate"
              variants={stackingVariants}
            />
          ))}
        </div>
      )}

      {/* Transition Phase */}
      {isTransitioning && (
        <div className="relative w-56 h-72">
          {unflippedPages.map((index) => (
            <motion.div
              key={index}
              className="absolute w-full h-full rounded-lg"
              style={{
                backgroundColor: colors[index % colors.length],
                boxShadow: `0 ${index * 2}px ${index * 5}px rgba(0, 0, 0, 0.2)`,
                zIndex: index,
              }}
              custom={index}
              initial="initial"
              animate="animate"
              variants={transitionVariants}
            />
          ))}
        </div>
      )}

      {/* Moving Right Phase */}
      {isMovingRight && (
        <motion.div
          className="relative w-56 h-72"
          initial="initial"
          animate="animate"
          variants={moveRightVariants}
        >
          {unflippedPages.map((index) => (
            <motion.div
              key={index}
              className="absolute w-full h-full rounded-lg"
              style={{
                backgroundColor: colors[index % colors.length],
                boxShadow: `0 ${index * 2}px ${index * 5}px rgba(0, 0, 0, 0.2)`,
                zIndex: index,
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Flip Phase */}
      {isFlipping && (
        <div className="relative w-[450px] h-72 gap-x-0.5 flex items-center justify-center">
          {/* Left Stack */}
          <div className="relative w-56 h-full">
            {flippedPages.map((index, i) => (
              <motion.div
                key={`flipped-${index}`}
                className="absolute w-full h-full rounded-lg flex items-center justify-center text-white font-semibold"
                style={{
                  backgroundColor: colors[index % colors.length],
                  zIndex: -i,
                }}
              >
                {/* {typingTexts[index]} */}
              </motion.div>
            ))}
          </div>

          {/* Right Stack */}
          <div className="relative w-56 h-full">
            {unflippedPages.map((index, i) => (
              <motion.div
                key={`unflipped-${i}`}
                className="absolute w-full h-full rounded-lg flex items-center justify-center text-white font-semibold whitespace-pre-line"
                style={{
                  backgroundColor: colors[index % colors.length],
                  transformOrigin: "left center",
                  zIndex: i,
                }}
                variants={flipVariants}
                initial="initial"
                animate={unflippedPages.length === i + 1 ? "animate" : undefined}
              >
                
                {unflippedPages.length === i + 1 && writing ? currentText : ""}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodebookAnimation;
