import { useState, useEffect } from 'react';
import { RedditPosts } from '../../types/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useApi } from '../Shared/use-api';

const fs = window.require('fs');
const path = window.require('path');

const useRedditData = () => {
    const [data, setData] = useState<RedditPosts>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const { modeInput, setModeInput, setDatasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

    useEffect(() => {
        if (!modeInput && !currentWorkspace.id) {
            setData({});
        }
    }, [modeInput, currentWorkspace.id]);

    const sendFolderToBackendServer = async (folderPath: string) => {
        const files: string[] = fs.readdirSync(folderPath);
        let workspace_id: string = '';
        for (const file of files) {
            const filePath = path.join(folderPath, file);

            if (fs.lstatSync(filePath).isFile()) {
                try {
                    const fileContent = fs.readFileSync(filePath);
                    const blob = new Blob([fileContent]);
                    const formData = new FormData();

                    formData.append('file', blob, file);
                    formData.append('description', 'Dataset Description');
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
                        setError(uploadResponse.error.name);
                    } else {
                        const result = uploadResponse.data;
                        workspace_id = result.workspace_id;
                        console.log(`File ${file} uploaded successfully`, result);
                    }
                } catch (error) {
                    console.error(`Error uploading file ${file}:`, error);
                }
            }
        }
        console.log('Dataset ID:', workspace_id);
        setDatasetId(workspace_id);

        const parseResponse = await fetchData(REMOTE_SERVER_ROUTES.PARSE_REDDIT_DATA, {
            method: 'POST',
            body: JSON.stringify({ workspace_id })
        });

        if (parseResponse.error) {
            console.error('Failed to parse Reddit data:', parseResponse.error);
        }

        return workspace_id;
    };

    const getRedditPostDataByBatch = async (
        workspaceId: string,
        batch: number,
        offset: number,
        all: boolean = false,
        searchTerm: string = '',
        startTime?: Date,
        endTime?: Date,
        hideRemoved: boolean = false,
        page: number = 1,
        itemsPerPage: number = 10
    ) => {
        console.log('Fetching data from remote server', {
            workspaceId: currentWorkspace.id,
            batch,
            offset,
            all,
            searchTerm,
            startTime,
            endTime,
            hideRemoved,
            page,
            itemsPerPage
        });

        const requestBody = {
            workspace_id: workspaceId,
            batch,
            offset,
            all,
            search_term: searchTerm,
            start_time: startTime ? Math.floor(startTime.getTime() / 1000) : undefined,
            end_time: endTime ? Math.floor(endTime.getTime() / 1000) : undefined,
            hide_removed: hideRemoved,
            page,
            items_per_page: itemsPerPage
        };

        const batchResponse = await fetchData(REMOTE_SERVER_ROUTES.GET_REDDIT_POSTS_BY_BATCH, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        if (batchResponse.error) {
            console.error('Error fetching batch data:', batchResponse.error);
            setError(batchResponse.error.name);
            return {};
        }

        console.log(batchResponse.data, 'getRedditPostDataByBatch');
        return batchResponse.data;
    };

    const loadFolderData = async (addToDb: boolean = false) => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }
            let folderPath = modeInput.split('|')?.[2];

            let currentDatasetId = currentWorkspace.id;
            if (addToDb) {
                currentDatasetId = await sendFolderToBackendServer(folderPath);
            }
            console.log('Data sent to server, workspace_id: ', currentDatasetId);
            const parsedData = await getRedditPostDataByBatch(currentWorkspace!.id, 10, 0);
            setData(parsedData);
            setError(null);
        } catch (err) {
            console.error('Failed to load folder:', err);
            setError('Failed to load folder.');
        } finally {
            setLoading(false);
        }
    };

    const checkPrimaryTorrentForSubreddit = async (
        subreddit: string,
        downloadDirectory?: string
    ) => {
        const { data: checkResponse, error: checkError } = await fetchData<{
            status: boolean;
            files: string[];
            total_size: number;
            error?: string;
        }>(REMOTE_SERVER_ROUTES.CHECK_PRIMARY_TORRENT, {
            method: 'POST',
            body: JSON.stringify({
                subreddit: subreddit,
                workspace_id: currentWorkspace!.id,
                download_dir: downloadDirectory
            })
        });

        console.log('Check response:', checkResponse);

        return {
            status: checkResponse?.status,
            error: checkResponse.error ? checkResponse.error : checkError?.message?.error_message
        };
    };

    const loadTorrentData = async (
        addToDb: boolean = false,
        torrentSubreddit?: string,
        torrentStart?: string,
        torrentEnd?: string,
        torrentPostsOnly?: boolean,
        useFallback: boolean = false,
        downloadDirectory?: string
    ) => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }

            if (addToDb) {
                setModeInput(
                    `reddit|torrent|${torrentSubreddit}|${torrentStart}|${torrentEnd}|${torrentPostsOnly}|${useFallback}|${downloadDirectory}`
                );

                const torrentResponse = await fetchData(
                    REMOTE_SERVER_ROUTES.DOWNLOAD_REDDIT_DATA_FROM_TORRENT,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            subreddit: torrentSubreddit,
                            start_date: torrentStart,
                            end_date: torrentEnd,
                            submissions_only: torrentPostsOnly,
                            workspace_id: currentWorkspace.id,
                            use_fallback: useFallback,
                            download_dir: downloadDirectory
                        })
                    }
                );

                if (torrentResponse.error) {
                    console.error('Failed to load torrent data:', torrentResponse.error);
                    setError(torrentResponse.error.name);
                    throw new Error(torrentResponse.error.message.error_message);
                } else {
                    console.log('Torrent data:', torrentResponse.data);
                }
            }

            const parsedData = await getRedditPostDataByBatch(currentWorkspace!.id, 10, 0);
            setData(parsedData);
            setError(null);
            return {
                data: parsedData,
                error: null
            };
        } catch (err: any) {
            console.error('Failed to load torrent data:', err);
            setError('Failed to load torrent data.');
            return {
                error: err
            };
        } finally {
            setLoading(false);
        }
    };

    const handleLoadTorrentFromFiles = async (data: [string, string[]]) => {
        const subreddit = data[0][0],
            files = data[0][1];
        console.log('Loading torrent data from files:', subreddit, files, currentWorkspace.id);
        const torrentFilesResponse = await fetchData(
            REMOTE_SERVER_ROUTES.PREPARE_REDDIT_TORRENT_DATA_FROM_FILES,
            {
                method: 'POST',
                body: JSON.stringify({
                    subreddit: subreddit,
                    files: files,
                    workspace_id: currentWorkspace.id
                })
            }
        );

        if (torrentFilesResponse.error) {
            console.error('Error loading torrent files:', torrentFilesResponse.error);
            setError(torrentFilesResponse.error.name);
        } else {
            console.log('Torrent data:', torrentFilesResponse.data);
        }
    };

    return {
        data,
        error,
        loadFolderData,
        loadTorrentData,
        handleLoadTorrentFromFiles,
        loading,
        checkPrimaryTorrentForSubreddit
    };
};

export default useRedditData;
