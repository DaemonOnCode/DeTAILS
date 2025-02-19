import { useState, useCallback, useEffect } from 'react';
import { RedditPosts } from '../../types/Coding/shared';
import { DB_PATH } from '../../constants/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import getServerUtils from '../Shared/get-server-url';
import { useWorkspaceContext } from '../../context/workspace-context';

const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

const useRedditData = () => {
    const [data, setData] = useState<RedditPosts>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const { modeInput, setModeInput, datasetId, setDatasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { getServerUrl } = getServerUtils();

    // Reset data if there's no modeInput and no datasetId.
    useEffect(() => {
        if (!modeInput && !datasetId) {
            setData({});
        }
    }, [modeInput, datasetId]);

    const omitFirstIfMatchesStructure = (dataArr: any[]) => {
        if (Array.isArray(dataArr) && dataArr.length > 0) {
            const firstElement = dataArr[0];
            if (!firstElement.hasOwnProperty('id')) {
                return dataArr.slice(1);
            }
        }
        return dataArr;
    };

    // Upload all files in the folder to the backend and return the dataset_id.
    const sendFolderToBackendServer = async (folderPath: string) => {
        const files: string[] = fs.readdirSync(folderPath);
        let dataset_id: string = '';
        for (const file of files) {
            const filePath = path.join(folderPath, file);

            // Process only files.
            if (fs.lstatSync(filePath).isFile()) {
                try {
                    const fileContent = fs.readFileSync(filePath);
                    const blob = new Blob([fileContent]); // Create a Blob for FormData
                    const formData = new FormData();

                    formData.append('file', blob, file);
                    formData.append('description', 'Dataset Description');
                    formData.append('dataset_id', dataset_id);
                    formData.append('workspace_id', currentWorkspace?.id ?? '');

                    const response = await fetch(
                        getServerUrl(REMOTE_SERVER_ROUTES.UPLOAD_REDDIT_DATA),
                        {
                            method: 'POST',
                            body: formData
                        }
                    );

                    if (!response.ok) {
                        console.error(`Failed to upload file ${file}: ${response.statusText}`);
                    } else {
                        const result = await response.json();
                        dataset_id = result.dataset_id;
                        console.log(`File ${file} uploaded successfully`, result);
                    }
                } catch (error) {
                    console.error(`Error uploading file ${file}:`, error);
                }
            }
        }
        console.log('Dataset ID:', dataset_id);
        setDatasetId(dataset_id);

        // Trigger parsing on the backend.
        await fetch(getServerUrl(REMOTE_SERVER_ROUTES.PARSE_REDDIT_DATA), {
            method: 'POST',
            body: JSON.stringify({ dataset_id }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return dataset_id;
    };

    // Fetch a batch of Reddit posts by dataset.
    const getRedditPostDataByBatch = async (
        datasetId: string,
        batch: number,
        offset: number,
        all: boolean = true
    ) => {
        console.log('Fetching data from remote server', batch, offset, all, datasetId);
        const response = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_REDDIT_POSTS_BY_BATCH), {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                batch,
                offset,
                all
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const resData = await response.json();
        console.log(resData, 'getRedditPostDataByBatch');
        return resData;
    };

    // Optionally, you can use this callback to load additional data (e.g. comments) in background.
    const loadRedditDataInBackground = useCallback(
        async (folderPath: string, parsedData: RedditPosts) => {
            if (!folderPath || Object.keys(parsedData).length === 0) return;
            console.log('load-comments called');
            const result = await ipcRenderer.invoke('load-data', folderPath, parsedData, DB_PATH);
            console.log(result, 'load-data');
        },
        []
    );

    // Main function to load Reddit data from a folder.
    const loadFolderData = async (addToDb: boolean = false, changeModeInput = false) => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }
            let folderPath = modeInput;
            if (!modeInput && changeModeInput) {
                // Prompt the user to select a folder.
                folderPath = await ipcRenderer.invoke('select-folder-reddit');
                setModeInput(folderPath);
            }

            let dataset_id = datasetId;
            if (addToDb) {
                dataset_id = await sendFolderToBackendServer(folderPath);
            }
            console.log('Data sent to server, dataset_id: ', dataset_id);
            const parsedData = await getRedditPostDataByBatch(dataset_id, 10, 0);
            setData(parsedData);
            setError(null);

            // Optionally, load additional data in the background.
            // await loadRedditDataInBackground(folderPath, parsedData);
        } catch (err) {
            console.error('Failed to load folder:', err);
            setError('Failed to load folder.');
        } finally {
            setLoading(false);
        }
    };

    const loadTorrentData = async (
        addToDb: boolean = false,
        torrentSubreddit?: string,
        torrentStart?: string,
        torrentEnd?: string,
        torrentPostsOnly?: boolean
    ) => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }

            if (addToDb) {
                setModeInput(`torrent:${torrentSubreddit}:${torrentStart}:${torrentEnd}`);
                const res = await fetch(
                    getServerUrl(REMOTE_SERVER_ROUTES.DOWNLOAD_REDDIT_DATA_FROM_TORRENT),
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            subreddit: torrentSubreddit,
                            start_date: torrentStart,
                            end_date: torrentEnd,
                            submissions_only: torrentPostsOnly,
                            dataset_id: datasetId
                        })
                    }
                );

                const data = await res.json();
                console.log('Torrent data:', data);
            }

            const parsedData = await getRedditPostDataByBatch(datasetId, 10, 0);
            setData(parsedData);
            setError(null);
        } catch (err) {
            console.error('Failed to load torrent data:', err);
            setError('Failed to load torrent data.');
        } finally {
            setLoading(false);
        }
    };

    return { data, error, loadFolderData, loadTorrentData, loading };
};

export default useRedditData;
