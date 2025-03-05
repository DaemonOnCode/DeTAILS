import React, { FC, RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import TorrentDataTab from '../../components/DataCollection/load-torrent-data';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';
import { useLoadingContext } from '../../context/loading-context';

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
    const { loadingDispatch } = useLoadingContext();
    // Get query parameters for active tab.
    const [searchParams, setSearchParams] = useSearchParams();
    const queryActiveTab = searchParams.get('activeTab') as 'folder' | 'torrent' | null;
    const [activeTab, setActiveTab] = useState<'folder' | 'torrent'>(queryActiveTab ?? 'folder');

    const [torrentSubreddit, setTorrentSubreddit] = useState('');
    const [torrentStart, setTorrentStart] = useState('');
    const [torrentEnd, setTorrentEnd] = useState('');
    const [torrentMode, setTorrentMode] = useState<'posts' | 'postsAndComments'>('posts');

    const selectedFilesRef = useRef<{ getFiles: () => [string, string[]] } | null>(null);

    useEffect(() => {
        // On mount, ensure the activeTab query parameter is set.
        if (!queryActiveTab) {
            searchParams.set('activeTab', activeTab);
            setSearchParams(searchParams);
        }
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    useEffect(() => {
        if (modeInput) {
            const splits = modeInput.split(':');
            if (splits.length >= 2) {
                const subMode = splits[1]; // e.g. "torrent" or "upload"
                if (subMode === 'torrent') {
                    updateActiveTab('torrent');
                } else if (subMode === 'upload') {
                    updateActiveTab('folder');
                }
            }
        }
    }, [modeInput]);

    const handleLoadTorrent = async () => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`
        });
        navigate(getCodingLoaderUrl(LOADER_ROUTES.TORRENT_DATA_LOADER));
        const postsOnly = torrentMode === 'posts';
        await loadTorrentData(true, torrentSubreddit, torrentStart, torrentEnd, postsOnly);
        if (error) return;
        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`);
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`
        });
    };

    useImperativeHandle(processRef, () => {
        return {
            run: async () => {
                const inputSplits = modeInput.split(':');
                if (inputSplits.length && inputSplits[0] === 'reddit') {
                    if (inputSplits[1] === 'torrent') {
                        if (selectedFilesRef.current?.getFiles) {
                            navigate(getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER));
                            console.log(selectedFilesRef.current.getFiles(), 'current selected');
                            await handleLoadTorrentFromFiles(selectedFilesRef.current.getFiles());
                        } else {
                            navigate(getCodingLoaderUrl(LOADER_ROUTES.TORRENT_DATA_LOADER));
                            await handleLoadTorrent();
                        }
                    } else {
                        navigate(getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER));
                        await loadFolderData(true, true);
                    }
                }
            }
        };
    }, [modeInput]);

    if (modeInput && type !== 'reddit') {
        return (
            <div className="p-4">
                <p className="text-red-500">
                    The current data is not retrieved from Reddit. Please switch to Interview data.
                </p>
            </div>
        );
    }

    const currentFolder = modeInput.split(':').slice(2).join(':');

    // Handler to update active tab and the URL query parameter.
    const updateActiveTab = (tab: 'folder' | 'torrent') => {
        setActiveTab(tab);
        searchParams.set('activeTab', tab);
        setSearchParams(searchParams);
    };

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
                    onClick={() => updateActiveTab('folder')}>
                    Local Folder
                </button>
                <button
                    className={`px-4 py-2 rounded ${
                        activeTab === 'torrent'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => updateActiveTab('torrent')}>
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
