import React, { FC, RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import TorrentDataTab from '../../components/DataCollection/load-torrent-data';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getCodingLoaderUrl } from '../../utility/get-loader-url';
import { LOADER_ROUTES, ROUTES } from '../../constants/Coding/shared';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';
import { useLoadingContext } from '../../context/loading-context';
import { TORRENT_END_DATE, TORRENT_START_DATE } from '../../constants/DataCollection/shared';

const { ipcRenderer, shell } = window.require('electron');

const LoadReddit: FC<{
    processRef: RefObject<{ run: () => Promise<void> } | null>;
}> = ({ processRef }) => {
    const location = useLocation();
    const { modeInput, setModeInput, metadata, metadataDispatch, type, datasetId } =
        useCollectionContext();
    const {
        data,
        loadFolderData,
        loadTorrentData,
        error,
        handleLoadTorrentFromFiles,
        loading,
        checkPrimaryTorrentForSubreddit
    } = useRedditData();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    const navigate = useNavigate();
    const { loadingDispatch, resetDataAfterPage, openModal, checkIfDataExists, abortRequests } =
        useLoadingContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryActiveTab = searchParams.get('activeTab') as 'folder' | 'torrent' | null;
    console.log('queryActiveTab', queryActiveTab);

    const [activeTab, setActiveTab] = useState<'folder' | 'torrent'>(queryActiveTab ?? 'torrent');

    const defaultSubreddit = '';
    const defaultStart = TORRENT_START_DATE;
    const defaultEnd = TORRENT_END_DATE;
    const defaultMode = 'postsAndComments';

    let torrentSubredditInitial = defaultSubreddit;
    let torrentStartInitial = defaultStart;
    let torrentEndInitial = defaultEnd;
    let torrentModeInitial = defaultMode;

    if (modeInput && typeof modeInput === 'string') {
        const modeSplits = modeInput.split(':');
        if (modeSplits.length >= 3 && modeSplits[0] === 'reddit' && modeSplits[1] === 'torrent') {
            const torrentParams = modeSplits[2].split('|');
            if (torrentParams.length >= 4) {
                torrentSubredditInitial = torrentParams[0] || defaultSubreddit;
                torrentStartInitial = torrentParams[1] || defaultStart;
                torrentEndInitial = torrentParams[2] || defaultEnd;
                torrentModeInitial = torrentParams[3] !== 'false' ? 'posts' : 'postsAndComments';
            }
        }
    }

    const [torrentSubreddit, setTorrentSubreddit] = useState(torrentSubredditInitial);
    const [torrentStart, setTorrentStart] = useState(torrentStartInitial);
    const [torrentEnd, setTorrentEnd] = useState(torrentEndInitial);
    const [torrentMode, setTorrentMode] = useState<'posts' | 'postsAndComments'>(
        torrentModeInitial as 'posts' | 'postsAndComments'
    );

    const [showModal, setShowModal] = useState(false);
    const [modalState, setModalState] = useState<'loading' | 'error' | 'retry-form'>('loading');

    const selectedFilesRef = useRef<{ getFiles: () => [string, string[]] } | null>(null);

    const handleExternelLink = () => {
        shell.openExternal('https://git.uwaterloo.ca/jrwallace/PASS');
    };
    useEffect(() => {
        if (!queryActiveTab) {
            searchParams.set('activeTab', modeInput.split(':')[1]);
            console.log('setting active tab', activeTab, searchParams.toString());
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
        console.log('modeInput', modeInput);
        if (modeInput) {
            const splits = modeInput.split(':');
            if (splits.length >= 2) {
                const subMode = splits[1];
                if (subMode === 'torrent') {
                    updateActiveTab('torrent');
                } else if (subMode === 'upload') {
                    updateActiveTab('folder');
                }
            }
        }
    }, [modeInput]);

    const loadTorrentWithOptions = async (
        subreddit: string,
        start: string,
        end: string,
        postsOnly: boolean,
        useFallback: boolean = false
    ) => {
        loadingDispatch({
            type: 'SET_LOADING_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`
        });
        abortRequests(location.pathname);
        navigate(getCodingLoaderUrl(LOADER_ROUTES.TORRENT_DATA_LOADER));
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const { error } = await loadTorrentData(
            true,
            subreddit,
            start,
            end,
            postsOnly,
            useFallback
        );
        if (error) return;
        loadingDispatch({
            type: 'SET_REST_UNDONE',
            route: location.pathname
        });
        loadingDispatch({
            type: 'SET_FIRST_RUN_DONE',
            route: location.pathname
        });
        loadingDispatch({
            type: 'SET_LOADING_DONE_ROUTE',
            route: `/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`
        });
        navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.LOAD_DATA}/${ROUTES.DATA_VIEWER}`);
    };

    const handleLoadTorrent = async () => {
        setShowModal(true);
        setModalState('loading');

        const checkPrimaryTorrent = await checkPrimaryTorrentForSubreddit(torrentSubreddit);

        if (!checkPrimaryTorrent) {
            setModalState('retry-form');
            return;
        }

        await loadTorrentWithOptions(
            torrentSubreddit,
            torrentStart,
            torrentEnd,
            torrentMode === 'posts'
        );
    };

    const handleProceedWithFallback = async () => {
        await loadTorrentWithOptions(
            torrentSubreddit,
            torrentStart,
            torrentEnd,
            torrentMode === 'posts',
            true
        );
    };

    useImperativeHandle(processRef, () => {
        return {
            run: async () => {
                const inputSplits = modeInput.split(':');
                if (inputSplits.length && inputSplits[0] === 'reddit') {
                    if (inputSplits[1] === 'torrent') {
                        if (selectedFilesRef.current?.getFiles) {
                            navigate(
                                getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                                    text: 'Loading data'
                                })
                            );
                            console.log(selectedFilesRef.current.getFiles(), 'current selected');
                            await handleLoadTorrentFromFiles(selectedFilesRef.current.getFiles());
                        } else {
                            navigate(getCodingLoaderUrl(LOADER_ROUTES.TORRENT_DATA_LOADER));
                            await handleLoadTorrent();
                        }
                    } else {
                        navigate(
                            getCodingLoaderUrl(LOADER_ROUTES.DATA_LOADING_LOADER, {
                                text: 'Loading data'
                            })
                        );
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

    const currentFolder =
        modeInput.split(':').slice(0, 2).join(':') === 'reddit:upload'
            ? modeInput.split(':').slice(2).join(':')
            : '';

    // Handler to update active tab and the URL query parameter.
    const updateActiveTab = (tab: 'folder' | 'torrent') => {
        setActiveTab(tab);
        searchParams.set('activeTab', tab);
        console.log('setting active tab', tab, searchParams.toString());
        setSearchParams(searchParams);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Tab header */}
            <header className="p-4 border-b flex space-x-4" id="reddit-dataset-tabs">
                <button
                    className={`px-4 py-2 rounded ${
                        activeTab === 'torrent'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => updateActiveTab('torrent')}>
                    Torrent
                </button>
                <button
                    className={`px-4 py-2 rounded ${
                        activeTab === 'folder'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => updateActiveTab('folder')}>
                    Local Folder
                </button>
            </header>

            {/* Main content area */}
            <main className="flex-1 min-h-0 overflow-auto p-4" id="reddit-dataset-main">
                {activeTab === 'folder' && (
                    <div>
                        <p className="mb-4">
                            Follow instructions at{' '}
                            <span
                                className="text-blue-500 underline cursor-pointer"
                                onClick={handleExternelLink}>
                                PASS
                            </span>{' '}
                            to create dataset for DeTAILS
                        </p>
                        <button
                            onClick={async () => {
                                if (checkIfDataExists(location.pathname)) {
                                    openModal('deductive-coding-redo', async () => {
                                        await resetDataAfterPage(location.pathname);
                                        let folderPath = await ipcRenderer.invoke('select-folder');
                                        setModeInput(`reddit:upload:${folderPath}`);
                                    });
                                } else {
                                    let folderPath = await ipcRenderer.invoke('select-folder');
                                    setModeInput(`reddit:upload:${folderPath}`);
                                }
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
                        handleLoadTorrent={async () => {
                            if (checkIfDataExists(location.pathname)) {
                                openModal('load-reddit-torrent', async () => {
                                    await resetDataAfterPage(location.pathname);
                                    await handleLoadTorrent();
                                });
                            } else {
                                loadingDispatch({
                                    type: 'SET_REST_UNDONE',
                                    route: location.pathname
                                });
                                await handleLoadTorrent();
                            }
                        }}
                    />
                )}
            </main>
            {showModal && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center"
                    style={{ zIndex: 1000 }}>
                    <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
                        {modalState === 'loading' && (
                            <p className="text-center">Checking subreddit availability...</p>
                        )}
                        {modalState === 'error' && (
                            <div className="space-y-4">
                                <p className="text-red-500">
                                    Error loading torrent data. Please choose an option:
                                </p>
                                <button
                                    onClick={() => {
                                        setModalState('retry-form');
                                    }}
                                    className="w-full p-2 bg-blue-500 text-white rounded">
                                    Correct name and retry
                                </button>
                            </div>
                        )}
                        {modalState === 'retry-form' && (
                            <div className="space-y-4">
                                <p>
                                    Subreddit was not found in primary torrent. Switching to
                                    fallback torrent will take more time but can possibly find
                                    results for the subreddit
                                </p>

                                <div className="flex space-x-2 w-full">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 p-2 bg-blue-500 text-white rounded">
                                        Make changes to torrent details
                                    </button>
                                    <button
                                        onClick={handleProceedWithFallback}
                                        className="p-2 bg-green-500 text-white rounded">
                                        Proceed with fallback torrent
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoadReddit;
