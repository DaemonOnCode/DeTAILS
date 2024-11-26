import { ChangeEvent, FC, useContext, useEffect, useState } from 'react';
import {
    DB_PATH,
    LOADER_ROUTES,
    ROUTES,
    beforeHumanValidation
} from '../../constants/Coding/shared';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { DataContext } from '../../context/data_context';
import RedditViewModal from '../../components/Coding/Shared/reddit_view_modal';
import { useNavigate } from 'react-router-dom';

const { ipcRenderer } = window.require('electron');

const CodingValidationPage: FC = () => {
    const dataContext = useContext(DataContext);

    // console.count('Coding Validation Page');

    const navigate = useNavigate();

    const handleCommentChange = (index: number, event: ChangeEvent<HTMLTextAreaElement>) => {
        dataContext.dispatchCodeResponses({
            type: 'UPDATE_COMMENT',
            index,
            comment: event.target.value
        });
    };

    const handleMark = (index: number, isMarked?: boolean) => {
        dataContext.dispatchCodeResponses({ type: 'MARK_RESPONSE', index, isMarked });
    };

    const [selectedData, setSelectedData] = useState<{
        link: string;
        text: string;
    }>({
        link: '',
        text: ''
    });

    // useEffect(() => {
    //     beforeHumanValidation.forEach((answer, index) => {
    //         let parsedAnswer: {
    //             unified_codebook: {
    //                 code: string;
    //                 description: string;
    //                 examples: string[];
    //             }[];
    //             recoded_transcript: {
    //                 code: string;
    //                 segment: string;
    //             }[];
    //         } = { unified_codebook: [], recoded_transcript: [] };
    //         try {
    //             parsedAnswer = JSON.parse(answer);
    //         } catch (e) {
    //             console.log(e);
    //         }

    //         let responses = [];
    //         for (const recodedTranscript of parsedAnswer.recoded_transcript) {
    //             const sentence = recodedTranscript.segment;
    //             const coded_word = recodedTranscript.code;
    //             const postId = dataContext.selectedPosts[index];
    //             responses.push({ sentence, coded_word, postId });
    //         }
    //         dataContext.dispatchCodeResponses({
    //             type: 'ADD_RESPONSES',
    //             responses
    //         });
    //     });
    // }, []);

    const runWithFeedback = async () => {
        const isAllCorrect = dataContext.codeResponses.every((value) => value.isMarked === true);
        if (isAllCorrect) {
            // const acceptedResponses = dataContext.codeResponses.map(
            //     ({ comment, isMarked, ...rest }) => ({
            //         ...rest
            //     })
            // );

            // dataContext.dispatchFinalCodeResponses({
            //     type: 'ADD_RESPONSES',
            //     responses: acceptedResponses
            // });
            navigate('/coding/' + ROUTES.FINAL);
            return;
        }

        // navigate(LOADER_ROUTES.FINAL_LOADER);

        const results = await ipcRenderer.invoke(
            'generate-codes-with-feedback',
            'llama3.2:3b',
            dataContext.references,
            dataContext.mainCode,
            dataContext.selectedFlashcards.map((id) => {
                return {
                    question: dataContext.flashcards.find((flashcard) => flashcard.id === id)!
                        .question,
                    answer: dataContext.flashcards.find((flashcard) => flashcard.id === id)!.answer
                };
            }),
            dataContext.selectedWords,
            dataContext.selectedPosts,
            dataContext.codeResponses.filter((response) => response.isMarked === false),
            DB_PATH
        );

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

        let totalResponses = dataContext.codeResponses.filter(
            (response) => response.isMarked === true
        );

        // totalResponses = totalResponses.concat(
        parsedResult.forEach((answer, index) => {
            for (const recodedTranscript of answer.recoded_transcript) {
                const sentence = recodedTranscript.segment;
                const coded_word = recodedTranscript.code;
                const postId = dataContext.selectedPosts[index];
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

        dataContext.dispatchCodeResponses({
            type: 'SET_RESPONSES',
            responses: totalResponses
        });

        navigate('/coding/' + ROUTES.CODING_VALIDATION);
    };

    const handleRerunCoding = () => {
        console.log('Re-running coding...');
        navigate(LOADER_ROUTES.CODING_VALIDATION_LOADER);

        // const markedIndexes = dataContext.codeResponses
        //     .map((response, index) => (response.isMarked !== undefined ? index : null))
        //     .filter((index) => index !== null) as number[];

        // const newResponses = dataContext.codeResponses.filter(
        //     (_, index) => !markedIndexes.includes(index)
        // );

        // dataContext.dispatchCodeResponses({
        //     type: 'RERUN_CODING',
        //     indexes: markedIndexes,
        //     newResponses
        // });

        // dataContext.dispatchCodeResponses({
        //     type: 'ADD_RESPONSES',
        //     responses:
        // });

        runWithFeedback();
    };

    const handleOpenReddit = async (postId: string, commentSlice: string) => {
        const link = await ipcRenderer.invoke('get-link-from-post', postId, commentSlice, DB_PATH);

        setSelectedData({ link, text: commentSlice });
    };

    // const handleAllAccept = () => {
    //     // const acceptedResponses = dataContext.codeResponses.map(
    //     //     ({ comment, isMarked, ...rest }) => ({
    //     //         ...rest
    //     //     })
    //     // );

    //     // dataContext.dispatchFinalCodeResponses({
    //     //     type: 'ADD_RESPONSES',
    //     //     responses: acceptedResponses
    //     // });

    //     // dataContext.dispatchCodeResponses({
    //     //     type: 'REMOVE_RESPONSES',
    //     //     all: true
    //     // });
    //     console.log('All accepted');
    //     dataContext.dispatchCodeResponses({
    //         type: 'SET_ALL_CORRECT'
    //     });

    //     // navigate(ROUTES.FINAL);
    // };

    // const handleRejectAll = () => {
    //     // runWithFeedback();
    //     console.log('All rejected');
    //     dataContext.dispatchCodeResponses({
    //         type: 'SET_ALL_INCORRECT'
    //     });
    // };

    const handleToggleAllSelectOrReject = (isSelect: boolean) => {
        const alreadySetToTarget = dataContext.codeResponses.every(
            (response) => response.isMarked === (isSelect ? true : false)
        );

        const finalDecision = alreadySetToTarget ? undefined : isSelect;

        if (finalDecision === undefined) {
            dataContext.dispatchCodeResponses({
                type: 'SET_ALL_UNMARKED'
            });
        } else {
            dataContext.dispatchCodeResponses({
                type: finalDecision ? 'SET_ALL_CORRECT' : 'SET_ALL_INCORRECT'
            });
        }
    };

    const handleNextClick = async () => {
        // dataContext.dispatchFinalCodeResponses({
        //     type: 'ADD_RESPONSES',
        //     responses: dataContext.codeResponses
        //         .filter(({ isMarked }) => isMarked === true)
        //         .map(({ comment, isMarked, ...rest }) => ({
        //             ...rest
        //         }))
        // });
    };

    const isReadyCheck = dataContext.codeResponses.some(
        (response) => response.isMarked !== undefined
    );

    useEffect(() => {
        console.log('Code Responses:', dataContext.codeResponses);
    }, [dataContext.codeResponses]);

    return (
        <div className="flex flex-col justify-between h-full">
            <div>
                <p>Please validate the following codings done by LLM </p>
                <div className="max-h-[calc(100vh-15rem)] overflow-auto mt-4 border border-gray-400 rounded-lg">
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
                            {dataContext.codeResponses.map((response, index) => (
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
                                    <td className="border border-gray-400 p-2 max-w-32">
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
                    {/* <button
                        className={`bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 cursor-pointer
                        ${dataContext.codeResponses.length !== 0 ? '' : 'cursor-not-allowed opacity-75'}`}
                        onClick={handleAllAccept}
                        disabled={dataContext.codeResponses.length === 0}>
                        Accept All
                    </button> */}
                    <button
                        onClick={handleRerunCoding}
                        disabled={!isReadyCheck}
                        className={`bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600  cursor-pointer${
                            isReadyCheck ? '' : 'cursor-not-allowed opacity-75'
                        }`}>
                        Re-run coding with changes
                    </button>
                    {/* <button
                        className={`bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600
                        ${dataContext.codeResponses.length !== 0 ? '' : 'cursor-not-allowed opacity-75'}`}
                        disabled={dataContext.codeResponses.length === 0}
                        onClick={handleRejectAll}>
                        Reject All
                    </button> */}
                </div>
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.INITIAL_CODING}
                nextPage={ROUTES.FINAL}
                isReady={isReadyCheck}
                onNextClick={handleNextClick}
            />
            {selectedData.link.length > 0 && (
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

export default CodingValidationPage;
