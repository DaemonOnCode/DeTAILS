import { useRef, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCodingContext } from '../../../context/coding-context';
import { useCollectionContext } from '../../../context/collection-context';
import { useLogger } from '../../../context/logging-context';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import useWorkspaceUtils from '../../../hooks/Shared/workspace-utils';
import { createTimer } from '../../../utility/timer';
import TopToolbar from '../Shared/top-toolbar';
import PostTranscript from '../CodingOverview/post-transcript';
import ValidationTable from '../UnifiedCoding/validation-table';

const TranscriptPage = ({ id }: { id: string }) => {
    const {
        unseenPostResponse,
        dispatchUnseenPostResponse,
        sampledPostResponse,
        dispatchSampledPostResponse
    } = useCodingContext();
    const { datasetId } = useCollectionContext();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const { getServerUrl } = useServerUtils();
    const hasSavedRef = useRef(false);

    const currentConfig = {
        name: 'Refine',
        review: false,
        codebook: {
            responses: sampledPostResponse,
            dispatchFunction: (...args: any) => {
                console.log('Dispatching to Review with codebook:', args);
                dispatchSampledPostResponse({
                    type: 'SET_RESPONSES',
                    responses: args[0]
                });
            }
        },
        topTranscript: {
            responses: unseenPostResponse.filter((response) => response.type === 'Human'),
            dispatchFunction: (...args: any) => {
                console.log('Dispatching to Refine (top transcript):', args);
                dispatchUnseenPostResponse({
                    ...args[0],
                    responseType: 'Human'
                });
            },
            conflicts: []
        },
        bottomTranscript: {
            responses: unseenPostResponse.filter((response) => response.type === 'Human'),
            dispatchFunction: (...args: any) => {
                console.log('Dispatching to Refine (bottom transcript):', args);
                dispatchUnseenPostResponse({
                    ...args[0],
                    responseType: 'Human'
                });
            },
            conflicts: []
        }
    };

    const [post, setPost] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCodebook, setShowCodebook] = useState(false);

    const [activeTranscript, setActiveTranscript] = useState<'top' | 'bottom' | null>('bottom');
    const [selectedText, setSelectedText] = useState<string | null>(null);

    const [isAddCodeModalOpen, setIsAddCodeModalOpen] = useState(false);
    const [isEditCodeModalOpen, setIsEditCodeModalOpen] = useState(false);
    const [isDeleteCodeModalOpen, setIsDeleteCodeModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [isEditHighlightModalOpen, setIsEditHighlightModalOpen] = useState(false);
    const [isDeleteHighlightModalOpen, setDeleteIsHighlightModalOpen] = useState(false);

    const fetchPostById = async (postId: string, datasetId: string) => {
        if (!postId || !datasetId) return;
        setLoading(true);
        try {
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_REDDIT_POST_BY_ID), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, datasetId })
            });
            const fetchedPost = await res.json();
            setPost(fetchedPost);
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = createTimer();
        logger.info('Transcript Page Loaded');
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
            logger.info('Transcript Page Unloaded').then(() => {
                logger.time('Transcript Page stay time', { time: timer.end() });
            });
        };
    }, []);

    useEffect(() => {
        if (id) {
            fetchPostById(id, datasetId);
        }
    }, [id, datasetId]);

    const handleSetActiveTranscript = (
        e: React.MouseEvent<HTMLDivElement>,
        position: 'top' | 'bottom' | null
    ) => {
        e.stopPropagation();
        console.log('position:', position, e);
        if (showCodebook && position === 'top') {
            setActiveTranscript(null);
            return;
        }
        setActiveTranscript(position);
    };

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col justify-center items-center">
                <p>Loading transcript...</p>
                <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="w-full h-full flex justify-center items-center">
                <p>Post not found</p>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex-1 overflow-auto">
                <div className="flex flex-col h-full">
                    <TopToolbar
                        selectedPost={post}
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                        setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setIsEditHighlightCodeModalOpen={setIsEditHighlightModalOpen}
                        setIsDeleteHighlightCodeModalOpen={setDeleteIsHighlightModalOpen}
                        showCodebookButton={true}
                        showCodebook={showCodebook}
                        activeTranscript={
                            'human'
                            // activeTranscript === 'top'
                            //     ? 'human'
                            //     : activeTranscript === 'bottom'
                            //       ? 'llm'
                            //       : null
                        }
                        onShowCodebook={() => {
                            // setActiveTranscript(null);
                            setShowCodebook((prev) => !prev);
                        }}
                    />
                    {/* 
                    <div
                        className={`'h-full flex flex-col`}
                        onClick={(e) => handleSetActiveTranscript(e, null)}>
                        <div
                            className={`h-1/2 overflow-auto 
                                    
            p-4 m-4
            ${
                activeTranscript === 'top'
                    ? 'border-4 border-blue-500 rounded-md'
                    : 'border border-gray-200 rounded-md'
            }
                                `}
                            onClick={(e) => handleSetActiveTranscript(e, 'top')}>
                            {showCodebook ? (
                                <>
                                    <ValidationTable
                                        dispatchCodeResponses={
                                            currentConfig?.codebook?.dispatchFunction as any
                                        }
                                        codeResponses={currentConfig?.codebook?.responses ?? []}
                                        onViewTranscript={() => {}}
                                        review
                                        // showThemes
                                        onReRunCoding={() => {}}
                                        onUpdateResponses={
                                            currentConfig?.codebook?.dispatchFunction as any
                                        }
                                    />
                                </>
                            ) : (
                                <PostTranscript
                                    post={post}
                                    onBack={() => window.history.back()}
                                    codeResponses={currentConfig?.topTranscript?.responses ?? []}
                                    isActive={activeTranscript === 'top'}
                                    dispatchCodeResponse={
                                        currentConfig?.topTranscript?.dispatchFunction as any
                                    }
                                    conflictingCodes={currentConfig?.topTranscript?.conflicts}
                                    review={false}
                                    selectedText={selectedText}
                                    setSelectedText={setSelectedText}
                                    isAddCodeModalOpen={isAddCodeModalOpen}
                                    isEditCodeModalOpen={isEditCodeModalOpen}
                                    isDeleteCodeModalOpen={isDeleteCodeModalOpen}
                                    isHighlightModalOpen={isHighlightModalOpen}
                                    isEditHighlightModalOpen={isEditHighlightModalOpen}
                                    isDeleteHighlightModalOpen={isDeleteHighlightModalOpen}
                                    setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                                    setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                                    setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                                    setIsHighlightModalOpen={setIsHighlightModalOpen}
                                    setIsEditHighlightModalOpen={setIsEditHighlightModalOpen}
                                    setDeleteIsHighlightModalOpen={setDeleteIsHighlightModalOpen}
                                />
                            )}
                        </div> */}

                    <div
                        className={`h-full overflow-auto 
            p-4 m-4
            ${
                activeTranscript === 'bottom'
                    ? 'border-4 border-blue-500 rounded-md'
                    : 'border border-gray-200 rounded-md'
            }`}
                        onClick={(e) => handleSetActiveTranscript(e, 'bottom')}>
                        <PostTranscript
                            post={post}
                            onBack={() => window.history.back()}
                            review={currentConfig.review}
                            codeResponses={currentConfig.bottomTranscript.responses ?? []}
                            isActive={true}
                            dispatchCodeResponse={currentConfig.bottomTranscript.dispatchFunction}
                            conflictingCodes={currentConfig.bottomTranscript.conflicts}
                            selectedText={selectedText}
                            setSelectedText={setSelectedText}
                            isAddCodeModalOpen={isAddCodeModalOpen}
                            isEditCodeModalOpen={isEditCodeModalOpen}
                            isDeleteCodeModalOpen={isDeleteCodeModalOpen}
                            isHighlightModalOpen={isHighlightModalOpen}
                            isEditHighlightModalOpen={isEditHighlightModalOpen}
                            isDeleteHighlightModalOpen={isDeleteHighlightModalOpen}
                            setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                            setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                            setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                            setIsHighlightModalOpen={setIsHighlightModalOpen}
                            setIsEditHighlightModalOpen={setIsEditHighlightModalOpen}
                            setDeleteIsHighlightModalOpen={setDeleteIsHighlightModalOpen}
                        />
                    </div>
                </div>
            </div>
        </div>
        // </div>
    );
};

export default TranscriptPage;
