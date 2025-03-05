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
    console.log(postIds, data, filter, 'use filtered data');

    return useMemo(() => {
        let filteredData = data;
        let filteredPostIds = postIds; // default: all posts
        let totalIds = postIds.length;
        let totalData = data;
        // console.log(filter, showCoderType, applyFilters, selectedTypeFilter, 'filters');
        const llmFilteredResponses = unseenPostResponse.filter(
            (response) => response.type === 'LLM'
        );
        const llmPostIds = llmFilteredResponses.map((r) => r.postId);
        if (!showCoderType && applyFilters) {
            if (selectedTypeFilter === 'All') {
                filteredData = [...sampledPostResponse, ...llmFilteredResponses];
                filteredPostIds = [...sampledPostIds, ...unseenPostIds];
                totalIds = filteredPostIds.length;
                totalData = [...sampledPostResponse, ...llmFilteredResponses];
            } else if (selectedTypeFilter === 'New Data') {
                filteredData = llmFilteredResponses;
                filteredPostIds = unseenPostIds;
                totalIds = filteredPostIds.length;
                totalData = llmFilteredResponses;
            } else if (selectedTypeFilter === 'Codebook') {
                filteredData = sampledPostResponse;
                filteredPostIds = sampledPostIds;
                totalIds = filteredPostIds.length;
                totalData = sampledPostResponse;
            }
        } else if (showCoderType && applyFilters) {
            if (selectedTypeFilter === 'All') {
                filteredData = unseenPostResponse;
                filteredPostIds = unseenPostIds;
                totalIds = filteredPostIds.length;
                totalData = unseenPostResponse;
            } else if (selectedTypeFilter === 'Human') {
                const humanPostResponses = unseenPostResponse.filter(
                    (response) => response.type === 'Human'
                );
                filteredData = humanPostResponses;
                filteredPostIds = humanPostResponses.map((r) => r.postId);
                // totalIds = filteredPostIds.length;
                // totalData = humanPostResponses;
            } else if (selectedTypeFilter === 'LLM') {
                filteredData = llmFilteredResponses;
                filteredPostIds = llmPostIds;
                // totalIds = filteredPostIds.length;
                // totalData = llmFilteredResponses;
            }
        }

        console.log(filteredData, 'filtered data', filter);

        if (filter) {
            // Case 1: Filter is exactly "coded-data"
            if (filter === 'coded-data') {
                // filteredData = filteredData;
                filteredPostIds = filteredPostIds.filter((postId) =>
                    totalData.some((item) => item.postId === postId)
                );
            }
            // Case 2: Filter is of the form "postId|coded-data"
            else if (filter.split('|')[1] === 'coded-data') {
                const [postId] = filter.split('|');
                filteredData = filteredData.filter((response) => response.postId === postId);
                filteredPostIds = filteredPostIds.filter((postId) =>
                    data.some((item) => item.postId === postId)
                );
            }
            // Case 3: Any other filter (by postId or code)
            else {
                filteredData = filteredData.filter(
                    (response) => response.postId === filter || response.code === filter
                );
                // filteredPostIds = filteredPostIds.filter((postId) =>
                //     data.some((item) => item.postId === postId)
                // );
                // When filtering by a specific post or code in "All Posts" mode,
                // show all posts in the left panel.
                // filteredPostIds = postIds;
            }
        }
        // Otherwise, no filter: return full data and all posts.
        return { filteredData, filteredPostIds, totalIds, totalData };
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
