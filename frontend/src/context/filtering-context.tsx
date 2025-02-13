import { createContext, FC, useContext } from 'react';
import { useMemo } from 'react';
import { ILayout } from '../types/Coding/shared';

interface IFilteringContext {}

export const FilteringContext = createContext<IFilteringContext>({});

export const FilteringProvider: FC<ILayout> = ({ children }) => {
    const value = useMemo(() => {
        return {};
    }, []);
    return <FilteringContext.Provider value={value}>{children}</FilteringContext.Provider>;
};

export const useFilteringContext = () => useContext(FilteringContext);
