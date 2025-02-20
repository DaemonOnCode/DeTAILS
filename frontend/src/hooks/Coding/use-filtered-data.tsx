import { useMemo } from 'react';

interface UseFilteredDataParams {
    data: any[];
    postIds: string[];
    filter: string | null;
    showCoderType: boolean;
    applyFilters: boolean;
    selectedTypeFilter: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
    sampledPostResponse: any[];
    unseenPostResponse: any[];
    sampledPostIds: string[];
    unseenPostIds: string[];
}

export function useFilteredData({
    data,
    postIds,
    filter,
    showCoderType,
    applyFilters,
    selectedTypeFilter,
    sampledPostResponse,
    unseenPostResponse,
    sampledPostIds,
    unseenPostIds
}: UseFilteredDataParams) {
    return useMemo(() => {
        let filteredData = data;
        let filteredPostIds = postIds; // default: all posts

        if (filter) {
            // Case 1: Filter is exactly "coded-data"
            if (filter === 'coded-data') {
                filteredData = data;
                filteredPostIds = postIds.filter((postId) =>
                    data.some((item) => item.postId === postId)
                );
            }
            // Case 2: Filter is of the form "postId|coded-data"
            else if (filter.split('|')[1] === 'coded-data') {
                const [postId] = filter.split('|');
                filteredData = data.filter((response) => response.postId === postId);
                filteredPostIds = postIds.filter((postId) =>
                    data.some((item) => item.postId === postId)
                );
            }
            // Case 3: Any other filter (by postId or code)
            else {
                filteredData = data.filter(
                    (response) => response.postId === filter || response.code === filter
                );
                // When filtering by a specific post or code in "All Posts" mode,
                // show all posts in the left panel.
                filteredPostIds = postIds;
            }
        } else if (!showCoderType && applyFilters) {
            if (selectedTypeFilter === 'All') {
                filteredData = [...sampledPostResponse, ...unseenPostResponse];
                filteredPostIds = [...sampledPostIds, ...unseenPostIds];
            } else if (selectedTypeFilter === 'New Data') {
                filteredData = unseenPostResponse;
                filteredPostIds = unseenPostIds;
            } else if (selectedTypeFilter === 'Codebook') {
                filteredData = sampledPostResponse;
                filteredPostIds = sampledPostIds;
            }
        }
        // Otherwise, no filter: return full data and all posts.
        return { filteredData, filteredPostIds };
    }, [
        data,
        postIds,
        filter,
        showCoderType,
        applyFilters,
        selectedTypeFilter,
        sampledPostResponse,
        unseenPostResponse,
        sampledPostIds,
        unseenPostIds
    ]);
}
