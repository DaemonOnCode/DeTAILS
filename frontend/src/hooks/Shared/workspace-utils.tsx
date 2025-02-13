import { useCallback, useEffect, useRef } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';
import { useCodingContext } from '../../context/coding-context';
import { useCollectionContext } from '../../context/collection-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { toast } from 'react-toastify';
import useServerUtils from './get-server-url';
import { useWebSocket } from '../../context/websocket-context';
import { useModelingContext } from '../../context/modeling-context';
import {
    IWorkspaceContext,
    AuthContextType,
    ICollectionContext,
    ICodingContext,
    IModelingContext
} from '../../types/Shared';

const useWorkspaceUtils = () => {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspaceContext();
    const collectionContext = useCollectionContext();
    const codingContext = useCodingContext();
    const modelingContext = useModelingContext();
    const { serviceStarting } = useWebSocket();

    const { getServerUrl } = useServerUtils();

    const getPayload = (
        currentWorkspace: IWorkspaceContext['currentWorkspace'],
        user: AuthContextType['user'],
        collectionContext: ICollectionContext,
        codingContext: ICodingContext,
        modelingContext: IModelingContext
    ) => {
        return {
            workspace_id: currentWorkspace?.id || '',
            user_email: user?.email || '',
            dataset_id: collectionContext.datasetId || '',
            collection_context: {
                mode_input: collectionContext.modeInput || '',
                subreddit: collectionContext.subreddit || '',
                selected_posts: collectionContext.selectedPosts || []
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
    }, [currentWorkspace, user, collectionContext, codingContext]);

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

        collectionContext.updateContext({
            datasetId: data.dataset_id ?? '',
            modeInput: data.mode_input ?? '',
            subreddit: data.subreddit ?? '',
            selectedPosts: data.selected_posts ?? []
        });

        modelingContext.updateContext({
            models: data.models ?? []
        });

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
            // toast.info('Loading workspace data...');
            const results = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.LOAD_STATE), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: currentWorkspace?.id || '',
                    user_email: user?.email || ''
                })
            });
            const parsedResults = await results.json();

            if (parsedResults.success) {
                updateContextData(parsedResults.data);
                toast.success('Workspace data loaded successfully');
                console.log('Workspace data loaded successfully');
            } else {
                resetContextData(collectionContext, codingContext, modelingContext);
                toast.error('Error loading workspace data');
                console.error('Error in loadWorkspaceData:', parsedResults.message);
            }
            console.log('Loading workspace data:', parsedResults.data);
        } catch (error) {
            resetContextData(collectionContext, codingContext, modelingContext);
            // toast.error('Error loading workspace data');
            console.error('Error in loadWorkspaceData:', error);
        }
    };

    const saveWorkspaceData = async () => {
        if (serviceStarting) {
            // toast.error('Service is starting, please wait');
            return;
        }
        const payload = getWorkspaceData();
        console.log('Saving workspace data:', payload);

        try {
            // toast.info('Saving workspace data...');
            const results = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.SAVE_STATE), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const parsedResults = await results.json();

            if (parsedResults.success) {
                toast.success('Workspace data saved successfully');
                console.log('Workspace data saved successfully');
            } else {
                toast.error('Error saving workspace data');
                console.error('Error in saveWorkspaceData:', parsedResults.message);
            }
        } catch (error) {
            // toast.error('Error saving workspace data');
            console.error('Error in saveWorkspaceData:', error);
        }
    }; // Ensures latest `getWorkspaceData` logic is used

    return {
        updateContextData,
        loadWorkspaceData,
        saveWorkspaceData,
        getWorkspaceData
    };
};

export default useWorkspaceUtils;
