import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

export interface PaginatedArgs {
    responseTypes: ('sampled' | 'unseen' | 'manual')[];
    pageSize?: number;
    filterCode?: string | null;
    searchTerm?: string;
    selectedTypeFilter?: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
    postId?: string | null;
}

export function usePaginatedResponses({
    pageSize = 50,
    filterCode = null,
    searchTerm = '',
    selectedTypeFilter = 'All',
    responseTypes,
    postId = null
}: PaginatedArgs) {
    const { fetchData } = useApi();

    const [pages, setPages] = useState<
        Array<{
            pageNum: number;
            postIds: string[];
            responsesByPostId: Record<string, any[]>;
        }>
    >([]);
    const [minPage, setMinPage] = useState(1);
    const [maxPage, setMaxPage] = useState(1);
    const [totalPostIds, setTotalPostIds] = useState(0);
    const [isLoadingPage, setIsLoadingPage] = useState(false);

    const loadPage = useCallback(
        async (page: number) => {
            setIsLoadingPage(true);
            const body = {
                page,
                pageSize,
                filterCode,
                searchTerm,
                selectedTypeFilter,
                responseTypes,
                postId
            };
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.GET_PAGINATED_RESPONSES, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            if (!error && data) {
                setPages((prev) => {
                    if (prev.some((p) => p.pageNum === page)) return prev;
                    return [
                        ...prev,
                        {
                            pageNum: page,
                            postIds: data.postIds,
                            responsesByPostId: data.responses
                        }
                    ];
                });
                setTotalPostIds(data.totalPostIds);
                setMinPage((mp) => Math.min(mp, page));
                setMaxPage((mp) => Math.max(mp, page));
            }
            setIsLoadingPage(false);
        },
        [fetchData, pageSize, filterCode, searchTerm, selectedTypeFilter, postId]
    );

    useEffect(() => {
        setPages([]);
        setMinPage(1);
        setMaxPage(1);
        setTotalPostIds(0);
        loadPage(1);
    }, [filterCode, searchTerm, selectedTypeFilter, loadPage]);

    const loadedPostIds = useMemo(() => {
        const set = new Set<string>();
        pages.forEach((p) => p.postIds.forEach((id) => set.add(id)));
        return Array.from(set);
    }, [pages]);

    const postIds = useMemo(() => {
        return pages
            .slice()
            .sort((a, b) => a.pageNum - b.pageNum)
            .flatMap((p) => p.postIds);
    }, [pages]);

    const responsesByPostId = useMemo(() => {
        return pages.reduce(
            (acc, p) => {
                Object.entries(p.responsesByPostId).forEach(([pid, arr]) => {
                    acc[pid] = [...(acc[pid] || []), ...arr];
                });
                return acc;
            },
            {} as Record<string, any[]>
        );
    }, [pages]);

    const hasNextPage = loadedPostIds.length < totalPostIds;
    const hasPreviousPage = minPage > 1;

    const loadNextPage = useCallback(() => {
        if (!isLoadingPage && hasNextPage) {
            loadPage(maxPage + 1);
        }
    }, [isLoadingPage, hasNextPage, maxPage, loadPage]);

    const loadPreviousPage = useCallback(() => {
        if (!isLoadingPage && hasPreviousPage) {
            loadPage(minPage - 1);
        }
    }, [isLoadingPage, hasPreviousPage, minPage, loadPage]);

    return {
        postIds,
        responsesByPostId,
        isLoadingPage,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage
    };
}
