import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { ROUTES } from '../../constants/Coding/shared';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { useCodingContext } from '../../context/coding-context';
import TranscriptPage from '../../components/Coding/ManualCoding/post-transcript';
import TranscriptGrid from '../../components/Coding/ManualCoding/transcript-grid';
import { useManualCodingContext } from '../../context/manual-coding-context'; // Import the context hook

const ManualCodingPage: React.FC = () => {
    const portalContainerRef = useRef<HTMLDivElement>(document.createElement('div'));

    const navigate = useNavigate();
    const { unseenPostResponse, dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();
    const { postStates, addPostIds, updatePostState, isLoading, codebook } =
        useManualCodingContext(); // Access ManualCodingContext

    const [tab, setTab] = useState<'unified' | 'transcript' | 'transcripts' | 'splitCheck'>(
        'transcripts'
    );
    const [currentId, setCurrentId] = useState<string | null>(null);

    useEffect(() => {
        const portalContainer = portalContainerRef.current;
        portalContainer.style.position = 'fixed';
        portalContainer.style.top = '0';
        portalContainer.style.left = '0';
        portalContainer.style.width = '100vw';
        portalContainer.style.height = '100vh';
        portalContainer.style.zIndex = '100';
        portalContainer.style.background = '#ffffff';

        document.body.appendChild(portalContainer);

        return () => {
            document.body.removeChild(portalContainer);
        };
    }, []);

    // Sync unseenPostIds with ManualCodingContext when they change
    useEffect(() => {
        if (unseenPostIds.length > 0) {
            addPostIds(unseenPostIds); // Add new post IDs to the context
        }
    }, [unseenPostIds, addPostIds]);

    // Handler for tab switching
    const handleTabChange = (newTab: 'unified' | 'transcript' | 'transcripts' | 'splitCheck') => {
        setTab(newTab);
        if (newTab !== 'transcript') {
            setCurrentId(null);
        }
    };

    return ReactDOM.createPortal(
        <div className="h-screen w-screen p-6 flex flex-col">
            {/* Header with navigation */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex space-x-4 border-b border-gray-200 w-full">
                    <button
                        onClick={() =>
                            navigate(`/${SHARED_ROUTES.CODING}/${ROUTES.DEDUCTIVE_CODING}`)
                        }
                        className="text-blue-500">
                        ← <span className="underline">Back to Application</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('transcripts')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'transcripts'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        All Posts
                    </button>
                    <button
                        onClick={() => handleTabChange('transcript')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'transcript'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        Manual Deductive Coding
                    </button>
                    <button
                        onClick={() => handleTabChange('unified')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'unified'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        Study Analysis
                    </button>
                    <button
                        onClick={() => handleTabChange('splitCheck')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'splitCheck'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        Transcript Analysis View
                    </button>
                </div>
            </div>

            {/* Loading overlay when codebook is being created */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
                    <p className="text-gray-700">Loading codebook...</p>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
                {tab === 'unified' ? (
                    <UnifiedCodingPage
                        postIds={unseenPostIds}
                        data={unseenPostResponse}
                        dispatchFunction={dispatchUnseenPostResponse}
                        split
                        showCodebook
                        showCoderType
                        showFilterDropdown
                        applyFilters
                        manualCoding
                        onPostSelect={(id) => {
                            if (id) {
                                setCurrentId(id);
                                setTab('transcript');
                            } else {
                                setCurrentId(null);
                                setTab('transcripts');
                            }
                        }}
                    />
                ) : tab === 'transcript' && currentId ? (
                    <TranscriptPage
                        id={currentId}
                        onBack={() => {
                            setCurrentId(null);
                            setTab('transcripts');
                        }}
                        postStates={postStates} // Pass post states
                        updatePostState={updatePostState} // Pass function to update state
                    />
                ) : tab === 'transcripts' ? (
                    <div className="h-full overflow-auto">
                        <TranscriptGrid
                            postIds={unseenPostIds}
                            postStates={postStates} // Pass post states
                            onPostSelect={(id) => {
                                setCurrentId(id);
                                setTab('transcript');
                            }}
                        />
                    </div>
                ) : tab === 'splitCheck' ? (
                    <></> // Placeholder for SplitCheckPage
                ) : (
                    <div>
                        <p>Select a post to continue</p>
                        <button
                            onClick={() => handleTabChange('transcripts')}
                            className="text-blue-500 underline">
                            Go back to Transcripts page
                        </button>
                    </div>
                )}
            </div>
        </div>,
        portalContainerRef.current
    );
};

export default ManualCodingPage;
