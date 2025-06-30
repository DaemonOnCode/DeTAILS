import { FC, useCallback, useEffect, useState } from 'react';
import PaginationControls from './pagination-control';
import InterviewTable from './interview-table';
import { useCollectionContext } from '../../context/collection-context';
import { DEBOUNCE_DELAY, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';
import { useLoadingContext } from '../../context/loading-context';
import { useLocation } from 'react-router-dom';
import useScrollRestoration from '../../hooks/Shared/use-scroll-restoration';
import useDebounce from '../../hooks/Shared/use-debounce';
import { useWorkspaceContext } from '../../context/workspace-context';

type InterviewTableRendererProps = {
    selectedData?: any[];
    setSelectedData?: (ids: string[]) => void;
    maxTableHeightClass?: string;
    itemsPerPageOptions?: number[];
};

const InterviewTableRenderer: FC<InterviewTableRendererProps> = ({
    selectedData = [],
    setSelectedData = () => {},
    itemsPerPageOptions = [10, 20, 50, 100]
}) => {
    const [files, setFiles] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageOptions[0]);

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_DELAY);

    const [isLoading, setIsLoading] = useState(false);
    const [isSelectingAll, setIsSelectingAll] = useState(false);

    const location = useLocation();
    const { fetchData } = useApi();
    const { isLocked, setIsLocked } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { checkIfDataExists, openModal, abortRequests, resetDataAfterPage } = useLoadingContext();
    const { scrollRef: tableRef } = useScrollRestoration(`interview-table-page-${currentPage}`);

    const fetchPage = useCallback(async () => {
        setIsLoading(true);
        try {
            const offset = (currentPage - 1) * itemsPerPage;
            const body = {
                workspace_id: currentWorkspace!.id,
                all: false,
                search_term: debouncedSearch || undefined,
                offset,
                batch: itemsPerPage,
                page: currentPage,
                items_per_page: itemsPerPage
            };
            const res = await fetchData(REMOTE_SERVER_ROUTES.GET_INTERVIEW_FILES_BY_BATCH, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            if (res.error) {
                console.error('Error fetching interviews:', res.error);
                setFiles([]);
                setTotalCount(0);
            } else {
                setFiles(Object.values(res.data.interview_files || {}));
                setTotalCount(res.data.total_count || 0);
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearch]);

    const fetchAllIds = useCallback(async (): Promise<string[]> => {
        setIsLoading(true);
        try {
            const body = {
                workspace_id: currentWorkspace!.id,
                all: true,
                search_term: debouncedSearch || undefined
            };
            const res = await fetchData(REMOTE_SERVER_ROUTES.GET_INTERVIEW_FILES_BY_BATCH, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            if (res.error) {
                console.error('Error fetching all interview IDs:', res.error);
                return [];
            }
            return res.data.file_ids || [];
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        fetchPage();
    }, [fetchPage]);

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage((p) => p + 1);
    };
    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage((p) => p - 1);
    };
    const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        if (v >= 1 && v <= totalPages) setCurrentPage(v);
    };
    const handleItemsPerPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    const toggleSelectAll = useCallback(async () => {
        if (isLocked || isSelectingAll) return;
        setIsSelectingAll(true);
        try {
            if (selectedData.length === totalCount) {
                setSelectedData([]);
            } else {
                const allIds = await fetchAllIds();
                setSelectedData(Array.from(new Set([...selectedData, ...allIds])));
            }
        } finally {
            setIsSelectingAll(false);
        }
    }, [isLocked, isSelectingAll, selectedData, totalCount, setSelectedData, fetchAllIds]);

    const toggleFileSelection = useCallback(
        (id: string) => {
            if (isLocked || isSelectingAll) return;
            // @ts-ignore
            setSelectedData((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            );
        },
        [isLocked, isSelectingAll, setSelectedData]
    );

    const toggleSelectPage = useCallback(() => {
        if (isLocked || isSelectingAll) return;
        const pageIds = files.map((f) => f.id);
        const allHere = pageIds.every((id) => selectedData.includes(id));
        setIsSelectingAll(true);
        // @ts-ignore
        setSelectedData((prev) =>
            allHere
                ? prev.filter((id) => !pageIds.includes(id))
                : Array.from(new Set([...prev, ...pageIds]))
        );
        setIsSelectingAll(false);
    }, [isLocked, isSelectingAll, files, selectedData, setSelectedData]);

    const handleLock = () => {
        if (selectedData.length > 0) {
            setIsLocked(true);
        }
    };
    const handleUnlock = async () => {
        const exists = await checkIfDataExists(location.pathname);
        if (exists) {
            openModal('unlock-interview-btn', async () => {
                abortRequests(location.pathname);
                await resetDataAfterPage(location.pathname);
                setIsLocked(false);
            });
        } else {
            abortRequests(location.pathname);
            setIsLocked(false);
        }
    };

    const selectAllLabel = selectedData.length === totalCount ? 'Deselect All' : 'Select All';

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4 flex items-center space-x-4">
                <input
                    type="text"
                    placeholder="Search by title or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2 border rounded flex-grow"
                />

                <button
                    onClick={toggleSelectAll}
                    disabled={isLocked || isSelectingAll}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 flex-shrink-0">
                    {isSelectingAll ? 'Loading…' : selectAllLabel}
                </button>

                <div className="flex items-center space-x-2">
                    <label>Rows:</label>
                    <select
                        value={itemsPerPage}
                        onChange={handleItemsPerPage}
                        className="p-2 border rounded">
                        {itemsPerPageOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center space-x-2">
                    <label>Page:</label>
                    <input
                        type="number"
                        value={currentPage}
                        min={1}
                        max={totalPages}
                        onChange={handlePageInput}
                        className="p-2 w-16 border rounded"
                    />
                    <span>/ {totalPages}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto" ref={tableRef}>
                <InterviewTable
                    data={files}
                    selectedFiles={selectedData}
                    toggleFileSelection={toggleFileSelection}
                    toggleSelectPage={() => toggleSelectPage()}
                    isLoading={isLoading}
                    itemsPerPage={itemsPerPage}
                />
            </div>

            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={handleNext}
                onPrevious={handlePrev}
                loading={isLoading || isSelectingAll}
                locked={isLocked}
                onLock={handleLock}
                onUnlock={handleUnlock}
                selectedCount={selectedData.length}
            />
        </div>
    );
};

export default InterviewTableRenderer;
