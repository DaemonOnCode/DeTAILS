import React, { createContext, useState, useEffect, useContext, FC, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoadingContext } from './loading-context';
import { PAGE_ROUTES } from '../constants/Coding/shared';
import { ICodingContext, Concept } from '../types/Shared';
import {
    IFile,
    IReference,
    IQECResponse,
    IQECTTyResponse,
    ThemeBucket,
    GroupedCodeBucket,
    ConceptEntry,
    InitialCodebookCode,
    ConceptsTableAction,
    SampleDataResponseReducerActions,
    BaseResponseHandlerActions,
    InitialCodebookTableAction,
    BaseBucketAction,
    ILayout
} from '../types/Coding/shared';
import { useApi } from '../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES } from '../constants/Shared';
import { useLoadingSteps } from '../hooks/Shared/use-loading-steps';

export const CodingContext = createContext<ICodingContext>({
    contextFiles: {},
    addContextFile: async () => {},
    addContextFilesBatch: async () => {},
    removeContextFile: async () => {},
    mainTopic: '',
    setMainTopic: async () => {},
    additionalInfo: '',
    setAdditionalInfo: async () => {},
    concepts: [],
    setConcepts: async () => {},
    selectedConcepts: [],
    setSelectedConcepts: async () => {},
    references: {},
    setReferences: async () => {},
    conceptOutlineTable: [],
    dispatchConceptOutlinesTable: async () => {},
    updateContext: async () => {},
    resetContext: async () => {},
    dispatchSampledPostResponse: async () => {},
    dispatchUnseenPostResponse: async () => {},
    dispatchAllPostResponse: async () => {},
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
    dispatchInitialCodebookTable: async () => {},
    dispatchSampledCopyPostResponse: async () => {}
});

export const CodingProvider: FC<ILayout> = ({ children }) => {
    const location = useLocation();
    const { loadingState, lockedUpdate } = useLoadingContext();
    const { fetchData } = useApi();

    const [contextFiles, setContextFilesState] = useState<IFile>({});
    const [mainTopic, setMainTopicState] = useState<string>('');
    const [additionalInfo, setAdditionalInfoState] = useState<string>('');
    const [researchQuestions, setResearchQuestionsState] = useState<string[]>([]);
    const [concepts, setConceptsState] = useState<Concept[]>([]);
    const [selectedConcepts, setSelectedConceptsState] = useState<string[]>([]);
    const [references, setReferencesState] = useState<{ [code: string]: IReference[] }>({});
    const [conceptOutlineTable, setConceptTableState] = useState<ConceptEntry[]>([]);
    const [themes, setThemesState] = useState<ThemeBucket[]>([]);
    const [unplacedCodes, setUnplacedCodesState] = useState<string[]>([]);
    const [groupedCodes, setGroupedCodesState] = useState<GroupedCodeBucket[]>([]);
    const [unplacedSubCodes, setUnplacedSubCodesState] = useState<string[]>([]);
    const [sampledPostIds, setSampledPostIdsState] = useState<string[]>([]);
    const [unseenPostIds, setUnseenPostIdsState] = useState<string[]>([]);
    const [initialCodebookTable, setInitialCodebookTableState] = useState<InitialCodebookCode[]>(
        []
    );

    const saveCodingContext = async (operationType: string, payload: any) => {
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
        concepts: setConceptsState,
        selectedConcepts: setSelectedConceptsState,
        references: setReferencesState,
        conceptOutlineTable: setConceptTableState,
        themes: setThemesState,
        groupedCodes: setGroupedCodesState,
        sampledPostIds: setSampledPostIdsState,
        unseenPostIds: setUnseenPostIdsState,
        initialCodebookTable: setInitialCodebookTableState
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
                        name: 'setConcepts'
                    },
                    {
                        name: 'selectedConcepts'
                    }
                ]
            },
            [PAGE_ROUTES.CONCEPT_OUTLINE]: {
                relatedStates: [
                    {
                        name: 'dispatchConceptOutlinesTable'
                    }
                ]
            },
            [PAGE_ROUTES.INITIAL_CODING]: {
                relatedStates: [
                    {
                        name: 'dispatchSampledPostResponse'
                    },
                    {
                        name: 'setSampledPostIds'
                    },
                    {
                        name: 'setUnseenPostIds'
                    }
                ],
                downloadData: { name: 'initial-codes' }
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
                    },
                    {
                        name: 'dispatchSampledCopyPostResponse'
                    }
                ],
                downloadData: { name: 'all-codes' }
            },
            [PAGE_ROUTES.REVIEWING_CODES]: {
                relatedStates: [
                    { name: 'setGroupedCodes' },
                    {
                        name: 'setUnplacedSubCodes'
                    }
                ],
                downloadData: {
                    name: 'codes-with-reviewed-codes'
                }
            },
            [PAGE_ROUTES.GENERATING_THEMES]: {
                relatedStates: [{ name: 'setThemes' }, { name: 'setUnplacedCodes' }],
                downloadData: {
                    name: 'codes-with-themes',
                    condition: themes.length > 0
                }
            }
        }),
        [
            contextFiles,
            mainTopic,
            additionalInfo,
            concepts,
            selectedConcepts,
            conceptOutlineTable,
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
                'concepts',
                'selectedConcepts',
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
            [PAGE_ROUTES.RELATED_CONCEPTS]: ['concepts', 'selectedConcepts'],
            [PAGE_ROUTES.CONCEPT_OUTLINE]: ['conceptOutlineTable'],
            [PAGE_ROUTES.INITIAL_CODING]: ['sampledPostIds'],
            [PAGE_ROUTES.INITIAL_CODEBOOK]: ['initialCodebookTable'],
            [PAGE_ROUTES.FINAL_CODING]: ['unseenPostIds'],
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
            addContextFile: (filePath: string, fileName: string) =>
                lockedUpdate('add-context-file', async () => {
                    const data = await saveCodingContext('addContextFile', { filePath, fileName });
                    if (data.contextFiles) setContextFilesState(data.contextFiles);
                    return data;
                }),
            addContextFilesBatch: (files: { filePath: string; fileName: string }[]) =>
                lockedUpdate('add-context-files-batch', async () => {
                    const data = await saveCodingContext('addContextFilesBatch', { files });
                    if (data.contextFiles) setContextFilesState(data.contextFiles);
                    else setContextFilesState((prev) => ({ ...prev }));
                    return data;
                }),
            removeContextFile: (filePath: string) =>
                lockedUpdate('remove-context-file', async () => {
                    const data = await saveCodingContext('removeContextFile', { filePath });
                    if (data.contextFiles) setContextFilesState(data.contextFiles);
                    else setContextFilesState((prev) => ({ ...prev }));
                    return data;
                }),
            mainTopic,
            setMainTopic: (topicOrUpdater) =>
                lockedUpdate('set-main-topic', async () => {
                    const newTopic =
                        typeof topicOrUpdater === 'function'
                            ? topicOrUpdater(mainTopic)
                            : topicOrUpdater;
                    const data = await saveCodingContext('setMainTopic', { mainTopic: newTopic });
                    if (data.mainTopic !== undefined) setMainTopicState(data.mainTopic);
                    else setMainTopicState((prev) => prev);
                    return data;
                }),
            additionalInfo,
            setAdditionalInfo: (infoOrUpdater) =>
                lockedUpdate('set-additional-info', async () => {
                    const newInfo =
                        typeof infoOrUpdater === 'function'
                            ? infoOrUpdater(additionalInfo)
                            : infoOrUpdater;
                    const data = await saveCodingContext('setAdditionalInfo', {
                        additionalInfo: newInfo
                    });
                    if (data.additionalInfo !== undefined)
                        setAdditionalInfoState(data.additionalInfo);
                    else setAdditionalInfoState((prev) => prev);
                    return data;
                }),
            concepts,
            setConcepts: (kwsOrUpdater) =>
                lockedUpdate('set-concepts', async () => {
                    const newConcepts =
                        typeof kwsOrUpdater === 'function' ? kwsOrUpdater(concepts) : kwsOrUpdater;
                    const data = await saveCodingContext('setConcepts', { concepts: newConcepts });
                    if (data.concepts) setConceptsState(data.concepts);
                    else setConceptsState((prev) => [...prev]);
                    return data;
                }),
            selectedConcepts,
            setSelectedConcepts: (skwsOrUpdater) =>
                lockedUpdate('set-selected-concepts', async () => {
                    const newSelectedConcepts =
                        typeof skwsOrUpdater === 'function'
                            ? skwsOrUpdater(selectedConcepts)
                            : skwsOrUpdater;
                    const data = await saveCodingContext('setSelectedConcepts', {
                        selectedConcepts: newSelectedConcepts
                    });
                    if (data.selectedConcepts) setSelectedConceptsState(data.selectedConcepts);
                    else setSelectedConceptsState((prev) => [...prev]);
                    return data;
                }),
            references,
            setReferences: (refsOrUpdater) =>
                lockedUpdate('set-references', async () => {
                    const newReferences =
                        typeof refsOrUpdater === 'function'
                            ? refsOrUpdater(references)
                            : refsOrUpdater;
                    const data = await saveCodingContext('setReferences', {
                        references: newReferences
                    });
                    if (data.references) setReferencesState(data.references);
                    return data;
                }),
            conceptOutlineTable,
            dispatchConceptOutlinesTable: (action: ConceptsTableAction) =>
                lockedUpdate('dispatch-concepts-table', async () => {
                    const data = await saveCodingContext('dispatchConceptOutlinesTable', {
                        action
                    });
                    if (data.conceptOutlineTable) setConceptTableState(data.conceptOutlineTable);
                    else setConceptTableState((prev) => [...prev]);
                    return data;
                }),
            updateContext: (updates: Partial<ICodingContext>) =>
                lockedUpdate('update-context', async () => {
                    const data = await saveCodingContext('updateContext', updates);
                    if (data.contextFiles) setContextFilesState(data.contextFiles);
                    if (data.mainTopic) setMainTopicState(data.mainTopic);
                    if (data.additionalInfo) setAdditionalInfoState(data.additionalInfo);
                    if (data.researchQuestions) setResearchQuestionsState(data.researchQuestions);
                    if (data.concepts) setConceptsState(data.concepts);
                    if (data.selectedConcepts) setSelectedConceptsState(data.selectedConcepts);
                    if (data.references) setReferencesState(data.references);
                    if (data.conceptOutlineTable) setConceptTableState(data.conceptOutlineTable);
                    if (data.themes) setThemesState(data.themes);
                    if (data.unplacedCodes) setUnplacedCodesState(data.unplacedCodes);
                    if (data.groupedCodes) setGroupedCodesState(data.groupedCodes);
                    if (data.unplacedSubCodes) setUnplacedSubCodesState(data.unplacedSubCodes);
                    if (data.sampledPostIds) setSampledPostIdsState(data.sampledPostIds);
                    if (data.unseenPostIds) setUnseenPostIdsState(data.unseenPostIds);
                    if (data.initialCodebookTable)
                        setInitialCodebookTableState(data.initialCodebookTable);
                    return data;
                }),
            resetContext: () =>
                lockedUpdate('reset-context', async () => {
                    const data = await saveCodingContext('resetContext', {});
                    if (data.success) {
                        setContextFilesState({});
                        setMainTopicState('');
                        setAdditionalInfoState('');
                        setResearchQuestionsState([]);
                        setConceptsState([]);
                        setSelectedConceptsState([]);
                        setReferencesState({});
                        setConceptTableState([]);
                        setThemesState([]);
                        setGroupedCodesState([]);
                        setSampledPostIdsState([]);
                        setUnseenPostIdsState([]);
                        setInitialCodebookTableState([]);
                    }
                    return data;
                }),
            dispatchSampledPostResponse: (
                action: SampleDataResponseReducerActions,
                refreshRef: any = null
            ) =>
                lockedUpdate('dispatch-sampled-post-response', async () => {
                    const data = await saveCodingContext('dispatchSampledPostResponse', { action });
                    console.log('Sampled Post Response:', data);
                    refreshRef?.current?.refresh();
                    refreshRef?.current?.refresh();
                    console.log(
                        'Refreshing data... from context after refreshing',
                        refreshRef?.current
                    );
                    refreshRef?.current?.refresh();
                    console.log(
                        'Refreshing data... from context after refreshing',
                        refreshRef?.current
                    );
                    return data;
                }),
            dispatchSampledCopyPostResponse: (
                action: SampleDataResponseReducerActions,
                refreshRef: any = null
            ) =>
                lockedUpdate('dispatch-sampled-copy-post-response', async () => {
                    const data = await saveCodingContext('dispatchSampledCopyPostResponse', {
                        action
                    });
                    console.log('Sampled Post Copy Response:', data);
                    refreshRef?.current?.refresh();
                    refreshRef?.current?.refresh();
                    console.log(
                        'Refreshing data... from context after refreshing',
                        refreshRef?.current
                    );
                    refreshRef?.current?.refresh();
                    console.log(
                        'Refreshing data... from context after refreshing',
                        refreshRef?.current
                    );
                    return data;
                }),
            dispatchUnseenPostResponse: (
                action: BaseResponseHandlerActions<IQECTTyResponse>,
                refreshRef: any = null
            ) =>
                lockedUpdate('dispatch-unseen-post-response', async () => {
                    const data = await saveCodingContext('dispatchUnseenPostResponse', { action });
                    console.log('Unseen Post Response:', data);
                    refreshRef?.current?.refresh();
                    return data;
                }),
            dispatchAllPostResponse: (
                action: BaseResponseHandlerActions<IQECTTyResponse>,
                refreshRef: any = null
            ) =>
                lockedUpdate('dispatch-all-post-response', async () => {
                    const data = await saveCodingContext('dispatchAllPostResponse', { action });
                    console.log('All Post Response:', data);
                    refreshRef?.current?.refresh();
                    return data;
                }),
            themes,
            dispatchThemes: (action) =>
                lockedUpdate('dispatch-themes', async () => {
                    const data = await saveCodingContext('dispatchThemes', { action });
                    if (data.themes) setThemesState(data.themes);
                    return data;
                }),
            groupedCodes,
            dispatchGroupedCodes: (action: BaseBucketAction) =>
                lockedUpdate('dispatch-grouped-codes', async () => {
                    const data = await saveCodingContext('dispatchGroupedCodes', { action });
                    if (data.groupedCodes) setGroupedCodesState(data.groupedCodes);
                    return data;
                }),
            researchQuestions,
            setResearchQuestions: (rqsOrUpdater) =>
                lockedUpdate('set-research-questions', async () => {
                    const newResearchQuestions =
                        typeof rqsOrUpdater === 'function'
                            ? rqsOrUpdater(researchQuestions)
                            : rqsOrUpdater;
                    const data = await saveCodingContext('setResearchQuestions', {
                        researchQuestions: newResearchQuestions
                    });
                    if (data.researchQuestions) setResearchQuestionsState(data.researchQuestions);
                    return data;
                }),
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
            dispatchInitialCodebookTable: (action: InitialCodebookTableAction) =>
                lockedUpdate('dispatch-initial-codebook-table', async () => {
                    const data = await saveCodingContext('dispatchInitialCodebookTable', {
                        action
                    });
                    if (data.initialCodebookTable)
                        setInitialCodebookTableState(data.initialCodebookTable);
                    return data;
                })
        }),
        [
            contextFiles,
            mainTopic,
            additionalInfo,
            concepts,
            selectedConcepts,
            references,
            conceptOutlineTable,
            themes,
            unplacedCodes,
            groupedCodes,
            unplacedSubCodes,
            researchQuestions,
            sampledPostIds,
            unseenPostIds,
            initialCodebookTable,
            location.pathname
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
