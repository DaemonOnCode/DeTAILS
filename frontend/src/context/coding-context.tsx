import {
    createContext,
    useState,
    FC,
    useCallback,
    useReducer,
    useEffect,
    useContext,
    useRef,
    Dispatch,
    useImperativeHandle
} from 'react';
import { useMemo } from 'react';
import {
    IFile,
    ILayout,
    IReference,
    IQECResponse,
    ThemeBucket,
    SetState,
    GroupedCodeBucket
} from '../types/Coding/shared';
import { ROUTES as SHARED_ROUTES } from '../constants/Shared';
import { ROUTES } from '../constants/Coding/shared';
import { ICodingContext, StepHandle } from '../types/Shared';
import { useLocation } from 'react-router-dom';
import { useLoadingContext } from './loading-context';
import {
    sampleDataResponseReducer,
    sampleDataWithThemeResponseReducer,
    unseenDataResponseReducer,
    keywordTableReducer
} from '../reducers/coding';
import { getGroupedCodeOfSubCode, getThemeByCode } from '../utility/theme-finder';
import { type } from 'os';
import { downloadCodebook } from '../utility/codebook-downloader';
import { useLoadingSteps } from '../hooks/Shared/use-loading-steps';

const { ipcRenderer } = window.require('electron');

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
    groupedCodes: [],
    setGroupedCodes: () => {},
    unplacedSubCodes: [],
    setUnplacedSubCodes: () => {},
    researchQuestions: [],
    setResearchQuestions: () => {},
    sampledPostIds: [],
    setSampledPostIds: () => {},
    unseenPostIds: [],
    setUnseenPostIds: () => {},
    conflictingResponses: [],
    setConflictingResponses: () => {}
});

// Create a provider component
export const CodingProvider: FC<ILayout> = ({ children }) => {
    const location = useLocation();
    const { loadingState, loadingDispatch, registerStepRef } = useLoadingContext();

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

    const [groupedCodes, setGroupedCodes] = useState<GroupedCodeBucket[]>([]);

    // State for codes that have not been placed into any bucket
    const [unplacedSubCodes, setUnplacedSubCodes] = useState<string[]>([]);

    // const toggleMode = useCallback(() => {
    //     setCurrentMode((prevMode: Mode) => {
    //         setModeInput('');
    //         return prevMode === 'link' ? 'folder' : 'link';
    //     });
    // }, []);
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

    useEffect(() => {
        console.log(location.pathname, 'pthname');
    }, [location]);

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
        () => ({
            [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`]: {
                relatedStates: [
                    {
                        state: contextFiles,
                        func: setContextFiles,
                        name: 'setContextFiles'
                    },
                    { state: mainTopic, func: setMainTopic, name: 'setMainTopic' },
                    { state: additionalInfo, func: setAdditionalInfo, name: 'setAdditionalInfo' },
                    {
                        state: researchQuestions,
                        func: setResearchQuestions,
                        name: 'setResearchQuestions'
                    }
                ]
            },
            [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`]: {
                relatedStates: [
                    {
                        state: keywords,
                        func: setKeywords,
                        name: 'setKeywords',
                        initValue: [mainTopic]
                    },
                    {
                        state: selectedKeywords,
                        func: setSelectedKeywords,
                        name: 'setSelectedKeywords',
                        initValue: [mainTopic]
                    }
                ]
            },
            [`/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`]: {
                relatedStates: [
                    // {
                    //     state: keywordTable,
                    //     func: dispatchKeywordsTable,
                    //     name: 'dispatchKeywordsTable'
                    // }
                ]
            },
            [`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`]: {
                relatedStates: [
                    {
                        state: sampledPostResponse,
                        func: dispatchSampledPostResponse,
                        name: 'dispatchSampledPostResponse'
                    }
                ],
                downloadData: { name: 'codebook', data: sampledPostResponse }
            },
            [`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`]: {
                relatedStates: [
                    {
                        state: unseenPostResponse,
                        func: dispatchUnseenPostResponse,
                        name: 'dispatchUnseenPostResponse'
                    }
                ],
                downloadData: { name: 'deductive_codebook', data: unseenPostResponse }
            },
            [`/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`]: {
                relatedStates: [
                    { state: groupedCodes, func: setGroupedCodes, name: 'setGroupedCodes' },
                    {
                        state: unplacedSubCodes,
                        func: setUnplacedSubCodes,
                        name: 'setUnplacedSubCodes'
                    }
                ],
                downloadData: {
                    name: 'codebook_with_grouped_codes',
                    condition: groupedCodes.length > 0,
                    data: [
                        ...sampledPostResponse.map((post) => ({
                            postId: post.postId,
                            id: post.id,
                            code: getGroupedCodeOfSubCode(post.code, groupedCodes),
                            quote: post.quote,
                            explanation: post.explanation,
                            comment: post.comment,
                            subCode: post.code
                        })),
                        ...unseenPostResponse.map((post) => ({
                            postId: post.postId,
                            id: post.id,
                            code: getGroupedCodeOfSubCode(post.code, groupedCodes),
                            quote: post.quote,
                            explanation: post.explanation,
                            comment: post.comment,
                            subCode: post.code
                        }))
                    ]
                }
            },
            [`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`]: {
                relatedStates: [
                    { state: themes, func: setThemes, name: 'setThemes' },
                    { state: unplacedCodes, func: setUnplacedCodes, name: 'setUnplacedCodes' }
                ],
                downloadData: {
                    name: 'codebook_with_themes',
                    condition: themes.length > 0,
                    data: [
                        ...sampledPostResponse.map((post) => ({
                            postId: post.postId,
                            quote: post.quote,
                            coded_word: post.code,
                            reasoning: post.explanation,
                            theme: getThemeByCode(post.code, themes, groupedCodes),
                            id: post.id
                        })),
                        ...unseenPostResponse.map((post) => ({
                            postId: post.postId,
                            quote: post.quote,
                            coded_word: post.code,
                            reasoning: post.explanation,
                            theme: getThemeByCode(post.code, themes, groupedCodes),
                            id: post.id
                        }))
                    ]
                }
            }
        }),
        [
            contextFiles,
            mainTopic,
            additionalInfo,
            keywords,
            selectedKeywords,
            keywordTable,
            sampledPostResponse,
            unseenPostResponse,
            themes,
            unplacedCodes
        ]
    );

    useLoadingSteps(
        loadingStateInitialization,
        loadingState[
            `/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.LLM_CONTEXT_V2}`
        ]?.stepRef
    );
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[
            `/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_CLOUD}`
        ]?.stepRef
    );
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[
            `/${SHARED_ROUTES.CODING}/${ROUTES.BACKGROUND_RESEARCH}/${ROUTES.KEYWORD_TABLE}`
        ]?.stepRef
    );
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[`/${SHARED_ROUTES.CODING}/${ROUTES.CODEBOOK_CREATION}`]?.stepRef
    );
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`]?.stepRef
    );
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[`/${SHARED_ROUTES.CODING}/${ROUTES.FINALIZING_CODES}`]?.stepRef
    );
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[`/${SHARED_ROUTES.CODING}/${ROUTES.THEMATIC_ANALYSIS}/${ROUTES.THEMES}`]
            ?.stepRef
    );

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
        if (updates.groupedCodes) setGroupedCodes(updates.groupedCodes);
        if (updates.unplacedSubCodes) setUnplacedSubCodes(updates.unplacedSubCodes);
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
        setGroupedCodes([]);
        setUnplacedSubCodes([]);
        setResearchQuestions([]);
        setSampledPostIds([]);
        setUnseenPostIds([]);
        setConflictingResponses([]);
    };

    useEffect(() => {
        if (!selectedKeywords.includes(mainTopic)) {
            setSelectedKeywords([mainTopic]);
        }
    }, [mainTopic, keywords]);

    // useEffect(() => {
    //     if (!keywords.includes(mainTopic)) {
    //         setKeywords((prev) => [...prev, mainTopic]);
    //     }
    // }, [keywords]);

    useEffect(() => {
        console.log('KT update', keywordTable);
    }, [keywordTable]);

    const value = useMemo(
        () => ({
            contextFiles,
            addContextFile,
            removeContextFile,
            // selectedPosts,
            // setSelectedPosts,
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
            groupedCodes,
            setGroupedCodes,
            unplacedSubCodes,
            setUnplacedSubCodes,
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
            // currentMode,
            // modeInput,
            // selectedPosts,
            // subreddit,
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
            groupedCodes,
            unplacedSubCodes,
            researchQuestions,
            sampledPostIds,
            unseenPostIds,
            conflictingResponses
        ]
    );

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

export const useCodingContext = () => useContext(CodingContext);
