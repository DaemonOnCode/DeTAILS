import e from 'express';
import {
    KeywordEntry,
    KeywordsTableAction,
    BaseResponseHandlerActions,
    IQECResponse,
    SampleDataResponseReducerActions,
    IQECTResponse,
    SampleDataWithThemeResponseReducerActions,
    IQECTTyResponse
} from '../types/Coding/shared';

export const keywordTableReducer = (
    state: KeywordEntry[],
    action: KeywordsTableAction
): KeywordEntry[] => {
    console.log('Action:', action, 'Keyword Table');
    switch (action.type) {
        case 'INITIALIZE':
            return [...action.entries];
        case 'SET_ALL_CORRECT':
            return [...state.map((response) => ({ ...response, isMarked: true }))];
        case 'SET_ALL_INCORRECT':
            return [...state.map((response) => ({ ...response, isMarked: false }))];
        case 'SET_ALL_UNMARKED':
            return [...state.map((response) => ({ ...response, isMarked: undefined }))];
        case 'ADD_MANY':
            let newEntries = action.entries.filter(
                (entry) => state.findIndex((s) => s.word === entry.word) === -1
            );
            // return [...state, ...action.entries.filter((entry) => newEntries.length === 0)];
            return [...state.filter((entry) => entry.isMarked === true), ...newEntries];
        case 'UPDATE_FIELD':
            return state.map((entry, i) =>
                i === action.index
                    ? {
                          ...entry,
                          [action.field]: action.value
                      }
                    : entry
            );
        case 'TOGGLE_MARK':
            return state.map((entry, i) =>
                i === action.index
                    ? {
                          ...entry,
                          isMarked: action.isMarked
                      }
                    : entry
            );
        case 'ADD_ROW':
            let newRow: KeywordEntry = {
                word: '',
                description: '',
                codes: [],
                inclusion_criteria: [],
                exclusion_criteria: []
            };
            if (action.entry) {
                newRow = action.entry;
            }
            return [...state, newRow];
        case 'UNDO_DELETE_ROW':
            return [...state.splice(action.index, 0, action.entry)];
        case 'DELETE_ROW':
            return state.filter((_, i) => i !== action.index);
        case 'RESET':
            return [];
        default:
            return state;
    }
};

export function baseResponseHandler<T>(
    state: T[],
    action: BaseResponseHandlerActions<T>,
    config: Record<string, any>
): T[] {
    let newResponses: T[] = [];
    // console.log('Action:', action, 'Base');
    switch (action.type) {
        case 'SET_CORRECT':
            return state.map((response, index) =>
                index === action.index ? { ...response, isCorrect: true, comment: '' } : response
            );
        case 'SET_ALL_CORRECT':
            return [...state.map((response) => ({ ...response, isMarked: true }))];
        case 'SET_INCORRECT':
            return state.map((response, index) =>
                index === action.index ? { ...response, isCorrect: false } : response
            );
        case 'SET_ALL_INCORRECT':
            return [...state.map((response) => ({ ...response, isMarked: false }))];
        case 'SET_ALL_UNMARKED':
            return [...state.map((response) => ({ ...response, isMarked: undefined }))];
        case 'UPDATE_COMMENT':
            return state.map((response, index) =>
                index === action.index ? { ...response, comment: action.comment } : response
            );
        case 'MARK_RESPONSE':
            return state.map((response, index) =>
                index === action.index ? { ...response, isMarked: action.isMarked } : response
            );
        case 'MARK_RESPONSE_BY_CODE_EXPLANATION':
            return state.map((response: any) =>
                action.code === response.code &&
                action.quote === response.quote &&
                action.postId === response.postId
                    ? { ...response, isMarked: action.isMarked }
                    : response
            );
        case 'ADD_RESPONSE':
            newResponses = [action.response].filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return state.concat({
                ...(newResponses.length ? (newResponses[0] as any) : {})
            });
        case 'SET_RESPONSES':
            newResponses = (action.responses ?? []).filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return [...newResponses];
        case 'ADD_RESPONSES':
            newResponses = (action.responses ?? []).filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return [...state, ...newResponses];
        case 'REMOVE_RESPONSES':
            if (action.all) {
                return [];
            }
            if (action.indexes) {
                return state.filter((_, index) => !action.indexes!.includes(index));
            }
            return state;
        case 'DELETE_CODE':
            return state.filter((response: any) => response.code !== action.code);
        case 'EDIT_CODE':
            return [
                ...state.map((response: any) =>
                    response.code === action.currentCode
                        ? { ...response, code: action.newCode }
                        : response
                )
            ];
        case 'DELETE_HIGHLIGHT':
            return state.filter(
                (response: any) =>
                    !(
                        response.postId === action.postId &&
                        response.quote === action.sentence &&
                        response.code === action.code
                    )
            );
        case 'EDIT_HIGHLIGHT':
            return state.map((response: any) =>
                response.postId === action.postId &&
                response.quote === action.sentence &&
                response.code === action.code
                    ? { ...response, quote: action.newSentence }
                    : response
            );
        case 'SET_CHAT_HISTORY':
            return state.map((response: any) => {
                if (
                    response.postId === action.postId &&
                    response.quote === action.sentence &&
                    response.code === action.code
                ) {
                    return {
                        ...response,
                        chatHistory: action.chatHistory
                    };
                }
                return response;
            });
        case 'UPDATE_CODE':
            console.log(
                'Update code',
                state,
                action,
                state.filter(
                    (response: any) =>
                        response.quote === action.quote && response.code === action.prevCode
                )
            );
            return state.map((response: any) =>
                response.quote === action.quote && response.code === action.prevCode
                    ? { ...response, code: action.newCode }
                    : response
            );
        case 'RESET':
            return [];
        case 'RERUN_CODING':
        default:
            return state;
    }
}

export const sampleDataResponseReducer = (
    state: IQECResponse[],
    action: SampleDataResponseReducerActions
): IQECResponse[] => {
    console.log('Action:', action, 'Sample Data');
    switch (action.type) {
        case 'SET_CORRECT':
        case 'SET_ALL_CORRECT':
        case 'SET_INCORRECT':
        case 'SET_ALL_INCORRECT':
        case 'SET_ALL_UNMARKED':
        case 'UPDATE_COMMENT':
        case 'MARK_RESPONSE':
        case 'MARK_RESPONSE_BY_CODE_EXPLANATION':
        case 'ADD_RESPONSE':
        case 'ADD_RESPONSES':
        case 'REMOVE_RESPONSES':
        case 'SET_RESPONSES':
        case 'DELETE_CODE':
        case 'EDIT_CODE':
        case 'DELETE_HIGHLIGHT':
        case 'EDIT_HIGHLIGHT':
        case 'SET_CHAT_HISTORY':
        case 'UPDATE_CODE':
        case 'RESET':
            let baseData = baseResponseHandler(state, action, {});
            console.log('Base Data:', baseData, state);
            return baseData;

        default:
            return state;
    }
};

export const sampleDataWithThemeResponseReducer = (
    state: IQECTResponse[],
    action: SampleDataWithThemeResponseReducerActions
): IQECTResponse[] => {
    console.log('Action:', action, 'Sampled with theme', state);
    switch (action.type) {
        case 'SET_CORRECT':
        case 'SET_ALL_CORRECT':
        case 'SET_INCORRECT':
        case 'SET_ALL_INCORRECT':
        case 'SET_ALL_UNMARKED':
        case 'UPDATE_COMMENT':
        case 'MARK_RESPONSE':
        case 'MARK_RESPONSE_BY_CODE_EXPLANATION':
        case 'ADD_RESPONSE':
        case 'ADD_RESPONSES':
        case 'REMOVE_RESPONSES':
        case 'SET_RESPONSES':
        case 'DELETE_CODE':
        case 'EDIT_CODE':
        case 'DELETE_HIGHLIGHT':
        case 'EDIT_HIGHLIGHT':
        case 'SET_CHAT_HISTORY':
        case 'RESET':
            return baseResponseHandler(state, action, {});
        case 'UPDATE_THEMES':
            console.log('Themes:', action.themes);
            if (!action.themes?.length) return state;
            let newState = state.map((response) => {
                const theme = action.themes.find((theme) => theme.codes.includes(response.code));
                return theme ? { ...response, theme: theme.name } : response;
            });
            console.log('New State:', newState);
            return newState;
        case 'DELETE_THEME':
            return state.filter((response) => response.theme !== action.name);
        default:
            return state;
    }
};

export const unseenDataResponseReducer = (
    state: IQECTTyResponse[],
    action: BaseResponseHandlerActions<IQECTTyResponse>
): IQECTTyResponse[] => {
    console.log('Action:', action, 'Unseen Data');
    switch (action.type) {
        case 'SET_CORRECT':
        case 'SET_ALL_CORRECT':
        case 'SET_INCORRECT':
        case 'SET_ALL_INCORRECT':
        case 'SET_ALL_UNMARKED':
        case 'UPDATE_COMMENT':
        case 'MARK_RESPONSE':
        case 'MARK_RESPONSE_BY_CODE_EXPLANATION':
        case 'ADD_RESPONSE':
        case 'ADD_RESPONSES':
        case 'REMOVE_RESPONSES':
        case 'SET_RESPONSES':
        case 'DELETE_CODE':
        case 'EDIT_CODE':
        case 'DELETE_HIGHLIGHT':
        case 'EDIT_HIGHLIGHT':
        case 'SET_CHAT_HISTORY':
        case 'UPDATE_CODE':
        case 'RESET':
            return baseResponseHandler(state, action, {});

        default:
            return state;
    }
};
