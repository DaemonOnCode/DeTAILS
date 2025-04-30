import {
    MetadataState,
    MetadataAction,
    RedditData,
    InterviewData,
    DataAction
} from '../types/DataCollection/shared';

export const metadataReducer = (state: MetadataState, action: MetadataAction): MetadataState => {
    if (!state) {
        return null;
    }
    switch (action.type) {
        case 'SET_SOURCE':
            return { ...state, source: action.payload } as MetadataState;
        case 'SET_SUBREDDIT':
            if (state.type === 'reddit') {
                return { ...state, subreddit: action.payload };
            }
            return state;
        case 'RESET_METADATA':
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
