import { MutableRefObject, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { debounce } from 'lodash';

const useScrollRestoration = (basicName: string) => {
    const location = useLocation();
    const uniqueId = `${basicName}_${location.pathname}`;
    const scrollRef: MutableRefObject<any> = useRef(null);
    const storageKey = `scrollPosition_${uniqueId}`;

    useEffect(() => {
        const restoreScrollPosition = () => {
            const savedPosition = sessionStorage.getItem(storageKey);
            if (scrollRef.current && savedPosition) {
                scrollRef.current.scrollTop = parseInt(savedPosition, 10);
            }
        };

        restoreScrollPosition();
        const timeoutId = setTimeout(restoreScrollPosition, 100);

        const saveScrollPosition = debounce(() => {
            if (scrollRef.current) {
                const currentPosition = scrollRef.current.scrollTop;
                sessionStorage.setItem(storageKey, currentPosition.toString());
            }
        }, 300);

        const handleScroll = () => {
            saveScrollPosition();
        };

        const element = scrollRef.current;
        if (element) {
            element.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (element) {
                element.removeEventListener('scroll', handleScroll);
            }
            saveScrollPosition.cancel();
            clearTimeout(timeoutId);
        };
    }, [uniqueId, storageKey]);

    return { scrollRef, storageKey };
};

export default useScrollRestoration;
