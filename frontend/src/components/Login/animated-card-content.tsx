import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { SetState } from '../../types/Coding/shared';
import {
    generateRandomTextArray,
    generateRandomTextColumnsArray
} from '../../utility/random-text-generator';

interface AnimatedCardContentProps {
    wordList: string[];
    idx: number;
    handleAnimationDone: SetState<number>;
}

interface WordSpan {
    start: number;
    word: string;
    color: string;
}
function AnimatedCardContent({ wordList, idx, handleAnimationDone }: AnimatedCardContentProps) {
    const NUM_COLS = 12;
    const NUM_CHARS = NUM_COLS * 7;
    const palette = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'];

    const [baseText, setBaseText] = useState<Array<' ' | '-'>>(generateRandomTextArray());
    const [wordSpans, setWordSpans] = useState<WordSpan[]>([
        {
            start: NUM_COLS * 0,
            word: 'Deductive',
            color: palette[Math.floor(Math.random() * palette.length)]
        },
        {
            start: NUM_COLS * 1,
            word: 'Thematic',
            color: palette[Math.floor(Math.random() * palette.length)]
        },
        {
            start: NUM_COLS * 2,
            word: 'Analysis',
            color: palette[Math.floor(Math.random() * palette.length)]
        },
        {
            start: NUM_COLS * 3,
            word: 'with',
            color: palette[Math.floor(Math.random() * palette.length)]
        },
        {
            start: NUM_COLS * 4,
            word: 'Iterative',
            color: palette[Math.floor(Math.random() * palette.length)]
        },
        {
            start: NUM_COLS * 5,
            word: 'LLM',
            color: palette[Math.floor(Math.random() * palette.length)]
        },
        {
            start: NUM_COLS * 6,
            word: 'Support',
            color: palette[Math.floor(Math.random() * palette.length)]
        }
    ]);
    const [highlightIndex, setHighlightIndex] = useState<number>(-1);

    // Generate random word spans
    // const generateWordSpans = (): WordSpan[] => {
    //     const spans: WordSpan[] = [];
    //     const numWords = 1; // Math.floor(Math.random() * 2) + 2; // yields 2 or 3
    //     let attempts = 0;
    //     while (spans.length < numWords && attempts < 20) {
    //         const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
    //         const maxStart = NUM_CHARS - randomWord.length;
    //         if (maxStart < 0) {
    //             attempts++;
    //             continue;
    //         }
    //         const start = Math.floor(Math.random() * (maxStart + 1));
    //         // Check for overlap
    //         const overlap = spans.some((span) => {
    //             const s = span.start;
    //             const e = span.start + span.word.length - 1;
    //             const candidateEnd = start + randomWord.length - 1;
    //             return !(candidateEnd <= s - 2 || start >= e + 2);
    //         });

    //         if (!overlap) {
    //             spans.push({
    //                 start,
    //                 word: randomWord,
    //                 color: palette[Math.floor(Math.random() * palette.length)]
    //             });
    //         }
    //         attempts++;
    //     }
    //     return spans;
    // };

    useEffect(() => {
        // setWordSpans(generateWordSpans());
        setHighlightIndex(-1);
        setBaseText(generateRandomTextColumnsArray(idx));
    }, [wordList]);

    // Increment highlightIndex every 150ms
    useEffect(() => {
        const interval = setInterval(() => {
            setHighlightIndex((prev) => {
                if (prev >= NUM_CHARS - 1) {
                    handleAnimationDone((prev) => prev + 1);
                    // reset after a pause
                    setTimeout(() => {
                        setBaseText(generateRandomTextColumnsArray(idx));
                        // setWordSpans(generateWordSpans());
                        setHighlightIndex(-1);
                    }, 1500);
                    return prev;
                }
                return prev + 1;
            });
        }, 150);
        return () => clearInterval(interval);
    }, [wordList]);

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
                break;
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

export default AnimatedCardContent;
