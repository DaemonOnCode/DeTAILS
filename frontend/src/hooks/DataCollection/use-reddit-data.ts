import { useState, useCallback, useEffect } from 'react';
import { RedditPosts } from '../../types/Coding/shared';
import { DB_PATH } from '../../constants/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import getServerUtils from '../Shared/get-server-url';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useApi } from '../Shared/use-api';

const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

const useRedditData = () => {
    const [data, setData] = useState<RedditPosts>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const { modeInput, setModeInput, datasetId, setDatasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

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

    const sendFolderToBackendServer = async (folderPath: string) => {
        const files: string[] = fs.readdirSync(folderPath);
        let dataset_id: string = '';
        for (const file of files) {
            const filePath = path.join(folderPath, file);

            if (fs.lstatSync(filePath).isFile()) {
                try {
                    const fileContent = fs.readFileSync(filePath);
                    const blob = new Blob([fileContent]);
                    const formData = new FormData();

                    formData.append('file', blob, file);
                    formData.append('description', 'Dataset Description');
                    formData.append('dataset_id', dataset_id);
                    formData.append('workspace_id', currentWorkspace?.id ?? '');

                    const uploadResponse = await fetchData(
                        REMOTE_SERVER_ROUTES.UPLOAD_REDDIT_DATA,
                        {
                            method: 'POST',
                            body: formData
                        }
                    );

                    if (uploadResponse.error) {
                        console.error(`Failed to upload file ${file}:`, uploadResponse.error);
                    } else {
                        const result = uploadResponse.data;
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

        const parseResponse = await fetchData(REMOTE_SERVER_ROUTES.PARSE_REDDIT_DATA, {
            method: 'POST',
            body: JSON.stringify({ dataset_id })
        });

        if (parseResponse.error) {
            console.error('Failed to parse Reddit data:', parseResponse.error);
        }

        return dataset_id;
    };

    const getRedditPostDataByBatch = async (
        datasetId: string,
        batch: number,
        offset: number,
        all: boolean = true
    ) => {
        console.log('Fetching data from remote server', batch, offset, all, datasetId);
        const batchResponse = await fetchData(REMOTE_SERVER_ROUTES.GET_REDDIT_POSTS_BY_BATCH, {
            method: 'POST',
            body: JSON.stringify({
                dataset_id: datasetId,
                batch,
                offset,
                all
            })
        });
        if (batchResponse.error) {
            console.error('Error fetching batch data:', batchResponse.error);
            return {};
        }
        console.log(batchResponse.data, 'getRedditPostDataByBatch');
        return batchResponse.data;
    };

    const loadRedditDataInBackground = useCallback(
        async (folderPath: string, parsedData: RedditPosts) => {
            if (!folderPath || Object.keys(parsedData).length === 0) return;
            console.log('load-comments called');
            const result = await ipcRenderer.invoke('load-data', folderPath, parsedData, DB_PATH);
            console.log(result, 'load-data');
        },
        []
    );

    const loadFolderData = async (addToDb: boolean = false, changeModeInput = false) => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }
            let folderPath = modeInput.split(':')?.[2];
            // Uncomment and modify if you want to prompt for a folder:
            // if (!modeInput && changeModeInput) {
            //     folderPath = await ipcRenderer.invoke('select-folder-reddit');
            //     setModeInput(`reddit:upload:${folderPath}`);
            // }

            let currentDatasetId = datasetId;
            if (addToDb) {
                currentDatasetId = await sendFolderToBackendServer(folderPath);
            }
            console.log('Data sent to server, dataset_id: ', currentDatasetId);
            const parsedData = await getRedditPostDataByBatch(currentDatasetId, 10, 0);
            setData(parsedData);
            setError(null);
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
                setModeInput(`reddit:torrent:${torrentSubreddit}|${torrentStart}|${torrentEnd}`);
                const torrentResponse = await fetchData(
                    REMOTE_SERVER_ROUTES.DOWNLOAD_REDDIT_DATA_FROM_TORRENT,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            subreddit: torrentSubreddit,
                            start_date: torrentStart,
                            end_date: torrentEnd,
                            submissions_only: torrentPostsOnly,
                            dataset_id: datasetId
                        })
                    }
                );

                if (torrentResponse.error) {
                    console.error('Failed to load torrent data:', torrentResponse.error);
                } else {
                    console.log('Torrent data:', torrentResponse.data);
                }
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

    const handleLoadTorrentFromFiles = async (data: [string, string[]]) => {
        const [subreddit, files] = data;
        const torrentFilesResponse = await fetchData(
            REMOTE_SERVER_ROUTES.DOWNLOAD_REDDIT_DATA_FROM_TORRENT,
            {
                method: 'POST',
                body: JSON.stringify({
                    subreddit: subreddit,
                    files: files,
                    dataset_id: datasetId
                })
            }
        );

        if (torrentFilesResponse.error) {
            console.error('Error loading torrent files:', torrentFilesResponse.error);
        } else {
            console.log('Torrent data:', torrentFilesResponse.data);
        }
    };

    return { data, error, loadFolderData, loadTorrentData, handleLoadTorrentFromFiles, loading };
};

export default useRedditData;
