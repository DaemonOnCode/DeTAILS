import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FaBrain, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { useWebSocket } from '../../../context/websocket-context';
import { useCollectionContext } from '../../../context/collection-context';
import { MODEL_LIST } from '../../../constants/Shared';
import { useSettings } from '../../../context/settings-context';

const { ipcRenderer } = window.require('electron');

const Workflow = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const llm1Ref = useRef<HTMLDivElement>(null);
    const llm2Ref = useRef<HTMLDivElement>(null);
    const llm3Ref = useRef<HTMLDivElement>(null);

    const { settings } = useSettings();

    const modelName = settings.ai?.model || MODEL_LIST.GEMINI_FLASH_THINKING;

    const { registerCallback, unregisterCallback } = useWebSocket();
    // const { selectedPosts } = useCollectionContext();
    const selectedPosts = [];

    const [lines, setLines] = useState<
        {
            fromX: number;
            fromY: number;
            toX: number;
            toY: number;
        }[]
    >([]);
    const [statuses, setStatuses] = useState({
        LLM1: 'not_started',
        LLM2: 'not_started',
        LLM3: 'not_started'
    });
    const [generatedText, setGeneratedText] = useState({
        LLM1: '',
        LLM2: '',
        LLM3: ''
    });

    const [processedPosts, setProcessedPosts] = useState<Set<string>>(new Set()); // Tracks unique completed posts
    const TOTAL_POSTS = selectedPosts.length || 5; // Use a default if `selectedPosts` is empty.

    const calculateArrowToBoxEdge = (from: DOMRect, to: DOMRect, containerRect: DOMRect) => {
        const fromCenter = {
            x: from.left + from.width / 2 - containerRect.left,
            y: from.top + from.height / 2 - containerRect.top
        };

        const toBox = {
            top: to.top - containerRect.top,
            bottom: to.bottom - containerRect.top,
            left: to.left - containerRect.left,
            right: to.right - containerRect.left,
            centerX: to.left + to.width / 2 - containerRect.left,
            centerY: to.top + to.height / 2 - containerRect.top
        };

        const slope = (toBox.centerY - fromCenter.y) / (toBox.centerX - fromCenter.x);

        if (Math.abs(slope) <= to.height / to.width) {
            if (fromCenter.x < toBox.centerX) {
                return {
                    x: toBox.left,
                    y: fromCenter.y + slope * (toBox.left - fromCenter.x)
                };
            } else {
                return {
                    x: toBox.right,
                    y: fromCenter.y + slope * (toBox.right - fromCenter.x)
                };
            }
        } else {
            if (fromCenter.y < toBox.centerY) {
                return {
                    x: fromCenter.x + (toBox.top - fromCenter.y) / slope,
                    y: toBox.top
                };
            } else {
                return {
                    x: fromCenter.x + (toBox.bottom - fromCenter.y) / slope,
                    y: toBox.bottom
                };
            }
        }
    };

    const updateLines = () => {
        if (!llm1Ref.current || !llm2Ref.current || !llm3Ref.current || !containerRef.current)
            return;

        const llm1Rect = llm1Ref.current.getBoundingClientRect();
        const llm2Rect = llm2Ref.current.getBoundingClientRect();
        const llm3Rect = llm3Ref.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const arrow1End = calculateArrowToBoxEdge(llm1Rect, llm3Rect, containerRect);
        const arrow2End = calculateArrowToBoxEdge(llm2Rect, llm3Rect, containerRect);

        setLines([
            {
                fromX: llm1Rect.left + llm1Rect.width / 2 - containerRect.left,
                fromY: llm1Rect.top + llm1Rect.height / 2 - containerRect.top,
                toX: arrow1End.x,
                toY: arrow1End.y
            },
            {
                fromX: llm2Rect.left + llm2Rect.width / 2 - containerRect.left,
                fromY: llm2Rect.top + llm2Rect.height / 2 - containerRect.top,
                toX: arrow2End.x,
                toY: arrow2End.y
            }
        ]);
    };

    const extractPostId = (message: string): string | null => {
        const match = message.match(/post ([a-zA-Z0-9]{6})/);
        return match ? match[1] : null;
    };

    const handleWebSocketMessage = (message: string) => {
        console.log('Total listeners: ', ipcRenderer.listeners('ws-message'));
        console.log('Received WebSocket message:', message);

        const postId = extractPostId(message);
        if (message.includes('WARNING:')) {
            const warningLLM = message.includes('LLM1')
                ? 'LLM1'
                : message.includes('LLM2')
                  ? 'LLM2'
                  : 'LLM3';
            setStatuses((prev) => ({ ...prev, [warningLLM]: 'warning' }));
            setGeneratedText((prev) => ({ ...prev, [warningLLM]: 'Warning' }));
        } else if (message.includes('ERROR:')) {
            const errorLLM = message.includes('LLM1')
                ? 'LLM1'
                : message.includes('LLM2')
                  ? 'LLM2'
                  : 'LLM3';
            setStatuses((prev) => ({ ...prev, [errorLLM]: 'error' }));
            setGeneratedText((prev) => ({ ...prev, [errorLLM]: 'Error' }));
        } else if (message.includes('Fetching data')) {
            setStatuses({ LLM1: 'fetching', LLM2: 'not_started', LLM3: 'not_started' });
            setGeneratedText({ LLM1: 'Fetching data...', LLM2: '', LLM3: '' });
        } else if (message.includes('Generating with LLM1')) {
            setStatuses((prev) => ({ ...prev, LLM1: 'generating' }));
            setGeneratedText((prev) => ({ ...prev, LLM1: 'Generating...' }));
        } else if (message.includes('LLM1 completed generation')) {
            setStatuses((prev) => ({ ...prev, LLM1: 'success' }));
            setGeneratedText((prev) => ({ ...prev, LLM1: 'Completed by LLM 1' }));
        } else if (message.includes('Generating with LLM2')) {
            setStatuses((prev) => ({ ...prev, LLM2: 'generating' }));
            setGeneratedText((prev) => ({ ...prev, LLM2: 'Generating...' }));
        } else if (message.includes('LLM2 completed generation')) {
            setStatuses((prev) => ({ ...prev, LLM2: 'success' }));
            setGeneratedText((prev) => ({ ...prev, LLM2: 'Completed by LLM 2' }));
        } else if (message.includes('Validating results')) {
            setStatuses((prev) => ({ ...prev, LLM3: 'validating' }));
            setGeneratedText((prev) => ({ ...prev, LLM3: 'Validating...' }));
        } else if (message.includes('Retrying validation')) {
            setStatuses((prev) => ({ ...prev, LLM3: 'warning' }));
            setGeneratedText((prev) => ({ ...prev, LLM3: 'Retrying...' }));
        } else if (message.includes('Error validating')) {
            setStatuses((prev) => ({ ...prev, LLM3: 'error' }));
            setGeneratedText((prev) => ({ ...prev, LLM3: 'Validation Failed' }));
        } else if (message.includes('Failed to validate')) {
            setStatuses((prev) => ({ ...prev, LLM3: 'error' }));
            setGeneratedText((prev) => ({ ...prev, LLM3: 'Validation Failed' }));
        } else if (message.includes('Successfully processed post')) {
            setStatuses((prev) => ({ ...prev, LLM3: 'success' }));
            setGeneratedText((prev) => ({ ...prev, LLM3: 'Validated Successfully' }));
        } else if (message.includes('Processed post')) {
            if (postId) {
                setProcessedPosts((prev) => new Set(prev).add(postId)); // Add postId to Set
            }
        }
    };

    useEffect(() => {
        registerCallback('coding-validation-loader', handleWebSocketMessage);
        return () => unregisterCallback('coding-validation-loader');
    }, []);

    useEffect(() => {
        updateLines();
        window.addEventListener('resize', updateLines);
        return () => window.removeEventListener('resize', updateLines);
    }, []);

    const getBoxClass = (status: string) => {
        const baseClass =
            'rounded-lg p-6 text-center border-2 flex flex-col justify-center items-center';

        switch (status) {
            case 'success':
                return `${baseClass} bg-white border-green-500 shadow-[0_10px_30px_0_rgba(72,187,120,0.6)]`;
            case 'fetching':
            case 'generating':
            case 'validating':
                return `${baseClass} bg-white border-blue-500 animate-shadowPulse`;
            case 'warning':
                return `${baseClass} bg-white border-yellow-500 shadow-[0_10px_30px_0_rgba(255,193,7,0.6)]`;
            case 'error':
                return `${baseClass} bg-white border-red-500 shadow-[0_10px_30px_0_rgba(220,53,69,0.6)]`;
            default:
                return `${baseClass} bg-white border-gray-300 shadow-[0_10px_30px_0_rgba(0,0,0,0.2)]`;
        }
    };

    const getIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <FaBrain className="text-green-500 text-4xl mb-2" />;
            case 'warning':
                return <FaExclamationTriangle className="text-yellow-500 text-4xl mb-2" />;
            case 'error':
                return <FaTimesCircle className="text-red-500 text-4xl mb-2" />;
            case 'fetching':
            case 'generating':
            case 'validating':
                return <FaBrain className="text-blue-500 text-4xl mb-2" />;
            default:
                return <FaBrain className="text-gray-500 text-4xl mb-2" />;
        }
    };

    return (
        <div className="w-full min-h-page flex flex-col items-center justify-center">
            {/* Progress Bar */}
            <div className="w-3/4 mb-6">
                <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-green-500"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(processedPosts.size / TOTAL_POSTS) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}></motion.div>
                </div>
                <div className="text-center mt-2 text-sm font-medium text-gray-700">
                    {`${processedPosts.size}/${TOTAL_POSTS} Posts Processed`}
                </div>
            </div>

            {/* Workflow */}
            <div ref={containerRef} className="relative w-[800px] h-[600px]">
                {/* SVG for Arrows */}
                <svg className="absolute top-0 left-0 w-full h-full">
                    {statuses.LLM1 === 'success' && (
                        <motion.line
                            x1={lines[0]?.fromX}
                            y1={lines[0]?.fromY}
                            x2={lines[0]?.toX}
                            y2={lines[0]?.toY}
                            stroke="black"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                            initial={{ strokeDasharray: '100%', strokeDashoffset: '100%' }}
                            animate={{ strokeDashoffset: '0%' }}
                            transition={{ duration: 2 }}
                        />
                    )}
                    {statuses.LLM2 === 'success' && (
                        <motion.line
                            x1={lines[1]?.fromX}
                            y1={lines[1]?.fromY}
                            x2={lines[1]?.toX}
                            y2={lines[1]?.toY}
                            stroke="black"
                            strokeWidth="2"
                            markerEnd="url(#arrowhead)"
                            initial={{ strokeDasharray: '100%', strokeDashoffset: '100%' }}
                            animate={{ strokeDashoffset: '0%' }}
                            transition={{ duration: 2 }}
                        />
                    )}
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="10"
                            refY="3.5"
                            orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="black" />
                        </marker>
                    </defs>
                </svg>

                {/* Cards */}
                <motion.div
                    ref={llm1Ref}
                    className={`absolute top-[10%] left-[10%] w-64 h-48 ${getBoxClass(statuses.LLM1)}`}>
                    {getIcon(statuses.LLM1)}
                    <p className="font-bold text-lg">LLM 1</p>
                    <p className="text-sm text-gray-600 capitalize">
                        {modelName.replace(':', ' ')}
                    </p>
                    <p className="text-sm mt-2">{generatedText.LLM1 || 'Waiting...'}</p>
                </motion.div>

                <motion.div
                    ref={llm2Ref}
                    className={`absolute top-[10%] right-[10%] w-64 h-48 ${getBoxClass(statuses.LLM2)}`}>
                    {getIcon(statuses.LLM2)}
                    <p className="font-bold text-lg">LLM 2</p>
                    <p className="text-sm text-gray-600 capitalize">
                        {modelName.replace(':', ' ')}
                    </p>
                    <p className="text-sm mt-2">{generatedText.LLM2 || 'Waiting...'}</p>
                </motion.div>

                <motion.div
                    ref={llm3Ref}
                    className={`absolute bottom-[10%] left-[50%] transform -translate-x-1/2 w-64 h-48 ${getBoxClass(statuses.LLM3)}`}>
                    {getIcon(statuses.LLM3)}
                    <p className="font-bold text-lg">LLM 3</p>
                    <p className="text-sm text-gray-600 capitalize">
                        {modelName.replace(':', ' ')}
                    </p>
                    <p className="text-sm mt-2">{generatedText.LLM3 || 'Waiting...'}</p>
                </motion.div>
            </div>
        </div>
    );
};

export default Workflow;
