import { createContext, useState, FC, useCallback, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import { ILayout } from '../types/Coding/shared';
import { useWebSocket } from './websocket-context';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCollectionContext } from './collection-context';
import { useWorkspaceContext } from './workspace-context';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/DataModeling/shared';
import useServerUtils from '../hooks/Shared/get-server-url';
import { IModelingContext } from '../types/Shared';
import { IModelState } from '../types/DataModeling/shared';

export const ModelingContext = createContext<IModelingContext>({
    models: [],
    addModel: () => {},
    updateModelName: () => {},
    removeModel: () => {},
    toggleProcessing: () => {},
    activeModelId: null,
    setActiveModelId: () => {},
    addNewModel: false,
    setAddNewModel: () => {},
    updateContext: () => {},
    resetContext: () => {},
    startListening: () => {},
    stopListening: () => {}
});

export const ModelingProvider: FC<ILayout> = ({ children }) => {
    const { registerCallback, unregisterCallback } = useWebSocket();
    const location = useLocation();
    const { datasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { getServerUrl } = useServerUtils();
    const navigate = useNavigate();

    const [models, setModels] = useState<IModelState[]>([]);
    const [activeModelId, setActiveModelId] = useState<string | null>(null);
    const [addNewModel, setAddNewModel] = useState<boolean>(false);

    const addModel = useCallback((id: string, modelName: string, type: string) => {
        setModels((prevModels) => {
            return [
                ...prevModels,
                { id, name: modelName, isProcessing: false, type, state: 'known' } as IModelState
            ];
        });
    }, []);

    const removeModel = useCallback(
        (id: string) => {
            console.log('Removing model:', id);
            setModels((prevModels) => {
                let newModels: IModelState[] = [];
                newModels = prevModels.filter((model) => model.id !== id);
                if (activeModelId === id) {
                    if (newModels.length > 1) {
                        setActiveModelId(newModels[0].id);
                    } else {
                        setActiveModelId(null);
                    }
                } // Reset active model if removed
                return newModels;
            });
        },
        [activeModelId]
    );

    const toggleProcessing = useCallback((id: string) => {
        setModels((prevModels) =>
            prevModels.map((model) =>
                model.id === id ? { ...model, isProcessing: !model.isProcessing } : model
            )
        );
    }, []);

    const resetContext = useCallback(() => {
        setModels([]);
        setActiveModelId(null);
    }, []);

    const updateModelName = (id: string, newName: string) => {
        setModels((prevModels) =>
            prevModels.map((model) => (model.id === id ? { ...model, name: newName } : model))
        );
    };

    const handleWebSocketMessage = (message: string) => {
        console.log('message', message);
        const data: {
            type: string;
            dataset_id: string;
            model_id: string;
            model_name: string;
            workspace_id: string;
            message: string;
            num_topics: number;
        } = JSON.parse(message);
        console.log('data', data, typeof data);

        if (data.dataset_id !== datasetId || data.workspace_id !== currentWorkspace?.id) {
            console.log('Message not for this workspace');
            return;
        }

        const messageArgs = data.message.split('|');

        switch (messageArgs[0]) {
            case 'starting':
                console.log('Starting');
                setModels((prevModels) => [
                    ...prevModels,
                    {
                        id: data.model_id,
                        isProcessing: true,
                        name: data.model_name,
                        type: data.type,
                        numTopics: data.num_topics,
                        stage: data.message
                    } as IModelState
                ]);
                console.log('Models:', models);
                setActiveModelId(data.model_id);
                navigate(`/${SHARED_ROUTES.DATA_MODELING}/${ROUTES.MODELS}`);
                break;
            case 'preprocessing':
                console.log('preprocessing');
                setModels((prevModels) =>
                    prevModels.map((m) =>
                        m.id === data.model_id ? { ...m, stage: data.message } : m
                    )
                );
                break;
            case 'preprocessed':
                console.log('preprocessed');
                setModels((prevModels) =>
                    prevModels.map((m) =>
                        m.id === data.model_id ? { ...m, stage: 'preprocessed' } : m
                    )
                );
                break;
            case 'modeling':
                console.log('modeling');
                setModels((prevModels) =>
                    prevModels.map((m) =>
                        m.id === data.model_id ? { ...m, stage: 'modeling' } : m
                    )
                );
                break;
            case 'modeled':
                console.log('modeled');
                setModels((prevModels) =>
                    prevModels.map((m) => (m.id === data.model_id ? { ...m, stage: 'modeled' } : m))
                );
                break;
            case 'end':
                console.log('end');
                setModels((prevModels) =>
                    prevModels.map((m) =>
                        m.id === data.model_id ? { ...m, isProcessing: false, stage: null } : m
                    )
                );
                break;
            default:
                console.log('Default');
                break;
        }
    };

    const startListening = async () => {
        const unknownModels = models.filter((model) => model.state !== 'known');

        if (unknownModels.length !== 0) {
            const result = await Promise.all(
                unknownModels.map((model) => {
                    return fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_MODEL_METADATA), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model_id: model.id,
                            dataset_id: datasetId || '',
                            workspace_id: currentWorkspace?.id || ''
                        })
                    });
                })
            );
            console.log('Result:', result);
            const data = await Promise.all(result.map((res) => res.json()));
            console.log('Data:', data);
            setModels((prevModels) => {
                return prevModels.map((model) => {
                    const modelData = data.find((d) => d.id === model.id);
                    console.log('Model Data:', modelData);
                    if (modelData) {
                        return {
                            id: model.id,
                            state: 'known',
                            isProcessing: modelData.end_time === null,
                            name: modelData.model_name,
                            type: modelData.type,
                            numTopics: modelData.num_topics,
                            stage: modelData.stage || null
                        };
                    }
                    return model;
                });
            });
        }
        registerCallback('model-loader', handleWebSocketMessage);
    };

    const stopListening = () => {
        unregisterCallback('model-loader');
        models.forEach((model) => {
            if (!model.isProcessing) {
                return;
            }
            setModels((prevModels) =>
                prevModels.map((m) => (m.id === model.id ? { ...m, state: 'unknown' } : m))
            );
        });
    };

    useEffect(() => {
        // Check if the path is '/modeling' or starts with '/modeling/'
        console.log('Location:', location.pathname);
        if (location.pathname.startsWith(`/${SHARED_ROUTES.DATA_MODELING}`)) {
            console.log('Listening for model updates');
            startListening();
            return () => {
                console.log('Stopped listening for model updates');
                stopListening();
            };
        }
    }, [location.pathname]);

    useEffect(() => {
        console.log('Modeling Context updated:', { models, activeModelId });
        if (models.length > 0 && !activeModelId) {
            setActiveModelId(models[0].id);
        }
    }, [models, activeModelId]);

    useEffect(() => {
        console.log('Current workspace:', currentWorkspace, datasetId);
        if (!currentWorkspace || !datasetId) return;
        console.log('Fetching models for dataset:', datasetId);
        fetch(getServerUrl(REMOTE_SERVER_ROUTES.LIST_MODELS), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workspace_id: currentWorkspace.id,
                dataset_id: datasetId
            })
        }).then(async (res) => {
            const data: {
                dataset_id: string;
                finished_at: string;
                id: string;
                method: string;
                model_name: string;
                num_topics: number;
                started_at: string;
                topics: string[];
                stage: string;
            }[] = await res.json();
            console.log('Data:', data);
            setModels(
                data.map(
                    (model) =>
                        ({
                            id: model.id,
                            isProcessing: model.finished_at === null,
                            name: model.model_name,
                            numTopics: model.num_topics,
                            type: model.method,
                            state: 'known',
                            stage: model.stage || null
                        }) as IModelState
                )
            );
        });
    }, [datasetId, currentWorkspace]);

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
            resetContext,
            addNewModel,
            setAddNewModel,
            updateContext,
            startListening,
            stopListening
        }),
        [models, activeModelId, addNewModel]
    );

    return <ModelingContext.Provider value={value}>{children}</ModelingContext.Provider>;
};

export const useModelingContext = () => useContext(ModelingContext);
