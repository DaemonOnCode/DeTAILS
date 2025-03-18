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
    manualCodingResponses: any[];
    sampledPostIds: string[];
    unseenPostIds: string[];
    testPostIds: string[];
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
    manualCodingResponses,
    sampledPostIds,
    unseenPostIds,
    testPostIds
}: UseFilteredDataParams) {
    return useMemo(() => {
        let filteredData = data;
        let filteredPostIds = postIds;
        let totalIds = postIds.length;
        let totalData = data;

        const llmFilteredResponses = unseenPostResponse.filter(
            (response) => response.type === 'LLM'
        );
        const llmPostIds = llmFilteredResponses.map((r) => r.postId);

        // Non-manual coding case
        if (!showCoderType && applyFilters) {
            if (selectedTypeFilter === 'All') {
                filteredData = [...sampledPostResponse, ...llmFilteredResponses];
                filteredPostIds = [...sampledPostIds, ...unseenPostIds];
                totalIds = filteredPostIds.length;
                totalData = filteredData;
            } else if (selectedTypeFilter === 'New Data') {
                filteredData = llmFilteredResponses;
                filteredPostIds = unseenPostIds;
                totalIds = filteredPostIds.length;
                totalData = filteredData;
            } else if (selectedTypeFilter === 'Codebook') {
                filteredData = sampledPostResponse;
                filteredPostIds = sampledPostIds;
                totalIds = filteredPostIds.length;
                totalData = filteredData;
            }
        }
        // Manual coding case
        else if (showCoderType && applyFilters) {
            if (selectedTypeFilter === 'All') {
                totalData = manualCodingResponses;
                filteredData = manualCodingResponses;
                filteredPostIds = testPostIds;
                totalIds = filteredPostIds.length;
            } else if (selectedTypeFilter === 'Human') {
                filteredData = manualCodingResponses.filter(
                    (response) => response.type === 'Human'
                );
                filteredPostIds = testPostIds;
                totalIds = filteredPostIds.length;
                totalData = filteredData;
            } else if (selectedTypeFilter === 'LLM') {
                filteredData = manualCodingResponses.filter((response) => response.type === 'LLM');
                filteredPostIds = testPostIds;
                totalIds = filteredPostIds.length;
                totalData = filteredData;
            }
        }

        // Apply additional filtering based on filter parameter
        if (filter) {
            if (filter === 'coded-data') {
                filteredPostIds = filteredPostIds.filter((postId) =>
                    totalData.some((item) => item.postId === postId)
                );
            } else if (filter.split('|')[1] === 'coded-data') {
                const [postId] = filter.split('|');
                filteredData = filteredData.filter((response) => response.postId === postId);
                filteredPostIds = filteredPostIds.filter((postId) =>
                    totalData.some((item) => item.postId === postId)
                );
            } else {
                // Distinguish between postId and code filters
                const allPostIds = Array.from(new Set(totalData.map((item) => item.postId)));
                if (allPostIds.includes(filter)) {
                    // Filter by postId: show responses for this post, keep all relevant postIds
                    filteredData = filteredData.filter((response) => response.postId === filter);
                    // Optionally: filteredPostIds = postIds; to show all posts, but here we keep as is
                } else {
                    // Filter by code: show only posts with responses matching the code
                    filteredData = filteredData.filter((response) => response.code === filter);
                    const postIdsWithCode = Array.from(new Set(filteredData.map((r) => r.postId)));
                    filteredPostIds = filteredPostIds.filter((postId) =>
                        postIdsWithCode.includes(postId)
                    );
                }
            }
        }

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
        manualCodingResponses,
        sampledPostIds,
        unseenPostIds,
        testPostIds
    ]);
}
