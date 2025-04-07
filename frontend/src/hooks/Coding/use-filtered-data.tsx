import { useEffect, useMemo } from 'react';
// import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
// import { useApi } from '../Shared/use-api';
// import { useCollectionContext } from '../../context/collection-context';

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

// interface CodedDataResponse {
//     filteredData: { postId: string; code: string; type: string }[];
//     filteredPostIds: string[];
//     totalIds: number;
//     uniqueCodes: string[];
// }

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
    // const { datasetId } = useCollectionContext();
    // const { fetchData } = useApi();
    // useEffect(() => {
    //     async function fetchCodedData() {
    //         const { data, error } = await fetchData<{ message: string; data: CodedDataResponse }>(
    //             REMOTE_SERVER_ROUTES.GET_CODED_DATA,
    //             {
    //                 method: 'POST',
    //                 body: JSON.stringify({
    //                     codebook_names: ['initial', 'deductive', 'manual'],
    //                     filters: {
    //                         showCoderType,
    //                         selectedTypeFilter,
    //                         filter: applyFilters ? filter : null // Only send filter if applying filters
    //                     },
    //                     dataset_id: datasetId,
    //                     batch_size: 20, // Fetch all data; adjust if pagination is needed
    //                     offset: 0
    //                 })
    //             }
    //         );

    //         if (data) {
    //             console.log('Fetched coded data:', data);
    //         }
    //         if (error) {
    //             console.error('Error fetching coded data:', error);
    //         }
    //     }

    //     fetchCodedData();
    // }, [filter, showCoderType, applyFilters, selectedTypeFilter]);

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
