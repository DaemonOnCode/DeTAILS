import { RefObject, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { SetState } from '../../types/Coding/shared';
import TorrentSelectionPanel from './torrent-selection-panel';
import { createResource } from '../../utility/resource-creator';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection-context';
import { useApi } from '../../hooks/Shared/use-api';
import { TORRENT_END_DATE, TORRENT_START_DATE } from '../../constants/DataCollection/shared';
import { useSettings } from '../../context/settings-context';
import debounce from 'lodash/debounce';

const { shell, ipcRenderer } = window.require('electron');
const fs = window.require('fs');

const TorrentDataTab = ({
    torrentSubreddit,
    setTorrentSubreddit,
    torrentStart,
    setTorrentStart,
    torrentEnd,
    setTorrentEnd,
    torrentMode,
    setTorrentMode,
    handleLoadTorrent,
    selectedFilesRef,
    selectedTorrentType,
    setSelectedTorrentType,
    downloadPath,
    setDownloadPath
}: {
    torrentSubreddit: string;
    setTorrentSubreddit: SetState<string>;
    torrentStart: string;
    setTorrentStart: SetState<string>;
    torrentEnd: string;
    setTorrentEnd: SetState<string>;
    torrentMode: 'posts' | 'postsAndComments';
    setTorrentMode: SetState<'posts' | 'postsAndComments'>;
    handleLoadTorrent: () => Promise<void>;
    selectedFilesRef: RefObject<{ getFiles: () => [string, string[]] } | null>;
    selectedTorrentType: string;
    setSelectedTorrentType: SetState<string>;
    downloadPath: string;
    setDownloadPath: SetState<string>;
}) => {
    const location = useLocation();
    const { getServerUrl } = useServerUtils();
    const { fetchData } = useApi();
    const [checking, setChecking] = useState<boolean>(false);
    const navigate = useNavigate();
    const { settings } = useSettings();

    const fetchTorrentData = useCallback(async () => {
        const { data, error } = await fetchData<any>(REMOTE_SERVER_ROUTES.GET_ALL_TORRENT_DATA);
        if (error) {
            console.error('Error fetching torrent data:', error);
            return null;
        }
        return data;
    }, [fetchData]);

    const dataResource = useMemo(() => createResource(fetchTorrentData()), [fetchTorrentData]);

    const [transmissionExists, setTransmissionExists] = useState<boolean | null>(null);

    const checkFolderExistence = (path: string) => {
        try {
            const checkPath =
                fs.existsSync(path) &&
                fs
                    .lstatSync(path, {
                        throwIfNoEntry: false
                    })
                    ?.isDirectory();
            console.log(
                'Folder exists:',
                checkPath,
                fs.existsSync(path),
                fs
                    .lstatSync(path, {
                        throwIfNoEntry: false
                    })
                    ?.isDirectory()
            );
            // setFolderExists(checkPath);
            return checkPath;
        } catch (error) {
            console.error('Error checking folder existence:', error);
            // setFolderExists(false);
            return false;
        }
    };

    const [folderExists, setFolderExists] = useState<boolean | null>(
        checkFolderExistence(settings.transmission.downloadDir)
    );
    const debouncedCheckFolderExistence = useMemo(
        () => debounce((path: string) => setFolderExists(checkFolderExistence(path)), 300),
        []
    );
    const handleDownloadPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPath = e.target.value;
        setDownloadPath(newPath);
        debouncedCheckFolderExistence(newPath);
    };

    const handleSelectFolder = async () => {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            setDownloadPath(folderPath);
        }
    };

    const checkTransmissionStatus = async () => {
        setChecking(true);
        // await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
            const { data, error } = await fetchData<{ exists: boolean }>(
                REMOTE_SERVER_ROUTES.CHECK_TRANSMISSION
            );

            if (error) {
                console.error('Error checking transmission:', error);
                setTransmissionExists(false);
            } else {
                setTransmissionExists(data.exists);
            }
        } catch (error) {
            console.error('Error checking transmission:', error);
            setTransmissionExists(false);
        } finally {
            setChecking(false);
        }
    };

    // Initial check when component mounts.
    useEffect(() => {
        checkTransmissionStatus();
    }, [getServerUrl]);

    // Use process.platform from Electron to detect the platform.
    let platform: 'windows' | 'macos' | 'linux' | 'unknown' = 'unknown';
    if (process.platform === 'win32') {
        platform = 'windows';
    } else if (process.platform === 'darwin') {
        platform = 'macos';
    } else if (process.platform === 'linux') {
        platform = 'linux';
    }

    // Show loading screen if transmission check is still pending.
    if (transmissionExists === null) {
        return <div>Checking Transmission daemon availability...</div>;
    }

    const torrentDisabledCheck =
        !folderExists ||
        torrentSubreddit === '' ||
        torrentStart === '' ||
        torrentEnd === '' ||
        new Date(torrentStart).getTime() > new Date(torrentEnd).getTime() ||
        new Date(torrentStart).getTime() < new Date(TORRENT_START_DATE).getTime() ||
        new Date(torrentEnd).getTime() > new Date(TORRENT_END_DATE).getTime();

    // If Transmission is not present, show installation instructions along with a re-check and settings navigation button.
    if (!transmissionExists) {
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold mb-4">Transmission Daemon Not Found</h2>
                {platform === 'windows' ? (
                    <div>
                        <h3 className="font-semibold mb-2">
                            Installation Instructions for Windows:
                        </h3>
                        <ol className="list-decimal ml-6 mb-4">
                            <li>
                                In some cases, you may need to install the Microsoft Visual C++
                                Redistributable before installing Transmission. Download it from:
                                <a
                                    href="https://aka.ms/vs/17/release/vc_redist.x64.exe"
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    vc_redist.x64.exe
                                </a>
                            </li>
                            <li>Download Transmission for Windows from the official website.</li>
                            <li>
                                Run the installer to install Transmission, go through the
                                installation prompts normally. On the screen which says{' '}
                                <strong>Custom Setup</strong>, click on the icon on the left of
                                "Transmission" and select{' '}
                                <strong>
                                    "Entire feature will be installed on local hard drive."
                                </strong>
                            </li>
                            <li>
                                After installing Transmission for the first time, the toolkit may
                                request administrator access to run transmission. You might also
                                notice a brief black window that appears and then closes; this is
                                completely normal.
                            </li>
                        </ol>
                    </div>
                ) : platform === 'macos' ? (
                    <div>
                        <h3 className="font-semibold mb-2">Installation Instructions for MacOS:</h3>
                        <ol className="list-decimal ml-6 mb-4">
                            <li>
                                Install Homebrew if not already installed.{' '}
                                <button
                                    onClick={() => shell.openExternal('https://brew.sh')}
                                    className="text-blue-500 underline focus:outline-none">
                                    Open brew.sh
                                </button>
                            </li>
                            <li>
                                Run <code>brew install transmission-cli</code> in Terminal.
                            </li>
                        </ol>
                    </div>
                ) : platform === 'linux' ? (
                    <div>
                        <h3 className="font-semibold mb-2">Installation Instructions for Linux:</h3>
                        <ol className="list-decimal ml-6 mb-4">
                            <li>
                                Install Transmission daemon using your package manager, e.g. run{' '}
                                <code>sudo apt-get install transmission-daemon</code> on
                                Debian/Ubuntu.
                            </li>
                            {/* <li>
                                Configure the daemon (check the config file in{' '}
                                <code>~/.config/transmission/</code> or{' '}
                                <code>/etc/transmission-daemon/settings.json</code>).
                            </li> */}
                            <li>
                                Restart the daemon with{' '}
                                <code>sudo service transmission-daemon restart</code>.
                            </li>
                        </ol>
                    </div>
                ) : (
                    <div>
                        <p>
                            Please refer to your system documentation for installing the
                            Transmission daemon.
                        </p>
                    </div>
                )}
                <p className="mb-4">
                    If you have completed the above steps and Transmission is still not being
                    detected, please go to Settings &rarr; Transmission and update the Transmission
                    executable path in the "Path" section.
                </p>
                <div className="flex flex-col space-y-4">
                    <button
                        onClick={() =>
                            navigate(`/${SHARED_ROUTES.AUTHENTICATED_SETTINGS}?tab=transmission`, {
                                state: {
                                    from: `${location.pathname}${location.search}`
                                }
                            })
                        }
                        className="px-4 py-2 text-white bg-indigo-500 rounded hover:bg-indigo-600 focus:outline-none w-max">
                        Go to Transmission Settings
                    </button>
                    <button
                        onClick={checkTransmissionStatus}
                        disabled={checking}
                        className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none w-max">
                        {checking ? 'Checking...' : 'Check Transmission'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full">
            {/* Left half: independent scroll */}
            <div className="w-1/2 h-full overflow-y-auto p-4">
                <div className="mb-4">
                    <label className="block mb-1">Subreddit Name</label>
                    <input
                        type="text"
                        value={torrentSubreddit}
                        onChange={(e) => setTorrentSubreddit(e.target.value)}
                        placeholder="Enter exact subreddit name"
                        className="p-2 border border-gray-300 rounded w-54 lg:w-96"
                    />
                </div>
                <div className="mb-4">
                    <label className="block mb-1">Start Date</label>
                    <input
                        type="month"
                        min={TORRENT_START_DATE}
                        max={TORRENT_END_DATE}
                        value={torrentStart}
                        onChange={(e) => setTorrentStart(e.target.value)}
                        className="p-2 border border-gray-300 rounded w-54 lg:w-96"
                    />
                </div>
                <div className="mb-4">
                    <label className="block mb-1">End Date</label>
                    <input
                        type="month"
                        min={TORRENT_START_DATE}
                        max={TORRENT_END_DATE}
                        value={torrentEnd}
                        onChange={(e) => setTorrentEnd(e.target.value)}
                        className="p-2 border border-gray-300 rounded w-54 lg:w-96"
                    />
                </div>
                <div className="mb-4">
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setTorrentMode('postsAndComments')}
                            className={`px-4 py-2 rounded focus:outline-none transition-colors ${
                                torrentMode === 'postsAndComments'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}>
                            Posts + Comments
                        </button>
                        <button
                            onClick={() => setTorrentMode('posts')}
                            className={`px-4 py-2 rounded focus:outline-none transition-colors ${
                                torrentMode === 'posts'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}>
                            Posts Only
                        </button>
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block mb-2">Select Torrent</label>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setSelectedTorrentType('primary')}
                            className={`px-4 py-2 rounded focus:outline-none transition-colors ${
                                selectedTorrentType === 'primary'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}>
                            Primary Torrent
                        </button>
                        <button
                            onClick={() => setSelectedTorrentType('fallback')}
                            className={`px-4 py-2 rounded focus:outline-none transition-colors ${
                                selectedTorrentType === 'fallback'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}>
                            Fallback Torrent
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block mb-2">Download Folder</label>
                    <div className="flex">
                        <input
                            type="text"
                            value={downloadPath}
                            onChange={handleDownloadPathChange}
                            className="flex-grow p-2 border border-gray-300 rounded-l"
                            placeholder="Enter or select download folder"
                        />
                        <button
                            onClick={handleSelectFolder}
                            className="p-2 bg-blue-500 text-white rounded-r">
                            Select Folder
                        </button>
                    </div>
                    {!folderExists && <p className="text-red-500 mt-1">Folder does not exist.</p>}
                </div>
                <button
                    title={
                        torrentDisabledCheck
                            ? 'Please fill in all fields properly to load torrent data'
                            : 'Load torrent data'
                    }
                    disabled={torrentDisabledCheck}
                    onClick={handleLoadTorrent}
                    className={`px-4 py-2 text-white rounded ${!torrentDisabledCheck ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-500'}`}>
                    Load Torrent Data
                </button>
            </div>

            {/* Right half: TorrentSelectionPanel with its own scroll */}
            <div className="w-1/2 h-full overflow-y-auto p-4">
                <Suspense fallback={<div className="p-4">Loading data...</div>}>
                    <TorrentSelectionPanel
                        dataResource={dataResource}
                        selectedFilesRef={selectedFilesRef}
                    />
                </Suspense>
            </div>
        </div>
    );
};

export default TorrentDataTab;
