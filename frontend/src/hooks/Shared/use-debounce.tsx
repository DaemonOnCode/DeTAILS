import { useState, useEffect, useMemo } from 'react';
import debounce from 'lodash/debounce';
import { DEBOUNCE_DELAY } from '../../constants/Shared';

function useDebounce<T>(value: T, delay: number = DEBOUNCE_DELAY): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    const debouncedSetValue = useMemo(
        () => debounce((val: T) => setDebouncedValue(val), delay),
        [delay]
    );

    useEffect(() => {
        debouncedSetValue(value);
        return () => debouncedSetValue.cancel();
    }, [value, debouncedSetValue]);

    return debouncedValue;
}

export default useDebounce;
