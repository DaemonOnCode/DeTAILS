import { FC, useState } from 'react';
import PaginationControls from './pagination-control';
import RedditTable from './reddit-table';
import { RedditPosts } from '../../types/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';

type RedditTableRendererProps = {
    data: RedditPosts;
    maxTableHeightClass?: string;
    maxContainerHeight?: string;
    loading?: boolean;
};

const RedditTableRenderer: FC<RedditTableRendererProps> = ({
    data,
    maxContainerHeight = 'min-h-page',
    maxTableHeightClass,
    loading
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    const { selectedPosts, setSelectedPosts } = useCollectionContext();

    const filteredData = Object.entries(data).filter(
        ([, { title, selftext, url }]) =>
            title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            selftext.toLowerCase().includes(searchTerm.toLowerCase()) ||
            url.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const displayedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    const handlePreviousPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handlePageNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const page = parseInt(e.target.value, 10);
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(parseInt(e.target.value, 10));
        setCurrentPage(1);
    };

    const togglePostSelection = (id: string) => {
        let newSelectedPosts = [...selectedPosts];
        if (newSelectedPosts.includes(id)) {
            newSelectedPosts = newSelectedPosts.filter((postId) => postId !== id);
        } else {
            newSelectedPosts.push(id);
        }
        setSelectedPosts(newSelectedPosts);
    };

    const toggleSelectAllPosts = () => {
        if (selectedPosts.length !== filteredData.length && selectedPosts.length === 0) {
            setSelectedPosts(filteredData.map(([id]) => id));
        } else {
            setSelectedPosts([]);
        }
    };

    const toggleSelectPage = (pageData: [string, RedditPosts[string]][]) => {
        let newSelectedPosts = [...selectedPosts];
        const pageIds = pageData.map(([id]) => id);
        const allSelected = pageIds.every((id) => newSelectedPosts.includes(id));

        if (allSelected) {
            newSelectedPosts = newSelectedPosts.filter((id) => !pageIds.includes(id));
        } else {
            pageIds.forEach((id) => {
                if (!newSelectedPosts.includes(id)) {
                    newSelectedPosts.push(id);
                }
            });
        }

        setSelectedPosts(newSelectedPosts);
    };

    return (
        <div className={`flex flex-col h-full`}>
            {/* Top Bar with Filter and Controls */}
            <div className="mb-4 flex justify-between items-center bg-gray-100 p-4 rounded">
                <input
                    type="text"
                    placeholder="Search by title, text, or URL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="p-2 border border-gray-300 rounded w-1/3"
                />

                <button
                    onClick={toggleSelectAllPosts}
                    className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
                    {selectedPosts.length !== filteredData.length && selectedPosts.length === 0
                        ? 'Select All Posts'
                        : 'Deselect All Posts'}
                </button>

                <div className="flex items-center">
                    <label htmlFor="itemsPerPage" className="mr-2">
                        Rows per page:
                    </label>
                    <select
                        id="itemsPerPage"
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        className="p-2 border border-gray-300 rounded">
                        {[10, 20, 50, 100].map((limit) => (
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

            {/* Scrollable Table Section */}
            <div className={`flex-1 overflow-y-auto`}>
                <RedditTable
                    data={displayedData}
                    isLoading={loading ?? false}
                    selectedPosts={selectedPosts}
                    togglePostSelection={togglePostSelection}
                    toggleSelectPage={toggleSelectPage}
                />
            </div>

            <div className="flex items-center justify-start mt-2">
                <p>{selectedPosts.length} posts selected</p>
            </div>

            {/* Pagination Controls */}
            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onNext={handleNextPage}
                onPrevious={handlePreviousPage}
            />
        </div>
    );
};

export default RedditTableRenderer;
