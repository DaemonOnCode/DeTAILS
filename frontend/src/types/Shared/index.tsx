import { RouteObject } from 'react-router-dom';
import {
    BaseResponseHandlerActions,
    IFile,
    IQECResponse,
    IQECTResponse,
    IQECTTyResponse,
    IReference,
    KeywordEntry,
    KeywordsTableAction,
    Mode,
    SampleDataResponseReducerActions,
    SampleDataWithThemeResponseReducerActions,
    SetState,
    ThemeBucket
} from '../Coding/shared';
import { Dispatch } from 'react';
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

export interface ICodingContext {
    contextFiles: IFile;
    addContextFile: (filePath: string, fileName: string) => void;
    removeContextFile: (filePath: string) => void;
    mainTopic: string;
    setMainTopic: SetState<string>;
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
    researchQuestions: string[];
    setResearchQuestions: SetState<string[]>;
    sampledPostIds: string[];
    setSampledPostIds: SetState<string[]>;
    unseenPostIds: string[];
    setUnseenPostIds: SetState<string[]>;
    conflictingResponses: IQECResponse[];
    setConflictingResponses: SetState<IQECResponse[]>;
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
    setCurrentWorkspace: (workspace: Workspace) => void;
    resetWorkspaces: () => void;
    addWorkspaceBatch: (newWorkspaces: Workspace[]) => void;
    setCurrentWorkspaceById: (workspaceId: string) => void;
    workspaceLoading: boolean;
    setWorkspaceLoading: SetState<boolean>;
}

export interface ILoadingState {
    [route: string]: boolean;
}

export type LoadingAction =
    | { type: 'SET_LOADING'; payload: { route: string; loading: boolean } }
    | { type: 'RESET_LOADING' }
    | { type: 'SET_LOADING_ALL'; payload: boolean }
    | { type: 'SET_LOADING_ROUTE'; route: string }
    | { type: 'SET_LOADING_DONE_ROUTE'; route: string };

export interface ILoadingContext {
    loadingState: ILoadingState;
    loadingDispatch: Dispatch<LoadingAction>;
}
