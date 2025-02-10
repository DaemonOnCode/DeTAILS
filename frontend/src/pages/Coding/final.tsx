import { useContext, useEffect, useRef, useState, useMemo } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { DB_PATH, ROUTES } from '../../constants/Coding/shared';
import { IFinalCodeResponse } from '../../types/Coding/shared';
import RedditViewModal from '../../components/Coding/Shared/reddit-view-modal';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const { ipcRenderer } = window.require('electron');

/** Helper to group items by postId. */
function groupByPostId<T extends { postId: string }>(items: T[]): Record<string, T[]> {
    return items.reduce(
        (acc, item) => {
            if (!acc[item.postId]) {
                acc[item.postId] = [];
            }
            acc[item.postId].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    );
}

const FinalPage = () => {
    const { subreddit, datasetId } = useCollectionContext();
    const { themes, sampledPostResponse, unseenPostResponse } = useCodingContext();
    const [renderedPost, setRenderedPost] = useState<{
        id: string;
        link: string;
        sentence: string;
    }>({ id: '', link: '', sentence: '' });

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

    // For "View Post" (Reddit Modal)
    const handleViewPost = async (postId: string, sentence: string) => {
        const link = undefined;
        // await ipcRenderer.invoke(
        //     'get-link-from-post',
        //     postId,
        //     sentence,
        //     datasetId,
        //     DB_PATH
        // );

        console.log('Viewing post:', postId, link, sentence);
        setRenderedPost({
            id: postId,
            link: link ?? `https://www.reddit.com/r/${subreddit}/comments/${postId}`,
            sentence
        });
    };

    // Helper: find theme by code
    const getThemeByCode = (code: string) => {
        for (const themeObj of themes) {
            if (themeObj.codes.includes(code)) {
                return themeObj.name;
            }
        }
        return 'Unknown Theme';
    };

    // Combine sampled & unseen post data
    const finalCodeResponses = [
        ...sampledPostResponse.map((post) => ({
            postId: post.postId,
            quote: post.quote,
            coded_word: post.code,
            reasoning: post.explanation,
            theme: getThemeByCode(post.code),
            id: post.id
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

    // Group by postId
    const grouped = useMemo(() => groupByPostId(finalCodeResponses), [finalCodeResponses]);
    const allPostIds = Object.keys(grouped);

    // If no data
    if (finalCodeResponses.length === 0) {
        return (
            <div className="h-page flex flex-col justify-between">
                <div>
                    <h2 className="text-xl font-bold mb-4">Final Page</h2>
                    <p className="mb-6">No data found.</p>
                </div>
                <NavigationBottomBar previousPage={ROUTES.ENCODED_DATA} />
            </div>
        );
    }

    // We'll have 4 columns: Code, Theme, Quote, Explanation
    // But we no longer show "Post ID" as a column in the main <thead>
    // because we show it in a "subheader" row (like the ValidationTable approach).
    let totalColumns = 4; // Code, Theme, Quote, Explanation

    return (
        <div className="h-page flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-bold mb-4">Final Page</h2>
                <p className="mb-6">
                    Below is the data extracted from Reddit posts with related words and contexts:
                </p>

                {/* Outer border container */}
                <div className="relative border border-gray-300 rounded-lg">
                    {/* Scrollable area */}
                    <div className="overflow-auto max-h-[calc(100vh-13rem)]">
                        <table className="w-full border-collapse relative">
                            {/* Sticky main table header: Code, Theme, Quote, Explanation */}
                            <thead className="sticky top-0 z-30 bg-gray-200 border-b-2 border-gray-400 shadow-md">
                                <tr>
                                    <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                        Code
                                    </th>
                                    <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                        Theme
                                    </th>
                                    <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                        Quote
                                    </th>
                                    <th className="p-2 border border-gray-400 bg-gray-200 outline outline-1 outline-gray-400">
                                        Explanation
                                    </th>
                                </tr>
                            </thead>

                            {/* For each postId group, render a subheader row and the group's rows */}
                            {allPostIds.map((pid) => {
                                const rows = grouped[pid];
                                return (
                                    <tbody key={pid}>
                                        {/* Subheader row for Post ID, sticky below main thead.
                        Adjust top offset if your thead is larger or smaller. */}
                                        <tr className="sticky top-[36px] bg-gray-50 z-20 border-b border-gray-300">
                                            <td
                                                colSpan={totalColumns}
                                                className="p-2 font-semibold border border-gray-300 outline outline-1 outline-gray-300 bg-gray-50">
                                                <button
                                                    onClick={() => {
                                                        handleViewPost(pid, '');
                                                    }}
                                                    className="text-blue-500 underline">
                                                    Post ID: {pid}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Rows for this postId */}
                                        {rows.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="border border-gray-400 p-2 max-w-32">
                                                    {item.coded_word}
                                                </td>
                                                <td className="border border-gray-400 p-2 max-w-32">
                                                    {item.theme}
                                                </td>
                                                <td className="border border-gray-400 p-2 max-w-md">
                                                    {item.quote}
                                                </td>
                                                <td className="border border-gray-400 p-2 min-w-96">
                                                    {item.reasoning}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>
                </div>
            </div>

            {/* Reddit Post Modal */}
            {renderedPost.link !== '' && (
                <RedditViewModal
                    isViewOpen={renderedPost.link !== ''}
                    postLink={renderedPost.link}
                    postText={renderedPost.sentence}
                    postId={renderedPost.id}
                    closeModal={() => setRenderedPost({ id: '', link: '', sentence: '' })}
                />
            )}

            <NavigationBottomBar previousPage={ROUTES.ENCODED_DATA} />
        </div>
    );
};

export default FinalPage;
