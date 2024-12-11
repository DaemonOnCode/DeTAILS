import { createContext, useState, FC, Dispatch, useCallback, useReducer, useEffect } from 'react';
import { useMemo } from 'react';
import {
    ILayout,
} from '../types/Coding/shared';
import { CollectionProvider } from './collection_context';
import { FilteringProvider } from './filtering_context';
import { ModelingProvider } from './modeling_context';
import { CodingProvider } from './coding_context';

interface IDataContext {
}

// Create the context
export const DataContext = createContext<IDataContext>({
});

// Create a provider component
export const DataProvider: FC<ILayout> = ({ children }) => {

    const value = useMemo(() => {
        return {
        };
    }, []);
    return (
        <CollectionProvider>
            <FilteringProvider>
                <ModelingProvider>
                    <CodingProvider>
                        <DataContext.Provider value={value}>{children}</DataContext.Provider>
                    </CodingProvider>
                </ModelingProvider>
            </FilteringProvider>
        </CollectionProvider>
    );
};
