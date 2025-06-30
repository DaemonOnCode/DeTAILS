import { useState, useEffect } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useApi } from '../Shared/use-api';

type InterviewData = any;

const fs = window.require('fs');
const path = window.require('path');

const useInterviewData = () => {
    const [data, setData] = useState<InterviewData>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isPreprocessing, setIsPreprocessing] = useState(false);
    const [isAnonymizing, setIsAnonymizing] = useState(false);

    const { modeInput } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

    useEffect(() => {
        if (!modeInput) {
            setData({});
        }
    }, [modeInput]);

    const uploadFiles = async (filePaths: string[]) => {
        setLoading(true);
        try {
            if (!currentWorkspace?.id) {
                throw new Error('Workspace not found');
            }
            for (const filePath of filePaths) {
                const fileContent = fs.readFileSync(filePath);
                const blob = new Blob([fileContent]);
                const formData = new FormData();
                formData.append('file', blob, path.basename(filePath));
                formData.append('workspace_id', currentWorkspace.id);
                formData.append('description', 'Interview Data File');

                const response = await fetchData(REMOTE_SERVER_ROUTES.UPLOAD_INTERVIEW_DATA, {
                    method: 'POST',
                    body: formData
                });
                if (response.error) {
                    throw new Error(response.error.message.error_message);
                }
            }
            setError(null);
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload files.');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const getNamesToAnonymize = async () => {
        setIsPreprocessing(true);
        try {
            const preprocessResponse = await fetchData(
                REMOTE_SERVER_ROUTES.PREPROCESS_INTERVIEW_FILES,
                { method: 'POST', body: JSON.stringify({ data }) }
            );
            if (preprocessResponse.error) {
                throw new Error(preprocessResponse.error.message.error_message);
            }
            return preprocessResponse.data.names;
        } catch (err) {
            console.error('Preprocess error:', err);
            setError('Failed to preprocess interview data.');
            return [];
        } finally {
            setIsPreprocessing(false);
        }
    };

    const submitAnonymizedNames = async (namesMap: { [k: string]: string }) => {
        setIsAnonymizing(true);
        try {
            const anonymizeResponse = await fetchData(
                REMOTE_SERVER_ROUTES.ANONYMIZE_INTERVIEW_DATA,
                { method: 'POST', body: JSON.stringify({ names: namesMap }) }
            );
            if (anonymizeResponse.error) {
                throw new Error(anonymizeResponse.error.message.error_message);
            }
            setData(anonymizeResponse.data);
            setError(null);
        } catch (err) {
            console.error('Anonymize error:', err);
            setError('Failed to anonymize interview data.');
            throw err;
        } finally {
            setIsAnonymizing(false);
        }
    };

    const getInterviewData = async () => {
        if (!currentWorkspace?.id) {
            throw new Error('Workspace not found');
        }
        const { data: respData, error: respErr } = await fetchData(
            REMOTE_SERVER_ROUTES.GET_INTERVIEW_DATA,
            {
                method: 'POST',
                body: JSON.stringify({ workspace_id: currentWorkspace.id })
            }
        );
        if (respErr) {
            console.error('Fetch interview data error:', respErr);
            setError('Failed to fetch interview data.');
            return null;
        }
        setData(respData);
        setError(null);
        return respData as any[];
    };

    return {
        data,
        error,
        loading,
        isPreprocessing,
        isAnonymizing,
        uploadFiles,
        getNamesToAnonymize,
        submitAnonymizedNames,
        getInterviewData
    };
};

export default useInterviewData;
