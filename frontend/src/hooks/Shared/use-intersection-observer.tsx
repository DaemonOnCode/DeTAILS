import { useState, useEffect, useRef } from 'react';

export const useIntersectionObserver = (
    externalRef?: React.RefObject<HTMLElement>,
    options?: IntersectionObserverInit & { visibleThreshold?: number; invisibleThreshold?: number }
) => {
    const [isVisible, setIsVisible] = useState(false);
    const internalRef = useRef<HTMLElement>(null);
    const ref = externalRef || internalRef;

    const visibleThreshold = options?.visibleThreshold ?? 0.1;
    const invisibleThreshold = options?.invisibleThreshold ?? 0.05;

    useEffect(() => {
        const element = ref.current;
        if (!element) {
            console.warn('No element to observe. Please pass a valid ref.');
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.intersectionRatio >= visibleThreshold) {
                    setIsVisible(true);
                } else if (entry.intersectionRatio <= invisibleThreshold) {
                    setIsVisible(false);
                }
            },
            {
                ...options,
                threshold: [invisibleThreshold, visibleThreshold]
            }
        );

        observer.observe(element);
        return () => observer.unobserve(element);
    }, [ref, options, visibleThreshold, invisibleThreshold]);

    return isVisible;
};
