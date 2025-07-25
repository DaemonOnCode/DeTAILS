import { createContext, FC } from 'react';
import { useMemo } from 'react';
import { ILayout } from '../types/Coding/shared';
import { CollectionProvider } from './collection-context';
import { CodingProvider } from './coding-context';
import { LoadingProvider } from './loading-context';
import { UndoProvider } from './undo-context';

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
                    <CodingProvider>
                        <DataContext.Provider value={value}>{children}</DataContext.Provider>
                    </CodingProvider>
                </CollectionProvider>
            </LoadingProvider>
        </UndoProvider>
    );
};
