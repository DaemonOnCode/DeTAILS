import { createContext, FC } from 'react';
import { useMemo } from 'react';
import { ILayout } from '../types/Coding/shared';
import { CollectionProvider } from './collection-context';
import { CodingProvider } from './coding-context';
import { LoadingProvider } from './loading-context';
import { UndoProvider } from './undo-context';
import { ManualCodingProvider } from './manual-coding-context';

interface IDataContext {}

export const DataContext = createContext<IDataContext>({});

export const DataProvider: FC<ILayout> = ({ children }) => {
    const value = useMemo(() => {
        return {};
    }, []);
    return (
        <UndoProvider>
            <LoadingProvider>
                <CollectionProvider>
                    {/* <FilteringProvider> */}
                    {/* <ModelingProvider> */}
                    <CodingProvider>
                        <ManualCodingProvider postIds={[]}>
                            <DataContext.Provider value={value}>{children}</DataContext.Provider>
                        </ManualCodingProvider>
                    </CodingProvider>
                    {/* </ModelingProvider>
            </FilteringProvider> */}
                </CollectionProvider>
            </LoadingProvider>
        </UndoProvider>
    );
};
