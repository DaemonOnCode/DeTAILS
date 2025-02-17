import { FC, useContext, useEffect, useRef } from 'react';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const LoadReddit: FC = () => {
    const { data, loadFolderData, error, loading } = useRedditData();
    const { toggleMode, currentMode, modeInput, setModeInput } = useCollectionContext();

    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);

    useEffect(() => {
        if (modeInput) {
            loadFolderData();
            return;
        }
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    // Check if data is loaded
    const isDataLoaded = !!modeInput;

    if (isDataLoaded) {
        // Render RedditTableRenderer when data is loaded
        return (
            <div className="flex flex-col h-page">
                <RedditTableRenderer data={data} loading={loading} />
            </div>
        );
    }

    // Render Link/Folder input when data is not loaded
    return (
        <div className="flex flex-col h-page">
            {/* Header: Toggle Button */}
            <header className="p-4">
                <button
                    onClick={toggleMode}
                    className="px-4 py-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600">
                    {currentMode === 'link' ? 'Switch to Folder' : 'Switch to Link'}
                </button>
            </header>

            {/* Main scrollable content */}
            <main className="flex-1 min-h-0 overflow-auto p-4">
                {currentMode === 'link' ? (
                    // Link Mode Input
                    <div>
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
                            className="p-2 border border-gray-300 rounded w-96 mb-4">
                            Select Folder
                        </button>
                        <div>
                            <h3>Selected Folder:</h3>
                            <p>{modeInput || 'No folder selected'}</p>
                            {error && <p className="text-red-500">{error}</p>}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default LoadReddit;
