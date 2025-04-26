import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import NavigationBottomBar from '../../components/Coding/Shared/navigation-bottom-bar';
import RedditViewModal from '../../components/Shared/reddit-view-modal';
import { PAGE_ROUTES } from '../../constants/Coding/shared';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

import { PostDetailedTable, PostDetailRow } from '../../components/Coding/Report/post-detailed';
import { PostSummaryTable, PostSummaryRow } from '../../components/Coding/Report/post-summary';
import { CodeDetailedTable, CodeDetailRow } from '../../components/Coding/Report/code-detailed';
import { CodeSummaryTable, CodeSummaryRow } from '../../components/Coding/Report/code-summary';
import { useApi } from '../../hooks/Shared/use-api';
import { downloadFileWithStreaming } from '../../utility/file-downloader';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';

const PAGE_SIZE = 20;

const ReportPage: React.FC = () => {
    const [viewType, setViewType] = useState<'post' | 'code'>('post');
    const [summaryView, setSummaryView] = useState(false);

    const isCodeView = viewType === 'code';
    const isSummaryView = summaryView;

    const location = useLocation();

    const [rows, setRows] = useState<any[]>([]);
    const [hasNext, setHasNext] = useState(true);
    const [loading, setLoading] = useState(false);

    const pageRef = useRef(1);
    const loadingRef = useRef(false);
    const nextRef = useRef(true);

    const { loadingState } = useLoadingContext();
    const stepRoute = location.pathname;

    const [overallStats, setOverallStats] = useState<{
        totalUniquePosts: number;
        totalUniqueCodes: number;
        totalQuoteCount: number;
    } | null>(null);

    const { fetchData } = useApi();

    const fetchPage = useCallback(async () => {
        if (loadingRef.current || !nextRef.current) return;
        loadingRef.current = true;
        setLoading(true);

        try {
            const { data } = await fetchData(REMOTE_SERVER_ROUTES.GET_ANALYSIS_REPORT, {
                method: 'POST',
                body: JSON.stringify({
                    page: pageRef.current,
                    pageSize: PAGE_SIZE,
                    viewType,
                    summary: summaryView
                })
            });
            setRows((r) => [...r, ...data.rows]);
            nextRef.current = data.meta.hasNext;
            setHasNext(data.meta.hasNext);
            pageRef.current += 1;
            setOverallStats(data.overallStats);
        } catch (err) {
            console.error('Fetch page error', err);
            toast.error('Failed to load data');
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [viewType, summaryView]);

    useEffect(() => {
        pageRef.current = 1;
        loadingRef.current = false;
        nextRef.current = true;

        setRows([]);
        setHasNext(true);
        setLoading(false);

        fetchPage();
    }, [fetchPage]);

    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => entries[0].isIntersecting && fetchPage(),
            { root: containerRef.current, threshold: 1.0 }
        );
        if (sentinelRef.current) obs.observe(sentinelRef.current);
        return () => obs.disconnect();
    }, [fetchPage]);

    const handleDownloadData = useCallback(async () => {
        const payload = {
            viewType,
            summary: summaryView
        };
        const suggestedName = `${viewType}_${summaryView ? 'summary' : 'detailed'}_analysis.csv`;
        await downloadFileWithStreaming(
            fetchData,
            REMOTE_SERVER_ROUTES.DOWNLOAD_ANALYSIS_REPORT,
            payload,
            suggestedName
        );
    }, [viewType, summaryView]);

    const [modal, setModal] = useState({ id: '', link: '', sentence: '' });
    const handleViewPost = (id: string) => setModal({ id, link: '', sentence: '' });

    if (loadingState[stepRoute]?.isFirstRun) {
        return (
            <p className="h-page w-full flex justify-center items-center">
                Please complete the previous page and click on proceed to continue with this page.
            </p>
        );
    }

    return (
        <div className="h-page flex flex-col justify-between">
            <header>
                <h2 className="text-xl font-bold mb-4">Analysis Page</h2>
                <div className="flex flex-col sm:flex-row justify-evenly items-center mb-4 ">
                    <div className="flex text-center justify-center items-center p-2 lg:p-4 gap-x-2">
                        <span
                            className={`cursor-pointer select-none ${
                                !isCodeView ? 'font-bold text-blue-500' : 'text-gray-700'
                            }`}
                            onClick={() => setViewType('post')}>
                            Post View
                        </span>

                        <label
                            htmlFor="toggleViewCode"
                            className="relative inline-block w-6 lg:w-12 h-3 lg:h-6 cursor-pointer">
                            <input
                                id="toggleViewCode"
                                type="checkbox"
                                className="sr-only"
                                checked={isCodeView}
                                onChange={() =>
                                    setViewType((v) => (v === 'post' ? 'code' : 'post'))
                                }
                            />
                            <div className="block bg-gray-300 w-6 lg:w-12 h-3 lg:h-6 rounded-full"></div>
                            <div
                                className={`dot absolute left-0.5 lg:left-1 top-0.5 lg:top-1 bg-white w-2 lg:w-4 h-2 lg:h-4 rounded-full transition-transform ${
                                    isCodeView ? 'translate-x-3 lg:translate-x-6 bg-blue-500' : ''
                                }`}></div>
                        </label>

                        <span
                            className={`cursor-pointer select-none ${
                                isCodeView ? 'font-bold text-blue-500' : 'text-gray-700'
                            }`}
                            onClick={() => setViewType('code')}>
                            Code View
                        </span>
                    </div>

                    <button
                        className="min-w-32 px-4 py-2 bg-blue-500 text-white rounded"
                        onClick={handleDownloadData}>
                        Download Data
                    </button>

                    <div className="flex text-center justify-center items-center p-2 lg:p-4 gap-x-2">
                        <span
                            className={`cursor-pointer select-none ${
                                !isSummaryView ? 'font-bold text-blue-500' : 'text-gray-700'
                            }`}
                            onClick={() => setSummaryView(false)}>
                            Detailed View
                        </span>

                        <label
                            htmlFor="toggleViewDetails"
                            className="relative inline-block w-6 lg:w-12 h-3 lg:h-6 cursor-pointer">
                            <input
                                id="toggleViewDetails"
                                type="checkbox"
                                className="sr-only"
                                checked={isSummaryView}
                                onChange={() => setSummaryView((s) => !s)}
                            />
                            <div className="block bg-gray-300 w-6 lg:w-12 h-3 lg:h-6 rounded-full"></div>
                            <div
                                className={`dot absolute left-0.5 lg:left-1 top-0.5 lg:top-1 bg-white w-2 lg:w-4 h-2 lg:h-4 rounded-full transition-transform ${
                                    isSummaryView
                                        ? 'translate-x-3 lg:translate-x-6 bg-blue-500'
                                        : ''
                                }`}></div>
                        </label>

                        <span
                            className={`cursor-pointer select-none ${
                                isSummaryView ? 'font-bold text-blue-500' : 'text-gray-700'
                            }`}
                            onClick={() => setSummaryView(true)}>
                            Summary View
                        </span>
                    </div>
                </div>
            </header>

            <main ref={containerRef} className="flex-1 overflow-auto space-y-4">
                {viewType === 'post' ? (
                    isSummaryView ? (
                        <PostSummaryTable
                            rows={rows as PostSummaryRow[]}
                            overallStats={overallStats}
                            onViewPost={handleViewPost}
                        />
                    ) : (
                        <PostDetailedTable
                            rows={rows as PostDetailRow[]}
                            onViewPost={handleViewPost}
                        />
                    )
                ) : isSummaryView ? (
                    <CodeSummaryTable rows={rows as CodeSummaryRow[]} overallStats={overallStats} />
                ) : (
                    <CodeDetailedTable rows={rows as CodeDetailRow[]} onViewPost={handleViewPost} />
                )}

                <div ref={sentinelRef} style={{ height: 1 }} />

                {loading && <div className="text-center py-2">Loading…</div>}
            </main>

            {modal.id && (
                <RedditViewModal
                    isViewOpen
                    postLink={modal.link}
                    postText={modal.sentence}
                    postId={modal.id}
                    closeModal={() => setModal({ id: '', link: '', sentence: '' })}
                />
            )}

            <footer>
                <NavigationBottomBar previousPage={PAGE_ROUTES.GENERATING_THEMES} />
            </footer>
        </div>
    );
};

export default ReportPage;
