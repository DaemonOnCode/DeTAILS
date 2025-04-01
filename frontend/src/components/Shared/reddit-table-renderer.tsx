import { FC, useEffect, useState } from 'react';
import PaginationControls from './pagination-control';
import RedditTable from './reddit-table';
import { RedditPosts, SetState } from '../../types/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';
import { useWorkspaceContext } from '../../context/workspace-context';

type RedditTableRendererProps = {
    maxTableHeightClass?: string;
    maxContainerHeight?: string;
    selectedData?: string[];
    setSelectedData?: SetState<string[]>;
};

const useDebounce = (value: string, delay: number): string => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

const RedditTableRenderer: FC<RedditTableRendererProps> = ({
    maxContainerHeight = 'min-h-page',
    maxTableHeightClass,
    selectedData = [],
    setSelectedData = () => {}
}) => {
    const [posts, setPosts] = useState<RedditPosts>({});
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [searchTerm, setSearchTerm] = useState('');
    // const [appliedStartTime, setAppliedStartTime] = useState('');
    // const [appliedEndTime, setAppliedEndTime] = useState('');
    // const [appliedHideRemoved, setAppliedHideRemoved] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    const location = useLocation();
    const { fetchData } = useApi();
    const { datasetId, isLocked, setIsLocked, dataFilters, setDataFilters } =
        useCollectionContext();
    const { checkIfDataExists, openModal, abortRequests, resetDataAfterPage } = useLoadingContext();
    const { currentWorkspace } = useWorkspaceContext();

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [pendingFilterStartTime, setPendingFilterStartTime] = useState(
        dataFilters.reddit?.start_time || ''
    );
    const [pendingFilterEndTime, setPendingFilterEndTime] = useState(
        dataFilters.reddit?.end_time || ''
    );
    const [pendingFilterHideRemoved, setPendingFilterHideRemoved] = useState(
        dataFilters.reddit?.hide_removed || false
    );

    const debouncedSearchTerm = useDebounce(searchTerm, 300);
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
            dataset_id: datasetId,
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
            // setSelectedData([]);
            setTotalCount(0);
        } else {
            setPosts(response.data.posts || {});
            if (selectedData.length === 0) setSelectedData(response.data.selected_post_ids || []);
            // setSelectedData(response.data.selected_post_ids || []);
            setTotalCount(response.data.total_count || 0);
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
            dataset_id: datasetId,
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
            setSelectedData([]);
        } else {
            const allIds = await fetchAllMatchingPostIds();
            setSelectedData(allIds);
        }
    };

    useEffect(() => {
        fetchPosts();
    }, [
        debouncedSearchTerm,
        dataFilters.reddit?.start_time,
        dataFilters.reddit?.end_time,
        dataFilters.reddit?.hide_removed,
        currentPage,
        itemsPerPage,
        datasetId
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
        // setAppliedStartTime(pendingFilterStartTime);
        // setAppliedEndTime(pendingFilterEndTime);
        // setAppliedHideRemoved(pendingFilterHideRemoved);
        setIsFilterModalOpen(false);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setDataFilters((prev) => ({ ...prev, reddit: {} }));
        setPendingFilterStartTime('');
        setPendingFilterEndTime('');
        setPendingFilterHideRemoved(false);
        // setAppliedStartTime('');
        // setAppliedEndTime('');
        // setAppliedHideRemoved(false);
        setCurrentPage(1);
    };

    const handleLockDataset = () => {
        if (selectedData.length > 0) setIsLocked(true);
    };

    const handleUnlockDataset = async () => {
        const dataExists = checkIfDataExists(location.pathname);
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
            {/* Top Bar */}
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
                    className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 mr-4"
                    disabled={isLocked}>
                    {selectAllLabel}
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

            {/* Filter Modal */}
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

            {/* Table */}
            <div className="flex-1 overflow-y-auto" ref={tableRef}>
                <RedditTable
                    data={displayedData}
                    isLoading={isLoading}
                    selectedPosts={selectedData}
                    togglePostSelection={togglePostSelection}
                    toggleSelectPage={toggleSelectPage}
                />
            </div>

            {/* Pagination Controls */}
            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={handleNextPage}
                onPrevious={handlePreviousPage}
                loading={isLoading}
                locked={isLocked}
                onLock={handleLockDataset}
                onUnlock={handleUnlockDataset}
                selectedCount={selectedData.length}
            />
        </div>
    );
};

export default RedditTableRenderer;
