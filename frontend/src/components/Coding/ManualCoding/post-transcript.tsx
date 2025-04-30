import { useRef, useEffect, useState, useCallback, useImperativeHandle } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCollectionContext } from '../../../context/collection-context';
import { useLogger } from '../../../context/logging-context';
import useWorkspaceUtils from '../../../hooks/Shared/workspace-utils';
import { createTimer } from '../../../utility/timer';
import TopToolbar from '../Shared/top-toolbar';
import PostTranscript from '../CodingTranscript/post-transcript';
import { TranscriptContextProvider } from '../../../context/transcript-context';
import { useApi } from '../../../hooks/Shared/use-api';
import { useManualCodingContext } from '../../../context/manual-coding-context';

const TranscriptPage = ({
    id,
    onBack
}: {
    id: string;
    onBack: () => void;
    postStates: {
        [postId: string]: boolean;
    };
    updatePostState: (postId: string, state: boolean) => void;
}) => {
    const {
        manualCodingResponses,
        dispatchManualCodingResponses,
        codebook,
        updatePostState,
        postStates
    } = useManualCodingContext();
    const { datasetId } = useCollectionContext();
    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();
    const hasSavedRef = useRef(false);
    const refetchRef = useRef<any>(null);
    const { fetchData } = useApi();

    const currentConfig: {
        name: string;
        review: boolean;
        codebook: {
            responses: any[];
            dispatchFunction: (...args: any) => void;
            showThemes?: boolean;
        } | null;
        topTranscript: {
            responses: any[];
            dispatchFunction: (...args: any) => void;
            conflicts?: any[];
        } | null;
        bottomTranscript: {
            responses: any[];
            dispatchFunction: (...args: any) => void;
            conflicts?: any[];
        };
    } = {
        name: 'Refine',
        review: false,
        codebook: {
            responses: manualCodingResponses,
            dispatchFunction: (...args: any) => {
                console.log('Dispatching to Review with codebook:', args);
            }
        },
        topTranscript: null,
        bottomTranscript: {
            responses: manualCodingResponses.filter((response) => response.type === 'Human'),
            dispatchFunction: (...args: any) => {
                console.log('Dispatching to Refine:', args);
                let value =
                    args[0].type === 'ADD_RESPONSE'
                        ? {
                              type: 'ADD_RESPONSE',
                              response: {
                                  ...args[0].response,
                                  type: 'Human'
                              }
                          }
                        : { ...args[0] };
                return dispatchManualCodingResponses(
                    {
                        ...value
                    },
                    // @ts-ignore
                    refetchRef
                );
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

    const _selectionRef = useRef<Range | null>(null);

    const [codeResponses, setCodeResponses] = useState([]);
    const [codebookCodes, setCodebookCodes] = useState([]);

    const fetchPostById = async (postId: string, datasetId: string, showLoading = true) => {
        console.log('Fetching post:', postId, datasetId);
        if (!postId || !datasetId) return;
        if (showLoading) {
            setLoading(true);
        }
        try {
            const { data: fetchedPost, error } = await fetchData<{
                post: any;
                responses: any[];
                allCodes: string[];
            }>(REMOTE_SERVER_ROUTES.GET_POST_TRANSCRIPT_DATA, {
                method: 'POST',
                body: JSON.stringify({ postId, manualCoding: true })
            });
            if (error) {
                console.error('Error fetching post:', error);
                return;
            }
            console.log('Fetched post:', fetchedPost);
            setPost(fetchedPost.post);
            setCodeResponses(fetchedPost.responses);
            setCodebookCodes(fetchedPost.allCodes);
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    };

    const allClearedToLeaveRef = useRef<{ check: boolean } | null>(null);

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

    useImperativeHandle(
        refetchRef,
        () => ({
            refresh: () => {
                if (id && datasetId) {
                    fetchPostById(id, datasetId, false);
                }
            }
        }),
        [id, datasetId]
    );

    const dispatchAndRefetch = useCallback(
        (...args: any[]) => {
            console.log('Dispatching and refetching:', args);
            return currentConfig?.bottomTranscript?.dispatchFunction!(...args);
        },
        [currentConfig, refetchRef]
    );

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

    const humanResponses = codeResponses.filter((r) => r.responseType === 'Human');

    return (
        <div className="h-full w-full flex flex-col min-h-0">
            <div className="flex flex-col flex-1 min-h-0">
                <TopToolbar
                    selectedPost={post}
                    setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                    selectionRefArray={[_selectionRef]}
                    setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                    setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                    setIsHighlightModalOpen={setIsHighlightModalOpen}
                    setIsEditHighlightCodeModalOpen={setIsEditHighlightModalOpen}
                    setIsDeleteHighlightCodeModalOpen={setDeleteIsHighlightModalOpen}
                    showCodebookButton={true}
                    showCodebook={showCodebook}
                    activeTranscript={'human'}
                    onShowCodebook={() => {
                        setShowCodebook((prev) => !prev);
                    }}
                    manualCoding
                    isDone={postStates[id]}
                    showDoneButton
                    onDoneClick={() => {
                        updatePostState(id, !postStates[id]);
                    }}
                />

                {showCodebook && (
                    <div
                        className="h-2/5 max-h-2/5 overflow-auto min-h-0"
                        onClick={(e) => handleSetActiveTranscript(e, null)}>
                        <div
                            className={`p-4 m-4 ${
                                activeTranscript === 'top'
                                    ? 'border-4 border-blue-500 rounded-md'
                                    : 'border border-gray-200 rounded-md'
                            }`}
                            onClick={(e) => handleSetActiveTranscript(e, 'top')}>
                            <table className="w-full relative border-separate border-spacing-0">
                                <thead className="sticky top-0 z-30 bg-gray-100">
                                    <tr>
                                        <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                            Code
                                        </th>
                                        <th className="p-2 bg-gray-100 border border-gray-300 outline outline-1 outline-gray-300">
                                            Definition
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {Object.entries(codebook ?? {}).map(([key, value]) => (
                                        <tr key={key}>
                                            <td className="p-2 border border-gray-300">{key}</td>
                                            <td className="p-2 border border-gray-300">{value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                <div
                    className={`${showCodebook ? '' : 'h-full'} flex-1 overflow-auto min-h-0 p-4 m-4 ${
                        activeTranscript === 'bottom'
                            ? 'border-4 border-blue-500 rounded-md'
                            : 'border border-gray-200 rounded-md'
                    }`}
                    onClick={(e) => handleSetActiveTranscript(e, 'bottom')}>
                    <TranscriptContextProvider
                        postId={id ?? ''}
                        review={currentConfig.review}
                        codeResponses={humanResponses ?? []}>
                        <PostTranscript
                            post={post}
                            codebookCodes={codebookCodes}
                            clearedToLeaveRef={allClearedToLeaveRef}
                            onBack={onBack}
                            _selectionRef={_selectionRef}
                            review={currentConfig.review}
                            codeResponses={humanResponses ?? []}
                            isActive={true}
                            extraCodes={Object.keys(codebook ?? {})}
                            dispatchCodeResponse={dispatchAndRefetch}
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
                            manualCoding
                            showAddCodeinHighlight={false}
                        />
                    </TranscriptContextProvider>
                </div>
            </div>
        </div>
    );
};

export default TranscriptPage;
