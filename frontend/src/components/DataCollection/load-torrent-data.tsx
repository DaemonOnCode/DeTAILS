import { RefObject, Suspense, useEffect, useState } from 'react';
import { SetState } from '../../types/Coding/shared';
import TorrentSelectionPanel from './torrent-selection-panel';
import { createResource } from '../../utility/resource-creator';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCollectionContext } from '../../context/collection-context';

// Use Electron's shell API to open external links.
const { shell } = window.require('electron');

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
    selectedFilesRef
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
}) => {
    const location = useLocation();
    const { getServerUrl } = useServerUtils();
    const [transmissionExists, setTransmissionExists] = useState<boolean | null>(null);
    const [checking, setChecking] = useState<boolean>(false);
    const navigate = useNavigate();
    const { type } = useCollectionContext();

    // Function to check Transmission status.
    const checkTransmissionStatus = async () => {
        setChecking(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.CHECK_TRANSMISSION));
            const data = await res.json();
            setTransmissionExists(data.exists);
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

    // If Transmission is not present, show installation instructions along with a re-check and settings navigation button.
    if (!transmissionExists) {
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold mb-4">Transmission Daemon Not Found</h2>
                {platform === 'windows' ? (
                    <div>
                        <h3 className="font-semibold mb-2">Windows Installation Instructions:</h3>
                        <ol className="list-decimal ml-6 mb-4">
                            <li>Download Transmission for Windows from the official website.</li>
                            <li>Run the installer to install the daemon.</li>
                            <li>
                                Configure the Transmission settings (e.g. configuration directory)
                                as needed.
                            </li>
                        </ol>
                    </div>
                ) : platform === 'macos' ? (
                    <div>
                        <h3 className="font-semibold mb-2">macOS Installation Instructions:</h3>
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
                        <h3 className="font-semibold mb-2">Linux Installation Instructions:</h3>
                        <ol className="list-decimal ml-6 mb-4">
                            <li>
                                Install Transmission daemon using your package manager, e.g. run{' '}
                                <code>sudo apt-get install transmission-daemon</code> on
                                Debian/Ubuntu.
                            </li>
                            <li>
                                Configure the daemon (check the config file in{' '}
                                <code>~/.config/transmission/</code> or{' '}
                                <code>/etc/transmission-daemon/settings.json</code>).
                            </li>
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

    // Otherwise, show the normal Torrent Data UI.
    const fetchTorrentData = async () => {
        const res = fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_ALL_TORRENT_DATA));
        const data = await (await res).json();
        return data;
    };

    const dataResource = createResource(fetchTorrentData());
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
                        placeholder="Enter subreddit name"
                        className="p-2 border border-gray-300 rounded w-54 lg:w-96"
                    />
                </div>
                <div className="mb-4">
                    <label className="block mb-1">Start Date</label>
                    <input
                        type="date"
                        value={torrentStart}
                        onChange={(e) => setTorrentStart(e.target.value)}
                        className="p-2 border border-gray-300 rounded w-54 lg:w-96"
                    />
                </div>
                <div className="mb-4">
                    <label className="block mb-1">End Date</label>
                    <input
                        type="date"
                        value={torrentEnd}
                        onChange={(e) => setTorrentEnd(e.target.value)}
                        className="p-2 border border-gray-300 rounded w-54 lg:w-96"
                    />
                </div>
                <div className="mb-4">
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setTorrentMode('posts')}
                            className={`px-4 py-2 rounded focus:outline-none transition-colors ${
                                torrentMode === 'posts'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}>
                            Posts Only
                        </button>
                        <button
                            onClick={() => setTorrentMode('postsAndComments')}
                            className={`px-4 py-2 rounded focus:outline-none transition-colors ${
                                torrentMode === 'postsAndComments'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}>
                            Posts + Comments
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleLoadTorrent}
                    className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600">
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
