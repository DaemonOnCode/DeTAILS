import { ChangeEvent, FC, useContext, useEffect, useState } from 'react';
import { ROUTES, beforeHumanValidation } from '../constants/shared';
import NavigationBottomBar from '../components/Shared/navigation_bottom_bar';
import { DataContext } from '../context/data_context';
import RedditViewModal from '../components/Shared/reddit_view_modal';

const { ipcRenderer } = window.require('electron');

const CodingValidationPage: FC = () => {
    const dataContext = useContext(DataContext);

    const handleCommentChange = (index: number, event: ChangeEvent<HTMLTextAreaElement>) => {
        dataContext.dispatch({ type: 'UPDATE_COMMENT', index, comment: event.target.value });
    };

    const handleMark = (index: number, isMarked?: boolean) => {
        dataContext.dispatch({ type: 'MARK_RESPONSE', index, isMarked });
    };

    const [selectedData, setSelectedData] = useState<{
        link: string;
        text: string;
    }>({
        link: '',
        text: ''
    });

    useEffect(() => {
        beforeHumanValidation.forEach((answer, index) => {
            let parsedAnswer: {
                unified_codebook: {
                    code: string;
                    description: string;
                    examples: string[];
                }[];
                recoded_transcript: {
                    code: string;
                    segment: string;
                }[];
            } = { unified_codebook: [], recoded_transcript: [] };
            try {
                parsedAnswer = JSON.parse(answer);
            } catch (e) {
                console.log(e);
            }

            for (const recodedTranscript of parsedAnswer.recoded_transcript) {
                const sentence = recodedTranscript.segment;
                const coded_word = recodedTranscript.code;
                const postId = dataContext.selectedPosts[index];
                dataContext.dispatch({
                    type: 'ADD_RESPONSE',
                    response: { sentence, coded_word, postId }
                });
            }
        });
    }, [dataContext.selectedPosts]);

    const handleRerunCoding = () => {
        console.log('Re-running coding...');

        const markedIndexes = dataContext.codeResponses
            .map((response, index) => (response.isMarked !== undefined ? index : null))
            .filter((index) => index !== null) as number[];

        const newResponses = dataContext.codeResponses.filter(
            (_, index) => !markedIndexes.includes(index)
        );

        dataContext.dispatch({
            type: 'RERUN_CODING',
            indexes: markedIndexes,
            newResponses
        });
    };

    const handleOpenReddit = async (postId: string, commentSlice: string) => {
        const link = await ipcRenderer.invoke(
            'get-link-from-post',
            postId,
            commentSlice,
            '../test.db'
        );

        setSelectedData({ link, text: commentSlice });
    };

    const isReadyCheck = dataContext.codeResponses.some(
        (response) => response.isMarked !== undefined
    );

    return (
        <div className="p-6 flex flex-col justify-between h-full">
            <div>
                <p>Please validate the following codings done by LLM </p>
                <div className="max-h-[calc(100vh-15rem)] overflow-auto mt-4 border border-gray-400 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-gray-400 p-2">Link</th>{' '}
                                <th className="border border-gray-400 p-2">Sentence</th>
                                <th className="border border-gray-400 p-2">Word</th>
                                <th className="border border-gray-400 p-2">Actions</th>
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
                                    <td className="border border-gray-400 p-2">
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
                    <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
                        Accept All
                    </button>
                    <button
                        onClick={handleRerunCoding}
                        disabled={!isReadyCheck}
                        className={`bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 ${
                            isReadyCheck ? '' : 'cursor-not-allowed opacity-75'
                        }`}>
                        Re-run coding with changes
                    </button>
                    <button className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
                        Reject All
                    </button>
                </div>
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.INITIAL_CODING}
                nextPage={ROUTES.FINAL}
                isReady={isReadyCheck}
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
