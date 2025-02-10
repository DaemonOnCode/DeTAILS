import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import PostTranscript from '../../components/Coding/CodingOverview/post-transcript';
import TopToolbar from '../../components/Coding/Shared/top-toolbar';
import ValidationTable from '../../components/Coding/UnifiedCoding/validation-table';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../context/collection-context';

const TranscriptPage = () => {
    const { id, state } = useParams<{ id: string; state: 'review' | 'refine' }>();
    const [searchParams] = useSearchParams();
    const split = searchParams.get('split');
    const codebook = searchParams.get('codebook');
    const type = searchParams.get('type');
    console.log(searchParams, split, codebook, type);

    const splitIsTrue = split === 'true';
    const codebookIsTrue = codebook === 'true';
    const splitCodebook = !(codebookIsTrue && !splitIsTrue);

    const {
        unseenPostResponse,
        dispatchUnseenPostResponse,
        sampledPostResponse,
        dispatchSampledPostResponse,
        sampledPostWithThemeResponse,
        dispatchSampledPostWithThemeResponse,
        conflictingResponses,
        setConflictingResponses
    } = useCodingContext();

    const { datasetId } = useCollectionContext();

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
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

    const config = new Map<
        string,
        {
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
        }
    >([
        [
            JSON.stringify({
                state: 'review',
                codebook: 'true',
                type: null,
                split: null
            }),
            {
                name: 'Review',
                review: true,
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
                topTranscript: null,
                bottomTranscript: {
                    responses: sampledPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'review',
                codebook: 'false',
                type: null,
                split: null
            }),
            {
                name: 'Review',
                review: true,
                codebook: null,
                topTranscript: null,
                bottomTranscript: {
                    responses: sampledPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'review',
                codebook: 'true',
                type: null,
                split: 'false'
            }),
            {
                name: 'Review',
                review: true,
                codebook: {
                    responses: sampledPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: unseenPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'true',
                type: null,
                split: null
            }),
            {
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
                topTranscript: null,
                bottomTranscript: {
                    responses: sampledPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'false',
                type: null,
                split: null
            }),
            {
                name: 'Refine',
                review: false,
                codebook: {
                    responses: sampledPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            // type: 'SET_RESPONSES',
                            // responses: args[0]
                            ...args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: sampledPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchSampledPostResponse({
                            // type: 'SET_RESPONSES',
                            // responses: args?.map((response: any) => ({
                            //     ...response
                            //     // type: 'Human'
                            // }))
                            ...args[0]
                        });
                    },
                    conflicts: conflictingResponses
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'true',
                type: 'Human',
                split: null
            }),
            {
                name: 'Refine',
                review: false,
                codebook: {
                    responses: unseenPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: unseenPostResponse.filter((response) => response.type === 'Human'),
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
                                : {
                                      ...args[0]
                                  };
                        dispatchUnseenPostResponse({
                            ...value
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'true',
                type: 'LLM',
                split: null
            }),
            {
                name: 'Refine',
                review: false,
                codebook: {
                    responses: unseenPostResponse,
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: unseenPostResponse.filter((response) => response.type === 'LLM'),
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        let value =
                            args[0].type === 'ADD_RESPONSE'
                                ? {
                                      type: 'ADD_RESPONSE',
                                      response: {
                                          ...args[0].response,
                                          type: 'LLM'
                                      }
                                  }
                                : {
                                      ...args[0]
                                  };
                        dispatchUnseenPostResponse({
                            ...value
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'true',
                type: null,
                split: 'true'
            }),
            {
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
                        console.log('Dispatching to Refine:', args);
                        dispatchUnseenPostResponse({
                            ...args[0],
                            responseType: 'Human'
                        });
                    }
                },
                bottomTranscript: {
                    responses: unseenPostResponse.filter((response) => response.type === 'LLM'),
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchUnseenPostResponse({
                            ...args[0],
                            responseType: 'LLM'
                        });
                    }
                }
            }
        ]
    ]);

    const currentConfig = config.get(
        JSON.stringify({
            state: state ?? 'review',
            codebook: (codebook ?? 'false') as 'true' | 'false',
            type,
            split
        })
    );

    console.log('Current config:', currentConfig, {
        state: state ?? 'review',
        codebook: (codebook ?? 'false') as 'true' | 'false',
        type,
        split
    });

    console.log(
        config.keys(),
        Array.from(config.keys()).forEach((key) =>
            console.log(
                key,
                JSON.stringify({
                    state: state ?? 'review',
                    codebook: (codebook ?? 'false') as 'true' | 'false',
                    type,
                    split
                }),
                key ===
                    JSON.stringify({
                        state: state ?? 'review',
                        codebook: (codebook ?? 'false') as 'true' | 'false',
                        type,
                        split
                    })
            )
        )
    );

    const [post, setPost] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCodebook, setShowCodebook] = useState(false);

    const [isAddCodeModalOpen, setIsAddCodeModalOpen] = useState(false);
    const [isEditCodeModalOpen, setIsEditCodeModalOpen] = useState(false);
    const [isDeleteCodeModalOpen, setIsDeleteCodeModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [isEditHighlightModalOpen, setIsEditHighlightModalOpen] = useState(false);
    const [isDeleteHighlightModalOpen, setDeleteIsHighlightModalOpen] = useState(false);

    const [activeTranscript, setActiveTranscript] = useState<'top' | 'bottom' | null>(
        splitIsTrue ? null : 'bottom'
    );

    const [selectedText, setSelectedText] = useState<string | null>(null);

    // const [responses, setResponses] = useState<any[]>([
    //     ...llmCodeResponses,
    //     ...humanCodeResponses
    // ]);

    const handleSetActiveTranscript = (
        e: React.MouseEvent<HTMLDivElement>,
        position: 'top' | 'bottom' | null
    ) => {
        e.stopPropagation(); // Prevent the click from bubbling to the outer container
        console.log('position:', position, e);
        if (showCodebook && position === 'top') {
            setActiveTranscript(null);
            return;
        }
        setActiveTranscript(position);
    };

    const { getServerUrl } = useServerUtils();

    const handleUpdateResponses = (updatedResponses: any[]) => {
        console.log('Updated responses:', updatedResponses);
        dispatchUnseenPostResponse({
            type: 'SET_RESPONSES',
            responses: updatedResponses
        });
    };

    const fetchPostById = async (postId: string, datasetId: string) => {
        console.log('Fetching post:', postId, datasetId);
        if (!postId || !datasetId) return;
        setLoading(true);
        try {
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_REDDIT_POST_BY_ID), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ postId, datasetId })
            });
            const fetchedPost = await res.json();
            console.log('Fetched post:', fetchedPost);
            setPost(fetchedPost);
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('ID:', id);

        if (id) {
            fetchPostById(id, datasetId);
        }
    }, [id, datasetId]);

    useEffect(() => {
        console.log(activeTranscript);
    }, [activeTranscript]);

    if (loading) {
        return <div>Loading transcript...</div>;
    }

    if (!post) {
        return <div>Post not found</div>;
    }

    // const humanCodeResponses = unseenPostResponse.filter((response) => response.type === 'Human');

    // const llmCodeResponses = unseenPostResponse.filter((response) => response.type === 'LLM');

    // // const filteredData = unseenPostWithThemeData;

    // const [topTranscript, bottomTranscript] = splitIsTrue ? ['Human', 'LLM'] : [null, type];

    return (
        <div className="h-page flex flex-col -m-6">
            {/* {splitIsTrue ? (
                <div className="flex justify-center p-3">
                    <button className="bg-blue-500 text-white rounded px-4 py-2">Split View</button>
                </div>
            ) : ( */}
            <>
                {state === 'refine' && (
                    <TopToolbar
                        selectedPost={post}
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                        setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                        setIsEditHighlightCodeModalOpen={setIsEditHighlightModalOpen}
                        setIsDeleteHighlightCodeModalOpen={setDeleteIsHighlightModalOpen}
                        showCodebookButton={true}
                        showCodebook={showCodebook}
                        activeTranscript={
                            activeTranscript === 'top'
                                ? (currentConfig?.topTranscript?.responses as any)
                                : activeTranscript === 'bottom'
                                  ? (currentConfig?.bottomTranscript.responses as any)
                                  : null
                        }
                        onShowCodebook={() => {
                            // handleSetActiveTranscript(e, null);
                            setActiveTranscript(null);
                            setShowCodebook((prev) => !prev);
                        }}
                    />
                )}
                {showCodebook && !splitIsTrue && (
                    <div className="h-[40%] overflow-auto border-b border-gray-300 p-4 m-6">
                        <ValidationTable
                            dispatchCodeResponses={currentConfig?.codebook?.dispatchFunction as any}
                            codeResponses={currentConfig?.codebook?.responses ?? []}
                            onViewTranscript={() => {}}
                            review={currentConfig?.review ?? true}
                            showThemes={currentConfig?.codebook?.showThemes}
                            onReRunCoding={() => {}}
                            onUpdateResponses={currentConfig?.codebook?.dispatchFunction as any}
                        />
                    </div>
                )}

                <div
                    className={`${!splitCodebook ? 'h-[60%]' : 'h-full'} flex-1 flex flex-col overflow-hidden`}
                    onClick={(e) => handleSetActiveTranscript(e, null)}>
                    {codebookIsTrue && state === 'review' && (
                        <div className="flex justify-center p-3">
                            <button
                                className="bg-blue-500 text-white rounded px-4 py-2"
                                onClick={() => setShowCodebook((prev) => !prev)}>
                                {showCodebook ? 'Hide Codebook' : 'Show Codebook'}
                            </button>
                        </div>
                    )}

                    <div
                        className={`${codebookIsTrue && state === 'review' ? 'h-[85%]' : 'h-full'} flex flex-col`}>
                        {splitIsTrue && (
                            <div
                                className={`h-1/2 overflow-auto ${
                                    splitIsTrue &&
                                    `
            p-4 m-4
            ${
                activeTranscript === 'top'
                    ? 'border-4 border-blue-500 rounded-md'
                    : 'border border-gray-200 rounded-md'
            }`
                                }`}
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
                                        codeResponses={
                                            currentConfig?.topTranscript?.responses ?? []
                                        }
                                        isActive={activeTranscript === 'top'}
                                        dispatchCodeResponse={
                                            currentConfig?.topTranscript?.dispatchFunction as any
                                        }
                                        conflictingCodes={currentConfig?.topTranscript?.conflicts}
                                        review={state === 'review'}
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
                                        setDeleteIsHighlightModalOpen={
                                            setDeleteIsHighlightModalOpen
                                        }
                                    />
                                )}
                            </div>
                        )}
                        <div
                            className={`${splitIsTrue ? 'h-1/2' : 'h-full'} overflow-auto 
                            ${
                                splitIsTrue &&
                                `
            p-4 m-4
            ${
                splitIsTrue && activeTranscript === 'bottom'
                    ? 'border-4 border-blue-500 rounded-md'
                    : 'border border-gray-200 rounded-md'
            }`
                            }`}
                            onClick={(e) => handleSetActiveTranscript(e, 'bottom')}>
                            <PostTranscript
                                post={post}
                                onBack={() => window.history.back()}
                                review={state === 'review'}
                                codeResponses={currentConfig?.bottomTranscript?.responses ?? []}
                                isActive={activeTranscript === 'bottom'}
                                dispatchCodeResponse={
                                    currentConfig?.bottomTranscript?.dispatchFunction as any
                                }
                                conflictingCodes={currentConfig?.bottomTranscript?.conflicts}
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
            </>
            {/* )} */}
        </div>
    );
};

export default TranscriptPage;
