import { FC, useEffect, useState } from 'react';
import PaginationControls from './pagination-control';
import RedditTable from './reddit-table';
import { RedditPosts, SetState } from '../../types/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';
import { DEBOUNCE_DELAY, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';
import { useWorkspaceContext } from '../../context/workspace-context';
import { TORRENT_START_DATE, TORRENT_END_DATE } from '../../constants/DataCollection/shared';
import useDebounce from '../../hooks/Shared/use-debounce';

type RedditTableRendererProps = {
    maxTableHeightClass?: string;
    maxContainerHeight?: string;
    selectedData?: string[];
    setSelectedData?: SetState<string[]>;
};

const RedditTableRenderer: FC<RedditTableRendererProps> = ({
    selectedData = [],
    setSelectedData = () => {}
}) => {
    const [posts, setPosts] = useState<RedditPosts>({});
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [searchTerm, setSearchTerm] = useState('');
    const [minDate, setMinDate] = useState('');
    const [maxDate, setMaxDate] = useState('');

    const [metadata, setMetadata] = useState<{
        subreddit?: string;
        start_date?: string;
        end_date?: string;
    }>({});

    const [isLoading, setIsLoading] = useState(false);
    const [isSelectingAll, setIsSelectingAll] = useState(false);

    const location = useLocation();
    const { fetchData } = useApi();
    const { isLocked, setIsLocked, dataFilters, setDataFilters } = useCollectionContext();
    const { checkIfDataExists, openModal, abortRequests, resetDataAfterPage } = useLoadingContext();
    const { currentWorkspace } = useWorkspaceContext();

    console.log('RedditTableRenderer mounted', dataFilters);

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so +1
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getStartDate(yearMonth) {
        const [year, month] = yearMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return formatDate(date);
    }

    function getEndDate(yearMonth) {
        const [year, month] = yearMonth.split('-').map(Number);
        const date = new Date(year, month, 0);
        return formatDate(date);
    }

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [pendingFilterStartTime, setPendingFilterStartTime] = useState<string>(
        dataFilters?.reddit?.start_time ?? ''
    );
    const [pendingFilterEndTime, setPendingFilterEndTime] = useState<string>(
        dataFilters?.reddit?.end_time ?? ''
    );
    const [pendingFilterHideRemoved, setPendingFilterHideRemoved] = useState<boolean>(
        dataFilters?.reddit?.hide_removed ?? false
    );

    useEffect(() => {
        if (dataFilters.reddit?.start_time) {
            setPendingFilterStartTime(getStartDate(dataFilters.reddit.start_time));
        } else {
            setPendingFilterStartTime('');
        }

        if (dataFilters.reddit?.end_time) {
            setPendingFilterEndTime(getEndDate(dataFilters.reddit.end_time));
        } else {
            setPendingFilterEndTime('');
        }

        if (dataFilters.reddit?.hide_removed) {
            setPendingFilterHideRemoved(dataFilters.reddit.hide_removed);
        } else {
            setPendingFilterHideRemoved(false);
        }
    }, [dataFilters]);

    const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY);
    const { scrollRef: tableRef } = useScrollRestoration(`validation-table-page-${currentPage}`);

    const fetchPosts = async () => {
        setIsLoading(true);
        const startTime = dataFilters.reddit?.start_time
            ? Math.floor(new Date(dataFilters.reddit.start_time).getTime() / 1000)
            : undefined;
        const endTime = dataFilters.reddit?.end_time
            ? Math.floor(new Date(dataFilters.reddit.end_time).getTime() / 1000)
            : undefined;

        const offset = (currentPage - 1) * itemsPerPage;
        const batch = itemsPerPage;

        const requestBody = {
            workspace_id: currentWorkspace!.id,
            all: false,
            search_term: debouncedSearchTerm,
            start_time: startTime,
            end_time: endTime,
            hide_removed: dataFilters.reddit?.hide_removed || false,
            offset: offset,
            batch: batch,
            page: currentPage,
            items_per_page: itemsPerPage
        };

        const response = await fetchData(REMOTE_SERVER_ROUTES.GET_REDDIT_POSTS_BY_BATCH, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        if (response.error) {
            console.error('Error fetching posts:', response.error);
            setPosts({});
            setTotalCount(0);
            setMinDate(getStartDate(TORRENT_START_DATE));
            setMaxDate(getEndDate(TORRENT_END_DATE));
            setMetadata({});
        } else {
            setPosts(response.data.posts || {});
            setTotalCount(response.data.total_count || 0);
            setMinDate(response.data.start_date || getStartDate(TORRENT_START_DATE));
            setMaxDate(response.data.end_date || getEndDate(TORRENT_END_DATE));
            setMetadata(response.data.metadata || {});
        }
        setIsLoading(false);
    };

    const fetchAllMatchingPostIds = async (): Promise<string[]> => {
        setIsLoading(true);
        const startTime = dataFilters.reddit?.start_time
            ? Math.floor(new Date(dataFilters.reddit.start_time).getTime() / 1000)
            : undefined;
        const endTime = dataFilters.reddit?.end_time
            ? Math.floor(new Date(dataFilters.reddit.end_time).getTime() / 1000)
            : undefined;

        const requestBody = {
            workspace_id: currentWorkspace!.id,
            batch: 0,
            offset: 0,
            all: true,
            search_term: debouncedSearchTerm,
            start_time: startTime,
            end_time: endTime,
            hide_removed: dataFilters.reddit?.hide_removed || false,
            page: 1,
            items_per_page: 10,
            get_all_ids: true
        };

        const response = await fetchData(REMOTE_SERVER_ROUTES.GET_REDDIT_POSTS_BY_BATCH, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        setIsLoading(false);
        if (response.error) {
            console.error('Error fetching all post IDs:', response.error);
            return [];
        }
        return response.data.post_ids || [];
    };

    const toggleSelectAll = async () => {
        if (isLocked) return;

        if (selectedData.length === totalCount) {
            await setSelectedData([]);
        } else {
            setIsSelectingAll(true);
            try {
                const allIds = await fetchAllMatchingPostIds();
                await setSelectedData(allIds);
            } catch (error) {
                console.error('Error selecting all posts:', error);
            } finally {
                setIsSelectingAll(false);
            }
        }
    };

    useEffect(() => {
        console.log('Fetching posts with filters:', dataFilters);
        fetchPosts();
    }, [
        debouncedSearchTerm,
        dataFilters?.reddit?.start_time,
        dataFilters?.reddit?.end_time,
        dataFilters?.reddit?.hide_removed,
        currentPage,
        itemsPerPage
    ]);

    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };
    const handlePreviousPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };
    const handlePageNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const page = parseInt(e.target.value, 10);
        if (page > 0 && page <= totalPages) setCurrentPage(page);
    };
    const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(parseInt(e.target.value, 10));
        setCurrentPage(1);
    };

    const togglePostSelection = (id: string) => {
        if (isLocked) return;
        setSelectedData((prev) =>
            prev.includes(id) ? prev.filter((postId) => postId !== id) : [...prev, id]
        );
    };

    const toggleSelectPage = (pageData: [string, RedditPosts[string]][]) => {
        if (isLocked) return;
        const pageIds = pageData.map(([id]) => id);
        const allSelected = pageIds.every((id) => selectedData.includes(id));
        setSelectedData((prev) =>
            allSelected
                ? prev.filter((id) => !pageIds.includes(id))
                : [...new Set([...prev, ...pageIds])]
        );
    };

    const handleApplyFilters = () => {
        setDataFilters((prev) => ({
            ...prev,
            reddit: {
                start_time: pendingFilterStartTime,
                end_time: pendingFilterEndTime,
                hide_removed: pendingFilterHideRemoved
            }
        }));
        setIsFilterModalOpen(false);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setDataFilters((prev) => ({ ...prev, reddit: {} }));
        setPendingFilterStartTime('');
        setPendingFilterEndTime('');
        setPendingFilterHideRemoved(false);
        setCurrentPage(1);
    };

    const handleLockDataset = () => {
        if (selectedData.length > 0) setIsLocked(true);
    };

    const handleUnlockDataset = async () => {
        const dataExists = await checkIfDataExists(location.pathname);
        if (dataExists) {
            openModal('unlock-dataset-btn', async () => {
                abortRequests(location.pathname);
                await resetDataAfterPage(location.pathname);
                setIsLocked(false);
            });
        } else {
            abortRequests(location.pathname);
            setIsLocked(false);
        }
    };

    const displayedData = Object.entries(posts).sort((a, b) => a[1].created_utc - b[1].created_utc);

    const selectAllLabel = selectedData.length === totalCount ? 'Deselect All' : 'Select All';

    return (
        <div className={`flex flex-col h-full`}>
            <div className="mb-4 flex items-center justify-between bg-gray-100 p-4 rounded">
                <input
                    id="reddit-table-search"
                    type="text"
                    placeholder="Search by title, text, or URL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2 border border-gray-300 rounded flex-grow mr-4"
                />
                <button
                    onClick={toggleSelectAll}
                    className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 mr-4 flex items-center justify-center"
                    disabled={isLocked || isSelectingAll}>
                    {isSelectingAll ? (
                        <div role="status">
                            <svg
                                aria-hidden="true"
                                className="w-6 h-6 text-white animate-spin fill-gray-500"
                                viewBox="0 0 100 101"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                    fill="currentColor"
                                />
                                <path
                                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                    fill="currentFill"
                                />
                            </svg>
                        </div>
                    ) : (
                        selectAllLabel
                    )}
                </button>
                <button
                    id="reddit-table-filter-button"
                    onClick={() => setIsFilterModalOpen(true)}
                    className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600 mr-4">
                    Filters
                </button>
                <div className="flex items-center mr-4">
                    <label htmlFor="itemsPerPage" className="mr-2">
                        Rows:
                    </label>
                    <select
                        id="itemsPerPage"
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        className="p-2 border border-gray-300 rounded">
                        {[10, 20, 50, 100, 1000].map((limit) => (
                            <option key={limit} value={limit}>
                                {limit}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center">
                    <label htmlFor="pageNumber" className="mr-2">
                        Page:
                    </label>
                    <input
                        id="pageNumber"
                        type="number"
                        value={currentPage}
                        onChange={handlePageNumberChange}
                        min={1}
                        max={totalPages}
                        className="p-2 border border-gray-300 rounded w-16"
                    />
                    <span className="ml-2">of {totalPages}</span>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-between bg-gray-100 p-4 rounded">
                <p>Subreddit name: {metadata.subreddit ?? 'Unknown'}</p>
                <p>
                    Date range: {metadata.start_date ?? 'Unknown'} to{' '}
                    {metadata.end_date ?? 'Unknown'}
                </p>
                <p>
                    Total posts: {totalCount} ({Object.keys(posts).length} loaded)
                </p>
            </div>

            {isFilterModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                    <div className="bg-white p-6 rounded shadow-lg w-11/12 sm:w-1/2 relative">
                        <button
                            onClick={() => setIsFilterModalOpen(false)}
                            className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-xl font-bold"
                            aria-label="Close Filters">
                            ×
                        </button>
                        <h2 className="text-xl mb-4">Filters</h2>
                        <div className="mb-4">
                            <label className="block mb-1">Start Date:</label>
                            <input
                                type="date"
                                min={minDate}
                                max={maxDate}
                                value={pendingFilterStartTime}
                                onChange={(e) => setPendingFilterStartTime(e.target.value)}
                                className="p-2 border border-gray-300 rounded w-full"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block mb-1">End Date:</label>
                            <input
                                type="date"
                                value={pendingFilterEndTime}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setPendingFilterEndTime(e.target.value)}
                                className="p-2 border border-gray-300 rounded w-full"
                            />
                        </div>
                        <div className="mb-4 flex items-center">
                            <input
                                type="checkbox"
                                checked={pendingFilterHideRemoved}
                                onChange={(e) => setPendingFilterHideRemoved(e.target.checked)}
                                className="form-checkbox"
                                id="hideRemovedCheckbox"
                            />
                            <label htmlFor="hideRemovedCheckbox" className="ml-2">
                                Hide posts with [removed] or [deleted]
                            </label>
                        </div>
                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={handleResetFilters}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                                Reset Filters
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto" ref={tableRef}>
                <RedditTable
                    data={displayedData}
                    isLoading={isLoading}
                    selectedPosts={selectedData}
                    togglePostSelection={togglePostSelection}
                    toggleSelectPage={toggleSelectPage}
                    itemsPerPage={itemsPerPage}
                />
            </div>

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={handleNextPage}
                onPrevious={handlePreviousPage}
                loading={isLoading}
                locked={isLocked || isSelectingAll}
                onLock={handleLockDataset}
                onUnlock={handleUnlockDataset}
                selectedCount={selectedData.length}
            />
        </div>
    );
};

export default RedditTableRenderer;
