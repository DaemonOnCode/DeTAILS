import React, { createContext, useState, useEffect, useContext, FC } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoadingContext } from './loading-context';
import { PAGE_ROUTES } from '../constants/Coding/shared';
import { ICodingContext, Keyword } from '../types/Shared';
import {
    IFile,
    IReference,
    IQECResponse,
    IQECTResponse,
    IQECTTyResponse,
    ThemeBucket,
    GroupedCodeBucket,
    KeywordEntry,
    InitialCodebookCode,
    KeywordsTableAction,
    SampleDataResponseReducerActions,
    SampleDataWithThemeResponseReducerActions,
    BaseResponseHandlerActions,
    InitialCodebookTableAction
} from '../types/Coding/shared';
import { useApi } from '../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';

// Define the CodingContext with default values
export const CodingContext = createContext<ICodingContext>({
    contextFiles: {},
    addContextFile: async () => {},
    removeContextFile: async () => {},
    mainTopic: '',
    setMainTopic: async () => {},
    additionalInfo: '',
    setAdditionalInfo: async () => {},
    keywords: [],
    setKeywords: async () => {},
    selectedKeywords: [],
    setSelectedKeywords: async () => {},
    words: [],
    setWords: async () => {},
    selectedWords: [],
    setSelectedWords: async () => {},
    references: {},
    setReferences: async () => {},
    keywordTable: [],
    dispatchKeywordsTable: async () => {},
    updateContext: async () => {},
    resetContext: async () => {},
    sampledPostResponse: [],
    dispatchSampledPostResponse: async () => {},
    sampledPostResponseCopy: [],
    setSampledPostResponseCopy: async () => {},
    sampledPostWithThemeResponse: [],
    dispatchSampledPostWithThemeResponse: async () => {},
    unseenPostResponse: [],
    dispatchUnseenPostResponse: async () => {},
    themes: [],
    setThemes: async () => {},
    unplacedCodes: [],
    setUnplacedCodes: async () => {},
    groupedCodes: [],
    setGroupedCodes: async () => {},
    unplacedSubCodes: [],
    setUnplacedSubCodes: async () => {},
    researchQuestions: [],
    setResearchQuestions: async () => {},
    sampledPostIds: [],
    setSampledPostIds: async () => {},
    unseenPostIds: [],
    setUnseenPostIds: async () => {},
    conflictingResponses: [],
    setConflictingResponses: async () => {},
    initialCodebookTable: [],
    dispatchInitialCodebookTable: async () => {}
});

// CodingProvider component
export const CodingProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const { loadingState, loadingDispatch } = useLoadingContext();
    const { fetchData } = useApi();

    // State declarations with initial values and renamed setters
    const [contextFiles, setContextFilesState] = useState<IFile>({});
    const [mainTopic, setMainTopicState] = useState<string>('');
    const [additionalInfo, setAdditionalInfoState] = useState<string>('');
    const [researchQuestions, setResearchQuestionsState] = useState<string[]>([]);
    const [keywords, setKeywordsState] = useState<Keyword[]>([]);
    const [selectedKeywords, setSelectedKeywordsState] = useState<string[]>([]);
    const [words, setWordsState] = useState<Keyword[]>([]);
    const [selectedWords, setSelectedWordsState] = useState<Keyword[]>([]);
    const [references, setReferencesState] = useState<{ [code: string]: IReference[] }>({});
    const [keywordTable, setKeywordTableState] = useState<KeywordEntry[]>([]);
    const [sampledPostResponse, setSampledPostResponseState] = useState<IQECResponse[]>([]);
    const [sampledPostResponseCopy, setSampledPostResponseCopyState] = useState<IQECResponse[]>([]);
    const [sampledPostWithThemeResponse, setSampledPostWithThemeResponseState] = useState<
        IQECTResponse[]
    >([]);
    const [unseenPostResponse, setUnseenPostResponseState] = useState<IQECTTyResponse[]>([]);
    const [themes, setThemesState] = useState<ThemeBucket[]>([]);
    const [unplacedCodes, setUnplacedCodesState] = useState<string[]>([]);
    const [groupedCodes, setGroupedCodesState] = useState<GroupedCodeBucket[]>([]);
    const [unplacedSubCodes, setUnplacedSubCodesState] = useState<string[]>([]);
    const [sampledPostIds, setSampledPostIdsState] = useState<string[]>([]);
    const [unseenPostIds, setUnseenPostIdsState] = useState<string[]>([]);
    const [conflictingResponses, setConflictingResponsesState] = useState<IQECResponse[]>([]);
    const [initialCodebookTable, setInitialCodebookTableState] = useState<InitialCodebookCode[]>(
        []
    );

    // Helper function to save context to the backend
    const saveCodingContext = async (operationType: string, payload: object) => {
        try {
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.SAVE_CODING_CONTEXT, {
                method: 'POST',
                body: JSON.stringify({ type: operationType, ...payload })
            });
            if (error) throw new Error(`Failed to save context for ${operationType}`);
            return data;
        } catch (error) {
            console.error(`Error in ${operationType}:`, error);
            throw error;
        }
    };

    const setterFunctions: Record<string, (value: any) => void> = {
        contextFiles: setContextFilesState,
        mainTopic: setMainTopicState,
        additionalInfo: setAdditionalInfoState,
        researchQuestions: setResearchQuestionsState,
        keywords: setKeywordsState,
        selectedKeywords: setSelectedKeywordsState,
        words: setWordsState,
        selectedWords: setSelectedWordsState,
        references: setReferencesState,
        keywordTable: setKeywordTableState,
        sampledPostResponse: setSampledPostResponseState,
        sampledPostResponseCopy: setSampledPostResponseCopyState,
        sampledPostWithThemeResponse: setSampledPostWithThemeResponseState,
        unseenPostResponse: setUnseenPostResponseState,
        themes: setThemesState,
        unplacedCodes: setUnplacedCodesState,
        groupedCodes: setGroupedCodesState,
        unplacedSubCodes: setUnplacedSubCodesState,
        sampledPostIds: setSampledPostIdsState,
        unseenPostIds: setUnseenPostIdsState,
        conflictingResponses: setConflictingResponsesState,
        initialCodebookTable: setInitialCodebookTableState
    };

    const resetFunctions: Record<string, () => void> = {
        contextFiles: () => setContextFilesState({}),
        mainTopic: () => setMainTopicState(''),
        additionalInfo: () => setAdditionalInfoState(''),
        researchQuestions: () => setResearchQuestionsState([]),
        keywords: () => setKeywordsState([]),
        selectedKeywords: () => setSelectedKeywordsState([]),
        words: () => setWordsState([]),
        selectedWords: () => setSelectedWordsState([]),
        references: () => setReferencesState({}),
        keywordTable: () => setKeywordTableState([]),
        sampledPostResponse: () => setSampledPostResponseState([]),
        sampledPostResponseCopy: () => setSampledPostResponseCopyState([]),
        sampledPostWithThemeResponse: () => setSampledPostWithThemeResponseState([]),
        unseenPostResponse: () => setUnseenPostResponseState([]),
        themes: () => setThemesState([]),
        unplacedCodes: () => setUnplacedCodesState([]),
        groupedCodes: () => setGroupedCodesState([]),
        unplacedSubCodes: () => setUnplacedSubCodesState([]),
        sampledPostIds: () => setSampledPostIdsState([]),
        unseenPostIds: () => setUnseenPostIdsState([]),
        conflictingResponses: () => setConflictingResponsesState([]),
        initialCodebookTable: () => setInitialCodebookTableState([])
    };

    // Helper function to fetch states from the backend
    const fetchStates = async (stateNames: string[]) => {
        try {
            if (stateNames.length === 0) return;
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.LOAD_CODING_CONTEXT, {
                method: 'POST',
                body: JSON.stringify({ states: stateNames })
            });
            if (error) throw new Error(`Failed to fetch states: ${stateNames.join(', ')}`);
            console.log('Fetched states:', data);
            return data;
        } catch (error) {
            console.error(`Error fetching states:`, error);
            throw error;
        }
    };

    // Fetch states based on the current page when location changes
    useEffect(() => {
        const page = location.pathname;
        const stateMap: Record<string, string[]> = {
            [PAGE_ROUTES.CONTEXT_V2]: [
                'contextFiles',
                'mainTopic',
                'additionalInfo',
                'researchQuestions'
            ],
            [PAGE_ROUTES.KEYWORD_CLOUD]: ['mainTopic', 'keywords', 'selectedKeywords'],
            [PAGE_ROUTES.KEYWORD_TABLE]: ['keywordTable'],
            [PAGE_ROUTES.CODEBOOK_CREATION]: ['sampledPostResponse', 'sampledPostIds'],
            [PAGE_ROUTES.INITIAL_CODEBOOK]: ['initialCodebookTable'],
            [PAGE_ROUTES.DEDUCTIVE_CODING]: ['unseenPostResponse', 'unseenPostIds'],
            [PAGE_ROUTES.FINALIZING_CODES]: ['groupedCodes', 'unplacedSubCodes'],
            [PAGE_ROUTES.THEMES]: ['themes', 'unplacedCodes']
        };
        const statesToFetch = stateMap[page] || [];
        if (statesToFetch.length > 0) {
            (async () => {
                try {
                    // Fetch only the required states
                    const fetchedData = await fetchStates(statesToFetch);
                    if (fetchedData) {
                        // Update the required states with fetched data
                        statesToFetch.forEach((stateName) => {
                            console.log(`Setting state: ${stateName}`, fetchedData[stateName]);
                            if (
                                fetchedData[stateName] !== undefined &&
                                setterFunctions[stateName]
                            ) {
                                setterFunctions[stateName](fetchedData[stateName]);
                            }
                        });

                        // Reset only the unused states
                        // const allStates = Object.keys(setterFunctions);
                        // const statesToReset = allStates.filter(
                        //     (state) => !statesToFetch.includes(state)
                        // );
                        // statesToReset.forEach((state) => resetFunctions[state]());
                    }
                } catch (error) {
                    console.error('Error in state fetching effect:', error);
                }
            })();
        }
    }, [location.pathname]);

    // Context value with updated setters
    const value: ICodingContext = {
        contextFiles,
        addContextFile: async (filePath: string, fileName: string) => {
            const data = await saveCodingContext('addContextFile', { filePath, fileName });
            if (data.contextFiles) setContextFilesState(data.contextFiles);
        },
        removeContextFile: async (filePath: string) => {
            const data = await saveCodingContext('removeContextFile', { filePath });
            if (data.contextFiles) setContextFilesState(data.contextFiles);
        },
        mainTopic,
        setMainTopic: async (topicOrUpdater) => {
            const newTopic =
                typeof topicOrUpdater === 'function' ? topicOrUpdater(mainTopic) : topicOrUpdater;
            const data = await saveCodingContext('setMainTopic', { mainTopic: newTopic });
            if (data.mainTopic !== undefined) setMainTopicState(data.mainTopic);
        },
        additionalInfo,
        setAdditionalInfo: async (infoOrUpdater) => {
            const newInfo =
                typeof infoOrUpdater === 'function' ? infoOrUpdater(additionalInfo) : infoOrUpdater;
            const data = await saveCodingContext('setAdditionalInfo', { additionalInfo: newInfo });
            if (data.additionalInfo !== undefined) setAdditionalInfoState(data.additionalInfo);
        },
        keywords,
        setKeywords: async (kwsOrUpdater) => {
            const newKeywords =
                typeof kwsOrUpdater === 'function' ? kwsOrUpdater(keywords) : kwsOrUpdater;
            const data = await saveCodingContext('setKeywords', { keywords: newKeywords });
            if (data.keywords) setKeywordsState(data.keywords);
        },
        selectedKeywords,
        setSelectedKeywords: async (skwsOrUpdater) => {
            const newSelectedKeywords =
                typeof skwsOrUpdater === 'function'
                    ? skwsOrUpdater(selectedKeywords)
                    : skwsOrUpdater;
            const data = await saveCodingContext('setSelectedKeywords', {
                selectedKeywords: newSelectedKeywords
            });
            if (data.selectedKeywords) setSelectedKeywordsState(data.selectedKeywords);
        },
        words,
        setWords: async (wdsOrUpdater) => {
            const newWords =
                typeof wdsOrUpdater === 'function' ? wdsOrUpdater(words) : wdsOrUpdater;
            const data = await saveCodingContext('setWords', { words: newWords });
            if (data.words) setWordsState(data.words);
        },
        selectedWords,
        setSelectedWords: async (swdsOrUpdater) => {
            const newSelectedWords =
                typeof swdsOrUpdater === 'function' ? swdsOrUpdater(selectedWords) : swdsOrUpdater;
            const data = await saveCodingContext('setSelectedWords', {
                selectedWords: newSelectedWords
            });
            if (data.selectedWords) setSelectedWordsState(data.selectedWords);
        },
        references,
        setReferences: async (refsOrUpdater) => {
            const newReferences =
                typeof refsOrUpdater === 'function' ? refsOrUpdater(references) : refsOrUpdater;
            const data = await saveCodingContext('setReferences', { references: newReferences });
            if (data.references) setReferencesState(data.references);
        },
        keywordTable,
        dispatchKeywordsTable: async (action: KeywordsTableAction) => {
            const data = await saveCodingContext('dispatchKeywordsTable', { action });
            if (data.keywordTable) setKeywordTableState(data.keywordTable);
        },
        updateContext: async (updates: Partial<ICodingContext>) => {
            const data = await saveCodingContext('updateContext', updates);
            // Assuming the backend returns the updated states, update them accordingly
            if (data.contextFiles) setContextFilesState(data.contextFiles);
            if (data.mainTopic) setMainTopicState(data.mainTopic);
            if (data.additionalInfo) setAdditionalInfoState(data.additionalInfo);
            if (data.researchQuestions) setResearchQuestionsState(data.researchQuestions);
            if (data.keywords) setKeywordsState(data.keywords);
            if (data.selectedKeywords) setSelectedKeywordsState(data.selectedKeywords);
            if (data.words) setWordsState(data.words);
            if (data.selectedWords) setSelectedWordsState(data.selectedWords);
            if (data.references) setReferencesState(data.references);
            if (data.keywordTable) setKeywordTableState(data.keywordTable);
            if (data.sampledPostResponse) setSampledPostResponseState(data.sampledPostResponse);
            if (data.sampledPostResponseCopy)
                setSampledPostResponseCopyState(data.sampledPostResponseCopy);
            if (data.sampledPostWithThemeResponse)
                setSampledPostWithThemeResponseState(data.sampledPostWithThemeResponse);
            if (data.unseenPostResponse) setUnseenPostResponseState(data.unseenPostResponse);
            if (data.themes) setThemesState(data.themes);
            if (data.unplacedCodes) setUnplacedCodesState(data.unplacedCodes);
            if (data.groupedCodes) setGroupedCodesState(data.groupedCodes);
            if (data.unplacedSubCodes) setUnplacedSubCodesState(data.unplacedSubCodes);
            if (data.sampledPostIds) setSampledPostIdsState(data.sampledPostIds);
            if (data.unseenPostIds) setUnseenPostIdsState(data.unseenPostIds);
            if (data.conflictingResponses) setConflictingResponsesState(data.conflictingResponses);
            if (data.initialCodebookTable) setInitialCodebookTableState(data.initialCodebookTable);
        },
        resetContext: async () => {
            const data = await saveCodingContext('resetContext', {});
            if (data.success) {
                setContextFilesState({});
                setMainTopicState('');
                setAdditionalInfoState('');
                setResearchQuestionsState([]);
                setKeywordsState([]);
                setSelectedKeywordsState([]);
                setWordsState([]);
                setSelectedWordsState([]);
                setReferencesState({});
                setKeywordTableState([]);
                setSampledPostResponseState([]);
                setSampledPostResponseCopyState([]);
                setSampledPostWithThemeResponseState([]);
                setUnseenPostResponseState([]);
                setThemesState([]);
                setUnplacedCodesState([]);
                setGroupedCodesState([]);
                setUnplacedSubCodesState([]);
                setSampledPostIdsState([]);
                setUnseenPostIdsState([]);
                setConflictingResponsesState([]);
                setInitialCodebookTableState([]);
            }
        },
        sampledPostResponse,
        dispatchSampledPostResponse: async (action: SampleDataResponseReducerActions) => {
            const data = await saveCodingContext('dispatchSampledPostResponse', { action });
            if (data.sampledPostResponse) setSampledPostResponseState(data.sampledPostResponse);
        },
        sampledPostResponseCopy,
        setSampledPostResponseCopy: async (copyOrUpdater) => {
            const newCopy =
                typeof copyOrUpdater === 'function'
                    ? copyOrUpdater(sampledPostResponseCopy)
                    : copyOrUpdater;
            const data = await saveCodingContext('setSampledPostResponseCopy', {
                sampledPostResponseCopy: newCopy
            });
            if (data.sampledPostResponseCopy)
                setSampledPostResponseCopyState(data.sampledPostResponseCopy);
        },
        sampledPostWithThemeResponse,
        dispatchSampledPostWithThemeResponse: async (
            action: SampleDataWithThemeResponseReducerActions
        ) => {
            const data = await saveCodingContext('dispatchSampledPostWithThemeResponse', {
                action
            });
            if (data.sampledPostWithThemeResponse)
                setSampledPostWithThemeResponseState(data.sampledPostWithThemeResponse);
        },
        unseenPostResponse,
        dispatchUnseenPostResponse: async (action: BaseResponseHandlerActions<IQECTTyResponse>) => {
            const data = await saveCodingContext('dispatchUnseenPostResponse', { action });
            console.log('Unseen Post Response:', data);
            if (data.unseenPostResponse) setUnseenPostResponseState(data.unseenPostResponse);
        },
        themes,
        setThemes: async (tmsOrUpdater) => {
            const newThemes =
                typeof tmsOrUpdater === 'function' ? tmsOrUpdater(themes) : tmsOrUpdater;
            const data = await saveCodingContext('setThemes', { themes: newThemes });
            if (data.themes) setThemesState(data.themes);
        },
        unplacedCodes,
        setUnplacedCodes: async (codesOrUpdater) => {
            const newCodes =
                typeof codesOrUpdater === 'function'
                    ? codesOrUpdater(unplacedCodes)
                    : codesOrUpdater;
            const data = await saveCodingContext('setUnplacedCodes', { unplacedCodes: newCodes });
            if (data.unplacedCodes) setUnplacedCodesState(data.unplacedCodes);
        },
        groupedCodes,
        setGroupedCodes: async (gcsOrUpdater) => {
            const newGroupedCodes =
                typeof gcsOrUpdater === 'function' ? gcsOrUpdater(groupedCodes) : gcsOrUpdater;
            const data = await saveCodingContext('setGroupedCodes', {
                groupedCodes: newGroupedCodes
            });
            if (data.groupedCodes) setGroupedCodesState(data.groupedCodes);
        },
        unplacedSubCodes,
        setUnplacedSubCodes: async (subCodesOrUpdater) => {
            const newSubCodes =
                typeof subCodesOrUpdater === 'function'
                    ? subCodesOrUpdater(unplacedSubCodes)
                    : subCodesOrUpdater;
            const data = await saveCodingContext('setUnplacedSubCodes', {
                unplacedSubCodes: newSubCodes
            });
            if (data.unplacedSubCodes) setUnplacedSubCodesState(data.unplacedSubCodes);
        },
        researchQuestions,
        setResearchQuestions: async (rqsOrUpdater) => {
            const newResearchQuestions =
                typeof rqsOrUpdater === 'function' ? rqsOrUpdater(researchQuestions) : rqsOrUpdater;
            const data = await saveCodingContext('setResearchQuestions', {
                researchQuestions: newResearchQuestions
            });
            if (data.researchQuestions) setResearchQuestionsState(data.researchQuestions);
        },
        sampledPostIds,
        setSampledPostIds: async (idsOrUpdater) => {
            const newIds =
                typeof idsOrUpdater === 'function' ? idsOrUpdater(sampledPostIds) : idsOrUpdater;
            // const data = await saveCodingContext('setSampledPostIds', { sampledPostIds: newIds });
            if (newIds) setSampledPostIdsState(newIds);
        },
        unseenPostIds,
        setUnseenPostIds: async (idsOrUpdater) => {
            const newIds =
                typeof idsOrUpdater === 'function' ? idsOrUpdater(unseenPostIds) : idsOrUpdater;
            // const data = await saveCodingContext('setUnseenPostIds', { unseenPostIds: newIds });
            if (newIds) setUnseenPostIdsState(newIds);
        },
        conflictingResponses,
        setConflictingResponses: async (crsOrUpdater) => {
            const newConflictingResponses =
                typeof crsOrUpdater === 'function'
                    ? crsOrUpdater(conflictingResponses)
                    : crsOrUpdater;
            const data = await saveCodingContext('setConflictingResponses', {
                conflictingResponses: newConflictingResponses
            });
            if (data.conflictingResponses) setConflictingResponsesState(data.conflictingResponses);
        },
        initialCodebookTable,
        dispatchInitialCodebookTable: async (action: InitialCodebookTableAction) => {
            const data = await saveCodingContext('dispatchInitialCodebookTable', { action });
            if (data.initialCodebookTable) setInitialCodebookTableState(data.initialCodebookTable);
        }
    };

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

// Hook to use the CodingContext
export const useCodingContext = () => {
    const context = useContext(CodingContext);
    if (!context) {
        throw new Error('useCodingContext must be used within a CodingProvider');
    }
    return context;
};
