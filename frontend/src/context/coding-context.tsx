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

    // State declarations with initial values
    const [contextFiles, setContextFiles] = useState<IFile>({});
    const [mainTopic, setMainTopic] = useState<string>('');
    const [additionalInfo, setAdditionalInfo] = useState<string>('');
    const [researchQuestions, setResearchQuestions] = useState<string[]>([]);
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
    const [words, setWords] = useState<Keyword[]>([]);
    const [selectedWords, setSelectedWords] = useState<Keyword[]>([]);
    const [references, setReferences] = useState<{ [code: string]: IReference[] }>({});
    const [keywordTable, setKeywordTable] = useState<KeywordEntry[]>([]);
    const [sampledPostResponse, setSampledPostResponse] = useState<IQECResponse[]>([]);
    const [sampledPostResponseCopy, setSampledPostResponseCopy] = useState<IQECResponse[]>([]);
    const [sampledPostWithThemeResponse, setSampledPostWithThemeResponse] = useState<
        IQECTResponse[]
    >([]);
    const [unseenPostResponse, setUnseenPostResponse] = useState<IQECTTyResponse[]>([]);
    const [themes, setThemes] = useState<ThemeBucket[]>([]);
    const [unplacedCodes, setUnplacedCodes] = useState<string[]>([]);
    const [groupedCodes, setGroupedCodes] = useState<GroupedCodeBucket[]>([]);
    const [unplacedSubCodes, setUnplacedSubCodes] = useState<string[]>([]);
    const [sampledPostIds, setSampledPostIds] = useState<string[]>([]);
    const [unseenPostIds, setUnseenPostIds] = useState<string[]>([]);
    const [conflictingResponses, setConflictingResponses] = useState<IQECResponse[]>([]);
    const [initialCodebookTable, setInitialCodebookTable] = useState<InitialCodebookCode[]>([]);

    // Map of state setters for dynamic updates
    const stateSetters = {
        contextFiles: setContextFiles,
        mainTopic: setMainTopic,
        additionalInfo: setAdditionalInfo,
        researchQuestions: setResearchQuestions,
        keywords: setKeywords,
        selectedKeywords: setSelectedKeywords,
        words: setWords,
        selectedWords: setSelectedWords,
        references: setReferences,
        keywordTable: setKeywordTable,
        sampledPostResponse: setSampledPostResponse,
        sampledPostResponseCopy: setSampledPostResponseCopy,
        sampledPostWithThemeResponse: setSampledPostWithThemeResponse,
        unseenPostResponse: setUnseenPostResponse,
        themes: setThemes,
        unplacedCodes: setUnplacedCodes,
        groupedCodes: setGroupedCodes,
        unplacedSubCodes: setUnplacedSubCodes,
        sampledPostIds: setSampledPostIds,
        unseenPostIds: setUnseenPostIds,
        conflictingResponses: setConflictingResponses,
        initialCodebookTable: setInitialCodebookTable
    };

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

    // Helper function to fetch states from the backend
    const fetchStates = async (stateNames: string[]) => {
        try {
            if (stateNames.length === 0) return;
            const { data, error } = await fetchData(REMOTE_SERVER_ROUTES.LOAD_CODING_CONTEXT, {
                method: 'POST',
                body: JSON.stringify({ states: stateNames })
            });
            if (error) throw new Error(`Failed to fetch states: ${stateNames.join(', ')}`);
            stateNames.forEach((stateName) => {
                if (data[stateName] !== undefined) {
                    stateSetters[stateName](data[stateName]);
                }
            });
        } catch (error) {
            console.error(`Error fetching states:`, error);
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
            [PAGE_ROUTES.KEYWORD_CLOUD]: ['keywords', 'selectedKeywords'],
            [PAGE_ROUTES.KEYWORD_TABLE]: ['keywordTable'],
            [PAGE_ROUTES.CODEBOOK_CREATION]: ['sampledPostResponse'],
            [PAGE_ROUTES.INITIAL_CODEBOOK]: ['initialCodebookTable'],
            [PAGE_ROUTES.DEDUCTIVE_CODING]: ['unseenPostResponse'],
            [PAGE_ROUTES.FINALIZING_CODES]: ['groupedCodes', 'unplacedSubCodes'],
            [PAGE_ROUTES.THEMES]: ['themes', 'unplacedCodes']
        };
        const statesToFetch = stateMap[page] || [];
        if (statesToFetch.length > 0) {
            fetchStates(statesToFetch);
        }
    }, [location.pathname]);

    // Context value with methods to interact with the backend
    const value: ICodingContext = {
        contextFiles,
        addContextFile: async (filePath: string, fileName: string) => {
            const data = await saveCodingContext('addContextFile', { filePath, fileName });
            if (data.contextFiles) setContextFiles(data.contextFiles);
        },
        removeContextFile: async (filePath: string) => {
            const data = await saveCodingContext('removeContextFile', { filePath });
            if (data.contextFiles) setContextFiles(data.contextFiles);
        },
        mainTopic,
        setMainTopic: async (topic: string) => {
            const data = await saveCodingContext('setMainTopic', { mainTopic: topic });
            if (data.mainTopic !== undefined) setMainTopic(data.mainTopic);
        },
        additionalInfo,
        setAdditionalInfo: async (info: string) => {
            const data = await saveCodingContext('setAdditionalInfo', { additionalInfo: info });
            if (data.additionalInfo !== undefined) setAdditionalInfo(data.additionalInfo);
        },
        keywords,
        setKeywords: async (kws: Keyword[]) => {
            const data = await saveCodingContext('setKeywords', { keywords: kws });
            if (data.keywords) setKeywords(data.keywords);
        },
        selectedKeywords,
        setSelectedKeywords: async (skws: string[]) => {
            const data = await saveCodingContext('setSelectedKeywords', { selectedKeywords: skws });
            if (data.selectedKeywords) setSelectedKeywords(data.selectedKeywords);
        },
        words,
        setWords: async (wds: Keyword[]) => {
            const data = await saveCodingContext('setWords', { words: wds });
            if (data.words) setWords(data.words);
        },
        selectedWords,
        setSelectedWords: async (swds: Keyword[]) => {
            const data = await saveCodingContext('setSelectedWords', { selectedWords: swds });
            if (data.selectedWords) setSelectedWords(data.selectedWords);
        },
        references,
        setReferences: async (refs: { [code: string]: IReference[] }) => {
            const data = await saveCodingContext('setReferences', { references: refs });
            if (data.references) setReferences(data.references);
        },
        keywordTable,
        dispatchKeywordsTable: async (action: KeywordsTableAction) => {
            const data = await saveCodingContext('dispatchKeywordsTable', { action });
            if (data.keywordTable) setKeywordTable(data.keywordTable);
        },
        updateContext: async (updates: Partial<ICodingContext>) => {
            const data = await saveCodingContext('updateContext', updates);
            Object.entries(data).forEach(([key, value]) => {
                if (stateSetters[key]) stateSetters[key](value);
            });
        },
        resetContext: async () => {
            const data = await saveCodingContext('resetContext', {});
            if (data.success) {
                setContextFiles({});
                setMainTopic('');
                setAdditionalInfo('');
                setResearchQuestions([]);
                setKeywords([]);
                setSelectedKeywords([]);
                setWords([]);
                setSelectedWords([]);
                setReferences({});
                setKeywordTable([]);
                setSampledPostResponse([]);
                setSampledPostResponseCopy([]);
                setSampledPostWithThemeResponse([]);
                setUnseenPostResponse([]);
                setThemes([]);
                setUnplacedCodes([]);
                setGroupedCodes([]);
                setUnplacedSubCodes([]);
                setSampledPostIds([]);
                setUnseenPostIds([]);
                setConflictingResponses([]);
                setInitialCodebookTable([]);
            }
        },
        sampledPostResponse,
        dispatchSampledPostResponse: async (action: SampleDataResponseReducerActions) => {
            const data = await saveCodingContext('dispatchSampledPostResponse', { action });
            if (data.sampledPostResponse) setSampledPostResponse(data.sampledPostResponse);
        },
        sampledPostResponseCopy,
        setSampledPostResponseCopy: async (copy: IQECResponse[]) => {
            const data = await saveCodingContext('setSampledPostResponseCopy', {
                sampledPostResponseCopy: copy
            });
            if (data.sampledPostResponseCopy)
                setSampledPostResponseCopy(data.sampledPostResponseCopy);
        },
        sampledPostWithThemeResponse,
        dispatchSampledPostWithThemeResponse: async (
            action: SampleDataWithThemeResponseReducerActions
        ) => {
            const data = await saveCodingContext('dispatchSampledPostWithThemeResponse', {
                action
            });
            if (data.sampledPostWithThemeResponse)
                setSampledPostWithThemeResponse(data.sampledPostWithThemeResponse);
        },
        unseenPostResponse,
        dispatchUnseenPostResponse: async (action: BaseResponseHandlerActions<IQECTTyResponse>) => {
            const data = await saveCodingContext('dispatchUnseenPostResponse', { action });
            if (data.unseenPostResponse) setUnseenPostResponse(data.unseenPostResponse);
        },
        themes,
        setThemes: async (tms: ThemeBucket[]) => {
            const data = await saveCodingContext('setThemes', { themes: tms });
            if (data.themes) setThemes(data.themes);
        },
        unplacedCodes,
        setUnplacedCodes: async (codes: string[]) => {
            const data = await saveCodingContext('setUnplacedCodes', { unplacedCodes: codes });
            if (data.unplacedCodes) setUnplacedCodes(data.unplacedCodes);
        },
        groupedCodes,
        setGroupedCodes: async (gcs: GroupedCodeBucket[]) => {
            const data = await saveCodingContext('setGroupedCodes', { groupedCodes: gcs });
            if (data.groupedCodes) setGroupedCodes(data.groupedCodes);
        },
        unplacedSubCodes,
        setUnplacedSubCodes: async (subCodes: string[]) => {
            const data = await saveCodingContext('setUnplacedSubCodes', {
                unplacedSubCodes: subCodes
            });
            if (data.unplacedSubCodes) setUnplacedSubCodes(data.unplacedSubCodes);
        },
        researchQuestions,
        setResearchQuestions: async (rqs: string[]) => {
            const data = await saveCodingContext('setResearchQuestions', {
                researchQuestions: rqs
            });
            if (data.researchQuestions) setResearchQuestions(data.researchQuestions);
        },
        sampledPostIds,
        setSampledPostIds: async (ids: string[]) => {
            const data = await saveCodingContext('setSampledPostIds', { sampledPostIds: ids });
            if (data.sampledPostIds) setSampledPostIds(data.sampledPostIds);
        },
        unseenPostIds,
        setUnseenPostIds: async (ids: string[]) => {
            const data = await saveCodingContext('setUnseenPostIds', { unseenPostIds: ids });
            if (data.unseenPostIds) setUnseenPostIds(data.unseenPostIds);
        },
        conflictingResponses,
        setConflictingResponses: async (crs: IQECResponse[]) => {
            const data = await saveCodingContext('setConflictingResponses', {
                conflictingResponses: crs
            });
            if (data.conflictingResponses) setConflictingResponses(data.conflictingResponses);
        },
        initialCodebookTable,
        dispatchInitialCodebookTable: async (action: InitialCodebookTableAction) => {
            const data = await saveCodingContext('dispatchInitialCodebookTable', { action });
            if (data.initialCodebookTable) setInitialCodebookTable(data.initialCodebookTable);
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
