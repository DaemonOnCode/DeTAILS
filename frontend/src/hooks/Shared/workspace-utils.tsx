import { useCallback, useEffect, useRef } from 'react';
import { REMOTE_SERVER_BASE_URL, REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useAuth } from '../../context/auth_context';
import { useCodingContext } from '../../context/coding_context';
import { useCollectionContext } from '../../context/collection_context';
import { useWorkspaceContext } from '../../context/workspace_context';
import { toast } from 'react-toastify';

const useWorkspaceUtils = () => {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspaceContext();
    const collectionContext = useCollectionContext();
    const codingContext = useCodingContext();

    // useEffect(() => {
    //     console.log('Current workspace updated:', currentWorkspace);
    // }, [currentWorkspace]);

    // useEffect(() => {
    //     console.log('Collection context updated:', collectionContext);
    // }, [collectionContext]);

    // useEffect(() => {
    //     console.log('Coding context updated:', codingContext);
    // }, [codingContext]);

    const getPayload = (
        currentWorkspace: any,
        user: any,
        collectionContext: any,
        codingContext: any
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
            coding_context: {
                main_code: codingContext.mainCode || '',
                additional_info: codingContext.additionalInfo || '',
                basis_files: codingContext.basisFiles || {},
                themes: codingContext.themes || [],
                selected_themes: codingContext.selectedThemes || [],
                codebook: codingContext.codeBook || [],
                references: codingContext.references || {},
                code_responses: codingContext.codeResponses || [],
                final_code_responses: codingContext.finalCodeResponses || []
            }
        };
    };

    const contextRef = useRef({
        currentWorkspace,
        user,
        collectionContext,
        codingContext
    });

    useEffect(() => {
        contextRef.current = { currentWorkspace, user, collectionContext, codingContext };
    }, [currentWorkspace, user, collectionContext, codingContext]);

    const getWorkspaceData = () => {
        const { currentWorkspace, user, collectionContext, codingContext } = contextRef.current;
        return getPayload(currentWorkspace, user, collectionContext, codingContext);
    };

    const updateContextData = (data: Record<string, any>) => {
        console.log('Updating context data:', data);
        if (!data) {
            collectionContext.resetContext();
            codingContext.resetContext();
            return;
        }

        collectionContext.updateContext({
            datasetId: data.dataset_id ?? '',
            modeInput: data.mode_input ?? '',
            subreddit: data.subreddit ?? '',
            selectedPosts: data.selected_posts ?? []
        });

        codingContext.updateContext({
            mainCode: data.main_code ?? '',
            additionalInfo: data.additional_info ?? '',
            basisFiles: data.basis_files ?? {},
            themes: data.themes ?? [],
            selectedThemes: data.selected_themes ?? [],
            codeBook: data.codebook ?? [],
            references: data.references ?? {},
            codeResponses: data.code_responses ?? [],
            finalCodeResponses: data.final_code_responses ?? []
        });
    };

    const loadWorkspaceData = async () => {
        try {
            // toast.info('Loading workspace data...');
            const results = await fetch(
                `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.LOAD_STATE}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_id: currentWorkspace?.id || '',
                        user_email: user?.email || ''
                    })
                }
            );
            const parsedResults = await results.json();

            if (parsedResults.success) {
                updateContextData(parsedResults.data);
                toast.success('Workspace data loaded successfully');
                console.log('Workspace data loaded successfully');
            } else {
                codingContext.resetContext();
                collectionContext.resetContext();
                toast.error('Error loading workspace data');
                console.error('Error in loadWorkspaceData:', parsedResults.message);
            }
            console.log('Loading workspace data:', parsedResults.data);
        } catch (error) {
            codingContext.resetContext();
            collectionContext.resetContext();
            // toast.error('Error loading workspace data');
            console.error('Error in loadWorkspaceData:', error);
        }
    };

    const saveWorkspaceData = async () => {
        const payload = getWorkspaceData();
        console.log('Saving workspace data:', payload);

        try {
            // toast.info('Saving workspace data...');
            const results = await fetch(
                `${REMOTE_SERVER_BASE_URL}/${REMOTE_SERVER_ROUTES.SAVE_STATE}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

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
