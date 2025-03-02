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
    SetState
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
import { getThemeByCode } from '../utility/theme-finder';
import { type } from 'os';
import { downloadCodebook } from '../utility/codebook-downloader';

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
        keyof typeof loadingState,
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
                        name: 'setSelectedKeywords'
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
                            theme: getThemeByCode(post.code, themes),
                            id: post.id
                        })),
                        ...unseenPostResponse.map((post) => ({
                            postId: post.postId,
                            quote: post.quote,
                            coded_word: post.code,
                            reasoning: post.explanation,
                            theme: getThemeByCode(post.code, themes),
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

    useEffect(
        () => {
            console.log(loadingState, 'loadingState');
            Object.entries(loadingStateInitialization).forEach(([k, v], idx) => {
                console.log('Kvi', k, v, idx, loadingState[k].stepRef.current);
                // const stepRef = loadingState[key].stepRef.current;
                // console.log('StepRef:', stepRef);
                if (loadingState[k].stepRef.current) {
                    loadingState[k].stepRef.current!.resetStep = (currentPage: string) => {
                        console.log('Resetting page:', currentPage);

                        const currentPageIdx = Object.keys(loadingStateInitialization).indexOf(
                            currentPage
                        );
                        if (currentPageIdx === -1) return;
                        Object.entries(loadingStateInitialization).forEach(([key, value]) => {
                            const states = value.relatedStates;
                            states.forEach((state) => {
                                const statePageIdx = Object.keys(
                                    loadingStateInitialization
                                ).indexOf(
                                    // state
                                    key
                                );
                                console.log('State:', state, statePageIdx, currentPageIdx);
                                if (statePageIdx > currentPageIdx) {
                                    // if (pageIdx > currentPageIdx) {
                                    console.log('kv', key, value);
                                    value.relatedStates.forEach((state) => {
                                        console.log('State?:', state);
                                        if (state.name.startsWith('set')) {
                                            // let stateName = state.name.replace('set', '');
                                            // const formattedName =
                                            //     stateName.charAt(0).toLowerCase() + stateName.slice(1);
                                            console.log(
                                                'Formatted name:',
                                                state.state,
                                                state.name,
                                                typeof state.state
                                            );
                                            const getDefaultValue = (value: any) => {
                                                if (Array.isArray(value)) return [];
                                                if (typeof value === 'string') return '';
                                                if (typeof value === 'number') return 0;
                                                return {};
                                            };
                                            console.log(
                                                "State's init value:",
                                                state.initValue,
                                                state.name
                                            );
                                            if (state.initValue) {
                                                (state.func as SetState<any>)(state.initValue);
                                            } else {
                                                (state.func as SetState<any>)(
                                                    getDefaultValue(state.state)
                                                );
                                            }
                                        } else {
                                            console.log('Dispatch:', state.func, state.name);
                                            (state.func as Dispatch<any>)({ type: 'RESET' });
                                        }
                                    });
                                    // }
                                }
                            });
                        });
                    };
                    // };

                    loadingState[k].stepRef.current!.checkDataExistence = (currentPage: string) => {
                        const currentPageIdx = Object.keys(loadingStateInitialization).indexOf(
                            currentPage
                        );
                        return Object.entries(loadingStateInitialization).some(([key, value]) => {
                            const states = value.relatedStates;
                            return states.some((state) => {
                                const statePageIdx = Object.keys(
                                    loadingStateInitialization
                                ).indexOf(
                                    // state
                                    key
                                );
                                console.log('State:', state, statePageIdx, currentPageIdx);
                                if (statePageIdx > currentPageIdx) {
                                    // Skip states from pages before the current one.
                                    if (Array.isArray(state.state)) {
                                        if (state.state.length > 0) {
                                            return true;
                                        }
                                    } else if (typeof state.state === 'string') {
                                        if (state.state !== '') {
                                            return true;
                                        }
                                    } else if (typeof state.state === 'number') {
                                        if (state.state !== 0) {
                                            return true;
                                        }
                                    } else if (
                                        typeof state.state === 'object' &&
                                        state.state !== null
                                    ) {
                                        if (Object.keys(state.state).length > 0) {
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            });
                        });
                    };

                    loadingState[k].stepRef.current!.downloadData = async () => {
                        // Iterate over each entry in the initialization object.
                        for (const [key, value] of Object.entries(loadingStateInitialization)) {
                            // Iterate over each related state for this key.
                            for (const state of value.relatedStates) {
                                const statePageIdx = Object.keys(
                                    loadingStateInitialization
                                ).indexOf(key);
                                console.log('State:', state, statePageIdx);

                                // Check if both the loadingState and the initialization have a downloadData property.
                                if (loadingState[key].downloadData && value.downloadData) {
                                    const downloadState = value.downloadData;
                                    console.log('Downloading data for:', key, downloadState);

                                    // Only proceed if there's data and the condition is not false.
                                    if (
                                        downloadState.data.length !== 0 &&
                                        downloadState.condition !== false
                                    ) {
                                        await ipcRenderer.invoke('save-csv', {
                                            data: downloadState.data,
                                            fileName: downloadState.name
                                        });
                                    }
                                }
                            }
                        }
                    };
                    // }
                    // Object.values(loadingStateInitialization).flatMap((initialization) =>
                    //     initialization.relatedStates.map((item) => item.state)
                    // )
                    // stepRef!.resetStep =
                    // stepRef!.checkDataExistence =
                }
            });
        },
        Object.values(loadingStateInitialization).flatMap((initialization) =>
            initialization.relatedStates.map((item) => item.state)
        )
    );
    // useEffect(() => {
    // }, []);

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
            researchQuestions,
            sampledPostIds,
            unseenPostIds,
            conflictingResponses
        ]
    );

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

export const useCodingContext = () => useContext(CodingContext);
