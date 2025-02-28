import { RefObject, Suspense } from 'react';
import { SetState } from '../../types/Coding/shared';
import TorrentSelectionPanel from './torrent-selection-panel';
import { createResource } from '../../utility/resource-creator';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { TorrentFilesSelectedState } from '../../types/DataCollection/shared';

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
    const { getServerUrl } = useServerUtils();

    const fetchTorrentData = async () => {
        const res = fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_ALL_TORRENT_DATA));
        const data = await (await res).json();
        return data;
        // return new Promise((resolve) => {
        //     setTimeout(() => {
        //         resolve({
        //             uwaterloo: {
        //                 posts: {
        //                     '2018': ['11', '12'],
        //                     '2019': ['1', '2', '3', '11', '12'],
        //                     '2020': ['1', '2', '3', '11', '12'],
        //                     '2021': ['1', '2', '3', '11', '12']
        //                 },
        //                 comments: {}
        //             },
        //             games: {
        //                 posts: {
        //                     '2018': ['11', '12'],
        //                     '2019': ['1', '2', '3', '11', '12']
        //                 },
        //                 comments: {
        //                     '2018': ['11', '12'],
        //                     '2019': ['1', '2', '3', '11', '12'],
        //                     '2020': ['1', '2', '3', '11', '12'],
        //                     '2021': ['1', '2', '3', '11', '12']
        //                 }
        //             }
        //         });
        //     }, 1000);
        // });
    };

    const dataResource = createResource(fetchTorrentData());
    return (
        // Outer container takes full viewport height.
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
