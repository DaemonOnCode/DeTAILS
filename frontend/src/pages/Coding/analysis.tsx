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
import PostView from '../../components/Coding/Final/post-view';
import CodeView from '../../components/Coding/Final/code-view';

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

function groupByCode<T extends { coded_word: string }>(items: T[]): Record<string, T[]> {
    return items.reduce(
        (acc, item) => {
            if (!acc[item.coded_word]) {
                acc[item.coded_word] = [];
            }
            acc[item.coded_word].push(item);
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
    const [isCodeView, setIsCodeView] = useState(false);

    const toggleView = () => {
        setIsCodeView((prev) => !prev);
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

    const groupedByCode = useMemo(() => groupByCode(finalCodeResponses), [finalCodeResponses]);
    const allCodes = Object.keys(groupedByCode);

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
                <p className="mb-2">
                    Below is the data extracted from Reddit posts with related words and contexts:
                </p>
                <div className="flex justify-center items-center p-4 space-x-2">
                    {/* Left Label: Post View */}
                    <span
                        className={`cursor-pointer select-none ${
                            !isCodeView ? 'font-bold text-blue-500' : 'text-gray-700'
                        }`}
                        onClick={() => setIsCodeView(false)}>
                        Post View
                    </span>

                    {/* Toggle Switch */}
                    <label
                        htmlFor="toggleView"
                        className="relative inline-block w-12 h-6 cursor-pointer">
                        <input
                            id="toggleView"
                            type="checkbox"
                            className="sr-only"
                            checked={isCodeView}
                            onChange={toggleView}
                        />
                        <div className="block bg-gray-300 w-12 h-6 rounded-full"></div>
                        <div
                            className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                isCodeView ? 'translate-x-6 bg-blue-500' : ''
                            }`}></div>
                    </label>

                    {/* Right Label: Code View */}
                    <span
                        className={`cursor-pointer select-none ${
                            isCodeView ? 'font-bold text-blue-500' : 'text-gray-700'
                        }`}
                        onClick={() => setIsCodeView(true)}>
                        Code View
                    </span>
                </div>

                {!isCodeView ? (
                    <PostView
                        allPostIds={allPostIds}
                        grouped={grouped}
                        handleViewPost={handleViewPost}
                        totalColumns={totalColumns}
                    />
                ) : (
                    <CodeView
                        allCodes={allCodes}
                        groupedByCode={groupedByCode}
                        totalColumns={totalColumns}
                        handleViewPost={handleViewPost}
                    />
                )}
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
