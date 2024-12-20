import { ChangeEvent, FC, useEffect, useState } from 'react';
import { DB_PATH, LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import RedditViewModal from '../../components/Coding/Shared/reddit_view_modal';
import { useNavigate } from 'react-router-dom';
import { useLogger } from '../../context/logging_context';
import {
    MODEL_LIST,
    REMOTE_SERVER_BASE_URL,
    REMOTE_SERVER_ROUTES,
    USE_LOCAL_SERVER
} from '../../constants/Shared';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding_context';
import { useCollectionContext } from '../../context/collection_context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const { ipcRenderer } = window.require('electron');

const CodingValidationV2Page: FC = () => {
    const {
        dispatchCodeResponses,
        codeResponses,
        references,
        mainCode,
        selectedFlashcards,
        flashcards,
        selectedWords,
        codeBook
    } = useCodingContext();
    const { selectedPosts, datasetId } = useCollectionContext();

    const navigate = useNavigate();
    const logger = useLogger();

    const { saveWorkspaceData } = useWorkspaceUtils();

    const handleCommentChange = (index: number, event: ChangeEvent<HTMLTextAreaElement>) => {
        dispatchCodeResponses({
            type: 'UPDATE_COMMENT',
            index,
            comment: event.target.value
        });
    };

    const handleMark = (index: number, isMarked?: boolean) => {
        dispatchCodeResponses({ type: 'MARK_RESPONSE', index, isMarked });
    };

    const [selectedData, setSelectedData] = useState<{
        link: string;
        text: string;
    }>({
        link: '',
        text: ''
    });

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Coding validation Page');

        return () => {
            saveWorkspaceData();
            logger.info('Unloaded Coding validation Page').then(() => {
                logger.time('Coding validation Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const runWithFeedback = async () => {
        const isAllCorrect = codeResponses.every((value) => value.isMarked === true);
        const timer = createTimer();
        if (isAllCorrect) {
            await logger.time('Coding validation with feedback', { time: timer.end() });
            navigate('/coding/' + ROUTES.FINAL);
            return;
        }

        if (!USE_LOCAL_SERVER) {
            await logger.info('Sending data to remote server for validation');
            // await ipcRenderer.invoke("connect-ws", datasetId);
            const res = await fetch(
                `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.GENERATE_CODES_WITH_THEMES_AND_FEEDBACK}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: MODEL_LIST.LLAMA_3_2,
                        references,
                        mainCode,
                        codeBook,
                        selectedPosts,
                        feedback: codeResponses.filter((response) => response.isMarked === false),
                        datasetId
                    })
                }
            );

            const results = await res.json();
            console.log('Result:', results);

            const parsedResult: {
                unified_codebook: {
                    code: string;
                    description: string;
                    examples: string[];
                }[];
                recoded_transcript: {
                    code: string;
                    segment: string;
                    reasoning: string;
                }[];
            }[] = results;

            let totalResponses = codeResponses.filter((response) => response.isMarked === true);
            parsedResult.forEach((answer, index) => {
                for (const recodedTranscript of answer.recoded_transcript) {
                    const sentence = recodedTranscript.segment;
                    const coded_word = recodedTranscript.code;
                    const postId = selectedPosts[index];
                    const reasoning = recodedTranscript.reasoning;
                    totalResponses.push({
                        sentence,
                        coded_word,
                        postId,
                        reasoning,
                        isMarked: undefined,
                        comment: ''
                    });
                }
            });

            await logger.info('Coding validation with feedback', { time: timer.end() });
            dispatchCodeResponses({
                type: 'SET_RESPONSES',
                responses: totalResponses
            });

            // await ipcRenderer.invoke("disconnect-ws", datasetId);
            navigate('/coding/' + ROUTES.CODING_VALIDATION);

            return;
        }

        const results = await ipcRenderer.invoke(
            'generate-codes-with-feedback',
            MODEL_LIST.LLAMA_3_2,
            references,
            mainCode,
            selectedFlashcards.map((id) => {
                return {
                    question: flashcards.find((flashcard) => flashcard.id === id)!.question,
                    answer: flashcards.find((flashcard) => flashcard.id === id)!.answer
                };
            }),
            selectedWords,
            selectedPosts,
            codeResponses.filter((response) => response.isMarked === false),
            DB_PATH
        );

        await logger.time('Coding validation with feedback', { time: timer.end() });

        console.log('Result:', results);

        const parsedResult: {
            unified_codebook: {
                code: string;
                description: string;
                examples: string[];
            }[];
            recoded_transcript: {
                code: string;
                segment: string;
                reasoning: string;
            }[];
        }[] = results;

        let totalResponses = codeResponses.filter((response) => response.isMarked === true);

        // totalResponses = totalResponses.concat(
        parsedResult.forEach((answer, index) => {
            for (const recodedTranscript of answer.recoded_transcript) {
                const sentence = recodedTranscript.segment;
                const coded_word = recodedTranscript.code;
                const postId = selectedPosts[index];
                const reasoning = recodedTranscript.reasoning;
                totalResponses.push({
                    sentence,
                    coded_word,
                    postId,
                    reasoning,
                    isMarked: undefined,
                    comment: ''
                });
            }
        });
        // )

        dispatchCodeResponses({
            type: 'SET_RESPONSES',
            responses: totalResponses
        });

        navigate('/coding/' + ROUTES.CODING_VALIDATION);
    };

    const handleRerunCoding = () => {
        console.log('Re-running coding...');
        navigate('../loader/' + LOADER_ROUTES.CODING_VALIDATION_LOADER);

        runWithFeedback();
    };

    const handleOpenReddit = async (postId: string, commentSlice: string) => {
        const link = await ipcRenderer.invoke(
            'get-link-from-post',
            postId,
            commentSlice,
            datasetId,
            DB_PATH
        );

        setSelectedData({ link, text: commentSlice });
    };

    const handleToggleAllSelectOrReject = (isSelect: boolean) => {
        const alreadySetToTarget = codeResponses.every(
            (response) => response.isMarked === (isSelect ? true : false)
        );

        const finalDecision = alreadySetToTarget ? undefined : isSelect;

        if (finalDecision === undefined) {
            dispatchCodeResponses({
                type: 'SET_ALL_UNMARKED'
            });
        } else {
            dispatchCodeResponses({
                type: finalDecision ? 'SET_ALL_CORRECT' : 'SET_ALL_INCORRECT'
            });
        }
    };

    const handleNextClick = async () => {};

    const isReadyCheck = codeResponses.some((response) => response.isMarked !== undefined);

    useEffect(() => {
        console.log('Code Responses:', codeResponses);
    }, [codeResponses]);

    return (
        <div className="flex flex-col justify-between h-full">
            <div>
                <p>Please validate the following codings done by LLM </p>
                <div className="max-h-[calc(100vh-18rem)] overflow-auto mt-4 border border-gray-400 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 p-2">Link</th>{' '}
                                <th className="border border-gray-400 p-2">Sentence</th>
                                <th className="border border-gray-400 p-2">Word</th>
                                <th className="border border-gray-400 p-2">
                                    Actions
                                    <div className="mt-2 flex justify-center gap-x-2">
                                        <button
                                            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-sm"
                                            onClick={() => handleToggleAllSelectOrReject(true)}>
                                            ✓
                                        </button>
                                        <button
                                            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                                            onClick={() => handleToggleAllSelectOrReject(false)}>
                                            ✕
                                        </button>
                                    </div>
                                </th>
                                <th className="border border-gray-400 p-2">Comment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {codeResponses.map((response, index) => (
                                <tr key={index} className="text-center">
                                    <td className="border border-gray-400 p-2">
                                        {' '}
                                        <button
                                            className="text-blue-500 underline"
                                            onClick={() =>
                                                handleOpenReddit(response.postId, response.sentence)
                                            }>
                                            {response.postId}
                                        </button>
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-md">
                                        {response.sentence}
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-32 break-words">
                                        {response.coded_word}
                                    </td>
                                    <td className="border border-gray-400 p-2 min-w-24">
                                        <button
                                            className={`px-2 py-1 rounded mr-2 ${
                                                response.isMarked === true
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-300 text-gray-500'
                                            }`}
                                            onClick={() =>
                                                handleMark(
                                                    index,
                                                    response.isMarked !== true ? true : undefined
                                                )
                                            }>
                                            ✓
                                        </button>
                                        <button
                                            className={`px-2 py-1 rounded ${
                                                response.isMarked === false
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-gray-300 text-gray-500'
                                            }`}
                                            onClick={() =>
                                                handleMark(
                                                    index,
                                                    response.isMarked !== false ? false : undefined
                                                )
                                            }>
                                            ✕
                                        </button>
                                    </td>
                                    <td className="border border-gray-400 p-2 min-w-72">
                                        {response.isMarked === false && (
                                            <textarea
                                                className="w-full p-2 border border-gray-300 rounded"
                                                placeholder="Enter reason for rejection..."
                                                value={response.comment}
                                                onChange={(event) =>
                                                    handleCommentChange(index, event)
                                                }
                                            />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-center gap-x-6">
                    <button
                        onClick={handleRerunCoding}
                        disabled={!isReadyCheck}
                        className={`bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600  cursor-pointer${
                            isReadyCheck ? '' : 'cursor-not-allowed opacity-75'
                        }`}>
                        Re-run coding with changes
                    </button>
                </div>
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.INITIAL_CODING}
                nextPage={ROUTES.FINAL}
                isReady={isReadyCheck}
                onNextClick={handleNextClick}
            />
            {(selectedData?.link ?? '').length > 0 && (
                <RedditViewModal
                    isViewOpen={selectedData.link.length > 0}
                    postLink={selectedData.link}
                    postText={selectedData.text}
                    closeModal={() => setSelectedData({ link: '', text: '' })}
                />
            )}
        </div>
    );
};

export default CodingValidationV2Page;
