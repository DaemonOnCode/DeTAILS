import { FC, RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import TorrentDataTab from '../../components/DataCollection/load-torrent-data';
import { useNavigate } from 'react-router-dom';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { LOADER_ROUTES } from '../../constants/Coding/shared';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';

const { ipcRenderer } = window.require('electron');

const LoadReddit: FC<{
    processRef: RefObject<{ run: () => Promise<void> } | null>;
}> = ({ processRef }) => {
    const { modeInput, setModeInput, metadata, metadataDispatch, type, datasetId } =
        useCollectionContext();
    const { data, loadFolderData, loadTorrentData, error, handleLoadTorrentFromFiles, loading } =
        useRedditData();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    const navigate = useNavigate();

    const { getServerUrl } = useServerUtils();

    // New state for tab system and torrent inputs
    const [activeTab, setActiveTab] = useState<'folder' | 'torrent'>('folder');
    const [torrentSubreddit, setTorrentSubreddit] = useState('');
    const [torrentStart, setTorrentStart] = useState('');
    const [torrentEnd, setTorrentEnd] = useState('');
    const [torrentMode, setTorrentMode] = useState<'posts' | 'postsAndComments'>('posts');

    const selectedFilesRef = useRef<{ getFiles: () => [string, string[]] } | null>(null);

    // useEffect(() => {
    //     // If a modeInput exists (and we’re not in torrent mode) then load the data.
    //     // if (modeInput && activeTab !== 'torrent' && !loading) {
    //     //     loadFolderData();
    //     // } else if (modeInput && activeTab === 'torrent') {
    //     //     loadTorrentData();
    //     // }
    //     console.log('modeInput:', modeInput, 'activeTab:', activeTab, 'loading:', loading);
    //     if (modeInput) {
    //         if (activeTab === 'folder') {
    //             loadFolderData();
    //         } else if (activeTab === 'torrent' && !data) {
    //             loadTorrentData();
    //         }
    //     }
    // }, [modeInput, activeTab]);

    useEffect(() => {
        // const inputSplits = modeInput.split(':');
        // if (inputSplits.length && inputSplits[0] === 'reddit') {
        //     if (inputSplits[1] === 'torrent') {
        //         loadTorrentData();
        //     } else {
        //         loadFolderData();
        //     }
        // }

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    const handleLoadTorrent = async () => {
        const postsOnly = torrentMode === 'posts';
        await loadTorrentData(true, torrentSubreddit, torrentStart, torrentEnd, postsOnly);
    };

    useImperativeHandle(processRef, () => {
        return {
            run: async () => {
                const inputSplits = modeInput.split(':');
                if (inputSplits.length && inputSplits[0] === 'reddit') {
                    navigate(getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER));
                    if (inputSplits[1] === 'torrent') {
                        if (selectedFilesRef.current?.getFiles) {
                            console.log(selectedFilesRef.current.getFiles(), 'current selected');
                            await handleLoadTorrentFromFiles(selectedFilesRef.current.getFiles());
                        } else {
                            await handleLoadTorrent();
                        }
                    } else {
                        await loadFolderData(true, true);
                    }
                }
            }
        };
    }, [modeInput]);

    // If the current context type is not "reddit", show an error message.
    if (modeInput && type !== 'reddit') {
        return (
            <div className="p-4">
                <p className="text-red-500">
                    The current data is not retrieved from Reddit. Please switch to Interview data.
                </p>
            </div>
        );
    }

    // // If data is loaded, show the table.
    // const isDataLoaded = Boolean(modeInput);
    // if (isDataLoaded) {
    //     return (
    //         // <div className="flex-1 overflow-auto">
    //         <RedditTableRenderer data={data} loading={loading} />
    //         // </div>
    //     );
    // }

    // Handler for loading torrent data.

    const currentFolder = modeInput.split(':').slice(2).join(':');

    return (
        <div className="flex flex-col h-full">
            {/* Tab header */}
            <header className="p-4 border-b flex space-x-4">
                <button
                    className={`px-4 py-2 rounded ${
                        activeTab === 'folder'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => setActiveTab('folder')}>
                    Local Folder
                </button>
                {/* <button
                    className={`px-4 py-2 rounded ${
                        activeTab === 'url' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => setActiveTab('url')}>
                    URL
                </button> */}
                <button
                    className={`px-4 py-2 rounded ${
                        activeTab === 'torrent'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => setActiveTab('torrent')}>
                    Torrent
                </button>
            </header>

            {/* Main content area */}
            <main className="flex-1 min-h-0 overflow-auto p-4">
                {activeTab === 'folder' && (
                    <div>
                        <button
                            onClick={async () => {
                                let folderPath = await ipcRenderer.invoke('select-folder-reddit');
                                setModeInput(`reddit:upload:${folderPath}`);
                            }}
                            className="p-2 border border-gray-300 rounded w-96 mb-4">
                            Select Folder
                        </button>
                        <div>
                            <h3>Selected Folder:</h3>
                            <p>{currentFolder || 'No folder selected'}</p>
                            {error && <p className="text-red-500">{error}</p>}
                        </div>
                    </div>
                )}
                {/* 
                {activeTab === 'url' && (
                    <div>
                        <input
                            type="text"
                            value={modeInput}
                            onChange={(e) => setModeInput(e.target.value)}
                            placeholder="Type or paste text with URLs here"
                            className="p-2 border border-gray-300 rounded w-96"
                        />
                    </div>
                )} */}

                {activeTab === 'torrent' && (
                    <TorrentDataTab
                        selectedFilesRef={selectedFilesRef}
                        torrentSubreddit={torrentSubreddit}
                        setTorrentSubreddit={setTorrentSubreddit}
                        torrentStart={torrentStart}
                        setTorrentStart={setTorrentStart}
                        torrentEnd={torrentEnd}
                        setTorrentEnd={setTorrentEnd}
                        torrentMode={torrentMode}
                        setTorrentMode={setTorrentMode}
                        handleLoadTorrent={handleLoadTorrent}
                    />
                )}
            </main>
        </div>
    );
};

export default LoadReddit;
