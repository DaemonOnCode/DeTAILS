import { useEffect, useRef, useState, useMemo } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { ROUTES } from '../../constants/Coding/shared';
import RedditViewModal from '../../components/Coding/Shared/reddit-view-modal';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import PostView from '../../components/Coding/Analysis/post-view';
import CodeView from '../../components/Coding/Analysis/code-view';

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
    const { datasetId } = useCollectionContext();
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
            link: link ?? '',
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
    const [isSummaryView, setIsSummaryView] = useState(false);

    const toggleView = (type: 'code' | 'details') => {
        if (type === 'details') setIsSummaryView((prev) => !prev);
        else setIsCodeView((prev) => !prev);
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
        ...unseenPostResponse
            // .filter((post) => post.type === 'LLM')
            .map((post) => ({
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

    return (
        <div className="h-page flex flex-col justify-between">
            <header>
                <h2 className="text-xl font-bold mb-4">Analysis Page</h2>
                <div className="flex flex-col sm:flex-row justify-evenly items-center mb-4 ">
                    <div className="flex text-center justify-center items-center p-2 lg:p-4 gap-x-2">
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
                            htmlFor="toggleViewCode"
                            className="relative inline-block w-6 lg:w-12 h-3 lg:h-6 cursor-pointer">
                            <input
                                id="toggleViewCode"
                                type="checkbox"
                                className="sr-only"
                                checked={isCodeView}
                                onChange={() => toggleView('code')}
                            />
                            <div className="block bg-gray-300 w-6 lg:w-12 h-3 lg:h-6 rounded-full"></div>
                            <div
                                className={`dot absolute left-0.5 lg:left-1 top-0.5 lg:top-1 bg-white w-2 lg:w-4 h-2 lg:h-4 rounded-full transition-transform ${
                                    isCodeView ? 'translate-x-3 lg:translate-x-6 bg-blue-500' : ''
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

                    <button className="min-w-32">
                        <a
                            href={`data:text/json;charset=utf-8,${encodeURIComponent(
                                JSON.stringify(
                                    finalCodeResponses.map((codeResponse) => ({
                                        postId: codeResponse.postId,
                                        quote: codeResponse.quote,
                                        code: codeResponse.coded_word,
                                        theme: codeResponse.theme,
                                        explanation: codeResponse.reasoning
                                    }))
                                )
                            )}`}
                            download="final_code_responses.json"
                            className="px-4 py-2 bg-blue-500 text-white rounded">
                            Download Data
                        </a>
                    </button>

                    <div className="flex text-center justify-center items-center p-2 lg:p-4 gap-x-2">
                        {/* Left Label: Detailed View */}
                        <span
                            className={`cursor-pointer select-none ${
                                !isSummaryView ? 'font-bold text-blue-500' : 'text-gray-700'
                            }`}
                            onClick={() => setIsSummaryView(false)}>
                            Detailed View
                        </span>

                        {/* Toggle Switch */}
                        <label
                            htmlFor="toggleViewDetails"
                            className="relative inline-blockw-6 lg:w-12 h-3 lg:h-6  cursor-pointer">
                            <input
                                id="toggleViewDetails"
                                type="checkbox"
                                className="sr-only"
                                checked={isSummaryView}
                                onChange={() => toggleView('details')}
                            />
                            <div className="block bg-gray-300 w-6 lg:w-12 h-3 lg:h-6 rounded-full"></div>
                            <div
                                className={`dot absolute left-0.5 lg:left-1 top-0.5 lg:top-1 bg-white w-2 lg:w-4 h-2 lg:h-4 rounded-full transition-transform ${
                                    isSummaryView
                                        ? 'translate-x-3 lg:translate-x-6 bg-blue-500'
                                        : ''
                                }`}></div>
                        </label>

                        {/* Right Label: Summary View */}
                        <span
                            className={`cursor-pointer select-none ${
                                isSummaryView ? 'font-bold text-blue-500' : 'text-gray-700'
                            }`}
                            onClick={() => setIsSummaryView(true)}>
                            Summary View
                        </span>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-hidden">
                {!isCodeView ? (
                    <PostView
                        allPostIds={allPostIds}
                        grouped={grouped}
                        handleViewPost={handleViewPost}
                        summaryView={isSummaryView}
                    />
                ) : (
                    <CodeView
                        allCodes={allCodes}
                        groupedByCode={groupedByCode}
                        summaryView={isSummaryView}
                        handleViewPost={handleViewPost}
                    />
                )}
            </main>

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

            <footer>
                <NavigationBottomBar previousPage={ROUTES.ENCODED_DATA} />
            </footer>
        </div>
    );
};

export default FinalPage;
