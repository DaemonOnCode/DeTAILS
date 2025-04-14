import { RouteObject } from 'react-router-dom';
import {
    BaseResponseHandlerActions,
    IFile,
    IQECResponse,
    IQECTResponse,
    IQECTTyResponse,
    IReference,
    InitialCodebookCode,
    InitialCodebookTableAction,
    KeywordEntry,
    KeywordsTableAction,
    Mode,
    SampleDataResponseReducerActions,
    SampleDataWithThemeResponseReducerActions,
    SetState,
    ThemeBucket
} from '../Coding/shared';
import { Dispatch, RefObject } from 'react';
import { IModelState } from '../DataModeling/shared';

export interface User {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
}

export interface UserToken {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    id_token: string;
    expiry_date: number;
}

export type AppRouteArray = (RouteObject & { hidden?: boolean; icon?: React.ReactNode })[];

export interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    login: (user: User, token: UserToken) => void;
    logout: () => void;
    remoteProcessing: boolean;
    setProcessing: (processing: boolean) => Promise<void>;
}

export interface ICollectionContext {
    currentMode: Mode;
    toggleMode: () => void;
    modeInput: string;
    setModeInput: SetState<string>;
    interviewInput: string[];
    setInterviewInput: SetState<string[]>;
    subreddit: string;
    setSubreddit: SetState<string>;
    selectedPosts: string[];
    setSelectedPosts: SetState<string[]>;
    datasetId: string;
    setDatasetId: SetState<string>;
    updateContext: (updates: Partial<ICollectionContext>) => void;
    resetContext: () => void;
}

export interface IModelingContext {
    models: IModelState[];
    addModel: (id: string, modelName: string, type: string) => void;
    updateModelName: (id: string, newName: string) => void;
    removeModel: (id: string) => void;
    toggleProcessing: (id: string) => void;
    activeModelId: string | null;
    setActiveModelId: (id: string) => void;
    addNewModel: boolean;
    setAddNewModel: SetState<boolean>;
    updateContext: (updates: Partial<IModelingContext>) => void;
    resetContext: () => void;
    startListening: () => void;
    stopListening: () => void;
}

export type Keyword = { id: string; word: string };

export interface ICodingContext {
    contextFiles: IFile;
    addContextFile: (filePath: string, fileName: string) => void;
    removeContextFile: (filePath: string) => void;
    mainTopic: string;
    setMainTopic: SetState<string>;
    additionalInfo?: string;
    setAdditionalInfo: SetState<string>;
    keywords: Keyword[];
    setKeywords: SetState<Keyword[]>;
    selectedKeywords: string[];
    setSelectedKeywords: SetState<string[]>;
    words: Keyword[];
    setWords: SetState<Keyword[]>;
    selectedWords: Keyword[];
    setSelectedWords: SetState<Keyword[]>;
    references: {
        [code: string]: IReference[];
    };
    setReferences: SetState<{
        [code: string]: IReference[];
    }>;
    keywordTable: KeywordEntry[];
    dispatchKeywordsTable: Dispatch<KeywordsTableAction>;
    updateContext: (updates: Partial<ICodingContext>) => void;
    resetContext: () => void;
    sampledPostResponse: IQECResponse[];
    dispatchSampledPostResponse: Dispatch<SampleDataResponseReducerActions>;
    sampledPostResponseCopy: IQECResponse[];
    setSampledPostResponseCopy: SetState<IQECResponse[]>;
    sampledPostWithThemeResponse: IQECTResponse[];
    dispatchSampledPostWithThemeResponse: Dispatch<SampleDataWithThemeResponseReducerActions>;
    unseenPostResponse: IQECTTyResponse[];
    dispatchUnseenPostResponse: Dispatch<BaseResponseHandlerActions<IQECTTyResponse>>;
    themes: ThemeBucket[];
    setThemes: SetState<ThemeBucket[]>;
    unplacedCodes: string[];
    setUnplacedCodes: SetState<string[]>;
    groupedCodes: ThemeBucket[];
    setGroupedCodes: SetState<ThemeBucket[]>;
    unplacedSubCodes: string[];
    setUnplacedSubCodes: SetState<string[]>;
    researchQuestions: string[];
    setResearchQuestions: SetState<string[]>;
    sampledPostIds: string[];
    setSampledPostIds: SetState<string[]>;
    unseenPostIds: string[];
    setUnseenPostIds: SetState<string[]>;
    conflictingResponses: IQECResponse[];
    setConflictingResponses: SetState<IQECResponse[]>;
    initialCodebookTable: InitialCodebookCode[];
    dispatchInitialCodebookTable: Dispatch<InitialCodebookTableAction>;
}

export interface Workspace {
    id: string;
    name: string;
    description?: string;
    updatedAt?: string;
}

export interface IWorkspaceContext {
    workspaces: Workspace[];
    currentWorkspace: Workspace | null;
    addWorkspace: (workspace: Workspace) => void;
    setWorkspaces: SetState<Workspace[]>;
    updateWorkspace: (id: string, name?: string, description?: string) => void;
    deleteWorkspace: (id: string) => void;
    setCurrentWorkspace: (workspace: Workspace | null) => void;
    resetWorkspaces: () => void;
    addWorkspaceBatch: (newWorkspaces: Workspace[]) => void;
    setCurrentWorkspaceById: (workspaceId: string) => void;
    workspaceLoading: boolean;
    setWorkspaceLoading: SetState<boolean>;
}

export interface ILoadingState {
    [route: string]: {
        isLoading: boolean;
        isFirstRun: boolean;
        downloadData?: boolean;
        stepRef: React.RefObject<StepHandle>;
    };
}

export interface StepHandle {
    validateStep?: () => boolean;
    resetStep: (currentPage: string) => void;
    downloadData?: (currentPage: string) => Promise<void>;
    checkDataExistence?: (currentPage: string) => boolean;
}

export type LoadingAction =
    | { type: 'SET_LOADING'; payload: { route: string; loading: boolean } }
    | { type: 'RESET_LOADING' }
    | { type: 'SET_LOADING_ALL'; payload: boolean }
    | { type: 'SET_LOADING_ROUTE'; route: string }
    | { type: 'SET_LOADING_DONE_ROUTE'; route: string }
    | {
          type: 'REGISTER_STEP_REF';
          payload: {
              route: string;
              ref: RefObject<StepHandle>;
              defaultData?: Omit<ILoadingState[string], 'stepRef'>;
          };
      }
    | {
          type: 'REGISTER_STEP_REF_MULTIPLE';
          payload: { route: string; ref: RefObject<StepHandle> }[];
      }
    | {
          type: 'RESET_PAGE_DATA';
          payload: { route: string; defaultData?: ILoadingState[string] };
      }
    | { type: 'SET_FIRST_RUN_DONE'; route: string }
    | { type: 'SET_REST_UNDONE'; route: string }
    | {
          type: 'UPDATE_PAGE_STATE';
          payload: {
              [route: string]: boolean;
          };
      };

export interface ILoadingContext {
    loadingState: ILoadingState;
    loadingDispatch: Dispatch<LoadingAction>;
    registerStepRef: (route: string, refObj: RefObject<StepHandle>) => void;
    resetDataAfterPage: (page: string) => Promise<void>;
    checkIfDataExists: (page: string) => boolean;
    requestArrayRef: RefObject<Record<string, ((...e: any) => void)[]> | null>;
    showProceedConfirmModal: boolean;
    setShowProceedConfirmModal: SetState<boolean>;
    openModal: (_id: string, _callback: (e: React.MouseEvent) => void | Promise<void>) => void;
    updateContext: (updates: {
        pageState: {
            [route: string]: boolean;
        };
    }) => void;
    resetContext: () => void;
    abortRequests: (page: string) => void;
    abortRequestsByRoute: (route: string) => void;
    openCredentialModalForCredentialError: (
        errorMessage: string,
        resolver: (newPath: string) => void
    ) => void;
}

export interface ModalCallbacks {
    [id: string]: (e: React.MouseEvent) => void | Promise<void>;
}
