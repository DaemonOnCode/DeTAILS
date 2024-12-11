import { createContext, useState, FC, Dispatch, useCallback, useReducer, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import {
    ILayout,
} from '../types/Coding/shared';

interface IModelingContext {
}

// Create the context
export const ModelingContext = createContext<IModelingContext>({
});


// Create a provider component
export const ModelingProvider: FC<ILayout> = ({ children }) => {
    const value = useMemo(
        () => ({
        }),
        [
        ]
    );

    return <ModelingContext.Provider value={value}>{children}</ModelingContext.Provider>;
};

export const useModelingContext = () => useContext(ModelingContext);