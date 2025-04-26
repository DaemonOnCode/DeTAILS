import { createContext, useState, useCallback, useMemo, FC, useContext, useEffect } from 'react';
import {
    BaseResponseHandlerActions,
    ILayout,
    IQECTTyResponse,
    SetState
} from '../types/Coding/shared';
import { useApi } from '../hooks/Shared/use-api';
import { useSettings } from './settings-context';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';
import { toast } from 'react-toastify';
import { useLoadingContext } from './loading-context';
import { PAGE_ROUTES } from '../constants/Coding/shared';
import { useLoadingSteps } from '../hooks/Shared/use-loading-steps';
import { useLocation } from 'react-router-dom';
import { CodebookType, IManualCodingContext } from '../types/Shared';

export const ManualCodingContext = createContext<IManualCodingContext>({
    postStates: {},
    addPostIds: async () => {},
    updatePostState: async () => {},
    isLoading: false,
    codebook: null,
    manualCodingResponses: [],
    dispatchManualCodingResponses: async () => {},
    updateContext: async () => {},
    resetContext: async () => {},
    generateCodebook: async () => {}
});

interface ManualCodingProviderProps extends ILayout {
    postIds: string[];
}

export const ManualCodingProvider: FC<ManualCodingProviderProps> = ({
    children,
    postIds: initialPostIds
}) => {
    const location = useLocation();
    const { settings } = useSettings();
    const { loadingState } = useLoadingContext();
    const [postStates, setPostStates] = useState<{ [postId: string]: boolean }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [codebook, setCodebook] = useState<CodebookType | null>(null);
    const [manualCodingResponses, setManualCodingResponses] = useState<IQECTTyResponse[]>([]);

    const { fetchData, fetchLLMData } = useApi();

    const saveManualCodingContext = async (operationType: string, payload: object) => {
        try {
            const { data, error } = await fetchData(
                REMOTE_SERVER_ROUTES.SAVE_MANUAL_CODING_CONTEXT,
                {
                    method: 'POST',
                    body: JSON.stringify({ type: operationType, ...payload })
                }
            );
            if (error) throw new Error(`Failed to save manual coding context for ${operationType}`);
            return data;
        } catch (error) {
            console.error(`Error in ${operationType}:`, error);
            throw error;
        }
    };

    const fetchManualCodingStates = async (stateNames: string[]) => {
        try {
            const { data, error } = await fetchData(
                REMOTE_SERVER_ROUTES.LOAD_MANUAL_CODING_CONTEXT,
                {
                    method: 'POST',
                    body: JSON.stringify({ states: stateNames })
                }
            );
            if (error)
                throw new Error(`Failed to fetch manual coding states: ${stateNames.join(', ')}`);
            return data;
        } catch (error) {
            console.error(`Error fetching manual coding states:`, error);
            throw error;
        }
    };

    useEffect(() => {
        const loadStates = async () => {
            const stateNames = ['postStates', 'codebook'];
            try {
                const fetchedData = await fetchManualCodingStates(stateNames);
                if (fetchedData) {
                    if (fetchedData.postStates !== undefined) setPostStates(fetchedData.postStates);
                    if (fetchedData.codebook !== undefined) setCodebook(fetchedData.codebook);
                }
            } catch (error) {
                console.error('Error loading manual coding states:', error);
            }
        };
        loadStates();
    }, []);

    useEffect(() => {
        if (codebook && Object.keys(codebook).length > 0 && Object.keys(postStates).length > 0) {
            const fetchResponses = async () => {
                try {
                    const postIds = Object.keys(postStates);
                    const { data, error } = await fetchLLMData<{
                        message: string;
                        data: IQECTTyResponse[];
                    }>(REMOTE_SERVER_ROUTES.GENERATE_DEDUCTIVE_CODES, {
                        method: 'POST',
                        body: JSON.stringify({
                            codebook,
                            post_ids: postIds,
                            model: settings.ai.model
                        })
                    });
                    if (error) throw new Error('Failed to fetch LLM responses');
                    toast.success('LLM generated deductive codes successfully');
                } catch (error) {
                    console.error('Error fetching LLM responses:', error);
                    toast.error('Failed to fetch LLM responses');
                }
            };
            fetchResponses();
        }
    }, [codebook]);

    const addPostIds = async (newPostIds: string[]) => {
        const data = await saveManualCodingContext('addPostIds', { newPostIds });
        if (data.postStates) setPostStates(data.postStates);
        return data;
    };

    const updatePostState = async (postId: string, state: boolean) => {
        const data = await saveManualCodingContext('updatePostState', { postId, state });
        if (data.postStates) setPostStates(data.postStates);
        return data;
    };

    const dispatchManualCodingResponses = async (
        action: BaseResponseHandlerActions<IQECTTyResponse>,
        refreshRef = null
    ) => {
        const data = await saveManualCodingContext('dispatchManualCodingResponses', { action });
        // if (data.manualCodingResponses) setManualCodingResponses(data.manualCodingResponses);
        refreshRef?.current?.refresh();
        return data;
    };

    const updateContext = async (updates: Partial<IManualCodingContext>) => {
        const data = await saveManualCodingContext('updateContext', updates);
        if (data.postStates) setPostStates(data.postStates);
        if (data.codebook) setCodebook(data.codebook);
        if (data.manualCodingResponses) setManualCodingResponses(data.manualCodingResponses);
    };

    const resetContext = async () => {
        const data = await saveManualCodingContext('resetContext', {});
        if (data.success) {
            setPostStates({});
            setCodebook({});
        }
    };

    const generateCodebook = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await fetchLLMData<{
                message: string;
                data: CodebookType;
            }>(REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK_WITHOUT_QUOTES, {
                method: 'POST',
                body: JSON.stringify({
                    model: settings.ai.model
                })
            });
            if (error) throw new Error('Failed to generate codebook');
            const newCodebook = data.data;
            const saveData = await saveManualCodingContext('setCodebook', {
                codebook: newCodebook
            });
            if (saveData.codebook !== undefined) setCodebook(saveData.codebook);
        } catch (error) {
            console.error('Error generating codebook:', error);
            toast.error('Failed to generate codebook');
        } finally {
            setIsLoading(false);
        }
    };

    const loadingStateInitialization: Record<
        string,
        {
            relatedStates: {
                name: string;
            }[];
        }
    > = useMemo(
        () => ({
            [PAGE_ROUTES.MANUAL_CODING]: {
                relatedStates: [
                    { name: 'setCodebook' },
                    {
                        name: 'setManualCodingResponses'
                    }
                ]
            }
        }),
        [codebook, manualCodingResponses]
    );

    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.MANUAL_CODING]?.stepRef);

    const fetchStates = async (stateNames: string[]) => {
        try {
            const { data, error } = await fetchData(
                REMOTE_SERVER_ROUTES.LOAD_MANUAL_CODING_CONTEXT,
                {
                    method: 'POST',
                    body: JSON.stringify({ states: stateNames })
                }
            );
            if (error) throw new Error(`Failed to fetch states: ${stateNames.join(', ')}`);
            return data;
        } catch (error) {
            console.error('Error fetching states:', JSON.stringify(error));
            throw error;
        }
    };

    useEffect(() => {
        const page = location.pathname;
        const stateMap: Record<string, string[]> = {
            [PAGE_ROUTES.HOME]: ['postStates', 'codebook'],
            [PAGE_ROUTES.MANUAL_CODING]: ['postStates', 'codebook']
        };
        const statesToFetch = stateMap[page] || [];
        if (statesToFetch.length > 0) {
            (async () => {
                try {
                    const fetchedData = await fetchStates(statesToFetch);
                    if (fetchedData) {
                        if (fetchedData.postStates !== undefined)
                            setPostStates(fetchedData.postStates);
                        if (fetchedData.codebook !== undefined) setCodebook(fetchedData.codebook);
                    }
                } catch (error) {
                    console.error('Error in state fetching effect:', error);
                }
            })();
        }
    }, [location.pathname]);

    const value = useMemo(
        () => ({
            postStates,
            addPostIds,
            updatePostState,
            isLoading,
            codebook,
            manualCodingResponses,
            dispatchManualCodingResponses,
            updateContext,
            resetContext,
            generateCodebook
        }),
        [postStates, isLoading, codebook, manualCodingResponses]
    );

    return <ManualCodingContext.Provider value={value}>{children}</ManualCodingContext.Provider>;
};

export const useManualCodingContext = () => useContext(ManualCodingContext);
