import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { ROUTES } from '../../constants/Coding/shared';
import UnifiedCodingPage from '../../components/Coding/UnifiedCoding/unified-coding-section';
import { useCodingContext } from '../../context/coding-context';
import TranscriptPage from '../../components/Coding/ManualCoding/post-transcript';
import TranscriptGrid from '../../components/Coding/ManualCoding/transcript-grid';

const ManualCodingPage: React.FC = () => {
    const portalContainerRef = useRef<HTMLDivElement>(document.createElement('div'));

    const navigate = useNavigate();
    const { unseenPostResponse, dispatchUnseenPostResponse, unseenPostIds } = useCodingContext();

    const [tab, setTab] = useState<'unified' | 'transcript' | 'transcripts'>('transcripts');
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

    return ReactDOM.createPortal(
        <div className="h-screen w-screen p-6 flex flex-col">
            {/* Top header with back button and tab header */}
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
                        onClick={() => setTab('transcripts')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'transcripts'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        Transcripts
                    </button>
                    <button
                        onClick={() => setTab('transcript')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'transcript'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        Manual Deductive Coding
                    </button>
                    <button
                        onClick={() => setTab('unified')}
                        className={`px-4 py-2 font-medium text-sm focus:outline-none ${
                            tab === 'unified'
                                ? 'border-b-2 border-blue-500 text-blue-500'
                                : 'text-gray-500 hover:text-blue-500'
                        }`}>
                        Split Check
                    </button>
                </div>
            </div>

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
                        manualCoding
                        onPostSelect={(id) => {
                            console.log('Post selected', id);
                            if (!id) {
                                setCurrentId(null);
                                setTab('transcripts');
                            } else {
                                setCurrentId(id);
                                setTab('transcript');
                            }
                        }}
                    />
                ) : tab === 'transcript' && currentId ? (
                    <TranscriptPage
                        id={currentId ?? ''}
                        onBack={() => {
                            setCurrentId(null);
                            setTab('transcripts');
                        }}
                    />
                ) : tab === 'transcripts' ? (
                    <div className="h-full overflow-auto">
                        <TranscriptGrid
                            postIds={unseenPostIds}
                            onPostSelect={(id) => {
                                setCurrentId(id);
                                setTab('transcript');
                            }}
                        />
                    </div>
                ) : (
                    <div>
                        <p>Select a post to continue</p>
                        <button
                            onClick={() => setTab('transcripts')}
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
