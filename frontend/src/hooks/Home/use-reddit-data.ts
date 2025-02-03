import { useState, useCallback, useEffect } from 'react';
import { RedditPosts } from '../../types/Coding/shared';
import { DB_PATH } from '../../constants/Coding/shared';
import { useCollectionContext } from '../../context/collection-context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import getServerUtils from '../Shared/get-server-url';
import { useWorkspaceContext } from '../../context/workspace-context';

const { ipcRenderer } = window.require('electron');
const FormData = require('form-data');
const fs = window.require('fs');
const path = window.require('path');

const useRedditData = () => {
    const [data, setData] = useState<RedditPosts>({});
    // const [fullData, setFullData] = useState<FullRedditData>();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const { modeInput, setModeInput, subreddit, setSubreddit, setDatasetId, datasetId } =
        useCollectionContext();

    const { currentWorkspace } = useWorkspaceContext();

    const { getServerUrl } = getServerUtils();

    useEffect(() => {
        if (!modeInput && !datasetId) {
            setData({});
            return;
        }
    }, [modeInput, datasetId]);

    const omitFirstIfMatchesStructure = (data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (!firstElement.hasOwnProperty('id')) {
                return data.slice(1);
            }
        }
        return data;
    };

    // const loadCommentsForPosts = async (folderPath: string, parsedData: RedditPosts) => {
    //     const files: string[] = fs.readdirSync(folderPath);

    //     console.log(files);
    //     const jsonFiles = files
    //         .filter(
    //             (file) => file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RC')
    //         )
    //         .map((file) => {
    //             const [_, datePart] = file.split('_');
    //             const [year, month] = datePart.replace('.json', '').split('-');
    //             return {
    //                 file,
    //                 year: parseInt(year, 10),
    //                 month: parseInt(month, 10)
    //             };
    //         })
    //         .sort();

    //     console.log(jsonFiles, folderPath);

    //     const parsedFullData: FullRedditData = {};

    //     jsonFiles.forEach(({ file }) => {
    //         try {
    //             const filePath = path.join(folderPath, file);
    //             const content = fs.readFileSync(filePath, 'utf-8');
    //             const data = JSON.parse(content);

    //             const filteredData: Record<string, string>[] = omitFirstIfMatchesStructure(data);

    //             const comments: RedditComments = {};
    //             filteredData.forEach((comment) => {
    //                 const commentId = comment.id;
    //                 delete comment.id;

    //                 const commentLink = comment.link_id.split('_')[1];
    //                 const commentParent = comment.parent_id.split('_')[1];
    //                 if (commentParent !== commentLink && !comments[commentParent]) {
    //                     // if (!comments[commentParent]?.comments) {
    //                     //     comments[commentParent].comments = {};
    //                     // }
    //                     // @ts-ignore
    //                     comments[commentParent] = {
    //                         comments: {}
    //                     };
    //                     comments[commentParent].comments[commentId] =
    //                         comment as unknown as RedditComments[string];
    //                 } else if (comments[commentParent]) {
    //                     comments[commentId] = {
    //                         ...comments[commentId],
    //                         ...(comment as unknown as RedditComments[string])
    //                     };
    //                 } else {
    //                     comments[commentId] = comment as unknown as RedditComments[string];
    //                 }
    //             });
    //             Object.keys(parsedData).forEach((id) => {
    //                 if (comments[id]) {
    //                     parsedFullData[id] = {
    //                         ...parsedData[id],
    //                         comments: {}
    //                     };
    //                 }
    //             });

    //             Object.keys(comments).forEach((id) => {
    //                 const link_id = comments[id].link_id?.split('_')[1];
    //                 console.log(link_id);
    //                 if (!link_id) return;
    //                 if (parsedFullData[link_id]) {
    //                     parsedFullData[link_id].comments = {
    //                         ...parsedFullData[link_id].comments,
    //                         [id]: comments[id]
    //                     };
    //                 }
    //             });
    //             // parsedFullData[parsedData[comments.link_id.split('_')[1]][id]] = {
    //             //     ...parsedData[comments.link_id.split('_')[1]],
    //             //     comments
    //             // };
    //         } catch (error) {
    //             console.error(`Failed to parse file ${file}:`, error);
    //         }
    //     });

    //     console.log(parsedFullData);
    //     return parsedFullData;
    // };

    const sendFolderToBackendServer = async (folderPath: string) => {
        const files: string[] = fs.readdirSync(folderPath);

        let dataset_id: string = '';
        for (const file of files) {
            const filePath = path.join(folderPath, file);

            // Ensure it is a file (not a subdirectory)
            if (fs.lstatSync(filePath).isFile()) {
                try {
                    const fileContent = fs.readFileSync(filePath); // Read file content
                    const blob = new Blob([fileContent]); // Create a Blob for compatibility with FormData
                    const formData = new FormData();

                    formData.append('file', blob, file); // Append the file to the form data
                    formData.append('description', 'Dataset Description');
                    formData.append('dataset_id', dataset_id);
                    formData.append('workspace_id', currentWorkspace?.id);

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
        await fetch(getServerUrl(REMOTE_SERVER_ROUTES.PARSE_REDDIT_DATA), {
            method: 'POST',
            body: JSON.stringify({
                dataset_id
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return dataset_id;
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

    const getRedditPostDataByBatch = async (
        datasetId: string,
        batch: number,
        offset: number,
        all: boolean = true
    ) => {
        // if (USE_LOCAL_SERVER) {
        //     const result = await ipcRenderer.invoke(
        //         'get-reddit-posts-by-batch',
        //         batch,
        //         offset,
        //         DB_PATH
        //     );
        //     return result;
        // } else {
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
        const data = await response.json();
        console.log(data, 'getRedditPostDataByBatch');
        return data;
        // }
    };

    const loadFolderData = async (addToDb: boolean = false, changeModeInput = false) => {
        setLoading(true);
        try {
            if (!currentWorkspace || !currentWorkspace.id) {
                throw new Error('Workspace not found');
            }
            let folderPath = modeInput;
            if (!modeInput && changeModeInput) {
                folderPath = await ipcRenderer.invoke('select-folder');
                setModeInput(folderPath);
            }

            // if (!USE_LOCAL_SERVER) {
            let dataset_id = datasetId;
            if (addToDb) {
                dataset_id = await sendFolderToBackendServer(folderPath);
            }
            console.log('Data sent to server, dataset_id: ', dataset_id);
            const parsedData = await getRedditPostDataByBatch(dataset_id, 10, 0);
            setData(parsedData);
            setError(null);
            //     return;
            // }

            // const files: string[] = fs.readdirSync(folderPath);
            // const jsonFiles = files
            //     .filter(
            //         (file) =>
            //             file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RS')
            //     )
            //     .map((file) => {
            //         const [prefix, datePart] = file.split('_');
            //         const [year, month] = datePart.replace('.json', '').split('-');
            //         return {
            //             file,
            //             type: prefix === 'RS' ? 'submission' : 'comment',
            //             year: parseInt(year, 10),
            //             month: parseInt(month, 10)
            //         };
            //     })
            //     .sort((a, b) => {
            //         if (a.type !== b.type) return a.type === 'submission' ? -1 : 1;
            //         if (a.year !== b.year) return a.year - b.year;
            //         return a.month - b.month;
            //     });

            // const parsedData: RedditPosts = {};
            // jsonFiles.forEach(({ file }) => {
            //     try {
            //         const filePath = path.join(folderPath, file);
            //         const content = fs.readFileSync(filePath, 'utf-8');
            //         const data = JSON.parse(content);

            //         const filteredData: Record<string, string>[] =
            //             omitFirstIfMatchesStructure(data);
            //         filteredData.forEach((post) => {
            //             const postId = post.id;
            //             delete post.id;
            //             if (!subreddit) {
            //                 setSubreddit(post.subreddit);
            //             }
            //             parsedData[postId] = post as unknown as RedditPosts[string];
            //         });
            //     } catch (error) {
            //         console.error(`Failed to parse file ${file}:`, error);
            //     }
            // });

            // // const parsedData = await getRedditPostDataByBatch(10, 0);

            // setData(parsedData);
            // setError(null);

            // if (addToDb) {
            //     loadRedditDataInBackground(folderPath, parsedData);
            // }
        } catch (error) {
            console.error('Failed to load folder:', error);
            // setError('Failed to load folder.');
        } finally {
            setLoading(false);
        }
    };

    return { data, error, loadFolderData, loading };
};

export default useRedditData;
