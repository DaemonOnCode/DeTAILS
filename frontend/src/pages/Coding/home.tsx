import { FC, useState, useContext, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { DataContext } from '../../context/data_context';
import { ROUTES, SELECTED_POSTS_MIN_THRESHOLD } from '../../constants/Coding/shared';
import RedditTable from '../../components/Coding/Home/reddit_table';
import PaginationControls from '../../components/Coding/Home/pagination_control';
import useRedditData from '../../hooks/Home/use_reddit_data';
import { RedditPosts } from '../../types/Coding/shared';

const HomePage: FC = () => {
    const dataContext = useContext(DataContext);
    const { data, error, loadFolderData } = useRedditData();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    console.log('rendered home page');
    console.count('Component Render');

    // Filtered Data
    const filteredData = Object.entries(data).filter(
        ([id, { title, selftext, url }]) =>
            title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            selftext.toLowerCase().includes(searchTerm.toLowerCase()) ||
            url.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (dataContext.modeInput.length > 0) {
            loadFolderData();
        }
    }, []);

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

    // Toggle individual post selection
    const togglePostSelection = (id: string) => {
        let newSelectedPosts = [...dataContext.selectedPosts];
        if (newSelectedPosts.includes(id)) {
            // Remove the post if it already exists
            newSelectedPosts = newSelectedPosts.filter((postId) => postId !== id);
        } else {
            // Add the post if it's not already selected
            newSelectedPosts.push(id);
        }
        dataContext.setSelectedPosts(newSelectedPosts);
    };

    // Select all or deselect all posts
    const toggleSelectAllPosts = () => {
        if (
            dataContext.selectedPosts.length !== filteredData.length &&
            dataContext.selectedPosts.length === 0
        ) {
            dataContext.setSelectedPosts(filteredData.map(([id]) => id));
        } else {
            // Deselect all posts
            dataContext.setSelectedPosts([]);
        }
    };

    // Function to toggle all posts on the current page
    const toggleSelectPage = (pageData: [string, RedditPosts[string]][]) => {
        let newSelectedPosts = [...dataContext.selectedPosts];
        const pageIds = pageData.map(([id]) => id);
        const allSelected = pageIds.every((id) => newSelectedPosts.includes(id));

        if (allSelected) {
            // If all posts on the page are selected, deselect them
            newSelectedPosts = newSelectedPosts.filter((id) => !pageIds.includes(id));
        } else {
            // Otherwise, select all posts on the page
            pageIds.forEach((id) => {
                if (!newSelectedPosts.includes(id)) {
                    newSelectedPosts.push(id);
                }
            });
        }

        dataContext.setSelectedPosts(newSelectedPosts);
    };

    const isReadyCheck =
        dataContext.modeInput.length > 0 &&
        Object.keys(data).length > 0 &&
        dataContext.selectedPosts.length >= SELECTED_POSTS_MIN_THRESHOLD;

    return (
        <div className="w-full h-full flex flex-col">
            {/* Toggle Button for Link/Folder Mode - Hidden when data is loaded */}
            {Object.keys(data).length === 0 && (
                <button
                    onClick={dataContext.toggleMode}
                    className="px-4 py-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600">
                    {dataContext.currentMode === 'link' ? 'Switch to Folder' : 'Switch to Link'}
                </button>
            )}

            {/* Conditionally render based on the current mode and whether data is loaded */}
            {dataContext.currentMode === 'link' ? (
                // Link Mode Input
                <div className="h-full">
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
                    {Object.keys(data).length === 0 ? (
                        // Render folder selection button if no data is loaded
                        <div>
                            <button
                                onClick={() => loadFolderData(true, true)}
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

                                {/* Select All Posts */}
                                <button
                                    onClick={toggleSelectAllPosts}
                                    className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
                                    {dataContext.selectedPosts.length !== filteredData.length &&
                                    dataContext.selectedPosts.length === 0
                                        ? 'Select All Posts'
                                        : 'Deselect All Posts'}
                                </button>

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
                                <RedditTable
                                    data={displayedData}
                                    selectedPosts={dataContext.selectedPosts}
                                    togglePostSelection={togglePostSelection}
                                    toggleSelectPage={toggleSelectPage}
                                />
                            </div>

                            <div className="flex items-center justify-start">
                                <p>{dataContext.selectedPosts.length} posts selected</p>
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

            <NavigationBottomBar nextPage={ROUTES.BASIS} isReady={isReadyCheck} />
        </div>
    );
};

export default HomePage;
