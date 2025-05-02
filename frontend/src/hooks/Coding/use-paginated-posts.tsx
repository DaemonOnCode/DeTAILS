import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { ResponseType } from '../../types/Coding/shared';

export interface PaginatedPostsResponse {
    postIds: string[];
    titles: Record<string, string>;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export function usePaginatedPosts({
    pageSize = 20,
    filterCode,
    searchTerm,
    responseTypes
}: {
    pageSize?: number;
    filterCode?: string | null;
    searchTerm?: string;
    responseTypes: ResponseType[];
}) {
    const { fetchData } = useApi();

    const [pages, setPages] = useState<
        Array<{ pageNum: number; postIds: string[]; titles: Record<string, string> }>
    >([]);
    const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
    const [total, setTotal] = useState(0);

    const loadPage = useCallback(
        async (page: number) => {
            if (loadingPages.has(page) || pages.some((p) => p.pageNum === page)) {
                return;
            }
            setLoadingPages((s) => new Set(s).add(page));
            const body = { page, pageSize, filterCode, searchTerm, responseTypes };
            const { data, error } = await fetchData(
                REMOTE_SERVER_ROUTES.GET_PAGINATED_POST_TITLES,
                {
                    method: 'POST',
                    body: JSON.stringify(body)
                }
            );
            setLoadingPages((s) => {
                const next = new Set(s);
                next.delete(page);
                return next;
            });
            if (!error) {
                setTotal(data.total);
                setPages((prev) =>
                    prev.some((p) => p.pageNum === page)
                        ? prev
                        : [...prev, { pageNum: page, postIds: data.postIds, titles: data.titles }]
                );
            }
        },
        [
            fetchData,
            pageSize,
            filterCode,
            searchTerm,
            JSON.stringify(responseTypes),
            loadingPages,
            pages
        ]
    );

    useEffect(() => {
        setPages([]);
        setTotal(0);
        loadPage(1);
    }, [filterCode, searchTerm, JSON.stringify(responseTypes)]);

    const postIds = useMemo(
        () =>
            pages
                .slice()
                .sort((a, b) => a.pageNum - b.pageNum)
                .flatMap((p) => p.postIds),
        [pages]
    );
    const titles = useMemo(
        () => pages.reduce((acc, p) => ({ ...acc, ...p.titles }), {} as Record<string, string>),
        [pages]
    );
    const minPage = useMemo(
        () => (pages.length ? Math.min(...pages.map((p) => p.pageNum)) : 1),
        [pages]
    );
    const maxPage = useMemo(
        () => (pages.length ? Math.max(...pages.map((p) => p.pageNum)) : 1),
        [pages]
    );
    const isLoading = loadingPages.size > 0;
    const hasNextPage = postIds.length < total;
    const hasPreviousPage = minPage > 1;

    const loadNextPage = () => {
        if (hasNextPage && !isLoading) loadPage(maxPage + 1);
    };
    const loadPreviousPage = () => {
        if (hasPreviousPage && !isLoading) loadPage(minPage - 1);
    };

    return {
        postIds,
        titles,
        total,
        isLoadingPosts: isLoading,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage
    };
}
