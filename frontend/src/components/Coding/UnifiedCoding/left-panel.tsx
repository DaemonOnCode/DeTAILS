import { FC, Suspense, useEffect, useRef, useState } from 'react';
import PostTab from './post-tab';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../../context/collection-context';

interface LeftPanelProps {
    postIds: string[];
    codes: string[];
    onFilterSelect: (filter: string | null) => void;
    showTypeFilterDropdown?: boolean; // Optional prop to control filter dropdown visibility
    selectedTypeFilter: 'Human' | 'LLM' | 'All';
    handleSelectedTypeFilter?: (e: any) => void;
}

const LeftPanel: FC<LeftPanelProps> = ({
    postIds,
    codes,
    onFilterSelect,
    showTypeFilterDropdown = false,
    selectedTypeFilter,
    handleSelectedTypeFilter
}) => {
    const [activeTab, setActiveTab] = useState<'posts' | 'codes'>('posts');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const [postIdTitles, setPostIdTitles] = useState<{ id: string; title: string }[]>([]);

    const containerRef = useRef<HTMLUListElement>(null);

    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();

    const handleSelect = (filter: string | null) => {
        setSelectedItem((prev) => {
            console.log(prev, filter);
            if (
                (prev === 'coded-data' || prev?.split('|')?.[1] === 'coded-data') &&
                filter !== null
            ) {
                let newFilter = `${filter}|coded-data`;
                onFilterSelect(newFilter);
                return newFilter;
            }
            onFilterSelect(filter);
            return filter;
        });
    };

    // const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    //     setSelectedFilter(event.target.value as 'Human' | 'LLM' | 'All');
    //     handleSelect(null); // Reset selection when filter changes
    // };

    const fetchTabData = async (postIds: string[], datasetId: string) => {
        if (!postIds.length || !datasetId) {
            return [];
        }
        // await new Promise((resolve) => setTimeout(resolve, 5000)); // Simulate delay
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_POST_ID_TITLE_BATCH), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ post_ids: postIds, dataset_id: datasetId })
        });

        if (!res.ok) {
            throw new Error('Failed to fetch data');
        }

        const results = await res.json();

        console.log('Results:', results);

        setPostIdTitles(
            results?.map((result: any) => ({ id: result.id, title: result.title })) ?? []
        );
    };

    useEffect(() => {
        fetchTabData(postIds, datasetId);
    }, [postIds]);

    return (
        <div className="m-6">
            {/* Conditional Filter Dropdown */}
            {showTypeFilterDropdown && (
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2">Load codes of:</label>
                    <select
                        value={selectedTypeFilter}
                        onChange={(e) => handleSelectedTypeFilter?.(e.target.value)}
                        className="w-full p-2 border rounded shadow bg-white cursor-pointer">
                        <option value="All">All</option>
                        <option value="Human">Human</option>
                        <option value="LLM">LLM</option>
                    </select>
                </div>
            )}
            {/* Tabs */}
            <div className="flex justify-around mb-4">
                <button
                    className={`py-1 lg:py-2 px-2 lg:px-4 w-1/2 ${activeTab === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => {
                        setActiveTab('posts');
                        handleSelect(null);
                    }}>
                    Posts
                </button>
                <button
                    className={`py-1 lg:py-2 px-1 lg:px-4 w-1/2 ${activeTab === 'codes' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => {
                        setActiveTab('codes');
                        handleSelect(null);
                    }}>
                    Codes
                </button>
            </div>

            {/* Posts Tab */}
            {activeTab === 'posts' ? (
                <ul
                    className="space-y-2 max-h-[calc(100vh-11rem)] overflow-auto"
                    ref={containerRef}>
                    <li className="flex justify-evenly items-center">
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === null
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect(null)}>
                            All Posts
                        </span>
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === 'coded-data' ||
                                selectedItem?.split('|')?.[1] === 'coded-data'
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect('coded-data')}>
                            Coded Posts
                        </span>
                    </li>
                    {postIdTitles.length === 0 ? (
                        <li>Loading...</li>
                    ) : (
                        postIdTitles
                            // .filter(
                            //     (post) =>
                            //         selectedFilter === 'All' || post.title.includes(selectedFilter)
                            // )
                            .map((postIdTitle) => (
                                <PostTab
                                    key={postIdTitle.id}
                                    postIdTitle={postIdTitle}
                                    selectedItem={selectedItem}
                                    handleSelect={handleSelect}
                                    containerRef={containerRef}
                                />
                            ))
                    )}
                </ul>
            ) : (
                // Codes Tab
                <ul className="space-y-2  max-h-[calc(100vh-11rem)] overflow-auto">
                    <li
                        className={`p-3 border rounded shadow cursor-pointer transition-all ${
                            selectedItem === null ? 'bg-blue-200 font-bold' : 'hover:bg-blue-100'
                        }`}
                        onClick={() => handleSelect(null)}>
                        Show All
                    </li>
                    {codes
                        // .filter((code) => selectedFilter === 'All' || code.includes(selectedFilter))
                        .map((code, index) => (
                            <li
                                key={index}
                                className={`p-3 border rounded shadow cursor-pointer transition-all ${
                                    selectedItem === code
                                        ? 'bg-blue-200 font-bold'
                                        : 'hover:bg-blue-100'
                                }`}
                                onClick={() => handleSelect(code)}>
                                {code}
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
};

export default LeftPanel;
