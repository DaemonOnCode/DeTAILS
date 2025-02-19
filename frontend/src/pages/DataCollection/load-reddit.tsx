import { FC, useEffect, useRef } from 'react';
import useRedditData from '../../hooks/DataCollection/use-reddit-data';
import RedditTableRenderer from '../../components/Shared/reddit-table-renderer';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const LoadReddit: FC = () => {
    // Destructure new context values.
    // For Reddit mode, metadata is assumed to be of type RedditMetadata.
    const { modeInput, setModeInput, metadata, metadataDispatch, type } = useCollectionContext();
    const { data, loadFolderData, error, loading } = useRedditData();
    const { saveWorkspaceData } = useWorkspaceUtils();

    console.log('type', type);

    const hasSavedRef = useRef(false);

    useEffect(() => {
        if (modeInput) {
            loadFolderData();
        }
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);
    // If the current context type is not "reddit", show an error message.
    if (type !== 'reddit') {
        return (
            <div className="p-4">
                <p className="text-red-500">
                    The current data type is not Reddit. Please switch to Reddit data from the home
                    page.
                </p>
            </div>
        );
    }

    // Toggle between "folder" and "url" mode.
    const toggleMode = () => {
        if (!metadata) return;
        // Only available in Reddit mode.
        if (metadata.type === 'reddit') {
            const newSource = metadata.source === 'url' ? 'folder' : 'url';
            metadataDispatch({ type: 'SET_SOURCE', payload: newSource });
        }
    };

    // Data is considered loaded if modeInput is nonempty.
    const isDataLoaded = Boolean(modeInput);

    if (isDataLoaded) {
        return (
            <div className="flex flex-col">
                <RedditTableRenderer data={data} loading={loading} />
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {/* Header with toggle button */}
            <header className="p-4">
                <button
                    onClick={toggleMode}
                    className="px-4 py-2 mb-4 text-white bg-blue-500 rounded hover:bg-blue-600">
                    {metadata?.source === 'url' ? 'Switch to Folder' : 'Switch to Link'}
                </button>
            </header>

            {/* Main scrollable content */}
            <main className="flex-1 min-h-0 overflow-auto p-4">
                {metadata?.source === 'url' ? (
                    // URL (Link) mode input.
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
                    // Folder mode.
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
