import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { useWebSocket } from '../../../context/websocket-context';
import { useCodingContext } from '../../../context/coding-context';
import { useApi } from '../../../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import { useWorkspaceContext } from '../../../context/workspace-context';

const CodebookAnimation: React.FC = () => {
    const { registerCallback, unregisterCallback } = useWebSocket();
    const { sampledPostIds } = useCodingContext();

    const numPages = 6;
    const colors = ['#4F46E5', '#3B82F6', '#6366F1', '#93C5FD', '#A78BFA', '#C084FC'];

    const [isStacking, setIsStacking] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isMovingRight, setIsMovingRight] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);
    const [writing, setWriting] = useState(false);
    const [currentText, setCurrentText] = useState('');
    const [flippedPages, setFlippedPages] = useState<number[]>([]);
    const [unflippedPages, setUnflippedPages] = useState<number[]>(
        Array.from({ length: numPages }, (_, i) => i)
    );

    const { fetchData } = useApi();
    const { datasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();

    const [postsFinished, setPostsFinished] = useState<number>(0);

    const typingTexts = [
        '-------- -----\n-- --- --\n-- ----------\n- - - - - -',
        '----- ----- -\n----------\n- - - - -\n -- -- --',
        '--- --- ---\n- -- --- --\n---- ---- --\n- - -- -----',
        '--- ----- --\n-- ----------\n-----------\n---- -- ----',
        '--- ---- -----\n- - -- -- -\n- -- -- --\n- - - - -',
        '--------------\n-- -- --- --\n - ---- -- --\n-- -- --'
    ];

    const handleWebsocketMessage = (message: string) => {
        console.log('Websocket message:', message);
        const match = message.match(
            /Dataset\s+([^}]+):\s+Generated codes for post\s+([^}]+)\.\.\./
        );

        if (match) {
            console.log('Match:', match);
            const datasetId = match[1];
            const postId = match[2];

            console.log('Sampled post ids:', sampledPostIds, 'Post id:', postId);
            // if (sampledPostIds.includes(postId)) {
            setPostsFinished((prev) => prev + 1);
            // }
        }
    };

    const getFunctionProgress = async () => {
        const { data, error } = await fetchData<{
            total: number;
            current: number;
        }>(REMOTE_SERVER_ROUTES.CHECK_FUNCTION_PROGRESS, {
            method: 'POST',
            body: JSON.stringify({
                name: 'codebook',
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
        registerCallback('codebook-loader', handleWebsocketMessage);

        return () => unregisterCallback('codebook-loader');
    }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isStacking) {
            console.log('Phase 1: Stacking');
            timer = setTimeout(() => {
                setIsStacking(false);
                setIsTransitioning(true);
            }, 2000);
        }
        return () => clearTimeout(timer);
    }, [isStacking]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isTransitioning) {
            console.log('Phase 2: Transitioning to a single stack');
            timer = setTimeout(() => {
                setIsTransitioning(false);
                setIsMovingRight(true);
            }, 1000);
        }
        return () => clearTimeout(timer);
    }, [isTransitioning]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isMovingRight) {
            console.log('Phase 3: Moving stack to the right');
            timer = setTimeout(() => {
                setIsMovingRight(false);
                setIsFlipping(true);
            }, 1000);
        }
        return () => clearTimeout(timer);
    }, [isMovingRight]);

    useEffect(() => {
        if (isFlipping) {
            console.log('Phase 4: Writing and Flipping');
            flipPages();
        }
    }, [isFlipping]);

    const flipPages = async () => {
        for (let i = unflippedPages.length - 1; i >= 0; i--) {
            setWriting(true);
            setCurrentText('');

            for (let j = 0; j <= typingTexts[i].length; j++) {
                setCurrentText(typingTexts[i].slice(0, j));
                await new Promise((resolve) => setTimeout(resolve, 20)); // Typing delay
            }

            setWriting(false);
            await new Promise((resolve) => setTimeout(resolve, 2000 - typingTexts[i].length * 15)); // Pause after typing

            setFlippedPages((prev) => [unflippedPages[i], ...prev]);
            setUnflippedPages((prev) => prev.slice(0, -1));
        }

        setTimeout(() => resetAnimation(), 1000);
    };

    const resetAnimation = () => {
        console.log('Resetting animation');
        setIsStacking(true);
        setIsTransitioning(false);
        setIsMovingRight(false);
        setIsFlipping(false);
        setWriting(false);
        setFlippedPages([]);
        setUnflippedPages(Array.from({ length: numPages }, (_, i) => i));
        setCurrentText('');
    };

    const stackingVariants: Variants = {
        initial: { y: 200, opacity: 0 },
        animate: (custom: number) => ({
            y: custom * -10,
            opacity: 1,
            transition: { delay: custom * 0.2, duration: 0.8, ease: 'easeInOut' }
        })
    };

    const transitionVariants: Variants = {
        initial: (custom: number) => ({ y: custom * -10 }),
        animate: { y: 0, transition: { duration: 1, ease: 'easeInOut' } }
    };

    const moveRightVariants: Variants = {
        initial: { x: 0 },
        animate: { x: 113, transition: { duration: 1, ease: 'easeInOut' } }
    };

    const flipVariants: Variants = {
        initial: { rotateY: 0 },
        animate: {
            x: -2,
            rotateY: -180,
            transition: { duration: 2.5, ease: 'linear' }
        }
    };

    return (
        <div className="min-h-page w-full flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold mb-8 text-gray-900">Generating Codebook</h1>
            <p className=" mb-16">
                {!!sampledPostIds?.length &&
                    `${postsFinished}/${sampledPostIds.length} completed. `}
                Please wait, this may take a moment...
            </p>

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
                                zIndex: index
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
                                zIndex: index
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
                    variants={moveRightVariants}>
                    {unflippedPages.map((index) => (
                        <motion.div
                            key={index}
                            className="absolute w-full h-full rounded-lg"
                            style={{
                                backgroundColor: colors[index % colors.length],
                                boxShadow: `0 ${index * 2}px ${index * 5}px rgba(0, 0, 0, 0.2)`,
                                zIndex: index
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
                                    zIndex: -i
                                }}>
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
                                    transformOrigin: 'left center',
                                    zIndex: i
                                }}
                                variants={flipVariants}
                                initial="initial"
                                animate={unflippedPages.length === i + 1 ? 'animate' : undefined}>
                                {unflippedPages.length === i + 1 && writing ? currentText : ''}
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodebookAnimation;
