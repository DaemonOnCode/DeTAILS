import {
    MetadataState,
    MetadataAction,
    InterviewData,
    RedditData,
    DataAction
} from '../context/collection-context';

export const metadataReducer = (state: MetadataState, action: MetadataAction): MetadataState => {
    if (!state) {
        return null;
    }
    switch (action.type) {
        case 'SET_SOURCE':
            return { ...state, source: action.payload } as MetadataState;
        case 'SET_SUBREDDIT':
            // Only applies if state is RedditMetadata.
            if (state.type === 'reddit') {
                return { ...state, subreddit: action.payload };
            }
            return state;
        case 'RESET_METADATA':
            // Return default values based on the type.
            return state.type === 'reddit'
                ? { type: 'reddit', source: 'folder', subreddit: '' }
                : { type: 'interview', source: 'folder' };
        default:
            return state;
    }
};

export const datasetReducer = (
    state: (RedditData | InterviewData)[],
    action: DataAction
): (RedditData | InterviewData)[] => {
    switch (action.type) {
        case 'ADD_DATA':
            return [...state, action.payload];
        case 'RESET_DATA':
            return [];
        default:
            return state;
    }
};
