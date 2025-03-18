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
import { BaseResponseHandlerActions, ILayout, IQECTTyResponse } from '../types/Coding/shared';
import { useApi } from '../hooks/Shared/use-api';
import { useCodingContext } from './coding-context';
import { useCollectionContext } from './collection-context';
import { useSettings } from './settings-context';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';
import { getGroupedCodeOfSubCode } from '../utility/theme-finder';
import { testDataResponseReducer } from '../reducers/coding';

// Define the type for the codebook (replace 'any' with the actual type if known)
type CodebookType = {
    [code: string]: string;
};

// Define the context interface with additional properties
interface IManualCodingContext {
    postStates: { [postId: string]: boolean }; // Tracks marked state for each postId
    addPostIds: (newPostIds: string[], initialState?: boolean) => void; // Function to add new postIds
    updatePostState: (postId: string, state: boolean) => void; // Function to update post state
    isLoading: boolean; // Indicates if the codebook is being created
    codebook: CodebookType | null; // Stores the codebook data
    manualCodingResponses: IQECTTyResponse[]; // Stores the manual coding responses
    dispatchManualCodingResponses: Dispatch<BaseResponseHandlerActions<IQECTTyResponse>>; // Dispatch function for manual coding responses
}

// Create the context with default values
export const ManualCodingContext = createContext<IManualCodingContext>({
    postStates: {},
    addPostIds: () => {},
    updatePostState: () => {},
    isLoading: false,
    codebook: null,
    manualCodingResponses: [],
    dispatchManualCodingResponses: () => {}
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
    const { datasetId, selectedData } = useCollectionContext();
    const { sampledPostResponse, unseenPostResponse, groupedCodes, sampledPostIds, unseenPostIds } =
        useCodingContext();
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

    const { fetchData } = useApi();

    const generateCodebookWithoutQuotes = useCallback(async () => {
        console.log(
            'Generating codebook without quotes',
            settings,
            datasetId,
            sampledPostResponse,
            unseenPostResponse
        );
        if (!settings.app.id || !sampledPostResponse.length || !unseenPostResponse.length)
            return {};
        // Call the backend API to generate the codebook
        const { data, error } = await fetchData<{
            message: string;
            data: CodebookType;
        }>(REMOTE_SERVER_ROUTES.GENERATE_CODEBOOK_WITHOUT_QUOTES, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                unseen_post_responses: unseenPostResponse.map((r) => ({
                    postId: r.postId,
                    id: r.id,
                    code: getGroupedCodeOfSubCode(r.code, groupedCodes),
                    quote: r.quote,
                    explanation: r.explanation,
                    comment: r.comment,
                    subCode: r.code
                })),
                sampled_post_responses: sampledPostResponse.map((r) => ({
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
            throw new Error('Failed to generate codebook');
        }
        return data.data;
    }, [settings, datasetId, sampledPostResponse, unseenPostResponse, groupedCodes]);

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
    const createCodebook = useCallback(async () => {
        setIsLoading(true);
        try {
            const newCodebook = await generateCodebookWithoutQuotes();
            setCodebook(newCodebook);
        } catch (error) {
            console.error('Error creating codebook:', error);
        } finally {
            setIsLoading(false);
        }
    }, [generateCodebookWithoutQuotes]);

    // Effect to trigger codebook creation when the set of postIds changes
    useEffect(() => {
        const currentPostIds = Object.keys(postStates);
        if (!setsEqual(currentPostIds, prevPostIdsRef.current)) {
            createCodebook();
            prevPostIdsRef.current = currentPostIds;
        }
    }, [postStates, createCodebook]);

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

    // Memoize the context value
    const value = useMemo(
        () => ({
            postStates,
            addPostIds,
            updatePostState,
            isLoading,
            codebook,
            manualCodingResponses,
            dispatchManualCodingResponses
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
