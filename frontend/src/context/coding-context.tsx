import { createContext, useState, FC, useCallback, useReducer, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import {
    IFile,
    ILayout,
    Mode,
    IReference,
    KeywordEntry,
    IQECTResponse,
    IQECTTyResponse,
    IQECResponse,
    ThemeBucket,
    KeywordsTableAction,
    BaseResponseHandlerActions,
    SampleDataResponseReducerActions,
    SampleDataWithThemeResponseReducerActions
} from '../types/Coding/shared';
import { ICodingContext } from '../types/Shared';

export const CodingContext = createContext<ICodingContext>({
    contextFiles: {},
    addContextFile: () => {},
    removeContextFile: () => {},
    mainTopic: '',
    setMainTopic: () => {},
    additionalInfo: '',
    setAdditionalInfo: () => {},
    keywords: [],
    setKeywords: () => {},
    selectedKeywords: [],
    setSelectedKeywords: () => {},
    words: [],
    setWords: () => {},
    selectedWords: [],
    setSelectedWords: () => {},
    references: {},
    setReferences: () => {},
    keywordTable: [],
    dispatchKeywordsTable: () => {},
    updateContext: () => {},
    resetContext: () => {},
    sampledPostResponse: [],
    dispatchSampledPostResponse: () => {},
    sampledPostResponseCopy: [],
    setSampledPostResponseCopy: () => {},
    sampledPostWithThemeResponse: [],
    dispatchSampledPostWithThemeResponse: () => {},
    unseenPostResponse: [],
    dispatchUnseenPostResponse: () => {},
    themes: [],
    setThemes: () => {},
    unplacedCodes: [],
    setUnplacedCodes: () => {},
    researchQuestions: [],
    setResearchQuestions: () => {},
    sampledPostIds: [],
    setSampledPostIds: () => {},
    unseenPostIds: [],
    setUnseenPostIds: () => {},
    conflictingResponses: [],
    setConflictingResponses: () => {}
});

// Reducer function to manage the state of responses
// function codeResponsesReducer<T>(state: T[], action: Action<T>): T[] {
//     console.log('Action:', action);
//     let newResponses: T[] = [];
//     switch (action.type) {
//         case 'SET_CORRECT':
//             return state.map((response, index) =>
//                 index === action.index ? { ...response, isCorrect: true, comment: '' } : response
//             );
//         case 'SET_ALL_CORRECT':
//             return [...state.map((response) => ({ ...response, isMarked: true }))];
//         case 'SET_INCORRECT':
//             return state.map((response, index) =>
//                 index === action.index ? { ...response, isCorrect: false } : response
//             );
//         case 'SET_ALL_INCORRECT':
//             return [...state.map((response) => ({ ...response, isMarked: false }))];
//         case 'SET_ALL_UNMARKED':
//             return [...state.map((response) => ({ ...response, isMarked: undefined }))];
//         case 'UPDATE_COMMENT':
//             return state.map((response, index) =>
//                 index === action.index ? { ...response, comment: action.comment } : response
//             );
//         case 'MARK_RESPONSE':
//             return state.map((response, index) =>
//                 index === action.index ? { ...response, isMarked: action.isMarked } : response
//             );
//         case 'RERUN_CODING':
//             return state
//                 .filter((_, index) => !action.indexes.includes(index))
//                 .concat(action.newResponses);
//         case 'ADD_RESPONSE':
//             newResponses = [action.response].filter(
//                 (response: any) =>
//                     response.coded_word?.trim() !== '' && response.sentence?.trim() !== ''
//             );
//             return state.concat({
//                 ...(newResponses.length ? (newResponses[0] as any) : {})
//             });
//         case 'SET_RESPONSES':
//             newResponses = action.responses.filter(
//                 (response: any) =>
//                     response.coded_word?.trim() !== '' && response.sentence?.trim() !== ''
//             );
//             return [...newResponses];
//         case 'ADD_RESPONSES':
//             newResponses = action.responses.filter(
//                 (response: any) =>
//                     response.coded_word?.trim() !== '' && response.sentence?.trim() !== ''
//             );
//             return [...state, ...newResponses];
//         case 'REMOVE_RESPONSES':
//             if (action.all) {
//                 return [];
//             }
//             if (action.indexes) {
//                 return state.filter((_, index) => !action.indexes!.includes(index));
//             }
//             return state;
//         case 'DELETE_CODE':
//             return state.filter((response: any) => response.coded_word !== action.code);
//         case 'EDIT_CODE':
//             return [
//                 ...state.map((response: any) =>
//                     response.coded_word === action.currentCode
//                         ? { ...response, coded_word: action.newCode }
//                         : response
//                 )
//             ];
//         case 'DELETE_HIGHLIGHT':
//             return state.filter(
//                 (response: any) =>
//                     response.postId !== action.postId && response.sentence !== action.sentence
//             );
//         case 'EDIT_HIGHLIGHT':
//             return state.map((response: any) =>
//                 response.postId === action.postId && response.sentence === action.sentence
//                     ? { ...response, sentence: action.newSentence }
//                     : response
//             );
//         default:
//             return state;
//     }
// }

const keywordTableReducer = (
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
            return [...state.filter((entry) => entry.isMarked === true), ...action.entries];
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
        default:
            return state;
    }
};

function baseResponseHandler<T>(
    state: T[],
    action: BaseResponseHandlerActions<T>,
    config: Record<string, any>
): T[] {
    let newResponses: T[] = [];
    console.log('Action:', action, 'Base');
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
        default:
            return state;
    }
}

const sampleDataResponseReducer = (
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
            let baseData = baseResponseHandler(state, action, {});
            console.log('Base Data:', baseData, state);
            return baseData;

        default:
            return state;
    }
};

const sampleDataWithThemeResponseReducer = (
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

const unseenDataResponseReducer = (
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
            return baseResponseHandler(state, action, {});

        default:
            return state;
    }
};

// Create a provider component
export const CodingProvider: FC<ILayout> = ({ children }) => {
    const [currentMode, setCurrentMode] = useState<Mode>('folder');
    const [modeInput, setModeInput] = useState<string>('');
    const [subreddit, setSubreddit] = useState<string>('');
    const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
    const [contextFiles, setContextFiles] = useState<IFile>({});
    const [mainTopic, setMainTopic] = useState<string>('');
    const [additionalInfo, setAdditionalInfo] = useState<string>('');

    const [researchQuestions, setResearchQuestions] = useState<string[]>([]);

    const [words, setWords] = useState<string[]>([]);
    const [selectedWords, setSelectedWords] = useState<string[]>([]);

    const [sampledPostIds, setSampledPostIds] = useState<string[]>([]);

    const [unseenPostIds, setUnseenPostIds] = useState<string[]>([]);

    const [sampledPostResponse, dispatchSampledPostResponse] = useReducer(
        sampleDataResponseReducer,
        []
    );

    const [sampledPostResponseCopy, setSampledPostResponseCopy] = useState<IQECResponse[]>([]);

    const [sampledPostWithThemeResponse, dispatchSampledPostWithThemeResponse] = useReducer(
        sampleDataWithThemeResponseReducer,
        []
    );

    const [unseenPostResponse, dispatchUnseenPostResponse] = useReducer(
        unseenDataResponseReducer,
        []
    );

    const [conflictingResponses, setConflictingResponses] = useState<IQECResponse[]>([]);

    const [keywords, setKeywords] = useState<string[]>([]);
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

    const [references, setReferences] = useState<{
        [code: string]: IReference[];
    }>({});

    const [keywordTable, dispatchKeywordsTable] = useReducer(keywordTableReducer, []);

    const [themes, setThemes] = useState<ThemeBucket[]>([]);

    const [unplacedCodes, setUnplacedCodes] = useState<string[]>([]);

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

    const addContextFile = useCallback((filePath: string, fileName: string) => {
        setContextFiles((prevFiles) => ({ ...prevFiles, [filePath]: fileName }));
    }, []);

    const removeContextFile = useCallback((filePath: string) => {
        setContextFiles((prevFiles) => {
            const newFiles = { ...prevFiles };
            delete newFiles[filePath];
            return newFiles;
        });
    }, []);

    const updateContext = (updates: Partial<ICodingContext>) => {
        console.log('Updates:', updates);
        if (updates.contextFiles) setContextFiles(updates.contextFiles);
        if (updates.mainTopic) setMainTopic(updates.mainTopic);
        if (updates.additionalInfo) setAdditionalInfo(updates.additionalInfo);
        if (updates.keywords) setKeywords(updates.keywords);
        if (updates.selectedKeywords) setSelectedKeywords(updates.selectedKeywords);
        if (updates.words) setWords(updates.words);
        if (updates.selectedWords) setSelectedWords(updates.selectedWords);
        if (updates.references) setReferences(updates.references);
        if (updates.keywordTable) {
            dispatchKeywordsTable({ type: 'INITIALIZE', entries: updates.keywordTable });
        }
        if (updates.sampledPostWithThemeResponse) {
            dispatchSampledPostWithThemeResponse({
                type: 'SET_RESPONSES',
                responses: updates.sampledPostWithThemeResponse
            });
        }
        if (updates.sampledPostResponse) {
            dispatchSampledPostResponse({
                type: 'SET_RESPONSES',
                responses: updates.sampledPostResponse
            });
        }
        if (updates.unseenPostResponse) {
            dispatchUnseenPostResponse({
                type: 'SET_RESPONSES',
                responses: updates.unseenPostResponse
            });
        }
        if (updates.themes) setThemes(updates.themes);
        if (updates.unplacedCodes) setUnplacedCodes(updates.unplacedCodes);
        if (updates.researchQuestions) setResearchQuestions(updates.researchQuestions);
        if (updates.sampledPostIds) setSampledPostIds(updates.sampledPostIds);
        if (updates.unseenPostIds) setUnseenPostIds(updates.unseenPostIds);
        if (updates.conflictingResponses) setConflictingResponses(updates.conflictingResponses);
    };

    const resetContext = () => {
        setContextFiles({});
        setMainTopic('');
        setAdditionalInfo('');
        setKeywords([]);
        setSelectedKeywords([]);
        setWords([]);
        setSelectedWords([]);
        setReferences({});
        dispatchKeywordsTable({ type: 'INITIALIZE', entries: [] });
        dispatchSampledPostWithThemeResponse({ type: 'SET_RESPONSES', responses: [] });
        dispatchSampledPostResponse({
            type: 'SET_RESPONSES',
            responses: []
        });
        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: []
        });
        setThemes([]);
        setUnplacedCodes([]);
        setResearchQuestions([]);
        setSampledPostIds([]);
        setUnseenPostIds([]);
        setConflictingResponses([]);
    };

    useEffect(() => {
        if (!keywords.includes(mainTopic)) {
            setSelectedKeywords([mainTopic]);
        }
    }, [mainTopic]);

    useEffect(() => {
        console.log('KT update', keywordTable);
    }, [keywordTable]);

    const value = useMemo(
        () => ({
            contextFiles,
            addContextFile,
            removeContextFile,
            selectedPosts,
            setSelectedPosts,
            mainTopic,
            setMainTopic,
            additionalInfo,
            setAdditionalInfo,
            keywords,
            setKeywords,
            selectedKeywords,
            setSelectedKeywords,
            words,
            setWords,
            selectedWords,
            setSelectedWords,
            references,
            setReferences,
            keywordTable,
            dispatchKeywordsTable,
            updateContext,
            resetContext,
            sampledPostResponse,
            dispatchSampledPostResponse,
            sampledPostResponseCopy,
            setSampledPostResponseCopy,
            sampledPostWithThemeResponse,
            dispatchSampledPostWithThemeResponse,
            unseenPostResponse,
            dispatchUnseenPostResponse,
            themes,
            setThemes,
            unplacedCodes,
            setUnplacedCodes,
            researchQuestions,
            setResearchQuestions,
            sampledPostIds,
            setSampledPostIds,
            unseenPostIds,
            setUnseenPostIds,
            conflictingResponses,
            setConflictingResponses
        }),
        [
            currentMode,
            modeInput,
            selectedPosts,
            subreddit,
            contextFiles,
            mainTopic,
            additionalInfo,
            keywords,
            selectedKeywords,
            words,
            selectedWords,
            keywordTable,
            references,
            sampledPostResponse,
            sampledPostResponseCopy,
            sampledPostWithThemeResponse,
            unseenPostResponse,
            themes,
            unplacedCodes,
            researchQuestions,
            sampledPostIds,
            unseenPostIds,
            conflictingResponses
        ]
    );

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

export const useCodingContext = () => useContext(CodingContext);
