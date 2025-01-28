import {
    createContext,
    useState,
    FC,
    Dispatch,
    useCallback,
    useReducer,
    useEffect,
    useContext
} from 'react';
import { useMemo } from 'react';
import {
    IFinalCodeResponse,
    IFile,
    ILayout,
    ISentenceBox,
    Mode,
    SetState,
    IReference,
    KeywordEntry,
    IQECRow,
    IQECTRow,
    IQECTResponse,
    IQECTTyResponse,
    IQECResponse,
    ThemeBucket
} from '../types/Coding/shared';

export interface ICodingContext {
    contextFiles: IFile;
    addContextFile: (filePath: string, fileName: string) => void;
    removeContextFile: (filePath: string) => void;
    mainCode: string;
    setMainCode: SetState<string>;
    additionalInfo?: string;
    setAdditionalInfo: SetState<string>;
    keywords: string[];
    setKeywords: SetState<string[]>;
    selectedKeywords: string[];
    setSelectedKeywords: SetState<string[]>;
    words: string[];
    setWords: SetState<string[]>;
    selectedWords: string[];
    setSelectedWords: SetState<string[]>;
    references: {
        [code: string]: IReference[];
    };
    setReferences: SetState<{
        [code: string]: IReference[];
    }>;
    keywordTable: KeywordEntry[];
    dispatchKeywordsTable: Dispatch<any>;
    // codeResponses: ISentenceBox[];
    // dispatchCodeResponses: Dispatch<any>;
    // finalCodeResponses: IFinalCodeResponse[];
    // dispatchFinalCodeResponses: Dispatch<any>;
    updateContext: (updates: Partial<ICodingContext>) => void;
    resetContext: () => void;
    // sampledPostData: IQECRow[];
    // unseenPostData: IQECRow[];
    // setSampledPostData: SetState<IQECRow[]>;
    // setUnseenPostData: SetState<IQECRow[]>;
    // sampledPostWithThemeData: IQECTRow[];
    // unseenPostWithThemeData: IQECTRow[];
    // setSampledPostWithThemeData: SetState<IQECTRow[]>;
    // setUnseenPostWithThemeData: SetState<IQECTRow[]>;
    // llmCodeResponses: IQECTResponse[];
    // dispatchLLMCodeResponses: Dispatch<any>;
    // humanCodeResponses: IQECTResponse[];
    // dispatchHumanCodeResponses: Dispatch<any>;
    sampledPostResponse: IQECResponse[];
    dispatchSampledPostResponse: Dispatch<any>;
    sampledPostWithThemeResponse: IQECTResponse[];
    dispatchSampledPostWithThemeResponse: Dispatch<any>;
    unseenPostResponse: IQECTTyResponse[];
    dispatchUnseenPostResponse: Dispatch<any>;
    themes: ThemeBucket[];
    setThemes: SetState<ThemeBucket[]>;
    unplacedCodes: string[];
    setUnplacedCodes: SetState<string[]>;
    researchQuestions: string[];
    setResearchQuestions: SetState<string[]>;
    sampledPostIds: string[];
    setSampledPostIds: SetState<string[]>;
    unseenPostIds: string[];
    setUnseenPostIds: SetState<string[]>;
}

// Create the context
export const CodingContext = createContext<ICodingContext>({
    contextFiles: {},
    addContextFile: () => {},
    removeContextFile: () => {},
    mainCode: '',
    setMainCode: () => {},
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
    // codeResponses: [],
    // dispatchCodeResponses: () => {},
    // finalCodeResponses: [],
    // dispatchFinalCodeResponses: () => {},
    updateContext: () => {},
    resetContext: () => {},
    // sampledPostData: [],
    // unseenPostData: [],
    // setSampledPostData: () => {},
    // setUnseenPostData: () => {},

    // sampledPostWithThemeData: [],
    // unseenPostWithThemeData: [],
    // setSampledPostWithThemeData: () => {},
    // setUnseenPostWithThemeData: () => {},
    // llmCodeResponses: [],
    // dispatchLLMCodeResponses: () => {},
    // humanCodeResponses: [],
    // dispatchHumanCodeResponses: () => {}
    sampledPostResponse: [],
    dispatchSampledPostResponse: () => {},
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
    setUnseenPostIds: () => {}
});

type Action<T> =
    | { type: 'SET_CORRECT'; index: number }
    | { type: 'SET_ALL_CORRECT' }
    | { type: 'SET_INCORRECT'; index: number }
    | { type: 'SET_ALL_INCORRECT' }
    | { type: 'UPDATE_COMMENT'; index: number; comment: string }
    | { type: 'MARK_RESPONSE'; index: number; isMarked?: boolean }
    | { type: 'RERUN_CODING'; indexes: number[]; newResponses: T[] }
    | {
          type: 'ADD_RESPONSE';
          response: T;
      }
    | { type: 'ADD_RESPONSES'; responses: T[] }
    | (
          | { type: 'REMOVE_RESPONSES'; indexes: number[]; all?: never }
          | { type: 'REMOVE_RESPONSES'; all: boolean; indexes?: never }
      )
    | { type: 'SET_ALL_UNMARKED' }
    | { type: 'SET_RESPONSES'; responses: T[] }
    | { type: 'DELETE_CODE'; code: string }
    | { type: 'EDIT_CODE'; currentCode: string; newCode: string }
    | { type: 'DELETE_HIGHLIGHT'; postId: string; sentence: string; code: string }
    | {
          type: 'EDIT_HIGHLIGHT';
          postId: string;
          sentence: string;
          newSentence: string;
          code: string;
      };

// Reducer function to manage the state of responses
function codeResponsesReducer<T>(state: T[], action: Action<T>): T[] {
    console.log('Action:', action);
    let newResponses: T[] = [];
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
        case 'RERUN_CODING':
            return state
                .filter((_, index) => !action.indexes.includes(index))
                .concat(action.newResponses);
        case 'ADD_RESPONSE':
            newResponses = [action.response].filter(
                (response: any) =>
                    response.coded_word?.trim() !== '' && response.sentence?.trim() !== ''
            );
            return state.concat({
                ...(newResponses.length ? (newResponses[0] as any) : {})
            });
        case 'SET_RESPONSES':
            newResponses = action.responses.filter(
                (response: any) =>
                    response.coded_word?.trim() !== '' && response.sentence?.trim() !== ''
            );
            return [...newResponses];
        case 'ADD_RESPONSES':
            newResponses = action.responses.filter(
                (response: any) =>
                    response.coded_word?.trim() !== '' && response.sentence?.trim() !== ''
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
            return state.filter((response: any) => response.coded_word !== action.code);
        case 'EDIT_CODE':
            return [
                ...state.map((response: any) =>
                    response.coded_word === action.currentCode
                        ? { ...response, coded_word: action.newCode }
                        : response
                )
            ];
        case 'DELETE_HIGHLIGHT':
            return state.filter(
                (response: any) =>
                    response.postId !== action.postId && response.sentence !== action.sentence
            );
        case 'EDIT_HIGHLIGHT':
            return state.map((response: any) =>
                response.postId === action.postId && response.sentence === action.sentence
                    ? { ...response, sentence: action.newSentence }
                    : response
            );
        default:
            return state;
    }
}

// Reducer function to manage the state of responses
function codeResponseReducer<T>(state: T[], action: Action<T>): T[] {
    console.log('Action:', action, 'LLM or Human');
    let newResponses: T[] = [];
    switch (action.type) {
        case 'SET_CORRECT':
            return state.map((response, index) =>
                index === action.index ? { ...response, isMarked: true, comment: '' } : response
            );
        case 'SET_ALL_CORRECT':
            return [...state.map((response) => ({ ...response, isMarked: true }))];
        case 'SET_INCORRECT':
            return state.map((response, index) =>
                index === action.index ? { ...response, isMarked: false } : response
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
        case 'RERUN_CODING':
            return state
                .filter((_, index) => !action.indexes.includes(index))
                .concat(action.newResponses);
        case 'ADD_RESPONSE':
            newResponses = [action.response].filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return state.concat({
                ...(newResponses.length ? (newResponses[0] as any) : {})
            });
        case 'SET_RESPONSES':
            newResponses = action.responses.filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return [...newResponses];
        case 'ADD_RESPONSES':
            newResponses = action.responses.filter(
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
                    response.postId !== action.postId &&
                    response.quote !== action.sentence &&
                    response.code !== action.code
            );
        case 'EDIT_HIGHLIGHT':
            return state.map((response: any) =>
                response.postId === action.postId &&
                response.quote === action.sentence &&
                response.code === action.code
                    ? { ...response, quote: action.newSentence }
                    : response
            );
        default:
            return state;
    }
}

type KeywordsTableAction =
    | { type: 'INITIALIZE'; entries: KeywordEntry[] }
    | { type: 'ADD_MANY'; entries: KeywordEntry[] }
    | { type: 'UPDATE_FIELD'; index: number; field: keyof KeywordEntry; value: string | string[] }
    | { type: 'TOGGLE_MARK'; index: number; isMarked?: boolean }
    | { type: 'ADD_ROW' }
    | { type: 'DELETE_ROW'; index: number };

const keywordTableReducer = (
    state: KeywordEntry[],
    action: KeywordsTableAction
): KeywordEntry[] => {
    switch (action.type) {
        case 'INITIALIZE':
            return [...action.entries];
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
            return [
                ...state,
                {
                    word: '',
                    description: '',
                    codes: [],
                    inclusion_criteria: [],
                    exclusion_criteria: []
                }
            ];
        case 'DELETE_ROW':
            return state.filter((_, i) => i !== action.index);
        default:
            return state;
    }
};

type baseResponseHandlerActions<T> =
    | { type: 'SET_CORRECT'; index: number }
    | { type: 'SET_ALL_CORRECT' }
    | { type: 'SET_INCORRECT'; index: number }
    | { type: 'SET_ALL_INCORRECT' }
    | { type: 'UPDATE_COMMENT'; index: number; comment: string }
    | { type: 'MARK_RESPONSE'; index: number; isMarked?: boolean }
    | { type: 'RERUN_CODING'; indexes: number[]; newResponses: T[] }
    | {
          type: 'ADD_RESPONSE';
          response: T;
      }
    | { type: 'ADD_RESPONSES'; responses: T[] }
    | (
          | { type: 'REMOVE_RESPONSES'; indexes: number[]; all?: never }
          | { type: 'REMOVE_RESPONSES'; all: boolean; indexes?: never }
      )
    | { type: 'SET_ALL_UNMARKED' }
    | { type: 'SET_RESPONSES'; responses: T[] };

function baseResponseHandler<T>(
    state: T[],
    action: baseResponseHandlerActions<T>,
    config: Record<string, any>
): T[] {
    let newResponses: T[] = [];
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
        case 'ADD_RESPONSE':
            newResponses = [action.response].filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return state.concat({
                ...(newResponses.length ? (newResponses[0] as any) : {})
            });
        case 'SET_RESPONSES':
            newResponses = action.responses.filter(
                (response: any) => response.code?.trim() !== '' && response.quote?.trim() !== ''
            );
            return [...newResponses];
        case 'ADD_RESPONSES':
            newResponses = action.responses.filter(
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
        default:
            return state;
    }
}

type sampleDataResponseReducerActions = baseResponseHandlerActions<IQECResponse>;

const sampleDataResponseReducer = (
    state: IQECResponse[],
    action: sampleDataResponseReducerActions
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
        case 'ADD_RESPONSE':
        case 'ADD_RESPONSES':
        case 'REMOVE_RESPONSES':
        case 'SET_RESPONSES':
            return baseResponseHandler(state, action, {});
        default:
            return state;
    }
};

type sampleDataWithThemeResponseReducerActions =
    | baseResponseHandlerActions<IQECTResponse>
    | { type: 'UPDATE_THEMES'; themes: ThemeBucket[] }
    | { type: 'DELETE_THEME'; name: string };

const sampleDataWithThemeResponseReducer = (
    state: IQECTResponse[],
    action: sampleDataWithThemeResponseReducerActions
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
        case 'ADD_RESPONSE':
        case 'ADD_RESPONSES':
        case 'REMOVE_RESPONSES':
        case 'SET_RESPONSES':
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

const unseenDataResponseReducer = (state: IQECTTyResponse[], action: any): IQECTTyResponse[] => {
    console.log('Action:', action, 'Unseen Data');
    switch (action.type) {
        case 'SET_CORRECT':
        case 'SET_ALL_CORRECT':
        case 'SET_INCORRECT':
        case 'SET_ALL_INCORRECT':
        case 'SET_ALL_UNMARKED':
        case 'UPDATE_COMMENT':
        case 'MARK_RESPONSE':
        case 'ADD_RESPONSE':
        case 'ADD_RESPONSES':
        case 'REMOVE_RESPONSES':
        case 'SET_RESPONSES':
            return baseResponseHandler(state, action, {});

        default:
            return state;
    }
};

const sampleData = [
    {
        postId: '1',
        quote: 'AI is evolving rapidly.',
        explanation: 'AI is evolving rapidly.',
        code: 'AI',
        id: '1'
    },
    {
        postId: '2',
        quote: 'React hooks simplify state management.',
        explanation: 'React hooks simplify state management.',
        code: 'React',
        id: '2'
    },
    {
        postId: '3',
        quote: 'JavaScript is versatile.',
        explanation: 'JavaScript is versatile.',
        code: 'JavaScript',
        id: '3'
    },
    {
        postId: '4',
        quote: 'JavaScript is versatile.',
        explanation: 'JavaScript is versatile.',
        code: 'React',
        id: '4'
    }
];

const unseenData = [
    {
        postId: '1',
        quote: 'AI is evolving rapidly.',
        explanation: 'AI is evolving rapidly.',
        code: 'AI',
        theme: 'AI',
        id: '1'
    },
    {
        postId: '2',
        quote: 'React hooks simplify state management.',
        explanation: 'React hooks simplify state management.',
        code: 'React',
        theme: 'JS',
        id: '2'
    },
    {
        postId: '3',
        quote: 'JavaScript is versatile.',
        explanation: 'JavaScript is versatile.',
        code: 'JavaScript',
        theme: 'JS',
        id: '3'
    },
    {
        postId: '4',
        quote: 'JavaScript is versatile.',
        explanation: 'JavaScript is versatile.',
        code: 'React',
        theme: 'JS',
        id: '4'
    }
];

// Create a provider component
export const CodingProvider: FC<ILayout> = ({ children }) => {
    const [currentMode, setCurrentMode] = useState<Mode>('folder');
    const [modeInput, setModeInput] = useState<string>('');
    const [subreddit, setSubreddit] = useState<string>('');
    const [selectedPosts, setSelectedPosts] = useState<string[]>([
        // '1019969',
        // '1069046',
        // '1076923',
        // '1093101',
        // '1141939',
        // '1145299',
        // '1193887',
        // '1194945',
        // '1253598',
        // '1254667'
    ]);
    const [contextFiles, setContextFiles] = useState<IFile>({});
    const [mainCode, setMainCode] = useState<string>('');
    // 'Student life';
    const [additionalInfo, setAdditionalInfo] = useState<string>('');

    const [researchQuestions, setResearchQuestions] = useState<string[]>([]);
    // 'Daily activities of students';
    const [flashcards, setFlashcards] = useState<
        {
            id: number;
            question: string;
            answer: string;
        }[]
    >([]);
    // initialFlashcards.map((flashcard, index) => ({ id: index, ...flashcard }))
    const [selectedFlashcards, setSelectedFlashcards] = useState<number[]>([
        // 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ]);
    const [words, setWords] = useState<string[]>([]);
    // initialWords
    const [selectedWords, setSelectedWords] = useState<string[]>([]);
    // initialWords.slice(0, 10)

    const [sampledPostIds, setSampledPostIds] = useState<string[]>([]);

    const [unseenPostIds, setUnseenPostIds] = useState<string[]>([]);

    // const [sampledPostData, setSampledPostData] = useState<IQECRow[]>([]);

    // const [unseenPostData, setUnseenPostData] = useState<IQECRow[]>([]);

    // const [sampledPostWithThemeData, setSampledPostWithThemeData] = useState<IQECTRow[]>([
    //     {
    //         postId: '1',
    //         quote: 'AI is evolving rapidly.',
    //         explanation: 'AI is evolving rapidly.',
    //         code: 'AI',
    //         id: '1',
    //         theme: 'AI'
    //     },
    //     {
    //         postId: '2',
    //         quote: 'React hooks simplify state management.',
    //         explanation: 'React hooks simplify state management.',
    //         code: 'React',
    //         id: '2',
    //         theme: 'JS'
    //     },
    //     {
    //         postId: '3',
    //         quote: 'JavaScript is versatile.',
    //         explanation: 'JavaScript is versatile.',
    //         code: 'JavaScript',
    //         id: '3',
    //         theme: 'JS'
    //     },
    //     {
    //         postId: '4',
    //         quote: 'JavaScript is versatile.',
    //         explanation: 'JavaScript is versatile.',
    //         code: 'React',
    //         id: '4',
    //         theme: 'JS'
    //     }
    // ]);

    // const [unseenPostWithThemeData, setUnseenPostWithThemeData] = useState<IQECTRow[]>([
    //     {
    //         postId: '5',
    //         quote: 'AI is evolving rapidly.',
    //         explanation: 'AI is evolving rapidly.',
    //         code: 'AI',
    //         id: '5',
    //         theme: 'AI'
    //     },
    //     {
    //         postId: '6',
    //         quote: 'React hooks simplify state management.',
    //         explanation: 'React hooks simplify state management.',
    //         code: 'React',
    //         id: '6',
    //         theme: 'JS'
    //     },
    //     {
    //         postId: '7',
    //         quote: 'JavaScript is versatile.',
    //         explanation: 'JavaScript is versatile.',
    //         code: 'JavaScript',
    //         id: '7',
    //         theme: 'JS'
    //     },
    //     {
    //         postId: '8',
    //         quote: 'JavaScript is versatile.',
    //         explanation: 'JavaScript is versatile.',
    //         code: 'React',
    //         id: '8',
    //         theme: 'JS'
    //     }
    // ]);

    // const [llmCodeResponses, dispatchLLMCodeResponses] = useReducer(
    //     codeResponseReducer<IQECTTyResponse>,
    //     unseenPostWithThemeData.map((post) => ({
    //         ...post,
    //         isMarked: undefined,
    //         comment: '',
    //         type: 'LLM'
    //     }))
    // );

    // const [humanCodeResponses, dispatchHumanCodeResponses] = useReducer(
    //     codeResponseReducer<IQECTTyResponse>,
    //     unseenPostWithThemeData.map((post) => ({
    //         ...post,
    //         isMarked: undefined,
    //         comment: '',
    //         type: 'Human'
    //     }))
    // );

    const [sampledPostResponse, dispatchSampledPostResponse] = useReducer(
        sampleDataResponseReducer,
        sampleData.map((post) => ({ ...post, isMarked: undefined, comment: '' }))
    );

    const [sampledPostWithThemeResponse, dispatchSampledPostWithThemeResponse] = useReducer(
        sampleDataWithThemeResponseReducer,
        []
    );

    const [unseenPostResponse, dispatchUnseenPostResponse] = useReducer(
        unseenDataResponseReducer,
        unseenData.map((post) => ({ ...post, isMarked: undefined, comment: '', type: 'LLM' }))
    );

    useEffect(() => {
        dispatchSampledPostWithThemeResponse({
            type: 'SET_RESPONSES',
            responses: sampledPostResponse.map((post) => ({
                ...post,
                theme: ''
            }))
        });
    }, [sampleData]);

    const [keywords, setKeywords] = useState<string[]>([]);
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

    const [references, setReferences] = useState<{
        [code: string]: IReference[];
    }>({});

    const [keywordTable, dispatchKeywordsTable] = useReducer(keywordTableReducer, []);

    const [themes, setThemes] = useState<ThemeBucket[]>([]);

    const [unplacedCodes, setUnplacedCodes] = useState<string[]>([
        // .filter((code) => !themes.some((theme) => theme.codes.includes(code)))
    ]);

    //      {
    //        "word": "Online discussions",
    //        "description": "Codes related to online discussions, including participation, engagement, and content creation.",
    //        "inclusion_criteria": ["Posts on social media (e.g., Instagram, Twitter) with comments or replies", "Emails from participants requesting information about upcoming events", "Online surveys or polls used for feedback"],
    //        "exclusion_criteria": ["Private messages sent to individuals outside of the event team"]
    //      },
    //      {
    //        "word": "Collaboration",
    //        "description": "Codes related to collaboration, including partnerships, teamwork, and shared goals.",
    //        "inclusion_criteria": ["Partnerships with other organizations or departments", "Collaborative projects between faculty members", "Shared goals for improving teaching practices"],
    //        "exclusion_criteria": ["Individual efforts without team involvement"]
    //      },
    //      {
    //        "word": "Partnership",
    //        "description": "Codes related to partnerships, including collaborations and joint initiatives.",
    //        "inclusion_criteria": ["Joint events or workshops with other organizations", "Collaborative research projects between faculty members and industry partners", "Partnerships for curriculum development"],
    //        "exclusion_criteria": ["Solo efforts without partner involvement"]
    //      },
    //      {
    //        "word": "Engagement",
    //        "description": "Codes related to engagement, including participation rates, audience feedback, and event evaluations.",
    //        "inclusion_criteria": ["High participation rates in online discussions or events", "Positive audience feedback on social media or email surveys", "Event evaluations indicating high levels of engagement"],
    //        "exclusion_criteria": ["Low participation rates or negative audience feedback"]
    //      },
    //      {
    //        "word": "Empowerment",
    //        "description": "Codes related to empowerment, including support for underrepresented groups, inclusive language, and opportunities for growth.",
    //        "inclusion_criteria": ["Support for underrepresented groups in events or online discussions", "Inclusive language used in event materials or social media posts", "Opportunities for growth and professional development provided to participants"],
    //        "exclusion_criteria": ["Lack of support for underrepresented groups, exclusionary language used"]
    //      },
    //      {
    //        "word": "Adaptability",
    //        "description": "Codes related to adaptability, including flexibility in event planning, responsiveness to participant needs, and ability to pivot when necessary.",
    //        "inclusion_criteria": ["Flexible event schedules or formats", "Responsive team members who address participant concerns promptly", "Ability to adjust plans in response to changing circumstances"],
    //        "exclusion_criteria": ["Inflexible event planning, delayed responses to participant concerns"]
    //      },
    //      {
    //        "word": "Resourcefulness",
    //        "description": "Codes related to resourcefulness, including creative solutions to challenges, efficient use of resources, and innovative approaches.",
    //        "inclusion_criteria": ["Creative solutions to technical or logistical challenges", "Efficient use of resources in event planning or online discussions", "Innovative approaches to teaching practices or curriculum development"],
    //        "exclusion_criteria": ["Lack of creative problem-solving, inefficient resource use"]
    //      },
    //      {
    //        "word": "Accommodation",
    //        "description": "Codes related to accommodation, including support for participants with disabilities, provision of accessible materials, and accommodations for different learning styles.",
    //        "inclusion_criteria": ["Support for participants with disabilities in events or online discussions", "Provision of accessible materials, such as transcripts or closed captions", "Accommodations for different learning styles, such as audio descriptions or large print materials"],
    //        "exclusion_criteria": ["Lack of support for participants with disabilities, inaccessible materials"]
    //      },
    //      {
    //        "word": "Equity",
    //        "description": "Codes related to equity, including efforts to address systemic inequalities, inclusive language and practices, and opportunities for underrepresented groups.",
    //        "inclusion_criteria": ["Efforts to address systemic inequalities in events or online discussions", "Inclusive language and practices used in event materials or social media posts", "Opportunities for underrepresented groups to participate and engage"],
    //        "exclusion_criteria": ["Lack of efforts to address systemic inequalities, exclusionary language or practices"]
    //      },
    //      {
    //        "word": "Participation",
    //        "description": "Codes related to participation, including opportunities for engagement, inclusive environments, and support for diverse perspectives.",
    //        "inclusion_criteria": ["Opportunities for engagement in events or online discussions", "Inclusive environments that value diverse perspectives", "Support for diverse perspectives and experiences"],
    //        "exclusion_criteria": ["Lack of opportunities for engagement, exclusionary environments"]
    //      },
    //      {
    //        "word": "Flexibility",
    //        "description": "Codes related to flexibility, including adaptability in event planning, responsiveness to participant needs, and ability to pivot when necessary.",
    //        "inclusion_criteria": ["Flexible event schedules or formats", "Responsive team members who address participant concerns promptly", "Ability to adjust plans in response to changing circumstances"],
    //        "exclusion_criteria": ["Inflexible event planning, delayed responses to participant concerns"]
    //      }
    //    ]);

    // const [codeResponses, dispatchCodeResponses] = useReducer(
    //     codeResponsesReducer<ISentenceBox>,
    //     []
    // );

    // const [finalCodeResponses, dispatchFinalCodeResponses] = useReducer(
    //     codeResponsesReducer<IFinalCodeResponse>,
    //     []
    // );

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

    const addFlashcard = useCallback((question: string, answer: string) => {
        setFlashcards((prevFlashcards) => {
            if (prevFlashcards.length === 0) return [{ id: 1, question, answer }];
            const lastFlashcard = prevFlashcards[prevFlashcards.length - 1];
            const newId = lastFlashcard.id + 1;
            return [...prevFlashcards, { id: newId, question, answer }];
        });
    }, []);

    const removeFlashcard = useCallback((id: number) => {
        setFlashcards((prevFlashcards) =>
            prevFlashcards.filter((flashcard) => flashcard.id !== id)
        );
    }, []);

    const selectFlashcard = useCallback((id: number) => {
        setSelectedFlashcards((prevFlashcards) => [...prevFlashcards, id]);
    }, []);

    const deselectFlashcard = useCallback((id: number) => {
        setSelectedFlashcards((prevFlashcards) =>
            prevFlashcards.filter((flashcardId) => flashcardId !== id)
        );
    }, []);

    const updateContext = (updates: Partial<ICodingContext>) => {
        if (updates.contextFiles) setContextFiles(updates.contextFiles);
        if (updates.mainCode) setMainCode(updates.mainCode);
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
        // if (updates.codeResponses) {
        //     dispatchCodeResponses({ type: 'SET_RESPONSES', responses: updates.codeResponses });
        // }
        // if (updates.finalCodeResponses) {
        //     dispatchFinalCodeResponses({
        //         type: 'SET_RESPONSES',
        //         responses: updates.finalCodeResponses
        //     });
        // }
    };

    const resetContext = () => {
        setContextFiles({});
        setMainCode('');
        setAdditionalInfo('');
        setFlashcards([]);
        setSelectedFlashcards([]);
        setKeywords([]);
        setSelectedKeywords([]);
        setWords([]);
        setSelectedWords([]);
        setReferences({});
        dispatchKeywordsTable({ type: 'INITIALIZE', entries: [] });
        dispatchSampledPostWithThemeResponse({ type: 'SET_RESPONSES', responses: [] });
        dispatchSampledPostResponse({
            type: 'SET_RESPONSES',
            responses: sampleData.map((post) => ({ ...post, isMarked: undefined, comment: '' }))
        });
        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: unseenData.map((post) => ({
                ...post,
                isMarked: undefined,
                comment: '',
                type: 'LLM'
            }))
        });
        setThemes([]);
        setUnplacedCodes([]);
        setResearchQuestions([]);
        setSampledPostIds([]);
        setUnseenPostIds([]);
        // dispatchCodeResponses({ type: 'SET_RESPONSES', responses: [] });
        // dispatchFinalCodeResponses({ type: 'SET_RESPONSES', responses: [] });
    };

    // const selectedKeywordsOrWords = useMemo(() => {
    //     return [mainCode];
    // }, [mainCode]);

    useEffect(() => {
        if (!keywords.includes(mainCode)) {
            setSelectedKeywords([mainCode]);
        }
        if (!words.includes(mainCode)) {
            setSelectedWords([mainCode]);
        }
    }, [mainCode]);

    // useEffect(() => {
    //     console.log('finalCodeResponses', finalCodeResponses);
    // }, [finalCodeResponses]);

    // useEffect(() => {
    //     dispatchFinalCodeResponses({
    //         type: 'SET_RESPONSES',
    //         responses: codeResponses
    //             .filter((response) => response.isMarked === true)
    //             .map((response) => {
    //                 return {
    //                     postId: response.postId,
    //                     sentence: response.sentence,
    //                     coded_word: response.coded_word,
    //                     reasoning: response.reasoning
    //                 };
    //             })
    //     });
    // }, [codeResponses]);

    useEffect(() => {
        console.log('In dc', currentMode, modeInput);
    }, [currentMode, modeInput]);

    const value = useMemo(
        () => ({
            contextFiles,
            addContextFile,
            removeContextFile,
            selectedPosts,
            setSelectedPosts,
            mainCode,
            setMainCode,
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
            // codeResponses,
            // dispatchCodeResponses,
            // finalCodeResponses,
            // dispatchFinalCodeResponses,
            updateContext,
            resetContext,
            // sampledPostData,
            // setSampledPostData,
            // unseenPostData,
            // setUnseenPostData,
            // sampledPostWithThemeData,
            // setSampledPostWithThemeData,
            // unseenPostWithThemeData,
            // setUnseenPostWithThemeData,
            // llmCodeResponses,
            // dispatchLLMCodeResponses,
            // humanCodeResponses,
            // dispatchHumanCodeResponses
            sampledPostResponse,
            dispatchSampledPostResponse,
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
            setUnseenPostIds
        }),
        [
            currentMode,
            modeInput,
            selectedPosts,
            subreddit,
            contextFiles,
            mainCode,
            additionalInfo,
            keywords,
            selectedKeywords,
            words,
            selectedWords,
            keywordTable,
            references,
            // codeResponses,
            // finalCodeResponses,
            // sampledPostData,
            // unseenPostData,
            // sampledPostWithThemeData,
            // unseenPostWithThemeData,
            // llmCodeResponses,
            // humanCodeResponses
            sampledPostResponse,
            sampledPostWithThemeResponse,
            unseenPostResponse,
            themes,
            unplacedCodes,
            researchQuestions,
            sampledPostIds,
            unseenPostIds
        ]
    );

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

export const useCodingContext = () => useContext(CodingContext);
