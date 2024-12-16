import { createContext, useState, FC, Dispatch, useCallback, useReducer, useEffect, useContext } from 'react';
import { useMemo } from 'react';
import {
    IFinalCodeResponse,
    IFile,
    ILayout,
    ISentenceBox,
    Mode,
    SetState,
    IReference,
    CodebookEntry
} from '../types/Coding/shared';

interface ICodingContext {
    basisFiles: IFile;
    addBasisFile: (filePath: string, fileName: string) => void;
    removeBasisFile: (filePath: string) => void;
    mainCode: string;
    setMainCode: SetState<string>;
    additionalInfo?: string;
    setAdditionalInfo: SetState<string>;
    flashcards: {
        id: number;
        question: string;
        answer: string;
    }[];
    addFlashcard: (question: string, answer: string) => void;
    removeFlashcard: (id: number) => void;
    selectedFlashcards: number[];
    selectFlashcard: (id: number) => void;
    deselectFlashcard: (id: number) => void;
    themes: string[];
    setThemes: SetState<string[]>;
    selectedThemes: string[];
    setSelectedThemes: SetState<string[]>;
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
    codeBook: CodebookEntry[];
    dispatchCodeBook: Dispatch<any>;
    codeResponses: ISentenceBox[];
    dispatchCodeResponses: Dispatch<any>;
    finalCodeResponses: IFinalCodeResponse[];
    dispatchFinalCodeResponses: Dispatch<any>;
}

// Create the context
export const CodingContext = createContext<ICodingContext>({
    basisFiles: {},
    addBasisFile: () => {},
    removeBasisFile: () => {},
    mainCode: '',
    setMainCode: () => {},
    additionalInfo: '',
    setAdditionalInfo: () => {},
    flashcards: [],
    addFlashcard: () => {},
    removeFlashcard: () => {},
    selectedFlashcards: [],
    selectFlashcard: () => {},
    deselectFlashcard: () => {},
    themes: [],
    setThemes: () => {},
    selectedThemes: [],
    setSelectedThemes: () => {},
    words: [],
    setWords: () => {},
    selectedWords: [],
    setSelectedWords: () => {},
    references: {},
    setReferences: () => {},
    codeBook: [],
    dispatchCodeBook: () => {},
    codeResponses: [],
    dispatchCodeResponses: () => {},
    finalCodeResponses: [],
    dispatchFinalCodeResponses: () => {}
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
    | { type: 'SET_RESPONSES'; responses: T[] };

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
            newResponses = state.filter((response: any) => response.coded_word !== '' || response.sentence !== '');
            return state.concat({
                ...action.response
            });
        case 'SET_RESPONSES':
            newResponses = action.responses.filter((response: any) => response.coded_word !== '' || response.sentence !== '');
            return [...newResponses];
        case 'ADD_RESPONSES':
            newResponses = action.responses.filter((response: any) => response.coded_word !== '' || response.sentence !== '');
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

type CodeBookAction =
    | { type: "INITIALIZE"; entries: CodebookEntry[] }
    | { type: "ADD_MANY"; entries: CodebookEntry[] }
    | { type: "UPDATE_FIELD"; index: number; field: keyof CodebookEntry; value: string | string[] }
    | { type: "TOGGLE_MARK"; index: number; isMarked?: boolean }
    | { type: "ADD_ROW" }
    | { type: "DELETE_ROW"; index: number };

const codeBookReducer = (state: CodebookEntry[], action: CodeBookAction): CodebookEntry[] => {
    switch (action.type) {
        case "INITIALIZE":
            return [...action.entries];
        case "ADD_MANY":
            return [...state.filter((entry) => entry.isMarked===true), ...action.entries];
        case "UPDATE_FIELD":
            return state.map((entry, i) =>
                i === action.index
                    ? {
                          ...entry,
                          [action.field]: action.value,
                      }
                    : entry
            );
        case "TOGGLE_MARK":
            return state.map((entry, i) =>
                i === action.index
                    ? {
                          ...entry,
                          isMarked: action.isMarked,
                      }
                    : entry
            );
        case "ADD_ROW":
            return [
                ...state,
                {
                    word: "",
                    description: "",
                    codes: [],
                    inclusion_criteria: [],
                    exclusion_criteria: [],
                },
            ];
        case "DELETE_ROW":
            return state.filter((_, i) => i !== action.index);
        default:
            return state;
    }
};

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
    const [basisFiles, setBasisFiles] = useState<IFile>({});
    const [mainCode, setMainCode] = useState<string>('');
    // 'Student life';
    const [additionalInfo, setAdditionalInfo] = useState<string>('');
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

    const [themes, setThemes] = useState<string[]>([]);
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

    const [references, setReferences] = useState<{
        [code: string]: IReference[];
    }>({});

    const [codeBook, dispatchCodeBook] = useReducer(codeBookReducer, []);
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

    const [codeResponses, dispatchCodeResponses] = useReducer(
        codeResponsesReducer<ISentenceBox>,
        []
    );

    const [finalCodeResponses, dispatchFinalCodeResponses] = useReducer(
        codeResponsesReducer<IFinalCodeResponse>,
        []
    );

    const toggleMode = useCallback(() => {
        setCurrentMode((prevMode: Mode) => {
            setModeInput('');
            return prevMode === 'link' ? 'folder' : 'link';
        });
    }, []);

    const addBasisFile = useCallback((filePath: string, fileName: string) => {
        setBasisFiles((prevFiles) => ({ ...prevFiles, [filePath]: fileName }));
    }, []);

    const removeBasisFile = useCallback((filePath: string) => {
        setBasisFiles((prevFiles) => {
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

    useEffect(() => {
        setSelectedThemes([mainCode]);
        setSelectedWords([mainCode]);
    }, [mainCode]);

    useEffect(() => {
        dispatchFinalCodeResponses({
            type: 'SET_RESPONSES',
            responses: codeResponses
                .filter((response) => response.isMarked === true)
                .map((response) => {
                    return {
                        postId: response.postId,
                        sentence: response.sentence,
                        coded_word: response.coded_word,
                        reasoning: response.reasoning
                    };
                })
        });
    }, [codeResponses]);

    useEffect(() => {
        console.log('In dc', currentMode, modeInput);
    }, [currentMode, modeInput]);

    const value = useMemo(
        () => ({
            basisFiles,
            addBasisFile,
            removeBasisFile,
            selectedPosts,
            setSelectedPosts,
            mainCode,
            setMainCode,
            additionalInfo,
            setAdditionalInfo,
            flashcards,
            addFlashcard,
            removeFlashcard,
            selectedFlashcards,
            selectFlashcard,
            deselectFlashcard,
            themes,
            setThemes,
            selectedThemes,
            setSelectedThemes,
            words,
            setWords,
            selectedWords,
            setSelectedWords,
            references,
            setReferences,
            codeBook,
            dispatchCodeBook,
            codeResponses,
            dispatchCodeResponses,
            finalCodeResponses,
            dispatchFinalCodeResponses
        }),
        [
            currentMode,
            modeInput,
            selectedPosts,
            subreddit,
            basisFiles,
            mainCode,
            additionalInfo,
            flashcards,
            selectedFlashcards,
            themes,
            selectedThemes,
            words,
            selectedWords,
            codeBook,
            references,
            codeResponses,
            finalCodeResponses
        ]
    );

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

export const useCodingContext = () => useContext(CodingContext);