import { motion } from 'framer-motion';
import { useState, useEffect, useTransition } from 'react';
import { generateRandomText } from '../../../utility/random-text-generator';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/Coding/shared';
import { useSettings } from '../../../context/settings-context';
import { useCodingContext } from '../../../context/coding-context';
import { useWebSocket } from '../../../context/websocket-context';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import { useWorkspaceContext } from '../../../context/workspace-context';
import { useApi } from '../../../hooks/Shared/use-api';

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
    const { registerCallback, unregisterCallback } = useWebSocket();
    const { unseenPostIds } = useCodingContext();

    const [highlightedWords, setHighlightedWords] = useState<{ index: number; color: string }[]>(
        []
    );
    const navigate = useNavigate();
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [textLine, setTextLine] = useState<string>(generateRandomText(500));
    const [resetting, setResetting] = useState(false);

    const [isPending, startTransition] = useTransition();

    const { settings } = useSettings();

    const [postsFinished, setPostsFinished] = useState<number>(0);

    const handleWebsocketMessage = (message: string) => {
        console.log('Websocket message:', message);
        const match = message.match(
            /Dataset\s+([^}]+):\s+Generated codes for post\s+([^}]+)\.\.\./
        );

        if (match) {
            console.log('Match:', match);
            const datasetId = match[1];
            const postId = match[2];
            setPostsFinished((prev) => prev + 1);
        }
    };

    const { fetchData } = useApi();
    const { datasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();

    const getFunctionProgress = async () => {
        const { data, error } = await fetchData<{
            total: number;
            current: number;
        }>(REMOTE_SERVER_ROUTES.CHECK_FUNCTION_PROGRESS, {
            method: 'POST',
            body: JSON.stringify({
                name: 'deductive',
                dataset_id: datasetId,
                workspace_id: currentWorkspace!.id
            })
        });
        console.log('Function progress:', data, error);
        if (!error) {
            setPostsFinished(data.current);
        }
    };

    useEffect(() => {
        getFunctionProgress();
        registerCallback('deductive-coding-loader', handleWebsocketMessage);
        return () => unregisterCallback('deductive-coding-loader');
    }, []);

    useEffect(() => {
        const words = textLine.split(' ');

        const highlightNextWord = () => {
            if (resetting) return;

            startTransition(() => {
                if (currentWordIndex < words.length) {
                    if (Math.random() < 0.2) {
                        const numWordsToHighlight = Math.floor(Math.random() * 3) + 1; // Highlight 1-3 words
                        const highlightColor =
                            highlightColors[Math.floor(Math.random() * highlightColors.length)]; // Pick one color for batch

                        const newHighlights = Array.from(
                            { length: numWordsToHighlight },
                            (_, i) => ({
                                index: currentWordIndex + i,
                                color: highlightColor
                            })
                        ).filter((item) => item.index < words.length && words[item.index].trim()); // Ensure valid words

                        setHighlightedWords((prev) => [...prev, ...newHighlights]);
                    }
                    setCurrentWordIndex((prev) => prev + 1);
                } else {
                    setResetting(true);
                    setTimeout(() => {
                        setHighlightedWords([]);
                        setCurrentWordIndex(0);
                        setTextLine(generateRandomText(500));
                        setResetting(false);
                    }, 500);
                }
            });
        };

        const highlightInterval = setInterval(highlightNextWord, 200);

        return () => clearInterval(highlightInterval);
    }, [currentWordIndex, resetting]);

    return (
        <div className="flex flex-col h-page px-4">
            <div className="flex-grow flex justify-center items-center">
                <div className="bg-white shadow-lg p-6 rounded-lg w-full max-w-3xl text-left border">
                    <h2 className="text-2xl font-semibold mb-2">🔍 Final Coding in Progress</h2>
                    <p className="mb-4">
                        {postsFinished}/{unseenPostIds.length} completed. Please wait, this may take
                        a moment...
                    </p>
                    <p className="text-lg font-mono leading-relaxed whitespace-pre-line">
                        {textLine.split(' ').map((word, idx) => {
                            const highlight = highlightedWords.find((h) => h.index === idx);
                            const isCurrentWord = idx === currentWordIndex;

                            return (
                                <motion.span
                                    key={idx}
                                    className={`inline ${
                                        highlight ? highlight.color + ' bg-opacity-50' : ''
                                    }`}
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

            {/* {settings.general.manualCoding && (
                <div className="mt-4 self-end">
                    <button
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => navigate(`/coding/${ROUTES.MANUAL_CODING}`)}>
                        Go to Manual Coding →
                    </button>
                </div>
            )} */}
        </div>
    );
};

export default DeductiveCoding;
