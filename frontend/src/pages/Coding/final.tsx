import { useContext, useEffect, useRef, useState } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { DB_PATH, ROUTES, exampleData } from '../../constants/Coding/shared';
import { IFinalCodeResponse } from '../../types/Coding/shared';
import RedditViewModal from '../../components/Coding/Shared/reddit_view_modal';
import { DataContext } from '../../context/data_context';
import { useLogger } from '../../context/logging_context';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding_context';
import { useCollectionContext } from '../../context/collection_context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const { ipcRenderer } = window.require('electron');

const FinalPage = () => {
    const { subreddit, datasetId } = useCollectionContext();
    // const { finalCodeResponses } = useCodingContext();

    const [renderedPost, setRenderedPost] = useState<{
        id: string;
        link: string;
        sentence: string;
    }>({
        id: '',
        link: '',
        sentence: ''
    });

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);

    // useEffect(() => {
    //     console.log('Final Page:', finalCodeResponses);
    // }, [finalCodeResponses]);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Final Page');

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Unloaded Final Page').then(() => {
                logger.time('Final Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const handleViewPost = async (post: IFinalCodeResponse) => {
        const link = await ipcRenderer.invoke(
            'get-link-from-post',
            post.postId,
            post.sentence,
            datasetId,
            DB_PATH
        );

        setRenderedPost((prevState) => {
            return {
                ...prevState,
                link: link ?? `https://www.reddit.com/r/${subreddit}/comments/${post.postId}`
            };
        });
    };

    return (
        <div className="h-full flex justify-between flex-col">
            <div>
                <h2 className="text-xl font-bold mb-4">Final Page</h2>
                <p className="mb-6">
                    Below is the data extracted from Reddit posts with related words and contexts:
                </p>

                {/* Table Container */}
                <div className="overflow-auto max-h-[calc(100vh-18rem)] border border-gray-300 rounded-lg">
                    <table className="w-full border-collapse">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="border border-gray-400 p-2">Link</th>
                                <th className="border border-gray-400 p-2">Sentence</th>
                                <th className="border border-gray-400 p-2">Word</th>
                                <th className="border border-gray-400 p-2">Reason</th>
                                {/* <th className="border border-gray-400 p-2">Context</th> */}
                            </tr>
                        </thead>
                        <tbody>
                            {/* {finalCodeResponses.map((item, index) => (
                                <tr key={index} className="text-center">
                                    <td className="border border-gray-400 p-2">
                                        <button
                                            onClick={() => {
                                                handleViewPost(item);
                                            }}
                                            className="text-blue-500 underline">
                                            {item.postId}
                                        </button>
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-md">
                                        {item.sentence}
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-32">
                                        {item.coded_word}
                                    </td>
                                    <td className="border border-gray-400 p-2 min-w-96">
                                        {item.reasoning}
                                    </td>
                                    <td className="border border-gray-400 p-2">{item.context}</td>
                                </tr>
                            ))} */}
                        </tbody>
                    </table>
                </div>
            </div>

            {renderedPost.link !== '' && (
                <RedditViewModal
                    isViewOpen={renderedPost.link !== ''}
                    postLink={renderedPost?.link}
                    postText={renderedPost?.sentence}
                    postId={renderedPost?.id}
                    closeModal={() => {
                        console.log('Closing modal');
                        setRenderedPost({
                            id: '',
                            link: '',
                            sentence: ''
                        });
                    }}
                />
            )}

            <NavigationBottomBar previousPage={ROUTES.FINAL_CODEBOOK} />
        </div>
    );
};

export default FinalPage;
