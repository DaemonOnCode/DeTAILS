import { useEffect, useRef } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { useCodingContext } from '../../context/coding-context';
import { ExtendedICollectionContext, useCollectionContext } from '../../context/collection-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useWebSocket } from '../../context/websocket-context';
import { useModelingContext } from '../../context/modeling-context';
import {
    IWorkspaceContext,
    AuthContextType,
    ICodingContext,
    IModelingContext,
    ILoadingContext
} from '../../types/Shared';
import { useToast } from '../../context/toast-context';
import { useApi } from './use-api';
import { useLoadingContext } from '../../context/loading-context';
import { IManualCodingContext, useManualCodingContext } from '../../context/manual-coding-context';
import { useLocation } from 'react-router-dom';

const useWorkspaceUtils = () => {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspaceContext();
    const collectionContext = useCollectionContext();
    const codingContext = useCodingContext();
    const modelingContext = useModelingContext();
    const loadingContext = useLoadingContext();
    const manualCodingContext = useManualCodingContext();
    const { serviceStarting } = useWebSocket();
    const { showToast } = useToast();
    const { fetchData } = useApi();
    const location = useLocation();

    const getPayload = (
        currentWorkspace: IWorkspaceContext['currentWorkspace'],
        user: AuthContextType['user'],
        modelingContext: IModelingContext,
        loadingContext: ILoadingContext,
        manualCodingContext: IManualCodingContext
    ) => {
        return {
            workspace_id: currentWorkspace?.id || '',
            user_email: user?.email || '',
            page_url: `${location.pathname}${location.search}`,
            dataset_id: '',
            collection_context: {},
            modeling_context: {
                models: modelingContext.models || []
            },
            coding_context: {},
            loading_context: {
                page_state:
                    Object.fromEntries(
                        Object.entries(loadingContext.loadingState)
                            .filter(([_, value]) => value && 'isFirstRun' in value)
                            .map(([key, value]) => [key, value.isFirstRun])
                    ) || {}
            },
            manual_coding_context: {
                post_states: manualCodingContext.postStates || {},
                codebook: manualCodingContext.codebook || {},
                manual_coding_responses: manualCodingContext.manualCodingResponses || []
            }
        };
    };

    const contextRef = useRef({
        currentWorkspace,
        user,
        modelingContext,
        loadingContext,
        manualCodingContext
    });

    useEffect(() => {
        contextRef.current = {
            currentWorkspace,
            user,
            modelingContext,
            loadingContext,
            manualCodingContext
        };
    }, [currentWorkspace, user, modelingContext, loadingContext, manualCodingContext]);

    const getWorkspaceData = () => {
        const { currentWorkspace, user, modelingContext } = contextRef.current;
        return getPayload(
            currentWorkspace,
            user,
            modelingContext,
            loadingContext,
            manualCodingContext
        );
    };

    const resetContextData = (...contexts: any[]) => {
        contexts.forEach((context) => context.resetContext());
    };

    const updateContextData = (data: Record<string, any>) => {
        console.log('Updating context data:', data);
        if (!data) {
            modelingContext.resetContext();
            loadingContext.resetContext();
            manualCodingContext.resetContext();
            return;
        }

        modelingContext.updateContext({
            models: data.models ?? []
        });

        loadingContext.updateContext({
            pageState: data.page_state ?? {}
        });

        manualCodingContext.updateContext({
            postStates: data.post_states ?? {},
            codebook: data.codebook ?? {},
            manualCodingResponses: data.manual_coding_responses ?? []
        });
    };

    const loadWorkspaceData = async () => {
        try {
            const fetchResponse = await fetchData(REMOTE_SERVER_ROUTES.LOAD_STATE, {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: currentWorkspace?.id || '',
                    user_email: user?.email || ''
                })
            });

            if (fetchResponse.error) {
                resetContextData(modelingContext, loadingContext, manualCodingContext);
                showToast({
                    type: 'error',
                    message: 'Error loading workspace data'
                });
                console.error('Error in loadWorkspaceData:', fetchResponse.error.message);
                return;
            }

            const parsedResults = fetchResponse.data;
            if (parsedResults.success) {
                updateContextData(parsedResults.data);
                showToast({
                    message: 'Workspace data loaded successfully',
                    type: 'success'
                });
                console.log('Workspace data loaded successfully');
            } else {
                resetContextData(modelingContext, loadingContext, manualCodingContext);
                showToast({
                    type: 'error',
                    message: 'Error loading workspace data'
                });
                console.error('Error in loadWorkspaceData:', parsedResults.message);
            }
            console.log('Loading workspace data:', parsedResults.data);
        } catch (error) {
            resetContextData(modelingContext, loadingContext, manualCodingContext);
            console.error('Error in loadWorkspaceData:', error);
        }
    };

    const saveWorkspaceData = async () => {
        if (serviceStarting) {
            return;
        }
        const payload = getWorkspaceData();
        console.log('Saving workspace data:', payload);

        try {
            const fetchResponse = await fetchData(REMOTE_SERVER_ROUTES.SAVE_STATE, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (fetchResponse.error) {
                showToast({
                    message: 'Error saving workspace data',
                    type: 'error'
                });
                console.error('Error in saveWorkspaceData:', fetchResponse.error.message);
                return;
            }

            const parsedResults = fetchResponse.data;
            if (parsedResults.success) {
                showToast({
                    message: 'Workspace data saved successfully',
                    type: 'success'
                });
                console.log('Workspace data saved successfully');
            } else {
                showToast({
                    message: 'Error saving workspace data',
                    type: 'error'
                });
                console.error('Error in saveWorkspaceData:', parsedResults.message);
            }
        } catch (error) {
            console.error('Error in saveWorkspaceData:', error);
        }
    };

    return {
        updateContextData,
        loadWorkspaceData,
        saveWorkspaceData,
        getWorkspaceData
    };
};

export default useWorkspaceUtils;
