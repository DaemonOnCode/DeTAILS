import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// We’ll assume N=3 columns, 5 rows => 15 cards

function useResponsiveColumns() {
    const cardWidth = 128; // w-32 in Tailwind (~32 * 4)
    const xSpacing = 132; // Given spacing between cards

    const [columns, setColumns] = useState(getColumnCount());

    function getColumnCount() {
        const screenWidth = window.innerWidth;
        return Math.max(1, Math.floor(screenWidth / xSpacing) + 4);
        // Ensures at least 1 column
    }

    useEffect(() => {
        function handleResize() {
            setColumns(getColumnCount());
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return columns;
}

// Phase type
type Phase = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function App() {
    const [currentPhase, setCurrentPhase] = useState<Phase>(1);

    useEffect(() => {
        // durations for each phase (ms)
        const durations: Record<Phase, number> = {
            1: 4000,
            2: 3000,
            3: 3000,
            4: 3000,
            5: 3000,
            6: 3000,
            7: 5000
        };

        const t = setTimeout(() => {
            if (currentPhase < 2) {
                setCurrentPhase((prev) => (prev + 1) as Phase);
            }
        }, durations[currentPhase]);

        return () => clearTimeout(t);
    }, [currentPhase]);

    return (
        <div className="h-screen min-h-screen bg-gray-100 flex items-center justify-center p-4 overflow-hidden">
            {/* 
        We'll handle "cards" in phases 1 & 2,
        then fade them out as we enter phase 3 
      */}
            <CardsPhases phase={currentPhase} />

            {/* 
        We'll handle text for phases 3,4,5
        using AnimatePresence to fade it in/out 
      */}
            <TextPhases phase={currentPhase} />

            {/* 
        We'll handle "DETAILS" for phases 6 & 7
        as a single persistent element that changes 
        scale/dimensions across those phases.
      */}
            <DetailsPhases phase={currentPhase} />
        </div>
    );
}

/* -------------------------------------------
   CARDS (Phase 1: Stacking -> Phase 2: Grid)
   Then fade out as we go to Phase 3.
-------------------------------------------- */
/* -------------------------------------------------------------------
   Weighted random character generation
-------------------------------------------------------------------- */

// Character sets (you can expand or customize these)
const LOWER = '-';
const UPPER = ' ';
const DIGITS = '-';
const SYMBOLS = '-';

/**
 * Return one random character according to our weighted probabilities:
 *   - 15%: space
 *   - 5%: digit
 *   - 5%: symbol
 *   - 20%: uppercase letter
 *   - 55%: lowercase letter
 */
function getWeightedRandomChar() {
    const r = Math.random();

    if (r < 0.1) {
        // 15% => space
        return ' ';
    } else if (r < 0.15) {
        // next 20% => uppercase
        const i = Math.floor(Math.random() * UPPER.length);
        return UPPER[i];
    } else if (r < 0.16) {
        // next 5% => symbol
        const i = Math.floor(Math.random() * SYMBOLS.length);
        return SYMBOLS[i];
    } else if (r < 0.18) {
        // next 5% => digit
        const i = Math.floor(Math.random() * DIGITS.length);
        return DIGITS[i];
    } else {
        // remaining 55% => lowercase
        const i = Math.floor(Math.random() * LOWER.length);
        return LOWER[i];
    }
}

/* -------------------------------------------------------------------
   CardContent: a grid of weighted-random characters.
   - Each card in Phase 2 will show this grid.
   - The grid uses different row/column gap to resemble typed lines.
-------------------------------------------------------------------- */
function CardContent({
    num,
    phase,
    highlightedChars = []
}: {
    highlightedChars?: [number, number, number][];
    phase: number;
    num: number;
}) {
    const ROWS = 30;
    const COLS = 20;

    const charMatrix = useMemo(() => {
        const matrix = [];
        for (let row = 0; row < ROWS; row++) {
            const rowChars = [];
            for (let col = 0; col < COLS; col++) {
                rowChars.push(getWeightedRandomChar());
            }
            matrix.push(rowChars);
        }
        return matrix;
    }, []);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                padding: '8px',
                // display: 'grid',
                // gridTemplateColumns: `repeat(${COLS}, auto)`,
                // gridTemplateRows: `repeat(${ROWS}, auto)`,
                fontFamily: 'serif',
                fontSize: '16px',
                overflow: 'hidden',
                alignItems: 'center'
            }}>
            {charMatrix.map((rowChars, rowIdx) =>
                rowChars.map((c, colIdx) => {
                    const isHighlighted = highlightedChars?.some(
                        ([no, r, c]) => r === rowIdx && c === colIdx && no === num
                    );

                    return (
                        <span
                            key={`${rowIdx}-${colIdx}`}
                            style={{
                                transition: 'background-color 0.5s ease-in-out',
                                backgroundColor:
                                    isHighlighted && phase === 2 ? '#00008b' : 'transparent',
                                // padding: '2px',
                                // borderRadius: '4px',
                                height: '100%'
                            }}>
                            {c}
                        </span>
                    );
                })
            )}
        </div>
    );
}

function generateIntervals(start: number, end: number, step: number) {
    const result = [];
    for (let i = start; i <= end; i += step) {
        result.push(i);
    }
    return result;
}

// Example Usage:
// console.log(generateIntervals(0, 50, 5));
// Output: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]

/* -------------------------------------------------------------------
   CardContent: a grid of weighted-random characters
-------------------------------------------------------------------- */
function CardsPhases({ phase }: { phase: Phase }) {
    const TOTAL_COLUMNS = useResponsiveColumns();
    const ROWS = 7;
    const TOTAL_CARDS = TOTAL_COLUMNS * ROWS;

    const highlight = useMemo(() => {
        // r->y c->x
        const highlightedChars = [
            // D
            [9, 0, 0],
            [9, 0, 1],
            [9, 0, 2],
            [9, 1, 0],
            [9, 1, 3],
            [9, 2, 0],
            [9, 2, 3],
            [9, 3, 0],
            [9, 3, 3],
            [9, 4, 0],
            [9, 4, 1],
            [9, 4, 2],
            // E
            [10, 0, 0],
            [10, 0, 1],
            [10, 0, 2],
            [10, 0, 3],
            [10, 1, 0],
            [10, 2, 0],
            [10, 2, 1],
            [10, 2, 2],
            [10, 2, 3],
            [10, 3, 0],
            [10, 4, 0],
            [10, 4, 1],
            [10, 4, 2],
            [10, 4, 3],
            // D
            [11, 0, 0],
            [11, 0, 1],
            [11, 0, 2],
            [11, 1, 0],
            [11, 1, 3],
            [11, 2, 0],
            [11, 2, 3],
            [11, 3, 0],
            [11, 3, 3],
            [11, 4, 0],
            [11, 4, 1],
            [11, 4, 2],
            // U
            [12, 0, 0],
            [12, 0, 3],
            [12, 1, 0],
            [12, 1, 3],
            [12, 2, 0],
            [12, 2, 3],
            [12, 3, 0],
            [12, 3, 3],
            [12, 4, 1],
            [12, 4, 2],
            // C
            [13, 0, 0],
            [13, 0, 1],
            [13, 0, 2],
            [13, 0, 3],
            [13, 1, 0],
            [13, 2, 0],
            [13, 3, 0],
            [13, 4, 0],
            [13, 4, 1],
            [13, 4, 2],
            [13, 4, 3],
            // T
            [14, 0, 0],
            [14, 0, 1],
            [14, 0, 2],
            [14, 1, 1],
            [14, 2, 1],
            [14, 3, 1],
            [14, 4, 1],
            // I
            [15, 0, 1],
            [15, 1, 1],
            [15, 2, 1],
            [15, 3, 1],
            [15, 4, 1],
            // V
            [16, 0, 0],
            [16, 0, 2],
            [16, 1, 0],
            [16, 1, 2],
            [16, 2, 0],
            [16, 2, 2],
            [16, 3, 0],
            [16, 3, 2],
            [16, 4, 1],
            // E
            [17, 0, 0],
            [17, 0, 1],
            [17, 0, 2],
            [17, 0, 3],
            [17, 1, 0],
            [17, 2, 0],
            [17, 2, 1],
            [17, 2, 2],
            [17, 2, 3],
            [17, 3, 0],
            [17, 4, 0],
            [17, 4, 1],
            [17, 4, 2],
            [17, 4, 3]
        ];

        return highlightedChars as [number, number, number][];
    }, []);

    console.log('highlight', highlight);

    // const VISIBLE_CARDS_RATIO = 0.1; // Show only 40% of cards in Phase 1
    const xSpacing = 128 + 8;
    const ySpacing = 176 + 8;
    const interval = generateIntervals(0, TOTAL_CARDS, 20);

    const colOffsets = useMemo(() => {
        return Array.from({ length: TOTAL_COLUMNS }, (_, c) => {
            const sign = c % 2 ? 1 : -1;
            return sign * (0.1 * c * ySpacing);
        });
    }, [ySpacing]);

    const cardPositions = useMemo(() => {
        return Array.from({ length: TOTAL_CARDS }).map((_, i) => {
            const col = i % TOTAL_COLUMNS;
            const row = Math.floor(i / TOTAL_COLUMNS);

            const baseX = col * xSpacing - (TOTAL_COLUMNS * xSpacing) / 2 + xSpacing / 2;
            const baseY = row * ySpacing - (ROWS * ySpacing) / 2 + ySpacing / 2;

            const finalY = baseY + colOffsets[col];
            return { x: baseX, y: finalY };
        });
    }, [colOffsets, xSpacing, ySpacing]);

    return (
        <AnimatePresence>
            {phase < 3 && (
                <motion.div
                    key="cards"
                    className="absolute"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 1 } }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)'
                    }}>
                    {Array.from({ length: TOTAL_CARDS })
                        // .filter((_, i) => phase === 2 || interval.includes(i)) // Show fewer in phase 1
                        .map((_, i) => {
                            const animateProps =
                                phase === 1
                                    ? {
                                          x: i,
                                          y: i,
                                          opacity: interval.includes(i) ? 1 : 0
                                      }
                                    : { x: cardPositions[i].x, y: cardPositions[i].y, opacity: 1 };

                            return (
                                <motion.div
                                    key={i}
                                    className="bg-white bg-opacity-50 w-32 h-44 border border-gray-400 shadow-xl absolute rounded-lg "
                                    style={{
                                        zIndex: i % 5,
                                        overflow: 'hidden'
                                    }}
                                    initial={
                                        phase === 1
                                            ? { y: 800, opacity: 0 }
                                            : { x: 0, y: 0, opacity: 0 }
                                    }
                                    animate={animateProps}
                                    transition={{
                                        delay: i * 0.05,
                                        type: 'spring',
                                        stiffness: 50
                                    }}>
                                    {phase === 2 && (
                                        <CardContent
                                            highlightedChars={highlight}
                                            num={i}
                                            phase={phase}
                                        />
                                    )}
                                </motion.div>
                            );
                        })}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
/* -------------------------------------------
   TEXT PHASES (3, 4, 5)
   We'll use a parent that shows/hides texts 
   via AnimatePresence or simple conditionals.
-------------------------------------------- */
function TextPhases({ phase }: { phase: Phase }) {
    return (
        <>
            {/* Phase 3: "DEDUCTIVE THEMATIC ANALYSIS" (ascii highlight) */}
            <AnimatePresence>
                {phase === 3 && (
                    <motion.div
                        key="p3-text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 1 } }}
                        className="absolute flex flex-col items-center justify-center">
                        <Phase3Highlight />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Phase 4: Show "DEDUCTIVE THEMATIC ANALYSIS" fade except highlight, then "Deductive Thematic Analysis with Iterative LLM Support" */}
            <AnimatePresence>
                {phase === 4 && (
                    <motion.div
                        key="p4-text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute flex flex-col items-center justify-center text-center p-4">
                        <Phase4Text />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Phase 5: Show acronym highlights "DETAILS" */}
            <AnimatePresence>
                {phase === 5 && (
                    <motion.div
                        key="p5-text"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute flex flex-col items-center justify-center text-center p-4">
                        <Phase5Acronym />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function Phase3Highlight() {
    const lines = ['DEDUCTIVE', 'THEMATIC', 'ANALYSIS'];
    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            {lines.map((line, idx) => (
                <div key={idx} className="text-2xl font-mono leading-loose">
                    {Array.from(line).map((char, i) => (
                        <span
                            key={i}
                            className="px-1"
                            style={{
                                backgroundColor: 'rgba(255, 235, 0, 0.7)',
                                margin: '2px'
                            }}>
                            {char}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

function Phase4Text() {
    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5 }}
                className="text-2xl font-semibold">
                <span className="bg-yellow-200 p-1">DEDUCTIVE THEMATIC ANALYSIS</span>
            </motion.div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 1 }}
                className="text-xl mt-8">
                <span className="px-2 py-1 bg-white">
                    Deductive Thematic Analysis with Iterative LLM Support
                </span>
            </motion.div>
        </>
    );
}

function Phase5Acronym() {
    return (
        <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1 }}
            className="text-2xl font-semibold space-y-2">
            <p>
                <span className="bg-yellow-200">De</span>ductive
            </p>
            <p>
                <span className="bg-yellow-200">T</span>hematic
            </p>
            <p>
                <span className="bg-yellow-200">A</span>nalysis
            </p>
            <p>
                <span className="bg-yellow-200">I</span>terative
            </p>
            <p>
                <span className="bg-yellow-200">L</span>LM
            </p>
            <p>
                <span className="bg-yellow-200">S</span>upport
            </p>
        </motion.div>
    );
}

/* -------------------------------------------
   DETAILS (Phase 6: Big -> Phase 7: Halved)
   Use ONE persistent component that changes 
   animation states based on `phase`.
-------------------------------------------- */
function DetailsPhases({ phase }: { phase: Phase }) {
    // We only show the “DETAILS” element once we hit Phase 6
    // through Phase 7. Then we do different animations.
    if (phase < 6) return null; // not yet

    return (
        <motion.div
            className="absolute flex flex-col items-center justify-center"
            animate={
                phase === 6 ? { height: '100%' } : { height: '50%' } // phase === 7
            }
            transition={{ duration: 2, ease: 'easeInOut' }}>
            <motion.div
                // We’ll define different animate props depending on the phase
                animate={
                    phase === 6 ? { scale: 2.5 } : { scale: 1.25 } // phase === 7
                }
                initial={{ scale: 0.5 }}
                transition={{ duration: 2, ease: 'easeInOut' }}
                style={{
                    transformOrigin: 'center center'
                }}
                className="text-5xl font-bold bg-yellow-200 p-4 rounded-lg">
                DETAILS
            </motion.div>

            {/* 
         Google Sign-In box (only appears after the halving is done).
         That means in Phase 7, but with a delay to wait for the shrink.
      */}
            <AnimatePresence>
                {phase === 7 && (
                    <motion.div
                        key="google-box"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 1,
                            delay: 2, // after 2s of halving
                            ease: 'easeInOut'
                        }}
                        className="bg-white p-6 rounded-md shadow-md border border-gray-300 w-64 h-48 flex flex-col items-center justify-center mt-8">
                        <p className="text-lg font-semibold mb-4">Google Sign-In</p>
                        <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                            Sign in with Google
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default App;
