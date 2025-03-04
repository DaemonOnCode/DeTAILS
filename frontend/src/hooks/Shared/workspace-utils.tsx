import { useCallback, useEffect, useRef } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { useCodingContext } from '../../context/coding-context';
import { ExtendedICollectionContext, useCollectionContext } from '../../context/collection-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { toast } from 'react-toastify';
import useServerUtils from './get-server-url';
import { useWebSocket } from '../../context/websocket-context';
import { useModelingContext } from '../../context/modeling-context';
import {
    IWorkspaceContext,
    AuthContextType,
    ICodingContext,
    IModelingContext
} from '../../types/Shared';
import { useToast } from '../../context/toast-context';
import { useApi } from './use-api';

const useWorkspaceUtils = () => {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspaceContext();
    const collectionContext = useCollectionContext();
    const codingContext = useCodingContext();
    const modelingContext = useModelingContext();
    const { serviceStarting } = useWebSocket();
    const { showToast } = useToast();
    const { fetchData } = useApi();

    const getPayload = (
        currentWorkspace: IWorkspaceContext['currentWorkspace'],
        user: AuthContextType['user'],
        collectionContext: ExtendedICollectionContext,
        codingContext: ICodingContext,
        modelingContext: IModelingContext
    ) => {
        return {
            workspace_id: currentWorkspace?.id || '',
            user_email: user?.email || '',
            dataset_id: collectionContext.datasetId || '',
            collection_context: {
                type: collectionContext.type || '',
                metadata: collectionContext.metadata || {},
                mode_input: collectionContext.modeInput || '',
                selected_data: collectionContext.selectedData || [],
                data_filters: collectionContext.dataFilters || {}
            },
            modeling_context: {
                models: modelingContext.models || []
            },
            coding_context: {
                context_files: codingContext.contextFiles || {},
                main_topic: codingContext.mainTopic || '',
                additional_info: codingContext.additionalInfo || '',
                research_questions: codingContext.researchQuestions || [],
                keywords: codingContext.keywords || [],
                selected_keywords: codingContext.selectedKeywords || [],
                keyword_table: codingContext.keywordTable || [],
                references: codingContext.references || {},
                sampled_post_responses: codingContext.sampledPostResponse || [],
                themes: codingContext.themes || [],
                unplaced_codes: codingContext.unplacedCodes || [],
                sampled_post_with_themes_responses:
                    codingContext.sampledPostWithThemeResponse || [],
                unseen_post_response: codingContext.unseenPostResponse || [],
                sampled_post_ids: codingContext.sampledPostIds || [],
                unseen_post_ids: codingContext.unseenPostIds || [],
                conflicting_responses: codingContext.conflictingResponses || []
            }
        };
    };

    const contextRef = useRef({
        currentWorkspace,
        user,
        collectionContext,
        codingContext,
        modelingContext
    });

    useEffect(() => {
        contextRef.current = {
            currentWorkspace,
            user,
            collectionContext,
            codingContext,
            modelingContext
        };
    }, [currentWorkspace, user, collectionContext, codingContext, modelingContext]);

    const getWorkspaceData = () => {
        const { currentWorkspace, user, collectionContext, codingContext, modelingContext } =
            contextRef.current;
        return getPayload(
            currentWorkspace,
            user,
            collectionContext,
            codingContext,
            modelingContext
        );
    };

    const resetContextData = (...contexts: any[]) => {
        contexts.forEach((context) => context.resetContext());
    };

    const updateContextData = (data: Record<string, any>) => {
        console.log('Updating context data:', data);
        if (!data) {
            collectionContext.resetContext();
            codingContext.resetContext();
            modelingContext.resetContext();
            return;
        }

        // Update collection context.
        collectionContext.updateContext({
            datasetId: data.dataset_id ?? '',
            modeInput: data.mode_input ?? '',
            metadata: data.metadata,
            type: data.type ?? '',
            selectedData: data.selected_data ?? [],
            dataFilters: data.data_filters ?? {}
        });

        // Update modeling context.
        modelingContext.updateContext({
            models: data.models ?? []
        });

        // Update coding context.
        codingContext.updateContext({
            mainTopic: data.main_topic ?? '',
            additionalInfo: data.additional_info ?? '',
            contextFiles: data.context_files ?? {},
            keywords: data.keywords ?? [],
            selectedKeywords: data.selected_keywords ?? [],
            keywordTable: data.keyword_table ?? [],
            references: data.references ?? {},
            themes: data.themes ?? [],
            researchQuestions: data.research_questions ?? [],
            sampledPostResponse: data.sampled_post_responses ?? [],
            sampledPostWithThemeResponse: data.sampled_post_with_themes_responses ?? [],
            unseenPostResponse: data.unseen_post_response ?? [],
            unplacedCodes: data.unplaced_codes ?? [],
            sampledPostIds: data.sampled_post_ids ?? [],
            unseenPostIds: data.unseen_post_ids ?? [],
            conflictingResponses: data.conflicting_responses ?? []
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
                resetContextData(collectionContext, codingContext, modelingContext);
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
                resetContextData(collectionContext, codingContext, modelingContext);
                showToast({
                    type: 'error',
                    message: 'Error loading workspace data'
                });
                console.error('Error in loadWorkspaceData:', parsedResults.message);
            }
            console.log('Loading workspace data:', parsedResults.data);
        } catch (error) {
            resetContextData(collectionContext, codingContext, modelingContext);
            console.error('Error in loadWorkspaceData:', error);
        }
    };

    const saveWorkspaceData = async () => {
        if (serviceStarting) {
            // Service is starting; do not save yet.
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
