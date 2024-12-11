import { createContext, useState, FC, Dispatch, useCallback, useReducer, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import {
    ILayout,
} from '../types/Coding/shared';

interface IFilteringContext {
}

// Create the context
export const FilteringContext = createContext<IFilteringContext>({

});

// Create a provider component
export const FilteringProvider: FC<ILayout> = ({ children }) => {
    const value = useMemo(() => {
        return {
        };
    }, []);
    return <FilteringContext.Provider value={value}>{children}</FilteringContext.Provider>;
};

export const useFilteringContext = () => useContext(FilteringContext);