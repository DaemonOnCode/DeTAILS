import { RouteObject } from 'react-router-dom';
import {
    BaseBucketAction,
    BaseResponseHandlerActions,
    IFile,
    IQECTTyResponse,
    IReference,
    InitialCodebookCode,
    InitialCodebookTableAction,
    ConceptEntry,
    ConceptsTableAction,
    Mode,
    SampleDataResponseReducerActions,
    SetState,
    ThemeBucket
} from '../Coding/shared';
import { Dispatch, RefObject } from 'react';
import {
    ModeType,
    MetadataState,
    Dataset,
    DataAction,
    MetadataAction
} from '../DataCollection/shared';

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

export type Concept = { id: string; word: string };

export type AsyncDispatch<T> = Dispatch<T> | ((...args: any[]) => Promise<any>);

export interface ICodingContext {
    contextFiles: IFile;
    addContextFile: (filePath: string, fileName: string) => void;
    addContextFilesBatch: (files: IFile[]) => void;
    removeContextFile: (filePath: string) => void;
    mainTopic: string;
    setMainTopic: SetState<string>;
    additionalInfo?: string;
    setAdditionalInfo: SetState<string>;
    concepts: Concept[];
    setConcepts: SetState<Concept[]>;
    selectedConcepts: string[];
    setSelectedConcepts: SetState<string[]>;
    references: {
        [code: string]: IReference[];
    };
    setReferences: SetState<{
        [code: string]: IReference[];
    }>;
    conceptOutlineTable: ConceptEntry[];
    dispatchConceptOutlinesTable: AsyncDispatch<ConceptsTableAction>;
    updateContext: (updates: Partial<ICodingContext>) => void;
    resetContext: () => void;
    dispatchSampledPostResponse: AsyncDispatch<SampleDataResponseReducerActions>;
    dispatchUnseenPostResponse: AsyncDispatch<BaseResponseHandlerActions<IQECTTyResponse>>;
    dispatchAllPostResponse: AsyncDispatch<BaseResponseHandlerActions<IQECTTyResponse>>;
    themes: ThemeBucket[];
    dispatchThemes: SetState<ThemeBucket[]>;
    groupedCodes: ThemeBucket[];
    dispatchGroupedCodes: AsyncDispatch<BaseBucketAction>;
    researchQuestions: string[];
    setResearchQuestions: SetState<string[]>;
    sampledPostIds: string[];
    setSampledPostIds: SetState<string[]>;
    unseenPostIds: string[];
    setUnseenPostIds: SetState<string[]>;
    initialCodebookTable: InitialCodebookCode[];
    dispatchInitialCodebookTable: AsyncDispatch<InitialCodebookTableAction>;
    dispatchSampledCopyPostResponse: AsyncDispatch<SampleDataResponseReducerActions>;
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
    resetStep: (currentPage: string) => Promise<void>;
    downloadData?: (currentPage: string) => Promise<void>;
    checkDataExistence?: (currentPage: string) => Promise<boolean>;
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
    | { type: 'SET_FIRST_RUN'; route: string; done: boolean }
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
    checkIfDataExists: (page: string) => Promise<boolean>;
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
    isStateLocked: (page: string) => boolean;
    lockedUpdate: (id: string, updateFn: () => Promise<any>) => Promise<any>;
}

export interface ModalCallbacks {
    [id: string]: (e: React.MouseEvent) => void | Promise<void>;
}

export type ModalCallbackPair = {
    onProceed: (e: React.MouseEvent) => void | Promise<void>;
    onCancel?: () => void;
};

export interface ICollectionContext {
    type: ModeType;
    metadata: MetadataState;
    dataset: Dataset;
    datasetId: string;
    modeInput: string;
    selectedData: string[];
    dataFilters: Record<string, any>;
    isLocked: boolean;
    setIsLocked: SetState<boolean>;
    setDataFilters: SetState<Record<string, any>>;
    datasetDispatch: React.Dispatch<DataAction>;
    setDatasetId: SetState<string>;
    setModeInput: SetState<string>;
    metadataDispatch: React.Dispatch<MetadataAction>;
    setType: SetState<ModeType>;
    setSelectedData: SetState<string[]>;
    updateContext: (updates: Partial<ICollectionContext>) => void;
    resetContext: () => void;
}
