import { useEffect } from 'react';

interface InfiniteScrollOptions {
    isLoading: boolean;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    loadNextPage: () => void;
    loadPreviousPage: () => void;
    threshold?: number;
}

export function useInfiniteScroll(
    containerRef: React.RefObject<HTMLElement>,
    {
        isLoading,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
        threshold = 50
    }: InfiniteScrollOptions
) {
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const { scrollTop, scrollHeight, clientHeight } = el;

                // near bottom?
                if (
                    scrollTop + clientHeight >= scrollHeight - threshold &&
                    hasNextPage &&
                    !isLoading
                ) {
                    loadNextPage();
                }
                // near top?
                if (scrollTop <= threshold && hasPreviousPage && !isLoading) {
                    loadPreviousPage();
                }

                ticking = false;
            });
        };

        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [
        containerRef,
        isLoading,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
        threshold
    ]);
}
