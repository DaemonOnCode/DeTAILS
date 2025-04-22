import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Snippet {
    id: string;
    text: string;
    bucketIndex: number;
    offsetX: number;
}

const codeSnippets: string[] = [
    'Code 1',
    'Code 2',
    'Code 3',
    'Code 4',
    'Code 5',
    'Code 6',
    'Code 7',
    'Code 8'
];

const buckets: string[] = ['Theme 1', 'Theme 2', 'Theme 3', 'Theme 4'];

export default function SmoothCodeFlow(): JSX.Element {
    const [activeSnippets, setActiveSnippets] = useState<Snippet[]>([]);
    const [snippetQueue, setSnippetQueue] = useState<string[]>([...codeSnippets]);

    useEffect(() => {
        console.log('Generating new snippet...');
        const interval = setInterval(() => {
            console.log('Spawning new snippet...');
            setActiveSnippets((prev) => {
                if (prev.length >= 4) return prev;

                if (snippetQueue.length === 0) {
                    setSnippetQueue([...codeSnippets]);
                    return prev;
                }

                const nextSnippetText = snippetQueue.shift();
                if (!nextSnippetText) return prev;

                const bucketIndex = Math.floor(Math.random() * buckets.length);
                const offsetX = (Math.random() - 0.5) * 30;

                const newSnippet: Snippet = {
                    id: crypto.randomUUID(),
                    text: nextSnippetText,
                    bucketIndex,
                    offsetX
                };

                return [...prev, newSnippet];
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [snippetQueue]);

    return (
        <div className="min-h-page flex flex-col items-center justify-between p-6 text-gray-800 relative overflow-hidden">
            <h1 className="text-2xl font-bold mb-6">Sorting Codes into Themes...</h1>

            <motion.div
                className="relative w-24 h-32 bg-blue-600 text-white flex items-center justify-center rounded-lg shadow-lg z-20 transform translate-y-16 text-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'mirror' }}>
                Finalized Codes
            </motion.div>

            <div className="relative w-full h-60 flex items-start justify-center">
                {activeSnippets.map((snippet) => {
                    const bucketX =
                        (snippet.bucketIndex - (buckets.length - 1) / 2) * 180 + snippet.offsetX; // Bucket alignment
                    const bucketY = 250;

                    return (
                        <motion.div
                            key={snippet.id}
                            className="absolute text-lg font-bold p-3 bg-blue-400 text-white rounded-lg shadow-md"
                            initial={{ opacity: 0, x: 0, y: 0, scale: 0.8 }}
                            animate={{
                                x: [0, bucketX * 0.4, bucketX],
                                y: [0, -50, bucketY * 0.6, bucketY],
                                opacity: [0, 1, 1, 0],
                                scale: [0.8, 1, 1, 0.8]
                            }}
                            transition={{
                                duration: 4,
                                repeat: 1,
                                ease: 'easeInOut'
                            }}
                            onAnimationComplete={() => {
                                setActiveSnippets((prev) =>
                                    prev.filter((s) => s.id !== snippet.id)
                                );
                            }}>
                            {snippet.text}
                        </motion.div>
                    );
                })}
            </div>

            <div className="w-full flex justify-center space-x-8 z-10 bg-white">
                {buckets.map((bucket, index) => (
                    <motion.div
                        key={index}
                        className="w-40 h-40 bg-gray-200 border border-gray-400 flex items-center justify-center 
              rounded-lg shadow-lg text-lg font-bold text-gray-700"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, repeatType: 'mirror' }}>
                        {bucket}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
