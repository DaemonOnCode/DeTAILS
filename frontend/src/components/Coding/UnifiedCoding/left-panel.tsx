import { FC, useEffect, useState } from 'react';
import PostTab from './post-tab';
import {
    usePaginatedPostsMetadata,
    usePaginatedCodesMetadata
} from '../../../hooks/Coding/use-paginated-metadata';
import { SetState } from '../../../types/Coding/shared';
import useScrollRestoration from '../../../hooks/Shared/use-scroll-restoration';
import { useInfiniteScroll } from '../../../hooks/Coding/use-infinite-scroll';
import { DEBOUNCE_DELAY } from '../../../constants/Shared';
import useDebounce from '../../../hooks/Shared/use-debounce';

interface LeftPanelProps {
    responseTypes: ('sampled' | 'unseen' | 'manual')[];
    activeTab: 'posts' | 'codes';
    filter: string | null;
    onFilterSelect: (f: string | null) => void;
    showTypeFilterDropdown?: boolean;
    selectedTypeFilter: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
    handleSelectedTypeFilter?: SetState<string>;
    showCoderType?: boolean;
    setActiveTab: SetState<'posts' | 'codes'>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedItem: string | null;
    setSelectedItem: SetState<string | null>;
}

const LeftPanel: FC<LeftPanelProps> = ({
    responseTypes,
    activeTab,
    filter,
    onFilterSelect,
    showTypeFilterDropdown = false,
    selectedTypeFilter,
    handleSelectedTypeFilter,
    showCoderType,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedItem,
    setSelectedItem
}) => {
    const { scrollRef: listRef, storageKey } = useScrollRestoration('left-panel');

    const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY);

    const {
        postIds,
        titles,
        totalPosts,
        totalCodedPosts,
        isLoading: loadingPosts,
        hasNextPage: postsHasNext,
        hasPreviousPage: postsHasPrev,
        loadNextPage: loadNextPosts,
        loadPreviousPage: loadPrevPosts
    } = usePaginatedPostsMetadata({
        pageSize: 20,
        responseTypes,
        searchTerm: activeTab === 'posts' ? debouncedSearchQuery : '',
        onlyCoded: selectedItem?.endsWith('coded-data') ?? false,
        selectedTypeFilter
    });

    const {
        codes,
        totalCodes,
        isLoading: loadingCodes,
        hasNextPage: codesHasNext,
        hasPreviousPage: codesHasPrev,
        loadNextPage: loadNextCodes,
        loadPreviousPage: loadPrevCodes
    } = usePaginatedCodesMetadata({
        pageSize: 20,
        responseTypes,
        searchTerm: activeTab === 'codes' ? debouncedSearchQuery : ''
    });

    useInfiniteScroll(listRef, {
        isLoading: activeTab === 'posts' ? loadingPosts : loadingCodes,
        hasNextPage: activeTab === 'posts' ? postsHasNext : codesHasNext,
        hasPreviousPage: activeTab === 'posts' ? postsHasPrev : codesHasPrev,
        loadNextPage: activeTab === 'posts' ? loadNextPosts : loadNextCodes,
        loadPreviousPage: activeTab === 'posts' ? loadPrevPosts : loadPrevCodes
    });

    useEffect(() => {
        setSelectedItem(null);
    }, [selectedTypeFilter]);

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
        if (selection === null) {
            setSearchQuery('');
        }
    };

    return (
        <div className="h-full flex flex-col">
            {showTypeFilterDropdown && (
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2">Load Codes of:</label>
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
                    Codes
                </button>
            </div>

            <div>
                {activeTab === 'posts' ? (
                    <div className="flex justify-evenly items-center text-center">
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === null
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect(null)}>
                            All Posts ({totalPosts})
                        </span>
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem?.endsWith('coded-data')
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
                        Show All ({totalCodes})
                    </div>
                )}
            </div>

            <input
                type="text"
                placeholder={activeTab === 'posts' ? 'Search posts...' : 'Search codes...'}
                className="w-full p-2 border rounded my-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex-1 overflow-auto min-h-0 my-2 gap-y-2" ref={listRef}>
                {activeTab === 'posts' ? (
                    <ul className="space-y-2">
                        {loadingPosts && postIds.length === 0 ? (
                            <li>Loading...</li>
                        ) : postIds.length === 0 ? (
                            <li>No posts found</li>
                        ) : (
                            postIds.map((postId) => (
                                <PostTab
                                    key={postId}
                                    postIdTitle={{ id: postId, title: titles[postId] || postId }}
                                    selectedItem={selectedItem}
                                    handleSelect={handleSelect}
                                    containerRef={listRef}
                                />
                            ))
                        )}
                        {loadingPosts && postIds.length > 0 && <li>Loading more...</li>}
                    </ul>
                ) : (
                    <ul className="space-y-2">
                        {loadingCodes && codes.length === 0 ? (
                            <li>Loading...</li>
                        ) : codes.length === 0 ? (
                            <li>No codes found</li>
                        ) : (
                            codes.map((code) => (
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
                            ))
                        )}
                        {loadingCodes && codes.length > 0 && <li>Loading more...</li>}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default LeftPanel;
