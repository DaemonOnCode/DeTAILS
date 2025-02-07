import { motion } from 'framer-motion';
import { useState, useEffect, useTransition } from 'react';

const generateRandomText = (
    length: number,
    dashWeight: number = 0.89, // More natural dashes
    spaceWeight: number = 0.1, // More spaces for natural word spacing
    newlineWeight: number = 0.01 // Rare newlines for paragraph effect
): string => {
    let text = '';
    let word = '';

    for (let i = 0; i < length; i++) {
        const rand = Math.random();

        if (rand < dashWeight) {
            word += '-';
        } else if (rand < dashWeight + spaceWeight) {
            text += word + ' ';
            word = ''; // Reset word
        }

        if (Math.random() < newlineWeight && text.length > 30) {
            text += '\n';
        }
    }

    text += word;
    return text.trim();
};

// Highlight colors
const highlightColors = [
    'bg-yellow-300',
    'bg-green-300',
    'bg-blue-300',
    'bg-red-300',
    'bg-purple-300',
    'bg-pink-300',
    'bg-indigo-300'
];

const DeductiveCoding = () => {
    const [highlightedWords, setHighlightedWords] = useState<{ index: number; color: string }[]>(
        []
    );
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [textLine, setTextLine] = useState<string>(generateRandomText(500));
    const [resetting, setResetting] = useState(false);

    // Use transition to smooth cursor movement
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const words = textLine.split(' ');

        const highlightNextWord = () => {
            if (resetting) return; // Stop highlighting when resetting

            startTransition(() => {
                if (currentWordIndex < words.length) {
                    if (Math.random() < 0.2) {
                        // 20% chance to highlight multiple words
                        const numWordsToHighlight = Math.floor(Math.random() * 3) + 1; // Highlight 1-3 words
                        const highlightColor =
                            highlightColors[Math.floor(Math.random() * highlightColors.length)]; // Pick one color for batch

                        const newHighlights = Array.from(
                            { length: numWordsToHighlight },
                            (_, i) => ({
                                index: currentWordIndex + i,
                                color: highlightColor // Same color for batch
                            })
                        ).filter((item) => item.index < words.length && words[item.index].trim()); // Ensure valid words

                        setHighlightedWords((prev) => [...prev, ...newHighlights]);
                    }
                    setCurrentWordIndex((prev) => prev + 1);
                } else {
                    setResetting(true); // Start reset process
                    setTimeout(() => {
                        setHighlightedWords([]);
                        setCurrentWordIndex(0);
                        setTextLine(generateRandomText(500)); // Set new text only once
                        setResetting(false); // Reset completed
                    }, 500); // Small delay to prevent multiple updates
                }
            });
        };

        const highlightInterval = setInterval(highlightNextWord, 200); // Faster word-by-word movement

        return () => clearInterval(highlightInterval);
    }, [currentWordIndex, resetting]);

    return (
        <div className="flex justify-center items-center h-panel px-4">
            <div className="bg-white shadow-lg p-6 rounded-lg w-full max-w-3xl text-left border">
                <h2 className="text-2xl font-semibold mb-4">🔍 Deductive Coding in Progress</h2>

                <p className="text-lg font-mono leading-relaxed whitespace-pre-line">
                    {textLine.split(' ').map((word, idx) => {
                        const highlight = highlightedWords.find((h) => h.index === idx);
                        const isCurrentWord = idx === currentWordIndex; // Cursor should appear here

                        return (
                            <motion.span
                                key={idx}
                                className={`inline ${highlight ? highlight.color + ' bg-opacity-50' : ''}`}
                                transition={{ duration: 0.2 }}>
                                {word}
                                {isCurrentWord && (
                                    <motion.span
                                        className="inline-block w-1 h-5 bg-black ml-1 align-baseline"
                                        animate={{ opacity: [0, 1] }}
                                        transition={{ repeat: Infinity, duration: 0.5 }}
                                    />
                                )}{' '}
                            </motion.span>
                        );
                    })}
                </p>
            </div>
        </div>
    );
};

export default DeductiveCoding;
