import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

/* -----------------------------------------------------
   1. Responsive columns (same as your code)
----------------------------------------------------- */
function useResponsiveColumns() {
    const cardWidth = 224;
    const xSpacing = 224 + 8;
    const [columns, setColumns] = useState(getColumnCount);

    function getColumnCount() {
        const screenWidth = window.innerWidth;
        return Math.max(1, Math.floor(screenWidth / xSpacing) + 1);
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

/* -----------------------------------------------------
   2. Generate random text array for static cards
----------------------------------------------------- */
function generateRandomTextArray(idx: number): Array<' ' | '-'> {
    let t1 = ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];
    let t2 = ['-', '-', '-', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
    let partialLineIndex = idx % 8;
    return Array.from({ length: 8 }, (_, i) => {
        if (i !== partialLineIndex) return t1;
        if (i === partialLineIndex) return t2;
        return t1;
    }).flat() as Array<' ' | '-'>;
}

/* -----------------------------------------------------
   3. Typing Effect (phases 1–3, unchanged)
----------------------------------------------------- */
function TypingEffect({
    word,
    phase,
    onFinishedTyping,
    idx
}: {
    word: string;
    phase: number;
    onFinishedTyping?: () => void;
    idx: number;
}) {
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const fadeColors = ['#808080', '#ffffff00'];

    // Define grid dimensions
    const ROWS = 8;
    const COLS = 12;
    const TOTAL_CELLS = ROWS * COLS;
    const [textArray, setTextArray] = useState<Array<string>>(generateRandomTextArray(idx));

    // Generate random row and column indices ensuring space for full word completion
    const { rowIndex, startColumnIndex, totalStartIndex } = useMemo(() => {
        const randomRow = Math.floor(Math.random() * ROWS);
        let hyphenInARow = generateRandomTextArray(idx)
            .slice(randomRow * COLS, randomRow * (COLS + 1))
            .filter((char) => char === '-').length;
        const maxStart = Math.max(0, hyphenInARow - word.length);
        const randomColumn = Math.floor(Math.random() * (maxStart + 1));
        const totalStartIdx = randomRow * COLS + randomColumn;
        return {
            rowIndex: randomRow,
            startColumnIndex: randomColumn,
            totalStartIndex: totalStartIdx
        };
    }, [idx, word]);

    useEffect(() => {
        const interval = setInterval(() => {
            setHighlightIndex((prev) => {
                const next = prev + 1;
                if (next >= word.length) {
                    clearInterval(interval);
                    onFinishedTyping?.(); // 🚀 Transition to Phase 4
                    return prev;
                }
                return next;
            });

            setTextArray((prev) => {
                const newArr = [...prev];
                if (highlightIndex + 1 < word.length) {
                    newArr[totalStartIndex + highlightIndex + 1] = word[highlightIndex + 1]; // Ensure correct position
                }
                return newArr;
            });
        }, 150);

        return () => clearInterval(interval);
    }, [highlightIndex, word, totalStartIndex, onFinishedTyping]);

    return (
        <motion.div className="grid grid-cols-12 max-w-[128px] font-mono text-lg">
            {textArray.map((char, index) => {
                const isFirstLetter = index === totalStartIndex && phase >= 4 && word !== 'with';
                const shouldFadeOut = phase === 4 && !isFirstLetter; // 🚀 Fade out all except first letter

                return (
                    <motion.span
                        key={index}
                        initial={{ color: index < totalStartIndex ? fadeColors[0] : '#000' }}
                        animate={{
                            color: isFirstLetter
                                ? '#f00' // 🔴 Highlight first letter in Phase 4
                                : shouldFadeOut
                                  ? '#ffffff00' // 🔥 Fade out the rest
                                  : index >= totalStartIndex &&
                                      index <= totalStartIndex + highlightIndex
                                    ? '#000'
                                    : phase === 3
                                      ? fadeColors
                                      : fadeColors[0]
                        }}
                        transition={{ duration: isFirstLetter ? 1 : 0.5, ease: 'easeInOut' }}
                        layoutId={isFirstLetter ? `highlight-${word}` : undefined} // 🚀 Assign layoutId for Phase 5
                        style={{
                            backgroundColor:
                                index >= totalStartIndex &&
                                index <= totalStartIndex + highlightIndex
                                    ? 'rgb(191 219 254)'
                                    : 'transparent',
                            borderRadius:
                                index === totalStartIndex
                                    ? '10px 0 0 10px'
                                    : index === totalStartIndex + word.length - 1
                                      ? '0 10px 10px 0'
                                      : '0px',
                            padding: '0px 1px'
                        }}>
                        {char}
                    </motion.span>
                );
            })}
        </motion.div>
    );
}

/* -----------------------------------------------------
   4. Static Card Content (phases 1–3, unchanged)
----------------------------------------------------- */
function StaticCardContent({ phase, idx }: { phase: number; idx: number }) {
    return (
        <motion.div
            className="grid grid-cols-12 font-mono text-lg"
            initial={{ opacity: 1 }}
            animate={{ opacity: phase === 3 ? 0 : 1 }}
            transition={{ duration: 0.5 }}
            // style={{
            //     opacity: phase === 3 ? 0 : 1,
            //     transition: 'opacity 1s ease-in-out'
            // }}
        >
            {generateRandomTextArray(idx).map((char, index) => (
                <motion.span
                    key={index}
                    initial={{
                        color: '#808080'
                    }}
                    animate={{
                        color: phase === 3 ? '#ffffff00' : '#808080'
                    }}
                    transition={{ duration: 0.5 }}>
                    {char}
                </motion.span>
            ))}
        </motion.div>
    );
}

/* -----------------------------------------------------
   5. Card Grid for phases 1–3 (unchanged)
----------------------------------------------------- */
function CardsGrid({
    phase,
    setPhase,
    words
}: {
    phase: number;
    setPhase: Dispatch<SetStateAction<Phase>>;
    words: string[];
}) {
    const TOTAL_COLUMNS = useResponsiveColumns();
    const ROWS = 5;
    const TOTAL_CARDS = TOTAL_COLUMNS * ROWS;

    const centerCards = useMemo(() => {
        const middleCol = Math.floor(TOTAL_COLUMNS / 2);
        const middleRow = Math.floor(ROWS / 2);
        return [
            middleCol + middleRow * TOTAL_COLUMNS,
            middleCol + (middleRow - 1) * TOTAL_COLUMNS,
            middleCol + (middleRow + 1) * TOTAL_COLUMNS,
            middleCol - 1 + middleRow * TOTAL_COLUMNS,
            middleCol + 1 + middleRow * TOTAL_COLUMNS,
            middleCol - 1 + (middleRow - 1) * TOTAL_COLUMNS,
            middleCol + 1 + (middleRow + 1) * TOTAL_COLUMNS
        ].sort((a, b) => a - b);
    }, [TOTAL_COLUMNS, ROWS]);

    return (
        <motion.div
            key="cardsGrid"
            className="grid"
            style={{
                gridTemplateColumns: `repeat(${TOTAL_COLUMNS}, 1fr)`,
                gap: '16px'
            }}
            layout>
            {Array.from({ length: TOTAL_CARDS }).map((_, i) => {
                const centerIndex = centerCards.indexOf(i);
                const isCenterCard = centerIndex !== -1;

                // Example "checkerboard" shift by column index
                const colIndex = i % TOTAL_COLUMNS;
                const shift =
                    colIndex % 2 === 0 ? -colIndex * 0.05 * (284 + 8) : colIndex * 0.05 * (284 + 8);

                return (
                    <motion.div
                        key={i}
                        /**
                         * We keep static width/height, etc. in className
                         * but handle background/border/shadow as motion props
                         **/
                        className="w-56 h-[284px] flex items-center justify-center text-lg p-2 leading-6"
                        style={{
                            // We can keep the shift in style or animate it in Framer
                            transform: `translateY(${shift}px)`,
                            // For the border to appear, we define width/style here:
                            borderWidth: '1px',
                            borderStyle: 'solid'
                        }}
                        /**
                         * initial => starting styles
                         * animate => phase-based interpolation
                         * transition => fade over 1s
                         **/
                        initial={{
                            backgroundColor: 'rgba(255, 255, 255, 0.5)',
                            borderColor: 'rgba(128,128,128, 0.5)',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                        animate={{
                            backgroundColor:
                                phase === 3 ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,0.5)',
                            borderColor:
                                phase === 3 ? 'rgba(128,128,128,0)' : 'rgba(128,128,128,0.5)',
                            boxShadow:
                                phase === 3
                                    ? '0 4px 6px rgba(0, 0, 0, 0)'
                                    : '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                        transition={{ duration: 0.5 }}>
                        {isCenterCard ? (
                            <motion.div layoutId={`word-${centerIndex}`}>
                                {phase === 0 ? (
                                    <StaticCardContent phase={phase} idx={i} />
                                ) : (
                                    <TypingEffect
                                        word={words[centerIndex]}
                                        phase={phase}
                                        idx={i}
                                        onFinishedTyping={() => setPhase(4)} // 🚀 Move to Phase 4
                                    />
                                )}

                                {/* Phase 4: Apply Highlight to First Letter */}
                                {/* {phase === 4 && words[centerIndex] !== 'with' && (
                                    <motion.span
                                        layoutId={`highlight-${words[centerIndex]}`} // Keep ID for Phase 5 transition
                                        initial={{ color: '#000' }}
                                        animate={{ color: '#f00' }}
                                        transition={{ duration: 1 }}
                                        style={{ fontWeight: 'bold' }}>
                                        {words[centerIndex][0]}
                                    </motion.span>
                                )} */}
                            </motion.div>
                        ) : (
                            <StaticCardContent phase={phase} idx={i} />
                        )}
                    </motion.div>
                );
            })}
        </motion.div>
    );
}

/* -----------------------------------------------------
   6. Center Layout (phases 4–5) => highlight acronym in phase 5
   EXACT for phases 4 & 5, no fade-out on container
----------------------------------------------------- */
function CenterLayout({ words, phase }: { words: string[]; phase: number }) {
    // Animate color #000 -> red in phase >= 5
    const AnimatedColorSpan = ({ text }: { text: string }) => (
        <motion.span
            initial={{ color: '#000' }}
            animate={{ color: '#f00' }}
            transition={{ duration: 0.5 }}
            style={{ whiteSpace: 'pre' }}>
            {text}
        </motion.span>
    );

    const highlightAcronym = (word: string) => {
        if (phase < 5) return word;
        if (word === 'Deductive') {
            // highlight first 2 letters "De"
            return (
                <>
                    <motion.span layoutId="highlight-Deductive">
                        <AnimatedColorSpan text="De" />
                    </motion.span>
                    {word.slice(2)}
                </>
            );
        } else {
            // highlight first letter
            return (
                <>
                    <motion.span layoutId={`highlight-${word}`}>
                        <AnimatedColorSpan text={word[0]} />
                    </motion.span>
                    {word.slice(1)}
                </>
            );
        }
    };

    return (
        <motion.div
            key="centerLayout"
            className="absolute inset-0 flex flex-col items-center justify-center space-y-4"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}>
            <div className="flex justify-center space-x-4">
                <motion.div
                    layoutId="word-0"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {highlightAcronym(words[0])}
                </motion.div>
                <motion.div
                    layoutId="word-1"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {highlightAcronym(words[1])}
                </motion.div>
                <motion.div
                    layoutId="word-2"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {highlightAcronym(words[2])}
                </motion.div>

                <motion.div
                    layoutId="word-3"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {words[3]}
                </motion.div>

                <motion.div
                    layoutId="word-4"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {highlightAcronym(words[4])}
                </motion.div>
                <motion.div
                    layoutId="word-5"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {highlightAcronym(words[5])}
                </motion.div>
                <motion.div
                    layoutId="word-6"
                    className="text-4xl font-bold bg-blue-200 p-4 rounded-md shadow-md">
                    {highlightAcronym(words[6])}
                </motion.div>
            </div>
        </motion.div>
    );
}

/* -----------------------------------------------------
   9. Phase 6: SplitScreen with smaller 'DeTAILS' on top,
       Google Auth on bottom, and a subtle 3D effect to the text
----------------------------------------------------- */
export function SplitScreenPhase6({
    words,
    GoogleOauth = <></>
}: {
    words: string[];
    GoogleOauth: JSX.Element;
}) {
    /** The merges for "DeTAILS" */
    const merges = [
        { word: 'Deductive', text: 'De' },
        { word: 'Thematic', text: 'T' },
        { word: 'Analysis', text: 'A' },
        { word: 'Iterative', text: 'I' },
        { word: 'LLM', text: 'L' },
        { word: 'Support', text: 'S' }
    ];

    /** Local state controlling whether Google Auth is visible yet */
    const [googleVisible, setGoogleVisible] = useState(true);
    const [flex, setFlex] = useState(false);

    return (
        <div className="relative h-screen w-screen" style={{ perspective: '1000px' }}>
            {/* Background with cards rendered behind all content */}
            <motion.div
                className="absolute inset-0 z-0"
                initial={{
                    opacity: 0
                }}
                animate={{
                    opacity: 0.5
                }}
                transition={{
                    duration: 1,
                    delay: 0.5
                }}>
                <BackgroundWithCards />
            </motion.div>

            {/* Foreground split screen content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10">
                {/** 1) DeTAILS text, centered, animates up */}
                <motion.div
                    initial={{ color: '#f00' }}
                    animate={{ color: '#000' }}
                    transition={{ duration: 0.5 }}
                    className={`h-1/2 flex items-end justify-end`} //${flex ? 'flex items-end justify-end' : 'flex items-center justify-center'}`}
                    onAnimationComplete={() => {
                        // Once DeTAILS has shifted up, show the Google Auth container.
                        setFlex(true);
                        // setGoogleVisible(true);
                    }}>
                    <div
                        className="text-9xl font-bold flex"
                        // Add perspective to the text container for the 3d transforms.
                        style={{ perspective: '1000px' }}>
                        {merges.map(({ word, text }) => (
                            <motion.span
                                key={word}
                                layoutId={`highlight-${word}`}
                                // Apply a subtle 3d rotation to each character.
                                style={{ transform: 'rotateX(5deg) rotateY(5deg)' }}>
                                {text}
                            </motion.span>
                        ))}
                    </div>
                </motion.div>

                {/** 2) Google OAuth container, appears below the text once it's done moving */}
                {googleVisible && (
                    <motion.div
                        className="h-1/2" // adjust margins/padding as needed
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}>
                        {GoogleOauth}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

/* -----------------------------------------------------
   10. The main LoginAnimation with phases 1..5 as before, plus 6, plus 7
----------------------------------------------------- */
type Phase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const typedWords = ['Deductive', 'Thematic', 'Analysis', 'with', 'Iterative', 'LLM', 'Support'];

export default function LoginAnimation({ GoogleOauth }: { GoogleOauth: JSX.Element }) {
    const [phase, setPhase] = useState<Phase>(0);

    // Automatic transitions for phases 1..4
    useEffect(() => {
        if (phase === 0) {
            const t = setTimeout(() => {
                setPhase(1);
            }, 500);
            return () => clearTimeout(t);
        }
    }, [phase]);

    // useEffect(() => {
    //     const t = setInterval(() => {
    //         setPhase(1);
    //     }, 500);
    //     return () => clearInterval(t);
    // }, []);

    useEffect(() => {
        if (phase === 1) {
            const t = setTimeout(() => {
                setPhase(2);
            }, 500);
            return () => clearTimeout(t);
        }
    }, [phase]);

    useEffect(() => {
        if (phase === 2) {
            const t = setTimeout(() => {
                setPhase(3);
            }, 1000);
            return () => clearTimeout(t);
        }
    }, [phase]);

    // useEffect(() => {
    //     if (phase === 3) {
    //         const t = setTimeout(() => {
    //             setPhase(4);
    //         }, 500);
    //         return () => clearTimeout(t);
    //     }
    // }, [phase]);

    // // From phase 4 => 5 after 3s
    // useEffect(() => {
    //     if (phase === 4) {
    //         const t = setTimeout(() => {
    //             setPhase(5);
    //         }, 500);
    //         return () => clearTimeout(t);
    //     }
    // }, [phase]);

    // From phase 5 => 6 after 3s
    useEffect(() => {
        console.log('Phase:', phase);
        if (phase === 4) {
            const t = setTimeout(() => {
                setPhase(6);
            }, 900);
            return () => clearTimeout(t);
        }
    }, [phase]);

    // Now from phase 6 => 7 after 3s
    // (So user sees "DeTAILS" in center for a while, then we do split screen)
    // useEffect(() => {
    //     if (phase === 6) {
    //         const t = setTimeout(() => {
    //             setPhase(7);
    //         }, 500);
    //         return () => clearTimeout(t);
    //     }
    // }, [phase]);

    // Track local state for showing the "DeTAILS" merges in phase 6
    const [mergeVisible, setMergeVisible] = useState(false);

    // Once phase 6's fadeOut container is done, show the merges
    function handleFadeComplete() {
        setMergeVisible(true);
    }

    return (
        <div className="relative h-screen flex items-center justify-center p-4 overflow-hidden">
            {/* Background fade for phases < 4 */}
            <AnimatePresence>
                {phase < 4 && (
                    <motion.div
                        key="bg"
                        className="absolute inset-0 bg-gray-100"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                    />
                )}
            </AnimatePresence>

            <LayoutGroup>
                {/* PHASES 1..3 => CardsGrid */}
                <AnimatePresence>
                    {phase < 5 && (
                        <motion.div
                            key="cardsContainer"
                            className="relative z-10"
                            initial={phase === 0 ? { opacity: 0 } : { opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}>
                            <CardsGrid phase={phase} words={typedWords} setPhase={setPhase} />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {/* PHASE 4..5 => show CenterLayout normally */}
                    {/* {phase >= 4 && phase < 6 && <CenterLayout words={typedWords} phase={phase} />} */}

                    {/* PHASE 6 => first we fade out center layout + leftover text */}
                    {phase === 6 && (
                        <SplitScreenPhase6 words={typedWords} GoogleOauth={GoogleOauth} />
                    )}
                </AnimatePresence>
            </LayoutGroup>
        </div>
    );
}

/* =====================================================
   Helper: Generate an array of 72 characters that are 
   either '-' or ' ' (spaces)
===================================================== */
function generateRandomText(): Array<' ' | '-'> {
    return Array.from({ length: 72 }, () => (Math.random() > 0.3 ? '-' : ' '));
}

/* =====================================================
   Types for word spans.
   Each card will randomly choose 2–3 words from a provided
   list and assign each a start index (ensuring the word fits
   within the 72-character bounds and does not overlap with others).
   A random highlight color is also assigned.
===================================================== */
interface WordSpan {
    start: number;
    word: string;
    color: string;
}

/* =====================================================
   AnimatedCardContent

   This component renders the content of one card.
   It:
   1. Generates a base array of 72 characters (– and spaces).
   2. Randomly picks 2–3 words from a passed-in word list.
   3. Randomly assigns each word a start index (without overlaps)
      and a random highlight color.
   4. Uses a “highlightIndex” that advances from –1 up to 71.
      As the pointer passes over a cell that belongs to a word,
      the character from that word is revealed with its designated color.
   5. When the pointer reaches the end, it resets the card.
===================================================== */
interface AnimatedCardContentProps {
    wordList: string[];
    idx: number;
}

export function AnimatedCardContent({ wordList, idx }: AnimatedCardContentProps) {
    const NUM_CHARS = 72; // Total characters per card.
    const NUM_COLS = 12; // We'll use a 12-column grid.

    // State for the underlying random text.
    const [baseText, setBaseText] = useState<Array<' ' | '-'>>(generateRandomText());
    // State for the chosen word spans.
    const [wordSpans, setWordSpans] = useState<WordSpan[]>([]);
    // Global pointer that “highlights” characters.
    const [highlightIndex, setHighlightIndex] = useState<number>(-1);

    // Define a palette of colors for highlighting.
    const palette = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'];

    // Generate 2–3 word spans that do not overlap.
    const generateWordSpans = (): WordSpan[] => {
        const spans: WordSpan[] = [];
        // Randomly choose 2 or 3 words.
        const numWords = Math.floor(Math.random() * 2) + 2; // yields 2 or 3
        let attempts = 0;
        while (spans.length < numWords && attempts < 20) {
            // Pick a random word from the list.
            const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
            // Make sure the word will fit.
            const maxStart = NUM_CHARS - randomWord.length;
            if (maxStart < 0) {
                attempts++;
                continue;
            }
            const start = Math.floor(Math.random() * (maxStart + 1));
            // Check for overlaps with already chosen spans.
            const overlap = spans.some((span) => {
                const s = span.start;
                const e = span.start + span.word.length - 1;
                const candidateEnd = start + randomWord.length - 1;
                return !(candidateEnd <= s - 2 || start >= e + 2);
            });

            if (!overlap) {
                spans.push({
                    start,
                    word: randomWord,
                    color: palette[Math.floor(Math.random() * palette.length)]
                });
            }
            attempts++;
        }
        return spans;
    };

    // On mount (or when wordList changes), initialize the card.
    useEffect(() => {
        setWordSpans(generateWordSpans());
        setHighlightIndex(-1);
        setBaseText(generateRandomTextArray(idx));
    }, [wordList]);

    // Every 150ms, increment the global highlight pointer.
    // When it reaches the end, reset the card (new text and new words).
    useEffect(() => {
        const interval = setInterval(() => {
            setHighlightIndex((prev) => {
                if (prev >= NUM_CHARS - 1) {
                    // When done, reset after a brief pause.
                    setTimeout(() => {
                        setBaseText(generateRandomTextArray(idx));
                        setWordSpans(generateWordSpans());
                        setHighlightIndex(-1);
                    }, 1000);
                    return prev;
                }
                return prev + 1;
            });
        }, 150);
        return () => clearInterval(interval);
    }, [wordList]);

    // Build the display array.
    // For each index, if it belongs to one of the word spans and the pointer
    // has passed it, reveal the corresponding character from the word and
    // assign the span’s highlight color. Otherwise, use the base random character.
    type DisplayLetter = { char: string; color: string };
    const displayLetters: DisplayLetter[] = [];
    for (let i = 0; i < NUM_CHARS; i++) {
        let letter: DisplayLetter = { char: baseText[i], color: '#808080' };
        for (const span of wordSpans) {
            if (i >= span.start && i < span.start + span.word.length) {
                if (highlightIndex >= i) {
                    letter.char = span.word[i - span.start];
                    letter.color = span.color;
                }
                break; // Since spans do not overlap.
            }
        }
        displayLetters.push(letter);
    }

    return (
        <motion.div className="grid grid-cols-12 gap-1 font-mono text-lg">
            {displayLetters.map((letter, index) => (
                <motion.span
                    key={index}
                    initial={{ color: '#808080' }}
                    animate={{ color: highlightIndex >= index ? letter.color : '#808080' }}
                    transition={{ duration: 0.3 }}>
                    {letter.char}
                </motion.span>
            ))}
        </motion.div>
    );
}

/* =====================================================
   CardsGridBackground

   This component lays out a grid of cards. You can decide
   how many rows and columns to display. Each card uses the 
   same styling as your original code and renders an 
   AnimatedCardContent in its center.
===================================================== */
interface CardsGridBackgroundProps {
    rows: number;
    columns: number;
    wordList: string[];
}

export function CardsGridBackground({ rows, columns, wordList }: CardsGridBackgroundProps) {
    return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: rows * columns }).map((_, i) => {
                // Calculate the column index for the current card.
                const colIndex = i % columns;
                // Apply a vertical displacement that alternates based on the column index.
                // Adjust the pixel value as needed.
                const displacement = colIndex % 2 === 0 ? 50 : -50;
                return (
                    <div
                        key={i}
                        className="w-56 h-[284px] flex items-center justify-center text-lg p-2 leading-6 bg-white/50 border border-gray-400 shadow-lg rounded-lg"
                        style={{ transform: `translateY(${displacement}px)` }}>
                        <AnimatedCardContent wordList={wordList} idx={i} />
                    </div>
                );
            })}
        </div>
    );
}

/* =====================================================
   Usage Example

   Here you can supply your own word list. In this example,
   each card will randomly choose 2–3 words from the list
   and type them into the card.
===================================================== */
const exampleWordList = [
    'Lorem',
    'Ipsum',
    'is',
    'simply',
    'dummy',
    'text',
    'of',
    'the',
    'printing',
    'and',
    'typesetting',
    'industry',
    'has',
    'been',
    "industry's",
    'standard',
    'ever',
    'since',
    '1500s',
    'when',
    'an',
    'unknown',
    'printer',
    'took',
    'a',
    'galley',
    'type',
    'scrambled',
    'it',
    'to',
    'make',
    'specimen',
    'book.',
    'It',
    'survived',
    'not',
    'only',
    'five',
    'centuries,',
    'but',
    'also',
    'leap',
    'into',
    'electronic',
    'typesetting,',
    'remaining',
    'essentially',
    'unchanged.',
    'was',
    'popularised',
    'in',
    '1960s',
    'with',
    'release',
    'Letraset',
    'sheets',
    'containing',
    'passages,',
    'more',
    'recently',
    'desktop',
    'publishing',
    'software',
    'like',
    'Aldus',
    'PageMaker',
    'including',
    'versions',
    'Ipsum.',
    'industry.',
    '1500s,'
];

export function BackgroundWithCards() {
    const TOTAL_COLUMNS = useResponsiveColumns();
    return (
        <div className="relative h-screen w-screen">
            {/* Center the grid background using absolute positioning and transform */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <CardsGridBackground rows={5} columns={TOTAL_COLUMNS} wordList={exampleWordList} />
            </div>
        </div>
    );
}
