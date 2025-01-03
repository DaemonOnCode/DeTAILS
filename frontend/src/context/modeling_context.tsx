import { createContext, useState, FC, useCallback, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import { ILayout, SetState } from '../types/Coding/shared';

// Define the interface for each model's state
interface IModelState {
    id: string;
    name: string;
    type: 'lda' | 'nmf' | 'bertopic' | 'biterm';
    isProcessing: boolean;
}

// Define the interface for the ModelingContext
interface IModelingContext {
    models: IModelState[];
    addModel: (id: string, modelName: string, type: string) => void;
    updateModelName: (id: string, newName: string) => void;
    removeModel: (id: string) => void;
    toggleProcessing: (id: string) => void;
    activeModelId: string | null;
    setActiveModelId: (id: string) => void;
    resetModelingContext: () => void;
    addNewModel: boolean;
    setAddNewModel: SetState<boolean>;
    updateContext: (updates: Partial<IModelingContext>) => void;
}

// Create the context
export const ModelingContext = createContext<IModelingContext>({
    models: [],
    addModel: () => {},
    updateModelName: () => {},
    removeModel: () => {},
    toggleProcessing: () => {},
    activeModelId: null,
    setActiveModelId: () => {},
    resetModelingContext: () => {},
    addNewModel: false,
    setAddNewModel: () => {},
    updateContext: () => {}
});

// Create a provider component
export const ModelingProvider: FC<ILayout> = ({ children }) => {
    const [models, setModels] = useState<IModelState[]>([
        { id: '1', name: 'Model 1', isProcessing: false, type: 'lda' },
        { id: '2', name: 'Model 2', isProcessing: true, type: 'nmf' },
        { id: '3', name: 'Model 3', isProcessing: false, type: 'bertopic' }
    ]);
    const [activeModelId, setActiveModelId] = useState<string | null>(null);
    const [addNewModel, setAddNewModel] = useState<boolean>(false);

    // Add a model to the list
    const addModel = useCallback((id: string, modelName: string, type: string) => {
        setModels((prevModels) => {
            // if (prevModels.some((model) => model.name === modelName)) return prevModels;
            return [
                ...prevModels,
                { id, name: modelName, isProcessing: false, type } as IModelState
            ];
        });
    }, []);

    // Remove a model from the list
    const removeModel = useCallback(
        (id: string) => {
            setModels((prevModels) => prevModels.filter((model) => model.id !== id));
            if (activeModelId === id) setActiveModelId(null); // Reset active model if removed
        },
        [activeModelId]
    );

    // Toggle processing state for a specific model
    const toggleProcessing = useCallback((id: string) => {
        setModels((prevModels) =>
            prevModels.map((model) =>
                model.id === id ? { ...model, isProcessing: !model.isProcessing } : model
            )
        );
    }, []);

    // Reset all modeling context state
    const resetModelingContext = useCallback(() => {
        setModels([]);
        setActiveModelId(null);
    }, []);

    const updateModelName = (id: string, newName: string) => {
        setModels((prevModels) =>
            prevModels.map((model) => (model.id === id ? { ...model, name: newName } : model))
        );
    };

    useEffect(() => {
        console.log('Modeling Context updated:', { models, activeModelId });
        if (models.length > 0 && !activeModelId) {
            setActiveModelId(models[0].id);
        }
    }, [models, activeModelId]);

    const updateContext = (updates: Partial<IModelingContext>) => {
        setModels(updates.models ?? []);
    };

    const value = useMemo(
        () => ({
            models,
            addModel,
            updateModelName,
            removeModel,
            toggleProcessing,
            activeModelId,
            setActiveModelId,
            resetModelingContext,
            addNewModel,
            setAddNewModel,
            updateContext
        }),
        [models, activeModelId, addNewModel]
    );

    return <ModelingContext.Provider value={value}>{children}</ModelingContext.Provider>;
};

// Hook to use the ModelingContext
export const useModelingContext = () => useContext(ModelingContext);
