import React, { createContext, useState, useEffect, useContext, FC, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoadingContext } from './loading-context';
import { PAGE_ROUTES } from '../constants/Coding/shared';
import { ICodingContext, Keyword } from '../types/Shared';
import {
    IFile,
    IReference,
    IQECResponse,
    IQECTTyResponse,
    ThemeBucket,
    GroupedCodeBucket,
    KeywordEntry,
    InitialCodebookCode,
    KeywordsTableAction,
    SampleDataResponseReducerActions,
    BaseResponseHandlerActions,
    InitialCodebookTableAction,
    BaseBucketAction
} from '../types/Coding/shared';
import { useApi } from '../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';
import { useLoadingSteps } from '../hooks/Shared/use-loading-steps';

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
    references: {},
    setReferences: async () => {},
    keywordTable: [],
    dispatchKeywordsTable: async () => {},
    updateContext: async () => {},
    resetContext: async () => {},
    // sampledPostResponse: [],
    dispatchSampledPostResponse: async () => {},
    // unseenPostResponse: [],
    dispatchUnseenPostResponse: async () => {},
    themes: [],
    dispatchThemes: async () => {},
    groupedCodes: [],
    dispatchGroupedCodes: async () => {},
    researchQuestions: [],
    setResearchQuestions: async () => {},
    sampledPostIds: [],
    setSampledPostIds: async () => {},
    unseenPostIds: [],
    setUnseenPostIds: async () => {},
    initialCodebookTable: [],
    dispatchInitialCodebookTable: async () => {}
});

export const CodingProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const { loadingState, loadingDispatch } = useLoadingContext();
    const { fetchData } = useApi();

    const [contextFiles, setContextFilesState] = useState<IFile>({});
    const [mainTopic, setMainTopicState] = useState<string>('');
    const [additionalInfo, setAdditionalInfoState] = useState<string>('');
    const [researchQuestions, setResearchQuestionsState] = useState<string[]>([]);
    const [keywords, setKeywordsState] = useState<Keyword[]>([]);
    const [selectedKeywords, setSelectedKeywordsState] = useState<string[]>([]);
    const [references, setReferencesState] = useState<{ [code: string]: IReference[] }>({});
    const [keywordTable, setKeywordTableState] = useState<KeywordEntry[]>([]);
    const [sampledPostResponse, setSampledPostResponseState] = useState<IQECResponse[]>([]);
    const [unseenPostResponse, setUnseenPostResponseState] = useState<IQECTTyResponse[]>([]);
    const [themes, setThemesState] = useState<ThemeBucket[]>([]);
    const [unplacedCodes, setUnplacedCodesState] = useState<string[]>([]);
    const [groupedCodes, setGroupedCodesState] = useState<GroupedCodeBucket[]>([]);
    const [unplacedSubCodes, setUnplacedSubCodesState] = useState<string[]>([]);
    const [sampledPostIds, setSampledPostIdsState] = useState<string[]>([]);
    const [unseenPostIds, setUnseenPostIdsState] = useState<string[]>([]);
    const [initialCodebookTable, setInitialCodebookTableState] = useState<InitialCodebookCode[]>(
        []
    );

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
        references: setReferencesState,
        keywordTable: setKeywordTableState,
        sampledPostResponse: setSampledPostResponseState,
        unseenPostResponse: setUnseenPostResponseState,
        themes: setThemesState,
        groupedCodes: setGroupedCodesState,
        sampledPostIds: setSampledPostIdsState,
        unseenPostIds: setUnseenPostIdsState,
        initialCodebookTable: setInitialCodebookTableState
    };

    const resetFunctions: Record<string, () => void> = {
        contextFiles: () => setContextFilesState({}),
        mainTopic: () => setMainTopicState(''),
        additionalInfo: () => setAdditionalInfoState(''),
        researchQuestions: () => setResearchQuestionsState([]),
        keywords: () => setKeywordsState([]),
        selectedKeywords: () => setSelectedKeywordsState([]),
        references: () => setReferencesState({}),
        keywordTable: () => setKeywordTableState([]),
        sampledPostResponse: () => setSampledPostResponseState([]),
        unseenPostResponse: () => setUnseenPostResponseState([]),
        themes: () => setThemesState([]),
        groupedCodes: () => setGroupedCodesState([]),
        sampledPostIds: () => setSampledPostIdsState([]),
        unseenPostIds: () => setUnseenPostIdsState([]),
        initialCodebookTable: () => setInitialCodebookTableState([])
    };

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

    const loadingStateInitialization: Record<
        string,
        {
            relatedStates: {
                name: string;
            }[];
            downloadData?: { name: string; condition?: boolean };
        }
    > = useMemo(
        () => ({
            [PAGE_ROUTES.CONTEXT]: {
                relatedStates: [
                    {
                        name: 'setContextFiles'
                    },
                    { name: 'setMainTopic' },
                    { name: 'setAdditionalInfo' },
                    {
                        name: 'setResearchQuestions'
                    }
                ]
            },
            [PAGE_ROUTES.RELATED_CONCEPTS]: {
                relatedStates: [
                    {
                        name: 'setKeywords'
                    },
                    {
                        name: 'selectedKeywords'
                    }
                ]
            },
            [PAGE_ROUTES.CONCEPT_OUTLINE]: {
                relatedStates: [
                    {
                        name: 'dispatchKeywordsTable'
                    }
                ]
            },
            [PAGE_ROUTES.INITIAL_CODING]: {
                relatedStates: [
                    {
                        name: 'dispatchSampledPostResponse'
                    },
                    {
                        name: 'setSampledPostResponseCopy'
                    },
                    {
                        name: 'setSampledPostIds'
                    },
                    {
                        name: 'setUnseenPostIds'
                    }
                ],
                downloadData: { name: 'codebook', data: sampledPostResponse }
            },
            [PAGE_ROUTES.INITIAL_CODEBOOK]: {
                relatedStates: [
                    {
                        name: 'dispatchInitialCodebookTable'
                    }
                ]
            },
            [PAGE_ROUTES.FINAL_CODING]: {
                relatedStates: [
                    {
                        name: 'dispatchUnseenPostResponse'
                    }
                ],
                downloadData: { name: 'final_codebook' }
            },
            [PAGE_ROUTES.REVIEWING_CODES]: {
                relatedStates: [
                    { name: 'setGroupedCodes' },
                    {
                        name: 'setUnplacedSubCodes'
                    }
                ],
                downloadData: {
                    name: 'codebook_with_grouped_codes'
                }
            },
            [PAGE_ROUTES.GENERATING_THEMES]: {
                relatedStates: [{ name: 'setThemes' }, { name: 'setUnplacedCodes' }],
                downloadData: {
                    name: 'codebook_with_themes',
                    condition: themes.length > 0
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

    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.CONTEXT]?.stepRef);
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[PAGE_ROUTES.RELATED_CONCEPTS]?.stepRef
    );
    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.CONCEPT_OUTLINE]?.stepRef);
    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.INITIAL_CODING]?.stepRef);
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[PAGE_ROUTES.INITIAL_CODEBOOK]?.stepRef
    );
    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.FINAL_CODING]?.stepRef);
    useLoadingSteps(loadingStateInitialization, loadingState[PAGE_ROUTES.REVIEWING_CODES]?.stepRef);
    useLoadingSteps(
        loadingStateInitialization,
        loadingState[PAGE_ROUTES.GENERATING_THEMES]?.stepRef
    );

    useEffect(() => {
        const page = location.pathname;
        const stateMap: Record<string, string[]> = {
            [PAGE_ROUTES.HOME]: [
                'contextFiles',
                'mainTopic',
                'additionalInfo',
                'researchQuestions',
                'keywords',
                'selectedKeywords',
                'initialCodebookTable',
                'groupedCodes',
                'unplacedSubCodes',
                'themes',
                'unplacedCodes',
                'sampledPostIds',
                'unseenPostIds'
            ],
            [PAGE_ROUTES.CONTEXT]: [
                'contextFiles',
                'mainTopic',
                'additionalInfo',
                'researchQuestions'
            ],
            [PAGE_ROUTES.RELATED_CONCEPTS]: ['keywords', 'selectedKeywords'],
            [PAGE_ROUTES.CONCEPT_OUTLINE]: ['keywordTable'],
            [PAGE_ROUTES.INITIAL_CODING]: ['sampledPostResponse', 'sampledPostIds'],
            [PAGE_ROUTES.INITIAL_CODEBOOK]: ['initialCodebookTable'],
            [PAGE_ROUTES.FINAL_CODING]: ['unseenPostResponse', 'unseenPostIds'],
            [PAGE_ROUTES.REVIEWING_CODES]: ['groupedCodes', 'unplacedSubCodes'],
            [PAGE_ROUTES.GENERATING_THEMES]: ['themes', 'unplacedCodes']
        };
        const statesToFetch = stateMap[page] || [];
        if (statesToFetch.length > 0) {
            (async () => {
                try {
                    const fetchedData = await fetchStates(statesToFetch);
                    if (fetchedData) {
                        statesToFetch.forEach((stateName) => {
                            console.log(`Setting state: ${stateName}`, fetchedData[stateName]);
                            if (
                                fetchedData[stateName] !== undefined &&
                                setterFunctions[stateName]
                            ) {
                                setterFunctions[stateName](fetchedData[stateName]);
                            }
                        });
                    }
                } catch (error) {
                    console.error('Error in state fetching effect:', error);
                }
            })();
        }
    }, [location.pathname]);

    const value: ICodingContext = useMemo(
        () => ({
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
                    typeof topicOrUpdater === 'function'
                        ? topicOrUpdater(mainTopic)
                        : topicOrUpdater;
                const data = await saveCodingContext('setMainTopic', { mainTopic: newTopic });
                if (data.mainTopic !== undefined) setMainTopicState(data.mainTopic);
            },
            additionalInfo,
            setAdditionalInfo: async (infoOrUpdater) => {
                const newInfo =
                    typeof infoOrUpdater === 'function'
                        ? infoOrUpdater(additionalInfo)
                        : infoOrUpdater;
                const data = await saveCodingContext('setAdditionalInfo', {
                    additionalInfo: newInfo
                });
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
            references,
            setReferences: async (refsOrUpdater) => {
                const newReferences =
                    typeof refsOrUpdater === 'function' ? refsOrUpdater(references) : refsOrUpdater;
                const data = await saveCodingContext('setReferences', {
                    references: newReferences
                });
                if (data.references) setReferencesState(data.references);
            },
            keywordTable,
            dispatchKeywordsTable: async (action: KeywordsTableAction) => {
                const data = await saveCodingContext('dispatchKeywordsTable', { action });
                if (data.keywordTable) setKeywordTableState(data.keywordTable);
            },
            updateContext: async (updates: Partial<ICodingContext>) => {
                const data = await saveCodingContext('updateContext', updates);
                if (data.contextFiles) setContextFilesState(data.contextFiles);
                if (data.mainTopic) setMainTopicState(data.mainTopic);
                if (data.additionalInfo) setAdditionalInfoState(data.additionalInfo);
                if (data.researchQuestions) setResearchQuestionsState(data.researchQuestions);
                if (data.keywords) setKeywordsState(data.keywords);
                if (data.selectedKeywords) setSelectedKeywordsState(data.selectedKeywords);
                if (data.references) setReferencesState(data.references);
                if (data.keywordTable) setKeywordTableState(data.keywordTable);
                if (data.sampledPostResponse) setSampledPostResponseState(data.sampledPostResponse);
                if (data.unseenPostResponse) setUnseenPostResponseState(data.unseenPostResponse);
                if (data.themes) setThemesState(data.themes);
                if (data.unplacedCodes) setUnplacedCodesState(data.unplacedCodes);
                if (data.groupedCodes) setGroupedCodesState(data.groupedCodes);
                if (data.unplacedSubCodes) setUnplacedSubCodesState(data.unplacedSubCodes);
                if (data.sampledPostIds) setSampledPostIdsState(data.sampledPostIds);
                if (data.unseenPostIds) setUnseenPostIdsState(data.unseenPostIds);
                if (data.initialCodebookTable)
                    setInitialCodebookTableState(data.initialCodebookTable);
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
                    setReferencesState({});
                    setKeywordTableState([]);
                    setSampledPostResponseState([]);
                    setUnseenPostResponseState([]);
                    setThemesState([]);
                    setGroupedCodesState([]);
                    setSampledPostIdsState([]);
                    setUnseenPostIdsState([]);
                    setInitialCodebookTableState([]);
                }
            },
            // sampledPostResponse,
            dispatchSampledPostResponse: async (action: SampleDataResponseReducerActions) => {
                const data = await saveCodingContext('dispatchSampledPostResponse', { action });
                console.log('Sampled Post Response:', data);
                if (data.sampledPostResponse) setSampledPostResponseState(data.sampledPostResponse);
            },
            // unseenPostResponse,
            dispatchUnseenPostResponse: async (
                action: BaseResponseHandlerActions<IQECTTyResponse>
            ) => {
                const data = await saveCodingContext('dispatchUnseenPostResponse', { action });
                console.log('Unseen Post Response:', data);
                if (data.unseenPostResponse) setUnseenPostResponseState(data.unseenPostResponse);
            },
            themes,
            dispatchThemes: async (action) => {
                const data = await saveCodingContext('dispatchThemes', {
                    action
                });
                if (data.themes) setThemesState(data.themes);
            },
            groupedCodes,
            dispatchGroupedCodes: async (action: BaseBucketAction) => {
                const data = await saveCodingContext('dispatchGroupedCodes', {
                    action
                });
                if (data.groupedCodes) setGroupedCodesState(data.groupedCodes);
            },
            researchQuestions,
            setResearchQuestions: async (rqsOrUpdater) => {
                const newResearchQuestions =
                    typeof rqsOrUpdater === 'function'
                        ? rqsOrUpdater(researchQuestions)
                        : rqsOrUpdater;
                const data = await saveCodingContext('setResearchQuestions', {
                    researchQuestions: newResearchQuestions
                });
                if (data.researchQuestions) setResearchQuestionsState(data.researchQuestions);
            },
            sampledPostIds,
            setSampledPostIds: async (idsOrUpdater) => {
                const newIds =
                    typeof idsOrUpdater === 'function'
                        ? idsOrUpdater(sampledPostIds)
                        : idsOrUpdater;
                if (newIds) setSampledPostIdsState(newIds);
            },
            unseenPostIds,
            setUnseenPostIds: async (idsOrUpdater) => {
                const newIds =
                    typeof idsOrUpdater === 'function' ? idsOrUpdater(unseenPostIds) : idsOrUpdater;
                if (newIds) setUnseenPostIdsState(newIds);
            },
            initialCodebookTable,
            dispatchInitialCodebookTable: async (action: InitialCodebookTableAction) => {
                const data = await saveCodingContext('dispatchInitialCodebookTable', { action });
                if (data.initialCodebookTable)
                    setInitialCodebookTableState(data.initialCodebookTable);
            }
        }),
        [
            contextFiles,
            mainTopic,
            additionalInfo,
            keywords,
            selectedKeywords,
            references,
            keywordTable,
            sampledPostResponse,
            unseenPostResponse,
            themes,
            unplacedCodes,
            groupedCodes,
            unplacedSubCodes,
            researchQuestions,
            sampledPostIds,
            unseenPostIds,
            initialCodebookTable
        ]
    );

    return <CodingContext.Provider value={value}>{children}</CodingContext.Provider>;
};

export const useCodingContext = () => {
    const context = useContext(CodingContext);
    if (!context) {
        throw new Error('useCodingContext must be used within a CodingProvider');
    }
    return context;
};
