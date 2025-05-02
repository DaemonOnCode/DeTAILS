import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { ResponseType, SelectedTypeFilter } from '../../types/Coding/shared';

export interface PaginatedArgs {
    responseTypes: ResponseType[];
    pageSize?: number;
    filterCode?: string | null;
    searchTerm?: string;
    selectedTypeFilter?: SelectedTypeFilter;
    postId?: string | null;
    markedTrue?: boolean;
}

export function usePaginatedResponses({
    pageSize = 50,
    filterCode = null,
    searchTerm = '',
    selectedTypeFilter = 'All',
    responseTypes,
    postId = null,
    markedTrue = false
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

    const buildBody = useCallback(
        (page: number) => ({
            page,
            pageSize,
            filterCode,
            searchTerm,
            selectedTypeFilter,
            responseTypes,
            postId,
            markedTrue
        }),
        [pageSize, filterCode, searchTerm, selectedTypeFilter, responseTypes, postId, markedTrue]
    );

    const loadPage = useCallback(
        async (page: number) => {
            setIsLoadingPage(true);
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.GET_PAGINATED_RESPONSES, {
                method: 'POST',
                body: JSON.stringify(buildBody(page))
            });

            if (!error && data) {
                setPages((prev) => {
                    if (prev.some((p) => p.pageNum === page))
                        return [
                            ...prev.filter((p) => p.pageNum !== page),
                            {
                                pageNum: page,
                                postIds: data.postIds,
                                responsesByPostId: data.responses
                            }
                        ];
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
    }, [filterCode, searchTerm, selectedTypeFilter, postId, loadPage]);

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
    }, [postId, isLoadingPage, hasNextPage, maxPage, loadPage]);

    const loadPreviousPage = useCallback(() => {
        if (!isLoadingPage && hasPreviousPage) {
            loadPage(minPage - 1);
        }
    }, [postId, isLoadingPage, hasPreviousPage, minPage, loadPage]);

    const refresh = useCallback(async () => {
        console.log('Refreshing data... from hook', pages);
        if (isLoadingPage) return;
        setIsLoadingPage(true);
        const pageNums = pages.map((_, i) => i + 1);
        const promises = pageNums.map((page) =>
            fetchData(REMOTE_SERVER_ROUTES.GET_PAGINATED_RESPONSES, {
                method: 'POST',
                body: JSON.stringify(buildBody(page))
            })
                .then((res) => ({ page, data: res.data, error: res.error }))
                .catch((err) => ({ page, data: undefined, error: err }))
        );

        try {
            const results = await Promise.all(promises);

            const successful = results.filter((r) => !r.error && r.data);

            const newPages = successful
                .map(({ page, data }) => ({
                    pageNum: page,
                    postIds: data.postIds,
                    responsesByPostId: data.responses
                }))
                .sort((a, b) => a.pageNum - b.pageNum);

            setPages(newPages);

            if (successful.length) {
                setTotalPostIds(successful[0].data.totalPostIds);
                setMinPage(Math.min(...pageNums));
                setMaxPage(Math.max(...pageNums));
            }
        } finally {
            setIsLoadingPage(false);
        }
    }, [
        pages,
        pageSize,
        filterCode,
        searchTerm,
        selectedTypeFilter,
        responseTypes,
        postId,
        isLoadingPage
    ]);

    return {
        postIds,
        responsesByPostId,
        isLoadingPage,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
        refresh
    };
}
