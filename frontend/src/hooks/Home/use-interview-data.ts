import { useState, useCallback, useEffect } from 'react';
import { useCollectionContext } from '../../context/collection-context';
import { useWorkspaceContext } from '../../context/workspace-context';
import getServerUtils from '../Shared/get-server-url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

const { ipcRenderer } = window.require('electron');
const FormData = require('form-data');
const fs = window.require('fs');
const path = window.require('path');

// Define your interview data type, or replace 'any' with a proper interface
type InterviewData = any;

const useInterviewData = () => {
    const [data, setData] = useState<InterviewData>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // Assume interviewInput can be a file path (for .txt, .pdf, .docx) or raw text.
    const { interviewInput, setInterviewInput } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { getServerUrl } = getServerUtils();

    // Reset data if there's no interview input
    useEffect(() => {
        if (!interviewInput) {
            setData({});
        }
    }, [interviewInput]);

    // Helper function to send file data to the backend
    const sendInterviewFileToBackend = async (filePath: string) => {
        try {
            const fileContent = fs.readFileSync(filePath);
            const blob = new Blob([fileContent]); // Create a Blob for FormData compatibility
            const formData = new FormData();

            formData.append('file', blob, path.basename(filePath));
            formData.append('description', 'Interview Data File');
            formData.append('workspace_id', currentWorkspace?.id);

            const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.UPLOAD_INTERVIEW_DATA), {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload file: ${response.statusText}`);
            }
            const result = await response.json();
            return result.dataset_id; // Assuming the backend returns a dataset_id
        } catch (error) {
            console.error('Error uploading interview file:', error);
            throw error;
        }
    };

    // Helper function to send raw text to the backend
    const sendInterviewTextToBackend = async (textData: string) => {
        try {
            const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.UPLOAD_INTERVIEW_DATA), {
                method: 'POST',
                body: JSON.stringify({ text: textData, workspace_id: currentWorkspace?.id }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`Failed to upload text data: ${response.statusText}`);
            }
            const result = await response.json();
            return result.dataset_id;
        } catch (error) {
            console.error('Error uploading interview text data:', error);
            throw error;
        }
    };

    // Main function to load interview data
    const loadInterviewData = async () => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }
            if (!interviewInput) {
                throw new Error('No interview data provided');
            }

            let dataset_id = '';
            // Check if interviewInput points to a file by examining its extension.
            const ext = path.extname(interviewInput).toLowerCase();

            if (['.txt', '.pdf', '.docx'].includes(ext)) {
                // interviewInput is assumed to be a file path.
                dataset_id = await sendInterviewFileToBackend(interviewInput);
            } else {
                // Otherwise, assume it's raw text data.
                dataset_id = await sendInterviewTextToBackend(interviewInput);
            }

            // After uploading, trigger parsing of the interview data.
            const parseResponse = await fetch(
                getServerUrl(REMOTE_SERVER_ROUTES.PARSE_INTERVIEW_DATA),
                {
                    method: 'POST',
                    body: JSON.stringify({ dataset_id }),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (!parseResponse.ok) {
                throw new Error(`Parsing failed: ${parseResponse.statusText}`);
            }
            const parsedData = await parseResponse.json();
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
