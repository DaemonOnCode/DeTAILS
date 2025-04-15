import { useState, useEffect } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import getServerUtils from '../Shared/get-server-url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useApi } from '../Shared/use-api';

const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

type InterviewData = any;

const useInterviewData = () => {
    const [data, setData] = useState<InterviewData>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const { modeInput } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

    useEffect(() => {
        if (!modeInput) {
            setData({});
        }
    }, [modeInput]);

    const sendInterviewFileToBackend = async (filePath: string): Promise<string> => {
        try {
            const fileContent = fs.readFileSync(filePath);
            const blob = new Blob([fileContent]);
            const formData = new FormData();

            formData.append('file', blob, path.basename(filePath));
            formData.append('description', 'Interview Data File');
            formData.append('workspace_id', currentWorkspace?.id ?? '');

            const uploadResponse = await fetchData(REMOTE_SERVER_ROUTES.UPLOAD_INTERVIEW_DATA, {
                method: 'POST',
                body: formData
            });

            if (uploadResponse.error) {
                throw new Error(`Failed to upload file: ${uploadResponse.error.message}`);
            }
            const result = uploadResponse.data;
            return result.dataset_id;
        } catch (error) {
            console.error('Error uploading interview file:', error);
            throw error;
        }
    };

    const sendInterviewTextToBackend = async (textData: string): Promise<string> => {
        try {
            const textResponse = await fetchData(REMOTE_SERVER_ROUTES.UPLOAD_INTERVIEW_DATA, {
                method: 'POST',
                body: JSON.stringify({ text: textData, workspace_id: currentWorkspace?.id })
            });

            if (textResponse.error) {
                throw new Error(`Failed to upload text data: ${textResponse.error.message}`);
            }
            const result = textResponse.data;
            return result.dataset_id;
        } catch (error) {
            console.error('Error uploading interview text data:', error);
            throw error;
        }
    };

    const loadInterviewData = async () => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }
            if (!modeInput) {
                throw new Error('No interview data provided');
            }

            let dataset_id = '';
            const ext = path.extname(modeInput).toLowerCase();
            if (['.txt', '.pdf', '.docx'].includes(ext)) {
                dataset_id = await sendInterviewFileToBackend(modeInput);
            } else {
                dataset_id = await sendInterviewTextToBackend(modeInput);
            }

            const parseResponse = await fetchData(REMOTE_SERVER_ROUTES.PARSE_INTERVIEW_DATA, {
                method: 'POST',
                body: JSON.stringify({ dataset_id })
            });

            if (parseResponse.error) {
                throw new Error(`Parsing failed: ${parseResponse.error.message}`);
            }
            const parsedData = parseResponse.data;
            setData(parsedData);
            setError(null);
        } catch (err) {
            console.error('Failed to load interview data:', err);
            setError('Failed to load interview data.');
        } finally {
            setLoading(false);
        }
    };

    return { data, error, loadInterviewData, loading };
};

export default useInterviewData;
