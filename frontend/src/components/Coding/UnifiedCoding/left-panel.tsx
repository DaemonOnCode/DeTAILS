import { FC, useEffect, useMemo, useRef, useState } from 'react';
import PostTab from './post-tab';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import { useApi } from '../../../hooks/Shared/use-api';
import { SetState } from '../../../types/Coding/shared';
import useScrollRestoration from '../../../hooks/Shared/use-scroll-restoration';

interface LeftPanelProps {
    totalPosts: number;
    totalCodedPosts: number;
    postIds: string[];
    codes: string[];
    filter: string | null;
    onFilterSelect: (filter: string | null) => void;
    showTypeFilterDropdown?: boolean;
    selectedTypeFilter: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
    handleSelectedTypeFilter?: (type: string) => void;
    showCoderType?: boolean;
    codedPostsCount: number;
    activeTab: 'posts' | 'codes';
    setActiveTab: (tab: 'posts' | 'codes') => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedItem: string | null;
    setSelectedItem: SetState<string | null>;
}

const LeftPanel: FC<LeftPanelProps> = ({
    totalPosts,
    totalCodedPosts,
    postIds,
    codes,
    filter,
    onFilterSelect,
    showTypeFilterDropdown = false,
    selectedTypeFilter,
    handleSelectedTypeFilter,
    showCoderType,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedItem,
    setSelectedItem
}) => {
    const [postIdTitles, setPostIdTitles] = useState<{ id: string; title: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLUListElement>(null);
    const { fetchData } = useApi();
    const { datasetId } = useCollectionContext();

    useEffect(() => {
        fetchTabData(postIds, datasetId);
    }, [postIds]);

    useEffect(() => {
        setSelectedItem(null);
    }, [selectedTypeFilter, setSelectedItem]);

    const { scrollRef: listRef, storageKey } = useScrollRestoration('left-panel');

    const fetchTabData = async (postIds: string[], datasetId: string) => {
        if (!postIds.length || !datasetId) return;
        setLoading(true);
        const { data: results, error } = await fetchData<any[]>(
            REMOTE_SERVER_ROUTES.GET_POST_ID_TITLE_BATCH,
            {
                method: 'POST',
                body: JSON.stringify({ post_ids: postIds, dataset_id: datasetId })
            }
        );
        if (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        } else {
            setPostIdTitles(
                results?.map((result: any) => ({ id: result.id, title: result.title })) ?? []
            );
            setLoading(false);
        }
    };

    // Filter posts based on searchQuery
    const filteredPosts = useMemo(() => {
        if (!searchQuery) return postIdTitles;
        const lowerQuery = searchQuery.toLowerCase();
        return postIdTitles.filter((post) => post.title.toLowerCase().includes(lowerQuery));
    }, [postIdTitles, searchQuery]);

    // Filter codes based on searchQuery
    const filteredCodes = useMemo(() => {
        if (!searchQuery) return codes;
        const lowerQuery = searchQuery.toLowerCase();
        return codes.filter((code) => code.toLowerCase().includes(lowerQuery));
    }, [codes, searchQuery]);

    useEffect(() => {
        if (listRef.current && postIdTitles.length > 0) {
            const savedPosition = sessionStorage.getItem(storageKey);
            if (savedPosition) {
                listRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        }
    }, [postIdTitles, listRef, storageKey]);

    const handleSelect = (selection: string | null) => {
        setSelectedItem((prev) => {
            if (
                (prev === 'coded-data' || prev?.split('|')?.[1] === 'coded-data') &&
                selection !== null
            ) {
                const newFilter = `${selection}|coded-data`;
                onFilterSelect(newFilter);
                return newFilter;
            }
            onFilterSelect(selection);
            return selection;
        });

        // Clear search query when "Show All" is clicked
        if (selection === null) {
            setSearchQuery('');
        }
    };

    return (
        <div className="h-full flex flex-col">
            {showTypeFilterDropdown && (
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2">Load sub-codes of:</label>
                    <select
                        value={selectedTypeFilter}
                        onChange={(e) => handleSelectedTypeFilter?.(e.target.value)}
                        className="w-full p-2 border rounded shadow bg-white cursor-pointer">
                        <option value="All">All</option>
                        {showCoderType ? (
                            <>
                                <option value="Human">Human</option>
                                <option value="LLM">LLM</option>
                            </>
                        ) : (
                            <>
                                <option value="New Data">New Data</option>
                                <option value="Codebook">Codebook</option>
                            </>
                        )}
                    </select>
                </div>
            )}

            <div className="flex justify-around mb-4">
                <button
                    className={`py-1 lg:py-2 px-2 lg:px-4 w-1/2 ${
                        activeTab === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                    onClick={() => {
                        setActiveTab('posts');
                        handleSelect(null);
                    }}>
                    Posts
                </button>
                <button
                    className={`py-1 lg:py-2 px-1 lg:px-4 w-1/2 ${
                        activeTab === 'codes' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                    onClick={() => {
                        setActiveTab('codes');
                        handleSelect(null);
                    }}>
                    Sub-codes
                </button>
            </div>

            <div>
                {activeTab === 'posts' ? (
                    <div className="flex justify-evenly items-center text-center">
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === null && searchQuery === ''
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect(null)}>
                            All Posts ({totalPosts})
                        </span>
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === 'coded-data' ||
                                selectedItem?.split('|')?.[1] === 'coded-data'
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect('coded-data')}>
                            Coded Posts ({totalCodedPosts})
                        </span>
                    </div>
                ) : (
                    <div
                        className={`p-3 border rounded shadow cursor-pointer transition-all text-center ${
                            selectedItem === null && searchQuery === ''
                                ? 'bg-blue-200 font-bold'
                                : 'hover:bg-blue-100'
                        }`}
                        onClick={() => handleSelect(null)}>
                        Show All ({codes.length})
                    </div>
                )}
            </div>

            {/* Always show the search input with dynamic placeholder */}
            <input
                type="text"
                placeholder={activeTab === 'posts' ? 'Search posts...' : 'Search codes...'}
                className="w-full p-2 border rounded my-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex-1 overflow-auto min-h-0 my-2 gap-y-2" ref={listRef}>
                {activeTab === 'posts' ? (
                    <ul className="space-y-2" ref={containerRef}>
                        {loading ? (
                            <li>Loading...</li>
                        ) : filteredPosts.length === 0 ? (
                            <div>No posts found</div>
                        ) : (
                            filteredPosts.map((postIdTitle) => (
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
                    <ul className="space-y-2">
                        {filteredCodes.map((code) => (
                            <li
                                key={code}
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
        </div>
    );
};

export default LeftPanel;
