import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { useCodingContext } from '../../context/coding-context';
import TranscriptPage from '../../components/Coding/ManualCoding/post-transcript';
import TranscriptGrid from '../../components/Coding/ManualCoding/transcript-grid';
import { useManualCodingContext } from '../../context/manual-coding-context';
import SplitCheckPage from '../../components/Coding/ManualCoding/split-check';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const ManualCodingPage: React.FC = () => {
    const portalContainerRef = useRef<HTMLDivElement>(document.createElement('div'));

    const { groupedCodes } = useCodingContext();
    const {
        postStates,
        updatePostState,
        isLoading,
        codebook,
        dispatchManualCodingResponses,
        generateCodebook
    } = useManualCodingContext();
    const hasSavedRef = useRef(false);

    const { saveWorkspaceData } = useWorkspaceUtils();

    console.log('ManualCodingPage rendered', postStates);

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

        console.log('ManualCodingPage mounted', codebook, Object.keys(codebook ?? {}).length === 0);

        // if (groupedCodes.length > 0 && Object.keys(codebook ?? {}).length === 0) {
        console.log('ManualCodingPage mounted Generating codebook', codebook);
        generateCodebook();
        // }

        return () => {
            document.body.removeChild(portalContainer);
        };
    }, []);

    const handleTabChange = async (newTab: string) => {
        setTab(newTab as typeof tab);
        if (!hasSavedRef.current) {
            hasSavedRef.current = true;
            await saveWorkspaceData();
            hasSavedRef.current = false;
        }
    };

    const postRelatedTabs = [
        { key: 'transcripts', label: 'All Posts' },
        { key: 'transcript', label: 'Manual Deductive Coding', disabled: true }
    ];

    const analysisRelatedTabs = [
        { key: 'unified', label: 'Study Analysis' },
        { key: 'splitCheck', label: 'Transcript Analysis View', disabled: true }
    ];

    return ReactDOM.createPortal(
        <div className="h-screen w-screen p-6 flex flex-col">
            <div className="flex items-center space-x-4 border-b border-gray-200 w-full">
                <button onClick={() => window.history.back()} className="text-blue-500">
                    ← <span className="underline">Back to Application</span>
                </button>
                {postRelatedTabs.map((tabItem) => (
                    <button
                        key={tabItem.key}
                        onClick={() => handleTabChange(tabItem.key)}
                        disabled={tabItem.disabled}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tabItem.key === tab
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        } ${tabItem.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {tabItem.label}
                    </button>
                ))}
                {analysisRelatedTabs.map((tabItem) => (
                    <button
                        key={tabItem.key}
                        onClick={() => handleTabChange(tabItem.key)}
                        disabled={tabItem.disabled}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tabItem.key === tab
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        } ${tabItem.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {tabItem.label}
                    </button>
                ))}
            </div>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
                    <p className="text-gray-700">Generating codebook...</p>
                </div>
            )}
            <div className="flex-1 overflow-hidden">
                {tab === 'unified' ? (
                    <UnifiedCodingPage
                        postIds={Object.keys(postStates)}
                        // data={manualCodingResponses}
                        dispatchFunction={dispatchManualCodingResponses}
                        split
                        showCodebook
                        responseTypes={['manual']}
                        showCoderType
                        showFilterDropdown
                        applyFilters
                        manualCoding
                        onPostSelect={(id) => {
                            setCurrentId(id);
                            setTab('splitCheck');
                        }}
                    />
                ) : tab === 'transcript' && currentId ? (
                    <TranscriptPage
                        id={currentId}
                        onBack={() => {
                            setCurrentId(null);
                            setTab('transcripts');
                        }}
                        postStates={postStates}
                        updatePostState={updatePostState}
                    />
                ) : tab === 'transcripts' ? (
                    <div className="h-full overflow-auto">
                        <TranscriptGrid
                            postIds={Object.keys(postStates)}
                            postStates={postStates}
                            onPostSelect={(id) => {
                                setCurrentId(id);
                                setTab('transcript');
                            }}
                        />
                    </div>
                ) : tab === 'splitCheck' && currentId ? (
                    <SplitCheckPage
                        id={currentId}
                        onBack={() => {
                            setCurrentId(null);
                            setTab('unified');
                        }}
                    />
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
