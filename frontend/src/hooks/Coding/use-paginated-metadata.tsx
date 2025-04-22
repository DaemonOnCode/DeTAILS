// hooks/usePaginatedMetadata.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

type ResponseType = 'sampled' | 'unseen' | 'manual';

interface BaseArgs {
    pageSize?: number;
    responseTypes: ResponseType[];
    searchTerm?: string;
}

// --- Posts metadata ---
export function usePaginatedPostsMetadata({
    pageSize = 20,
    responseTypes,
    searchTerm = '',
    onlyCoded = false,
    selectedTypeFilter = 'New Data'
}: {
    pageSize?: number;
    responseTypes: ('sampled' | 'unseen' | 'manual')[];
    searchTerm?: string;
    onlyCoded?: boolean;
    selectedTypeFilter?: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
}) {
    const { fetchData } = useApi();
    const [page, setPage] = useState(1);
    const [postIds, setPostIds] = useState<string[]>([]);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [totalPosts, setTotalPosts] = useState(0);
    const [totalCodedPosts, setTotalCodedPosts] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const loadPage = useCallback(
        async (pageNum: number) => {
            setIsLoading(true);
            const body = {
                page: pageNum,
                pageSize,
                responseTypes,
                searchTerm: searchTerm || undefined,
                onlyCoded,
                selectedTypeFilter: selectedTypeFilter
            };
            const { data, error } = await fetchData(
                REMOTE_SERVER_ROUTES.GET_PAGINATED_POSTS_METADATA,
                {
                    method: 'POST',
                    body: JSON.stringify(body)
                }
            );
            setIsLoading(false);
            if (!error) {
                setPostIds((prev) => (pageNum === 1 ? data.postIds : [...prev, ...data.postIds]));
                setTitles((t) => ({ ...t, ...data.titles }));
                setTotalPosts(data.totalPosts);
                setTotalCodedPosts(data.totalCodedPosts);
                setHasNext(data.hasNext);
                setHasPrev(data.hasPrevious);
                setPage(pageNum);
            }
        },
        [fetchData, pageSize, responseTypes, searchTerm, onlyCoded, selectedTypeFilter]
    );

    useEffect(() => {
        loadPage(1);
    }, [responseTypes, searchTerm, onlyCoded]);

    const loadNextPage = () => {
        if (hasNext && !isLoading) loadPage(page + 1);
    };
    const loadPreviousPage = () => {
        if (hasPrev && !isLoading) loadPage(page - 1);
    };

    return {
        postIds,
        titles,
        totalPosts,
        totalCodedPosts,
        isLoading,
        hasNextPage: hasNext,
        hasPreviousPage: hasPrev,
        loadNextPage,
        loadPreviousPage
    };
}

// --- Codes metadata ---
export function usePaginatedCodesMetadata({
    pageSize = 50,
    responseTypes,
    searchTerm = '',
    selectedTypeFilter = 'New Data'
}: BaseArgs & {
    selectedTypeFilter?: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
}) {
    const { fetchData } = useApi();
    const [page, setPage] = useState(1);
    const [codes, setCodes] = useState<string[]>([]);
    const [totalCodes, setTotalCodes] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const loadPage = useCallback(
        async (pageToLoad: number) => {
            setIsLoading(true);
            const body = {
                page: pageToLoad,
                pageSize,
                responseTypes,
                searchTerm: searchTerm || undefined,
                selectedTypeFilter
            };
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.GET_PAGINATED_CODES, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            setIsLoading(false);
            if (!error) {
                setCodes((prev) => (pageToLoad === 1 ? data.codes : [...prev, ...data.codes]));
                setTotalCodes(data.totalCodes);
                setHasNext(data.hasNext);
                setHasPrev(data.hasPrevious);
                setPage(pageToLoad);
            }
        },
        [fetchData, pageSize, responseTypes, searchTerm, selectedTypeFilter]
    );

    useEffect(() => {
        loadPage(1);
    }, [JSON.stringify(responseTypes), searchTerm]);

    const loadNextPage = () => {
        if (hasNext && !isLoading) loadPage(page + 1);
    };
    const loadPreviousPage = () => {
        if (hasPrev && !isLoading) loadPage(page - 1);
    };

    return {
        codes,
        totalCodes,
        isLoading,
        hasNextPage: hasNext,
        hasPreviousPage: hasPrev,
        loadNextPage,
        loadPreviousPage
    };
}
