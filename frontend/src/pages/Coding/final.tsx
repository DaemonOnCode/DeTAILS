import { useContext, useEffect, useRef, useState } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { DB_PATH, ROUTES } from '../../constants/Coding/shared';
import { IFinalCodeResponse } from '../../types/Coding/shared';
import RedditViewModal from '../../components/Coding/Shared/reddit-view-modal';
import { DataContext } from '../../context/data-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const { ipcRenderer } = window.require('electron');

const FinalPage = () => {
    const { subreddit, datasetId } = useCollectionContext();
    const { themes, sampledPostResponse, unseenPostResponse } = useCodingContext();

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

    const getThemeByCode = (code: string) => {
        for (const themeObj of themes) {
            if (themeObj.codes.includes(code)) {
                return themeObj.name;
            }
        }
        return 'Unknown Theme'; // Default if no match is found
    };

    // Combine sampled and unseen posts for table
    const finalCodeResponses = [
        ...sampledPostResponse.map((post) => ({
            postId: post.postId,
            quote: post.quote,
            coded_word: post.code,
            reasoning: post.explanation,
            theme: getThemeByCode(post.code),
            id: post.id // Keep ID for modal reference
        })),
        ...unseenPostResponse.map((post) => ({
            postId: post.postId,
            quote: post.quote,
            coded_word: post.code,
            reasoning: post.explanation,
            theme: getThemeByCode(post.code),
            id: post.id
        }))
    ];

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
                                <th className="border border-gray-400 p-2">Post ID</th>
                                <th className="border border-gray-400 p-2">Quote</th>
                                <th className="border border-gray-400 p-2">Code</th>
                                <th className="border border-gray-400 p-2">Theme</th>
                                <th className="border border-gray-400 p-2">Explanation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalCodeResponses.map((item, index) => (
                                <tr key={index} className="text-center">
                                    <td className="border border-gray-400 p-2">
                                        <button
                                            onClick={() =>
                                                setRenderedPost({
                                                    id: item.postId,
                                                    link: `https://reddit.com/${item.postId}`,
                                                    sentence: item.quote
                                                })
                                            }
                                            className="text-blue-500 underline">
                                            {item.postId}
                                        </button>
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-md">
                                        {item.quote}
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-32">
                                        {item.coded_word}
                                    </td>
                                    <td className="border border-gray-400 p-2 max-w-32">
                                        {item.theme}
                                    </td>
                                    <td className="border border-gray-400 p-2 min-w-96">
                                        {item.reasoning}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reddit Post Modal */}
            {renderedPost.link !== '' && (
                <RedditViewModal
                    isViewOpen={renderedPost.link !== ''}
                    postLink={renderedPost?.link}
                    postText={renderedPost?.sentence}
                    postId={renderedPost?.id}
                    closeModal={() =>
                        setRenderedPost({
                            id: '',
                            link: '',
                            sentence: ''
                        })
                    }
                />
            )}

            {/* Navigation */}
            <NavigationBottomBar previousPage={ROUTES.ENCODED_DATA} />
        </div>
    );
};

export default FinalPage;
