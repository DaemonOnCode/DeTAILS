import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import { PAGE_ROUTES } from '../../constants/Coding/shared';
import RedditViewModal from '../../components/Coding/Shared/reddit-view-modal';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import PostView from '../../components/Coding/Analysis/post-view';
import CodeView from '../../components/Coding/Analysis/code-view';
import { downloadCodebook } from '../../utility/codebook-downloader';
import { groupByCode, groupByPostId } from '../../utility/group-items';
import { getGroupedCodeOfSubCode, getThemeByCode } from '../../utility/theme-finder';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';
import { useLoadingContext } from '../../context/loading-context';

const { ipcRenderer } = window.require('electron');

const FinalPage = () => {
    const { datasetId } = useCollectionContext();
    const { themes, sampledPostResponse, unseenPostResponse, groupedCodes } = useCodingContext();
    const [renderedPost, setRenderedPost] = useState<{
        id: string;
        link: string;
        sentence: string;
    }>({ id: '', link: '', sentence: '' });

    const location = useLocation();
    const { loadingState } = useLoadingContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Final Page');

        return () => {
            // if (!hasSavedRef.current) {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            //     hasSavedRef.current = true;
            // }
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

    const [isCodeView, setIsCodeView] = useState(false);
    const [isSummaryView, setIsSummaryView] = useState(false);

    const toggleView = (type: 'code' | 'details') => {
        if (type === 'details') setIsSummaryView((prev) => !prev);
        else setIsCodeView((prev) => !prev);
    };

    // Combine sampled & unseen post data
    const finalCodeResponses = useMemo(
        () => [
            ...sampledPostResponse.map((post) => ({
                postId: post.postId,
                quote: post.quote,
                coded_word: getGroupedCodeOfSubCode(post.code, groupedCodes),
                reasoning: post.explanation,
                theme: getThemeByCode(post.code, themes, groupedCodes),
                id: post.id
            })),
            ...unseenPostResponse
                // .filter((post) => post.type === 'LLM')
                .map((post) => ({
                    postId: post.postId,
                    quote: post.quote,
                    coded_word: getGroupedCodeOfSubCode(post.code, groupedCodes),
                    reasoning: post.explanation,
                    theme: getThemeByCode(post.code, themes, groupedCodes),
                    id: post.id
                }))
        ],
        [sampledPostResponse, unseenPostResponse, themes, groupedCodes]
    );

    // Group by postId
    const grouped = useMemo(() => groupByPostId(finalCodeResponses), [finalCodeResponses]);
    const allPostIds = Object.keys(grouped);

    const groupedByCode = useMemo(() => groupByCode(finalCodeResponses), [finalCodeResponses]);
    const allCodes = Object.keys(groupedByCode);

    // const handleDownloadCodebook = async () => {
    //     const success = await downloadCodebook(
    //         finalCodeResponses.map((item) => ({
    //             postId: item.postId,
    //             quote: item.quote,
    //             coded_word: item.coded_word,
    //             explanation: item.reasoning,
    //             theme: item.theme
    //         }))
    //     );
    //     if (success) {
    //         toast.success('Codebook downloaded successfully');
    //     } else {
    //         toast.error('Download cancelled or failed');
    //     }
    // };

    const getDetailedCodeData = useCallback(() => {
        const data = [];
        for (const code of allCodes) {
            const rows = groupedByCode[code];
            const theme = rows[0]?.theme || 'Unknown Theme';
            for (const item of rows) {
                data.push({
                    Code: code,
                    Theme: theme,
                    'Post ID': item.postId,
                    Quote: item.quote,
                    Explanation: item.reasoning
                });
            }
        }
        return data;
    }, [allCodes, groupedByCode]);

    const getSummaryCodeData = useCallback(() => {
        const themeGroups = {};
        allCodes.forEach((code) => {
            const rows = groupedByCode[code];
            rows.forEach((item) => {
                const theme = item.theme;
                if (!themeGroups[theme]) {
                    themeGroups[theme] = [];
                }
                themeGroups[theme].push(item);
            });
        });

        const summaryRows = Object.keys(themeGroups).map((themeName) => {
            const items: any[] = themeGroups[themeName];
            const uniquePosts = new Set(items.map((item) => item.postId));
            const uniqueCodes = new Set(items.map((item) => item.coded_word));
            const totalQuoteCount = items.length;
            return [themeName, uniquePosts.size, uniqueCodes.size, totalQuoteCount];
        });

        const overallUniqueThemes = Object.keys(themeGroups).length;
        const overallUniquePosts = new Set();
        const overallUniqueCodes = new Set();
        let overallTotalQuoteCount = 0;
        Object.values(themeGroups).forEach((items: any[]) => {
            overallTotalQuoteCount += items.length;
            items.forEach((item) => {
                overallUniquePosts.add(item.postId);
                overallUniqueCodes.add(item.coded_word);
            });
        });

        const overallStats = [
            ['Overall Stats', 'Value'],
            ['Total Unique Themes', overallUniqueThemes],
            ['Total Unique Posts', overallUniquePosts.size],
            ['Total Code Count', overallUniqueCodes.size],
            ['Total Quote Count', overallTotalQuoteCount]
        ];

        return [
            ['Theme Name', 'Unique Posts Count', 'Unique Codes Count', 'Total Quote Count'],
            ...summaryRows,
            [], // Empty row for separation
            ...overallStats
        ];
    }, [allCodes, groupedByCode]);

    const getDetailedPostData = useCallback(() => {
        const data = [];
        for (const pid of allPostIds) {
            const rows = grouped[pid];
            for (const item of rows) {
                data.push({
                    'Post ID': pid,
                    Code: item.coded_word,
                    Theme: item.theme,
                    Quote: item.quote,
                    Explanation: item.reasoning
                });
            }
        }
        return data;
    }, [allPostIds, grouped]);

    const getSummaryPostData = useCallback(() => {
        const summaryRows = allPostIds.map((pid) => {
            const rows = grouped[pid];
            const uniqueThemes = new Set(rows.map((row) => row.theme));
            const uniqueCodes = new Set(rows.map((row) => row.coded_word));
            const totalQuoteCount = rows.length;
            return [pid, uniqueThemes.size, uniqueCodes.size, totalQuoteCount];
        });

        const overallThemes = new Set();
        const overallCodes = new Set();
        let overallQuoteCount = 0;
        allPostIds.forEach((pid) => {
            const rows = grouped[pid];
            rows.forEach((row) => {
                overallThemes.add(row.theme);
                overallCodes.add(row.coded_word);
            });
            overallQuoteCount += rows.length;
        });

        const overallStats = [
            ['Overall Stats', 'Value'],
            ['Total Unique Themes', overallThemes.size],
            ['Total Unique Codes', overallCodes.size],
            ['Total Quote Count', overallQuoteCount]
        ];

        return [
            ['Post ID', 'Unique Theme Count', 'Unique Code Count', 'Total Quote Count'],
            ...summaryRows,
            [], // Empty row for separation
            ...overallStats
        ];
    }, [allPostIds, grouped]);

    const handleDownloadData = useCallback(async () => {
        console.log('Downloading data...', isCodeView, isSummaryView);
        let data;
        if (isCodeView) {
            if (isSummaryView) {
                data = getSummaryCodeData();
            } else {
                data = getDetailedCodeData();
            }
        } else {
            if (isSummaryView) {
                data = getSummaryPostData();
            } else {
                data = getDetailedPostData();
            }
        }
        const result = await ipcRenderer.invoke('save-csv', {
            data,
            fileName: `${isCodeView ? 'code' : 'post'}_${
                isSummaryView ? 'summary' : 'detailed'
            }_analysis`
        });

        if (result.success) {
            toast.success('Data downloaded successfully');
        } else {
            toast.error('Download cancelled or failed');
        }
    }, [
        isCodeView,
        isSummaryView,
        getSummaryCodeData,
        getDetailedCodeData,
        getSummaryPostData,
        getDetailedPostData
    ]);

    if (loadingState[location.pathname]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    // If no data
    if (finalCodeResponses.length === 0) {
        return (
            <div className="h-page flex flex-col justify-between">
                <div>
                    <h2 className="text-xl font-bold mb-4">Final Page</h2>
                    <p className="mb-6">No data found.</p>
                </div>
                <NavigationBottomBar previousPage={PAGE_ROUTES.THEMES} />
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

                    <button
                        className="min-w-32 px-4 py-2 bg-blue-500 text-white rounded"
                        onClick={handleDownloadData}>
                        Download Data
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
            {renderedPost.id !== '' && (
                <RedditViewModal
                    isViewOpen={renderedPost.id !== ''}
                    postLink={renderedPost.link}
                    postText={renderedPost.sentence}
                    postId={renderedPost.id}
                    closeModal={() => setRenderedPost({ id: '', link: '', sentence: '' })}
                />
            )}

            <footer>
                <NavigationBottomBar previousPage={PAGE_ROUTES.THEMES} />
            </footer>
        </div>
    );
};

export default FinalPage;
