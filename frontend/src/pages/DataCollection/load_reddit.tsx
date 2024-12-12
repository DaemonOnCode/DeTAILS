import { FC, useContext, useEffect } from 'react';
import useRedditData from '../../hooks/Home/use_reddit_data';
import RedditTableRenderer from '../../components/Shared/reddit_table_renderer';
import { useCollectionContext } from '../../context/collection_context';

const LoadReddit: FC = () => {
    const { data, loadFolderData, error } = useRedditData();
    const { toggleMode, currentMode, modeInput, setModeInput } = useCollectionContext();

    useEffect(() => {
        if (modeInput) {
            loadFolderData();
            return;
        }
    }, []);

    // Check if data is loaded
    const isDataLoaded = !!modeInput;

    if (isDataLoaded) {
        // Render RedditTableRenderer when data is loaded
        return (
            <div className="flex flex-col h-full">
                <RedditTableRenderer data={data} />
            </div>
        );
    }

    // Render Link/Folder input when data is not loaded
    return (
        <div className="flex flex-col h-full">
            {/* Toggle Button for Link/Folder Mode */}
            <button
                onClick={toggleMode}
                className="px-4 py-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600">
                {currentMode === 'link' ? 'Switch to Folder' : 'Switch to Link'}
            </button>

            {currentMode === 'link' ? (
                // Link Mode Input
                <div className="h-full">
                    <input
                        type="text"
                        value={modeInput}
                        onChange={(e) => setModeInput(e.target.value)}
                        placeholder="Type or paste text with URLs here"
                        className="p-2 border border-gray-300 rounded w-96"
                    />
                </div>
            ) : (
                // Folder Mode
                <div>
                    <button
                        onClick={() => loadFolderData(true, true)}
                        className="p-2 border border-gray-300 rounded w-96">
                        Select Folder
                    </button>
                    <div>
                        <h3>Selected Folder:</h3>
                        <p>{modeInput || 'No folder selected'}</p>
                        {error && <p className="text-red-500">{error}</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoadReddit;
