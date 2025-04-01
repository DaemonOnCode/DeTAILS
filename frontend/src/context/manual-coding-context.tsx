import {
    createContext,
    useState,
    useCallback,
    useMemo,
    FC,
    useContext,
    useEffect,
    useRef,
    useReducer,
    Dispatch
} from 'react';
import {
    BaseResponseHandlerActions,
    ILayout,
    IQECTTyResponse,
    SetState
} from '../types/Coding/shared';
import { useApi } from '../hooks/Shared/use-api';
import { useCodingContext } from './coding-context';
import { useCollectionContext } from './collection-context';
import { useSettings } from './settings-context';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';
import { getGroupedCodeOfSubCode } from '../utility/theme-finder';
import { testDataResponseReducer } from '../reducers/coding';
import { useWorkspaceContext } from './workspace-context';
import { toast } from 'react-toastify';
import { useLoadingContext } from './loading-context';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { PAGE_ROUTES, ROUTES } from '../constants/Coding/shared';
import { useLoadingSteps } from '../hooks/Shared/use-loading-steps';

// Define the type for the codebook (replace 'any' with the actual type if known)
type CodebookType = {
    [code: string]: string;
};

// Define the context interface with additional properties
export interface IManualCodingContext {
    postStates: { [postId: string]: boolean }; // Tracks marked state for each postId
    addPostIds: (newPostIds: string[], initialState?: boolean) => void; // Function to add new postIds
    updatePostState: (postId: string, state: boolean) => void; // Function to update post state
    isLoading: boolean; // Indicates if the codebook is being created
    codebook: CodebookType | null; // Stores the codebook data
    manualCodingResponses: IQECTTyResponse[]; // Stores the manual coding responses
    dispatchManualCodingResponses: Dispatch<BaseResponseHandlerActions<IQECTTyResponse>>; // Dispatch function for manual coding responses
    updateContext: (updates: Partial<IManualCodingContext>) => void;
    resetContext: () => void;
    generateCodebook: (
        sampledPostResponses: any[],
        unseenPostResponses: any[],
        groupedCodes: any[]
    ) => void;
}

// Create the context with default values
export const ManualCodingContext = createContext<IManualCodingContext>({
    postStates: {},
    addPostIds: () => {},
    updatePostState: () => {},
    isLoading: false,
    codebook: null,
    manualCodingResponses: [],
    dispatchManualCodingResponses: () => {},
    updateContext: () => {},
    resetContext: () => {},
    generateCodebook: () => {}
});

// Define props for the provider
interface ManualCodingProviderProps extends ILayout {
    postIds: string[];
}

// Create the provider component
export const ManualCodingProvider: FC<ManualCodingProviderProps> = ({
    children,
    postIds: initialPostIds
}) => {
    const { settings } = useSettings();
    const { loadingState, loadingDispatch, registerStepRef } = useLoadingContext();
    const { datasetId, selectedData } = useCollectionContext();
    const { sampledPostResponse, unseenPostResponse, groupedCodes, sampledPostIds, unseenPostIds } =
        useCodingContext();
    const { currentWorkspace } = useWorkspaceContext();
    console.log('Initial postIds', initialPostIds);
    // State for post states, initialized with initial postIds
    const [postStates, setPostStates] = useState<{ [postId: string]: boolean }>(
        initialPostIds.reduce((acc, id) => ({ ...acc, [id]: false }), {})
    );
    // State for loading indicator
    const [isLoading, setIsLoading] = useState(false);
    // State for the codebook
    const [codebook, setCodebook] = useState<CodebookType | null>(null);
    // Ref to track previous postIds
    const prevPostIdsRef = useRef<string[]>([]);

    const [manualCodingResponses, dispatchManualCodingResponses] = useReducer(
        testDataResponseReducer,
        []
    );

    const { fetchData, fetchLLMData } = useApi();

    const fetchLLMResponses = useCallback(
        async (codebook: CodebookType, postIds: string[]) => {
            const { data, error } = await fetchLLMData<{
                message: string;
                data: IQECTTyResponse[];
            }>(REMOTE_SERVER_ROUTES.GENERATE_DEDUCTIVE_CODES, {
                method: 'POST',
                body: JSON.stringify({
                    codebook,
                    post_ids: postIds,
                    model: settings.ai.model,
                    workspace_id: currentWorkspace!.id,
                    dataset_id: datasetId
                })
            });
            if (error) {
                throw new Error('Failed to fetch LLM responses');
            }
            return data.data;
        },
        [fetchLLMData, settings]
    );
    const generateCodebookWithoutQuotes = useCallback(
        async (sampledPostResponses: any[], unseenPostResponses: any[], groupedCodes: any[]) => {
            console.log(
                'Generating codebook without quotes',
                settings,
                datasetId,
                sampledPostResponses,
                unseenPostResponses
            );
            if (
                !settings.app.id ||
                !sampledPostResponses.length ||
                !unseenPostResponses.length ||
                !groupedCodes?.length
            ) {
                console.log(
                    'Returning empty object, settings.app.id:',
                    settings.app.id,
                    'sampledPostResponse.length:',
                    sampledPostResponses.length,
                    'unseenPostResponse.length:',
                    unseenPostResponses.length
                );
                return {};
            }
            // Call the backend API to generate the codebook
            const { data, error } = await fetchLLMData<{
                message: string;
                data: CodebookType;
            }>(REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK_WITHOUT_QUOTES, {
                method: 'POST',
                body: JSON.stringify({
                    dataset_id: datasetId,
                    unseen_post_responses: unseenPostResponses.map((r) => ({
                        postId: r.postId,
                        id: r.id,
                        code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                        quote: r.quote,
                        explanation: r.explanation,
                        comment: r.comment,
                        subCode: r.code
                    })),
                    sampled_post_responses: sampledPostResponses.map((r) => ({
                        postId: r.postId,
                        id: r.id,
                        code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                        quote: r.quote,
                        explanation: r.explanation,
                        comment: r.comment,
                        subCode: r.code
                    })),
                    model: settings.ai.model
                })
            });
            if (error) {
                console.error('Failed to generate codebook:', error);
                throw new Error('Failed to generate codebook');
            }
            return data.data;
        },
        [settings, datasetId, groupedCodes]
    );

    // Function to add new postIds, avoiding overwrites of existing ones
    const addPostIds = useCallback((newPostIds: string[], initialState = false) => {
        setPostStates((prev) => {
            const newStates = newPostIds.reduce(
                (acc, id) => {
                    if (!(id in prev)) {
                        // Only add if not already present
                        acc[id] = initialState;
                    }
                    return acc;
                },
                {} as { [postId: string]: boolean }
            );
            return { ...prev, ...newStates };
        });
    }, []);

    // Function to update the state of an existing post
    const updatePostState = useCallback((postId: string, state: boolean) => {
        setPostStates((prev) => ({ ...prev, [postId]: state }));
    }, []);

    // Function to create the codebook by calling the backend
    const createCodebook = useCallback(
        async (sampledPostResponses: any[], unseenPostResponses: any[], groupedCodes: any[]) => {
            setIsLoading(true);
            try {
                const newCodebook = await generateCodebookWithoutQuotes(
                    sampledPostResponses,
                    unseenPostResponses,
                    groupedCodes
                );
                setCodebook(newCodebook);
            } catch (error) {
                console.error('Error creating codebook:', error);
            } finally {
                setIsLoading(false);
            }
        },
        [generateCodebookWithoutQuotes]
    );

    const updateContext = (updates: Partial<IManualCodingContext>) => {
        console.log('Updates:', updates);
        if (updates.postStates) {
            setPostStates(updates.postStates);
        }
        if (updates.codebook) {
            setCodebook(updates.codebook);
        }
        if (updates.manualCodingResponses) {
            dispatchManualCodingResponses({
                type: 'ADD_RESPONSES',
                responses: updates.manualCodingResponses
            });
        }
    };

    const resetContext = () => {
        setPostStates({});
        setCodebook(null);
        dispatchManualCodingResponses({ type: 'RESET' });
    };

    // Effect to trigger codebook creation when the set of postIds changes
    const generateCodebook = useCallback(
        (sampledPostResponse: any[], unseenPostResponse: any[], groupedCodes: any[]) => {
            console.log(
                'Manual context mounted',
                Object.keys(codebook ?? {}).length === 0,
                Object.keys(codebook ?? {}).length !== 0
            );
            if (Object.keys(codebook ?? {}).length !== 0) return;
            // const currentPostIds = Object.keys(postStates);
            // if (currentPostIds.length > 0 && !setsEqual(currentPostIds, prevPostIdsRef.current)) {
            createCodebook(sampledPostResponse, unseenPostResponse, groupedCodes);
            //     prevPostIdsRef.current = currentPostIds;
            // }
        },
        [codebook, postStates, createCodebook]
    );

    useEffect(() => {
        if (postStates && Object.keys(postStates).length > 0) {
            console.log('Post states:', postStates);
            return;
        }

        const testPostIds = selectedData.filter(
            (p) => !sampledPostIds.includes(p) && !unseenPostIds.includes(p)
        );

        console.log('Test postIds:', testPostIds);

        setPostStates(testPostIds.reduce((acc, id) => ({ ...acc, [id]: false }), {}));
    }, [sampledPostIds, unseenPostIds]);

    useEffect(() => {
        if (
            manualCodingResponses.length === 0 &&
            codebook &&
            Object.keys(codebook).length > 0 &&
            Object.keys(postStates).length > 0 &&
            sampledPostResponse.length > 0 &&
            unseenPostResponse.length > 0
        ) {
            const fetchResponses = async () => {
                try {
                    const postIds = Object.keys(postStates);
                    const responses = await fetchLLMResponses(codebook, postIds);
                    const llmResponses = responses.map((resp) => ({
                        ...resp,
                        type: 'LLM',
                        isMarked: true
                    }));
                    dispatchManualCodingResponses({
                        type: 'ADD_RESPONSES',
                        responses: llmResponses
                    });
                    toast.success('LLM generated deductive codes successfully');
                } catch (error) {
                    console.error('Error fetching LLM responses:', error);
                }
            };
            fetchResponses();
        }
    }, [codebook, sampledPostResponse, unseenPostResponse]);

    const loadingStateInitialization: Record<
        string,
        {
            relatedStates: {
                state: any;
                func: SetState<any> | Dispatch<any>;
                name: string;
                initValue?: any;
            }[];
            downloadData?: { name: string; data: any[]; condition?: boolean };
        }
    > = useMemo(
        () =>
            settings.general.manualCoding
                ? {
                      [PAGE_ROUTES.MANUAL_CODING]: {
                          relatedStates: [
                              {
                                  state: codebook,
                                  func: setCodebook,
                                  name: 'setCodebook',
                                  initValue: null
                              },
                              {
                                  state: manualCodingResponses,
                                  func: dispatchManualCodingResponses,
                                  name: 'dispatchManualCodingResponses'
                              }
                          ]
                      }
                  }
                : {},
        [codebook, manualCodingResponses]
    );

    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.MANUAL_CODING]?.stepRef);

    // Memoize the context value
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
        [postStates, addPostIds, updatePostState, isLoading, codebook, manualCodingResponses]
    );

    return <ManualCodingContext.Provider value={value}>{children}</ManualCodingContext.Provider>;
};

// Helper function to compare two arrays as sets
function setsEqual(a: string[], b: string[]) {
    const setA = new Set(a);
    const setB = new Set(b);
    return a.length === b.length && a.every((id) => setB.has(id));
}

// Hook to use the context
export const useManualCodingContext = () => useContext(ManualCodingContext);
