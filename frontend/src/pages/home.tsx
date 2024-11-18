import { FC, useState, useContext } from 'react';
import NavigationBottomBar from '../components/Shared/navigation_bottom_bar';
import { DataContext } from '../context/data_context';
import { ROUTES } from '../constants/shared';
import RedditTable from '../components/Home/reddit_table';
import PaginationControls from '../components/Home/pagination_control';
import useRedditData from '../hooks/Home/use_reddit_data';

const HomePage: FC = () => {
    const dataContext = useContext(DataContext);
    const { data, error, loadFolderData } = useRedditData();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    // Filtered Data
    const filteredData = data.filter(
        (post) =>
            post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.selftext?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.url?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination Logic
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
        setCurrentPage(1); // Reset to the first page when changing items per page
    };

    return (
        <div className="w-full h-screen flex flex-col p-6">
            {/* Toggle Button for Link/Folder Mode - Hidden when data is loaded */}
            {!data.length && (
                <button
                    onClick={dataContext.toggleMode}
                    className="px-4 py-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600">
                    {dataContext.currentMode === 'link' ? 'Switch to Folder' : 'Switch to Link'}
                </button>
            )}

            {/* Conditionally render based on the current mode and whether data is loaded */}
            {dataContext.currentMode === 'link' ? (
                // Link Mode Input
                <div>
                    <input
                        type="text"
                        value={dataContext.modeInput}
                        onChange={(e) => dataContext.setModeInput(e.target.value)}
                        placeholder="Type or paste text with URLs here"
                        className="p-2 border border-gray-300 rounded w-96"
                    />
                </div>
            ) : (
                // Folder Mode
                <div className="flex flex-col h-full">
                    {!data.length ? (
                        // Render folder selection button if no data is loaded
                        <div>
                            <button
                                onClick={loadFolderData}
                                className="p-2 border border-gray-300 rounded w-96">
                                Select Folder
                            </button>
                            <div>
                                <h3>Selected Folder:</h3>
                                <p>{dataContext.modeInput || 'No folder selected'}</p>
                                {error && <p className="text-red-500">{error}</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-grow overflow-hidden h-full">
                            {/* Top Bar with Filter and Controls */}
                            <div className="mb-4 flex justify-between items-center bg-gray-100 p-4 rounded">
                                {/* Search Filter */}
                                <input
                                    type="text"
                                    placeholder="Search by title, text, or URL..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="p-2 border border-gray-300 rounded w-1/3"
                                />

                                {/* Items Per Page */}
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

                                {/* Go to Page */}
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

                            {/* Table */}
                            <div className="overflow-y-auto max-h-[calc(100vh-17rem)]">
                                <RedditTable data={displayedData} />
                            </div>

                            {/* Pagination Controls */}
                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onNext={handleNextPage}
                                onPrevious={handlePreviousPage}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Bottom Bar (kept fixed at the bottom of the screen) */}
            <NavigationBottomBar nextPage={ROUTES.BASIS} isReady={data.length > 0} />
        </div>
    );
};

export default HomePage;
