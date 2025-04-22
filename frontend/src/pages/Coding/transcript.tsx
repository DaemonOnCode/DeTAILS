import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import PostTranscript from '../../components/Coding/CodingTranscript/post-transcript';
import TopToolbar from '../../components/Coding/Shared/top-toolbar';
import ValidationTable from '../../components/Coding/UnifiedCoding/validation-table';
import { useCodingContext } from '../../context/coding-context';
import { useLogger } from '../../context/logging-context';
import { createTimer } from '../../utility/timer';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../context/collection-context';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import {
    ROUTES as CODING_ROUTES,
    PAGE_ROUTES as CODING_PAGE_ROUTES
} from '../../constants/Coding/shared';
import { TranscriptContextProvider } from '../../context/transcript-context';
import { useApi } from '../../hooks/Shared/use-api';
import TutorialWrapper from '../../components/Shared/tutorial-wrapper';
import { TutorialStep } from '../../components/Shared/custom-tutorial-overlay';
import { useWorkspaceContext } from '../../context/workspace-context';
import { usePaginatedResponses } from '../../hooks/Coding/use-paginated-responses';

const TranscriptPage = () => {
    const { id, state } = useParams<{ id: string; state: 'review' | 'refine' }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { fetchData } = useApi();
    const split = searchParams.get('split');
    const codebook = searchParams.get('codebook');
    const type = searchParams.get('type');

    const location = useLocation();
    const { tab, search, selected } = location.state || {};
    // console.log(searchParams, split, codebook, type);

    const splitIsTrue = split === 'true';
    const codebookIsTrue = codebook === 'true';
    const splitCodebook = !(codebookIsTrue && !splitIsTrue);

    const { dispatchUnseenPostResponse, dispatchSampledPostResponse } = useCodingContext();

    const { datasetId } = useCollectionContext();

    const allClearedToLeaveRef = useRef<{ check: boolean } | null>(null);

    const logger = useLogger();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);
    useEffect(() => {
        const timer = createTimer();
        logger.info('Transcript Page Loaded');

        return () => {
            if (!hasSavedRef.current) {
                hasSavedRef.current = true;
                saveWorkspaceData().finally(() => {
                    hasSavedRef.current = false;
                });
            }
            logger.info('Transcript Page Unloaded').then(() => {
                logger.time('Transcript Page stay time', { time: timer.end() });
            });
        };
    }, []);

    const createBackFunction = (route: string, review: boolean) => () => {
        const params = new URLSearchParams();
        params.set('review', review.toString());
        if (tab) params.set('tab', tab);
        if (search) params.set('search', search);
        if (selected) params.set('selected', selected);
        params.set('selectedTypeFilter', location.state?.selectedTypeFilter ?? 'All');
        navigate(`${route}?${params.toString()}`);
    };

    const config = new Map<
        string,
        {
            name: string;
            review: boolean;
            backFunction?: (...args: any) => void;
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.INITIAL_CODING, true),
                codebook: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.INITIAL_CODING, true),
                codebook: null,
                topTranscript: null,
                bottomTranscript: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.INITIAL_CODING, true),
                codebook: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.INITIAL_CODING, false),
                codebook: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchSampledPostResponse({
                            ...args[0]
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
                review: true,
                backFunction: createBackFunction(CODING_PAGE_ROUTES.INITIAL_CODING, false),
                codebook: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            // type: 'SET_PARTIAL_RESPONSES',
                            // responses: args[0]
                            ...args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchSampledPostResponse({
                            // type: 'SET_PARTIAL_RESPONSES',
                            // responses: args?.map((response: any) => ({
                            //     ...response
                            //     // type: 'Human'
                            // }))
                            ...args[0]
                        });
                    },
                    conflicts: []
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, false),
                codebook: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['unseen'],
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, false),
                codebook: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['unseen'],
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
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, false),
                codebook: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchSampledPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    }
                },
                topTranscript: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchUnseenPostResponse({
                            ...args[0],
                            responseType: 'Human'
                        });
                    }
                },
                bottomTranscript: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Refine:', args);
                        dispatchUnseenPostResponse({
                            ...args[0],
                            responseType: 'LLM'
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'review',
                codebook: 'true',
                type: 'LLM',
                split: null
            }),
            {
                name: 'Review',
                review: true,
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, true),
                codebook: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
                            responses: args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchUnseenPostResponse({
                            type: 'SET_PARTIAL_RESPONSES',
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
                type: 'Codebook',
                split: null
            }),
            {
                name: 'Review',
                review: true,
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, true),
                codebook: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            ...args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchSampledPostResponse({
                            ...args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'true',
                type: 'Codebook',
                split: null
            }),
            {
                name: 'Refine',
                review: false,
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, false),
                codebook: {
                    responses: ['sampled', 'unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            ...args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['sampled'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchSampledPostResponse({
                            ...args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'review',
                codebook: 'true',
                type: 'New Data',
                split: null
            }),
            {
                name: 'Review',
                review: true,
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, true),
                codebook: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            ...args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchUnseenPostResponse({
                            ...args[0]
                        });
                    }
                }
            }
        ],
        [
            JSON.stringify({
                state: 'refine',
                codebook: 'true',
                type: 'New Data',
                split: null
            }),
            {
                name: 'Refine',
                review: false,
                backFunction: createBackFunction(CODING_PAGE_ROUTES.FINAL_CODING, false),
                codebook: {
                    responses: ['sampled', 'unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review with codebook:', args);
                        dispatchUnseenPostResponse({
                            ...args[0]
                        });
                    },
                    showThemes: false
                },
                topTranscript: null,
                bottomTranscript: {
                    responses: ['unseen'],
                    dispatchFunction: (...args: any) => {
                        console.log('Dispatching to Review:', args);
                        dispatchUnseenPostResponse({
                            ...args[0]
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

    const {
        responsesByPostId,
        isLoadingPage,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage
    } = usePaginatedResponses({
        pageSize: 10,
        responseTypes: currentConfig.bottomTranscript.responses ?? []
    });

    const validationTableData = Object.values(responsesByPostId).flat();

    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                !allClearedToLeaveRef.current?.check &&
                !componentRef.current?.contains(e.target as Node) &&
                post
            ) {
                e.preventDefault();
                e.stopPropagation();
                alert('Check if all explanations are complete to leave the page');
            }
        };

        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, []);

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

    const topSelectionRef = useRef<Range | null>(null);
    const bottomSelectionRef = useRef<Range | null>(null);

    const dispatchAndRefetch = useCallback(
        (...args: any[]) => {
            currentConfig?.bottomTranscript?.dispatchFunction!(...args);
            if (id && datasetId) {
                fetchPostById(id, datasetId, false);
            }
        },
        [currentConfig, id, datasetId]
    );

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

    const [codeResponses, setCodeResponses] = useState([]);
    const [codebookCodes, setCodebookCodes] = useState([]);

    const handleUpdateResponses = (updatedResponses: any[]) => {
        console.log('Updated responses:', updatedResponses);
        dispatchUnseenPostResponse({
            type: 'SET_PARTIAL_RESPONSES',
            responses: updatedResponses
        });
    };

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
                body: JSON.stringify({ postId })
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

    useEffect(() => {
        if (id) {
            fetchPostById(id, datasetId);
        }
    }, [id, datasetId]);

    const handleSwitchToEditMode = () => {
        const params = new URLSearchParams();
        if (type) {
            params.append('type', type);
        }
        if (split) {
            params.append('split', split);
        }
        if (codebook) {
            params.append('codebook', codebook);
        }

        navigate(`/${SHARED_ROUTES.CODING}/transcript/${id}/refine?${params.toString()}`, {
            state: location.state
        });
    };

    if (loading) {
        return (
            <div className="w-full h-page flex flex-col justify-center items-center">
                Loading transcript...
                <div className="flex justify-center mt-4">
                    <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
                </div>
            </div>
        );
    }

    if (!post) {
        return <div className="w-full h-full flex justify-center items-center">Post not found</div>;
    }

    const tutorialSteps: TutorialStep[] = [
        {
            content: `This is the transcript ${state === 'refine' ? 'edit' : 'review'} page where you can code the post.`,
            target: '#transcript-main',
            placement: 'bottom'
        },
        ...(state === 'refine'
            ? [
                  {
                      content:
                          'This is the toolbar where you can add, edit, and delete codes and highlights.',
                      target: '#transcript-toolbar',
                      placement: 'bottom'
                  }
              ]
            : []),
        {
            content: 'Click this to go back to previous page.',
            target: '#transcript-back-button',
            placement: 'right'
        },
        {
            content: 'This is the transcript of the post.',
            target: '#transcript-container',
            placement: 'right'
        },
        {
            content: 'This section shows the information related to the transcript.',
            target: '#transcript-metadata',
            placement: 'left'
        }
    ];

    return (
        <TutorialWrapper
            steps={tutorialSteps}
            pageId={`/${SHARED_ROUTES.CODING}/transcript?review=${state === 'review'}`}>
            <main className="h-screen flex flex-col -m-6" id="transcript-main" ref={componentRef}>
                <>
                    {state === 'refine' && (
                        <TopToolbar
                            selectedPost={post}
                            setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                            selectionRefArray={[topSelectionRef, bottomSelectionRef]}
                            setIsHighlightModalOpen={setIsHighlightModalOpen}
                            setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                            setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                            setIsEditHighlightCodeModalOpen={setIsEditHighlightModalOpen}
                            setIsDeleteHighlightCodeModalOpen={setDeleteIsHighlightModalOpen}
                            showCodebookButton={true}
                            showCodebook={showCodebook}
                            activeTranscript={
                                activeTranscript === 'top'
                                    ? (codeResponses as any)
                                    : activeTranscript === 'bottom'
                                      ? (currentConfig?.bottomTranscript.responses as any)
                                      : null
                            }
                            onShowCodebook={() => {
                                setActiveTranscript(null);
                                setShowCodebook((prev) => !prev);
                            }}
                        />
                    )}
                    {showCodebook && !splitIsTrue && (
                        <div className="h-[40%] overflow-auto border-b border-gray-300 p-4 m-6">
                            <ValidationTable
                                dispatchCodeResponses={
                                    currentConfig?.codebook?.dispatchFunction as any
                                }
                                codeResponses={validationTableData ?? []}
                                onViewTranscript={() => {}}
                                review={true}
                                showThemes={currentConfig?.codebook?.showThemes}
                                onReRunCoding={() => {}}
                                onUpdateResponses={currentConfig?.codebook?.dispatchFunction as any}
                                hasNextPage={hasNextPage}
                                hasPreviousPage={hasPreviousPage}
                                loadNextPage={loadNextPage}
                                loadPreviousPage={loadPreviousPage}
                                isLoadingPage={isLoadingPage}
                            />
                        </div>
                    )}

                    <div
                        className={`${splitCodebook ? 'h-[60%]' : 'h-full'} flex-1 flex flex-col overflow-hidden`}
                        onClick={(e) => handleSetActiveTranscript(e, null)}>
                        {codebookIsTrue && state === 'review' && (
                            <div className="flex justify-center p-3 gap-x-6">
                                <button
                                    className="bg-blue-500 text-white rounded px-4 py-2"
                                    onClick={() => setShowCodebook((prev) => !prev)}>
                                    {showCodebook ? 'Hide Codebook' : 'Show Codebook'}
                                </button>
                                <button
                                    className="bg-blue-500 text-white rounded px-4 py-2"
                                    onClick={handleSwitchToEditMode}>
                                    Go to Edit mode
                                </button>
                            </div>
                        )}

                        <p className="px-6 py-2 text-center bg-gray-100 text-base lg:text-lg font-bold text-[#203636]">
                            Double click Quote to filter related Code and Explanation
                        </p>

                        <div
                            className={`${codebookIsTrue && state === 'review' ? 'h-[85%]' : 'h-[95%]'} flex flex-col`}>
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
                                                codeResponses={validationTableData ?? []}
                                                onViewTranscript={() => {}}
                                                review
                                                onReRunCoding={() => {}}
                                                onUpdateResponses={
                                                    currentConfig?.codebook?.dispatchFunction as any
                                                }
                                                hasNextPage={hasNextPage}
                                                hasPreviousPage={hasPreviousPage}
                                                loadNextPage={loadNextPage}
                                                loadPreviousPage={loadPreviousPage}
                                                isLoadingPage={isLoadingPage}
                                            />
                                        </>
                                    ) : (
                                        <TranscriptContextProvider
                                            postId={id ?? ''}
                                            review={state === 'review'}
                                            codeResponses={codeResponses ?? []}>
                                            <PostTranscript
                                                post={post}
                                                codebookCodes={codebookCodes}
                                                clearedToLeaveRef={allClearedToLeaveRef}
                                                onBack={() =>
                                                    (
                                                        currentConfig?.backFunction ??
                                                        window.history.back
                                                    )()
                                                }
                                                _selectionRef={topSelectionRef}
                                                codeResponses={codeResponses ?? []}
                                                isActive={activeTranscript === 'top'}
                                                dispatchCodeResponse={
                                                    currentConfig?.topTranscript
                                                        ?.dispatchFunction as any
                                                }
                                                conflictingCodes={
                                                    currentConfig?.topTranscript?.conflicts
                                                }
                                                review={currentConfig?.review ?? true}
                                                selectedText={selectedText}
                                                setSelectedText={setSelectedText}
                                                isAddCodeModalOpen={isAddCodeModalOpen}
                                                isEditCodeModalOpen={isEditCodeModalOpen}
                                                isDeleteCodeModalOpen={isDeleteCodeModalOpen}
                                                isHighlightModalOpen={isHighlightModalOpen}
                                                isEditHighlightModalOpen={isEditHighlightModalOpen}
                                                isDeleteHighlightModalOpen={
                                                    isDeleteHighlightModalOpen
                                                }
                                                setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                                                setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                                                setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                                                setIsHighlightModalOpen={setIsHighlightModalOpen}
                                                setIsEditHighlightModalOpen={
                                                    setIsEditHighlightModalOpen
                                                }
                                                setDeleteIsHighlightModalOpen={
                                                    setDeleteIsHighlightModalOpen
                                                }
                                            />
                                        </TranscriptContextProvider>
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
                                <TranscriptContextProvider
                                    postId={id ?? ''}
                                    review={state === 'review'}
                                    codeResponses={codeResponses ?? []}>
                                    <PostTranscript
                                        post={post}
                                        codebookCodes={codebookCodes}
                                        clearedToLeaveRef={allClearedToLeaveRef}
                                        _selectionRef={bottomSelectionRef}
                                        onBack={() =>
                                            (currentConfig?.backFunction ?? window.history.back)()
                                        }
                                        review={currentConfig?.review ?? true}
                                        codeResponses={codeResponses ?? []}
                                        isActive={activeTranscript === 'bottom'}
                                        dispatchCodeResponse={dispatchAndRefetch as any}
                                        handleSwitchToEditMode={handleSwitchToEditMode}
                                        conflictingCodes={
                                            currentConfig?.bottomTranscript?.conflicts
                                        }
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
                                </TranscriptContextProvider>
                            </div>
                        </div>
                    </div>
                </>
            </main>
        </TutorialWrapper>
    );
};

export default TranscriptPage;
