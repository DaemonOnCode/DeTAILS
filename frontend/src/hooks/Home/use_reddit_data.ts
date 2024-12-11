import { useState, useCallback } from 'react';
import { RedditPosts } from '../../types/Coding/shared';
import { DB_PATH } from '../../constants/Coding/shared';
import { useCollectionContext } from '../../context/collection_context';

const { ipcRenderer } = window.require('electron');
const FormData = require("form-data");
const fs = window.require('fs');
const path = window.require('path');

const useRedditData = () => {
    const [data, setData] = useState<RedditPosts>({});
    // const [fullData, setFullData] = useState<FullRedditData>();
    const [error, setError] = useState<string | null>(null);

    const { modeInput, setModeInput, subreddit, setSubreddit } = useCollectionContext();

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

    const sendFolderToBackendServer = async (files: string[], folderPath: string) => {
    const url = "http://localhost:8080/api/collections/datasets";

    let dataset_id: string = "";
    for (const file of files) {
        const filePath = path.join(folderPath, file);

        // Ensure it is a file (not a subdirectory)
        if (fs.lstatSync(filePath).isFile()) {
            try {
                const fileContent = fs.readFileSync(filePath); // Read file content
                const blob = new Blob([fileContent]); // Create a Blob for compatibility with FormData
                const formData = new FormData();

                formData.append("file", blob, file); // Append the file to the form data
                formData.append("name", subreddit); // Add metadata if required
                formData.append("description", "Dataset Description");
                formData.append("dataset_id", dataset_id);

                const response = await fetch(url, {
                    method: "POST",
                    body: formData,
                });

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
    await fetch("http://localhost:8080/api/collections/parse-reddit-dataset", {
        method: "POST",
        body: JSON.stringify({
            dataset_id
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })
};




    const loadCommentsInBackground = useCallback(
        async (folderPath: string, parsedData: RedditPosts) => {
            if (!folderPath || Object.keys(parsedData).length === 0) return;

            console.log('load-comments called');
            const result = await ipcRenderer.invoke('load-data', folderPath, parsedData, DB_PATH);
            console.log(result, 'load-data');
        },
        []
    );

    const loadFolderData = async (addToDb: boolean = false, changeModeInput = false) => {
        try {
            let folderPath = modeInput;
            if (!modeInput || changeModeInput) {
                folderPath = await ipcRenderer.invoke('select-folder');
                setModeInput(folderPath);
            }

            const files: string[] = fs.readdirSync(folderPath);
            const jsonFiles = files
                .filter(
                    (file) =>
                        file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RS')
                )
                .map((file) => {
                    const [prefix, datePart] = file.split('_');
                    const [year, month] = datePart.replace('.json', '').split('-');
                    return {
                        file,
                        type: prefix === 'RS' ? 'submission' : 'comment',
                        year: parseInt(year, 10),
                        month: parseInt(month, 10)
                    };
                })
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'submission' ? -1 : 1;
                    if (a.year !== b.year) return a.year - b.year;
                    return a.month - b.month;
                });

            const parsedData: RedditPosts = {};
            jsonFiles.forEach(({ file }) => {
                try {
                    const filePath = path.join(folderPath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    const filteredData: Record<string, string>[] =
                        omitFirstIfMatchesStructure(data);
                    filteredData.forEach((post) => {
                        const postId = post.id;
                        delete post.id;
                        if (!subreddit) {
                            setSubreddit(post.subreddit);
                        }
                        parsedData[postId] = post as unknown as RedditPosts[string];
                    });
                } catch (error) {
                    console.error(`Failed to parse file ${file}:`, error);
                }
            });

            setData(parsedData);
            setError(null);

            if (addToDb) {
                loadCommentsInBackground(folderPath, parsedData);
                sendFolderToBackendServer(files, folderPath);
            }
        } catch (error) {
            console.error('Failed to load folder:', error);
            // setError('Failed to load folder.');
        }
    };

    return { data, error, loadFolderData };
};

export default useRedditData;
