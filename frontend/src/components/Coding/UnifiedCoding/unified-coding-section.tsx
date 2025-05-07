import {
    useMemo,
    useState,
    useEffect,
    useCallback,
    useImperativeHandle,
    useRef,
    RefObject
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import debounce from 'lodash/debounce';
import {
    BaseResponseHandlerActions,
    CoderType,
    ResponseType,
    SelectedTypeFilter
} from '../../../types/Coding/shared';
import { useCodingContext } from '../../../context/coding-context';
import LeftPanel from './left-panel';
import ReviewToggle from './review-toggle';
import ValidationTable from './validation-table';
import { DetailsLLMIcon } from '../../Shared/Icons';
import { toast } from 'react-toastify';
import { useApi } from '../../../hooks/Shared/use-api';
import { REMOTE_SERVER_ROUTES, ROUTES as SHARED_ROUTES } from '../../../constants/Shared';
import { downloadFileWithStreaming } from '../../../utility/file-downloader';
import { usePaginatedResponses } from '../../../hooks/Coding/use-paginated-responses';
import { useWorkspaceContext } from '../../../context/workspace-context';

interface UnifiedCodingPageProps {
    postIds: string[];
    responseTypes?: ResponseType[];
    dispatchFunction: (action: any, refreshRef?: RefObject<any>) => void;
    review?: boolean;
    showThemes?: boolean;
    download?: boolean;
    showCodebook?: boolean;
    split?: boolean;
    showFilterDropdown?: boolean;
    showRerunCoding?: boolean;
    handleRerun?: () => void;
    conflictingResponses?: any[];
    manualCoding?: boolean;
    onPostSelect?: (postId: string | null) => void;
    showCoderType?: boolean;
    coderType?: CoderType;
    applyFilters?: boolean;
}

const UnifiedCodingPage: React.FC<UnifiedCodingPageProps> = ({
    postIds: _postIds,
    review: reviewParam,
    responseTypes = ['sampled'],
    dispatchFunction,
    showThemes = false,
    download = true,
    showCodebook = false,
    split,
    showFilterDropdown = false,
    showRerunCoding = false,
    handleRerun = () => {},
    conflictingResponses = [],
    manualCoding = false,
    onPostSelect = () => {},
    showCoderType = false,
    coderType,
    applyFilters = false
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { fetchData } = useApi();
    const { currentWorkspace } = useWorkspaceContext();
    const {
        sampledPostIds,
        unseenPostIds,
        dispatchSampledPostResponse,
        dispatchUnseenPostResponse,
        dispatchAllPostResponse,
        dispatchSampledCopyPostResponse
    } = useCodingContext();

    const [review, setReview] = useState(reviewParam ?? true);
    const [filter, setFilter] = useState<string | null>(null);
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<SelectedTypeFilter>(
        showCoderType ? 'All' : 'New Data'
    );

    const [activeTab, setActiveTab] = useState<'posts' | 'codes'>('posts');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedback, setFeedback] = useState('');

    const [isDownloadingTranscripts, setIsDownloadingTranscripts] = useState(false);

    useEffect(() => {
        console.log('Restoring state from URL', location.search);
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab') === 'codes' ? 'codes' : 'posts';
        const typeFromUrl = params.get('selectedTypeFilter');
        const allowedTypes = ['New Data', 'Initial Data', 'Human', 'LLM', 'All'];
        const defaultType = showCoderType ? 'All' : 'New Data';
        const type = allowedTypes.includes(typeFromUrl ?? '') ? typeFromUrl : defaultType;
        const search = params.get('search');
        if (search) {
            setSearchQuery(search);
        }
        const selected = params.get('selected');
        if (selected) {
            setSelectedItem(selected);
        }
        console.log(
            'Restored state:',
            tab,
            search,
            selected,
            type,
            allowedTypes.includes(type ?? ''),
            reviewParam,
            review
        );
        setActiveTab(tab);
        setFilter(selected);
        setSelectedTypeFilter(type as SelectedTypeFilter);
    }, [location.search]);

    const debouncedUpdateUrl = useMemo(
        () =>
            debounce((tab: string, search: string, selected: string | null, type: string) => {
                const params = new URLSearchParams();
                params.set('tab', tab);
                if (search) params.set('search', search);
                if (selected) params.set('selected', selected);
                params.set('selectedTypeFilter', type);
                navigate({ search: params.toString() }, { replace: true });
            }, 300),
        [navigate]
    );

    useEffect(() => {
        debouncedUpdateUrl(activeTab, searchQuery, selectedItem, selectedTypeFilter);
    }, [activeTab, searchQuery, selectedItem, selectedTypeFilter, debouncedUpdateUrl]);

    useEffect(() => {
        return () => debouncedUpdateUrl.cancel();
    }, [debouncedUpdateUrl]);

    const {
        responsesByPostId,
        isLoadingPage,
        hasNextPage,
        hasPreviousPage,
        loadNextPage,
        loadPreviousPage,
        refresh
    } = usePaginatedResponses({
        pageSize: 10,
        searchTerm: searchQuery,
        selectedTypeFilter,
        responseTypes,
        postId: activeTab === 'posts' ? selectedItem : null,
        filterCode: activeTab === 'codes' ? selectedItem : null
    });

    const isSampled = (response: any) => sampledPostIds.includes(response.post_id);

    const routeDispatch = (action: BaseResponseHandlerActions<any>, refreshRef: RefObject<any>) => {
        let dispatchResult = null;
        if (selectedTypeFilter === 'Initial Data') {
            console.log(action, 'route dispatch codebook updating sample');
            // @ts-ignore
            dispatchResult = dispatchSampledCopyPostResponse({ ...action }, refreshRef);
        } else if (selectedTypeFilter === 'New Data') {
            console.log(action, 'route dispatch newdata updating unseen');
            // @ts-ignore
            dispatchResult = dispatchUnseenPostResponse({ ...action }, refreshRef);
        } else {
            console.log(action, 'route dispatch');
            if ('responses' in action) {
                const responses = action.responses;
                const sampledResponses = responses.filter((r: any) => isSampled(r));
                const unseenResponses = responses.filter((r: any) => !isSampled(r));
                if (sampledResponses.length > 0) {
                    console.log(action, 'route dispatch responses updating sample');
                    dispatchResult = dispatchSampledPostResponse(
                        { ...action, responses: sampledResponses },
                        // @ts-ignore
                        refreshRef
                    );
                }
                if (unseenResponses.length > 0) {
                    console.log(action, 'route dispatch responses updating unseen');
                    dispatchResult = dispatchUnseenPostResponse(
                        { ...action, responses: unseenResponses },
                        // @ts-ignore
                        refreshRef
                    );
                }
                return;
            } else if ('index' in action) {
                if (isSampled(action.index)) {
                    console.log(action, 'route dispatch index updating sample');
                    // @ts-ignore
                    dispatchResult = dispatchSampledPostResponse(action, refreshRef);
                } else {
                    console.log(action, 'route dispatch index updating unseen');
                    // @ts-ignore
                    dispatchResult = dispatchUnseenPostResponse(action, refreshRef);
                }
                return dispatchResult;
            } else {
                console.log(action, 'route dispatch updating both');
                // // @ts-ignore
                // dispatchResult = dispatchSampledPostResponse(action, refreshRef);
                // // @ts-ignore
                // dispatchResult = dispatchUnseenPostResponse(action, refreshRef);
                // @ts-ignore
                dispatchResult = dispatchAllPostResponse(action, refreshRef);
            }
        }
        return dispatchResult;
    };

    const downloadCodebook = async () => {
        const payload = {
            responseTypes
        };
        return await downloadFileWithStreaming(
            fetchData,
            REMOTE_SERVER_ROUTES.DOWNLOAD_CODES,
            payload,
            'codebook.csv'
        );
    };

    const downloadTranscripts = async () => {
        const payload = {
            workspace_id: currentWorkspace?.id,
            post_ids: [
                ...(responseTypes.find((type) => type === 'sampled_copy') ? sampledPostIds : []),
                ...(responseTypes.find((type) => type === 'unseen') ? unseenPostIds : [])
            ]
        };
        return await downloadFileWithStreaming(
            fetchData,
            REMOTE_SERVER_ROUTES.GET_TRANSCRIPTS_CSV,
            payload,
            'transcripts.csv'
        );
    };

    const refreshRef = useRef<any>(null);
    useImperativeHandle(
        refreshRef,
        () => ({
            refresh
        }),
        [refresh]
    );

    const dispatchWithRefresh = useCallback(
        async (action: BaseResponseHandlerActions<any>) => {
            console.log('Dispatching with refresh', action);
            return await (coderType &&
            !(selectedTypeFilter === 'Human' || selectedTypeFilter === 'LLM')
                ? routeDispatch(action, refreshRef)
                : dispatchFunction(action, refreshRef));
        },
        [refresh, selectedTypeFilter]
    );

    const handleViewTranscript = useCallback(
        (postId: string | null) => {
            if (manualCoding) {
                onPostSelect(postId);
                return;
            }

            console.log('View transcript clicked', postId);

            const params = new URLSearchParams();
            if (showFilterDropdown && selectedTypeFilter) {
                if (selectedTypeFilter === 'All') {
                    if (sampledPostIds.includes(postId ?? '')) {
                        params.append('type', 'Initial Data');
                    } else {
                        params.append('type', 'New Data');
                    }
                } else {
                    params.append('type', selectedTypeFilter);
                }
            } else if (showFilterDropdown && coderType) {
                params.append('type', coderType);
            }
            if (split !== undefined) {
                params.append('split', split.toString());
            }
            if (showCodebook) params.append('codebook', 'true');

            const mode = review ? 'review' : 'refine';

            const navigationState = {
                tab: activeTab,
                search: searchQuery,
                selected: selectedItem,
                selectedTypeFilter
            };

            console.log(
                'Current config',
                `/${SHARED_ROUTES.CODING}/transcript/${postId}/${mode}?${params.toString()}`,
                navigationState
            );

            navigate(`/${SHARED_ROUTES.CODING}/transcript/${postId}/${mode}?${params.toString()}`, {
                state: navigationState
            });
        },
        [activeTab, searchQuery, selectedItem, selectedTypeFilter, review, coderType]
    );

    const handleUpdateResponses = (updatedResponses: any[]) => {
        dispatchWithRefresh({
            type: 'SET_PARTIAL_RESPONSES',
            responses: updatedResponses
        });
    };

    const handleSelectedTypeFilter = (type: string) => {
        setFilter(null);
        setSelectedTypeFilter(type as SelectedTypeFilter);
    };

    const handleReRunCoding = () => {
        setShowFeedbackModal(true);
    };

    // usEff

    return (
        <div
            id="unified-coding-page"
            className="h-full flex flex-col -mx-6 overflow-hidden responsive-text">
            <div className="flex flex-1 overflow-y-auto">
                <div className="w-1/4 border-r flex-1 overflow-auto px-6 pb-0">
                    <LeftPanel
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        setSelectedItem={setSelectedItem}
                        selectedItem={selectedItem}
                        filter={filter}
                        onFilterSelect={setFilter}
                        showTypeFilterDropdown={showFilterDropdown}
                        selectedTypeFilter={selectedTypeFilter}
                        handleSelectedTypeFilter={handleSelectedTypeFilter}
                        showCoderType={showCoderType}
                        responseTypes={responseTypes}
                    />
                </div>
                <div className="w-3/4 flex flex-col h-full">
                    <div
                        id="coding-controls"
                        className="flex justify-evenly items-center px-6 py-4">
                        {download && (
                            <div className="flex gap-x-2">
                                <button
                                    onClick={async () => {
                                        const success = await downloadCodebook();
                                        if (success) {
                                            toast.success('Codes downloaded successfully');
                                        } else {
                                            toast.error('Download cancelled or failed');
                                        }
                                    }}
                                    className="px-4 py-2 bg-green-500 text-white rounded">
                                    Download Codes
                                </button>
                                <button
                                    onClick={async (e) => {
                                        setIsDownloadingTranscripts(true);
                                        const success = await downloadTranscripts();
                                        setIsDownloadingTranscripts(false);
                                        if (success) {
                                            toast.success('Transcripts downloaded successfully');
                                        } else {
                                            toast.error('Download cancelled or failed');
                                        }
                                    }}
                                    className="px-4 py-2 bg-green-500 text-white rounded">
                                    Download Transcripts
                                </button>
                            </div>
                        )}
                        <ReviewToggle review={review} setReview={setReview} />
                    </div>
                    <div className="flex-1 overflow-y-auto px-6">
                        <ValidationTable
                            codeResponses={Object.values(responsesByPostId).flat() as any[]}
                            dispatchCodeResponses={dispatchWithRefresh}
                            onViewTranscript={handleViewTranscript}
                            review={review}
                            showThemes={showThemes}
                            onReRunCoding={handleReRunCoding}
                            onUpdateResponses={handleUpdateResponses}
                            conflictingResponses={conflictingResponses}
                            currentPostId={selectedItem}
                            showCoderType={showCoderType}
                            isLoadingPage={isLoadingPage}
                            hasNextPage={hasNextPage}
                            hasPreviousPage={hasPreviousPage}
                            loadNextPage={loadNextPage}
                            loadPreviousPage={loadPreviousPage}
                        />
                    </div>
                    {showRerunCoding && review && (
                        <div className="flex justify-end py-4 px-6">
                            <button
                                id="redo-coding-btn"
                                onClick={handleReRunCoding}
                                className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                                <DetailsLLMIcon className="h-6 w-6" />
                                Redo with feedback
                            </button>
                        </div>
                    )}
                </div>
                {showFeedbackModal && (
                    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
                        <div className="bg-white p-6 rounded shadow-lg w-80">
                            <h2 className="text-xl font-bold mb-4">Provide Feedback</h2>
                            <textarea
                                className="w-full border border-gray-300 rounded p-2 resize-none"
                                rows={4}
                                placeholder="Enter your feedback here..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                            />
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={() => setShowFeedbackModal(false)}
                                    className="mr-2 px-4 py-2 bg-gray-300 rounded">
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        console.log('Feedback:', feedback);
                                        setShowFeedbackModal(false);
                                        handleRerun();
                                    }}
                                    className="px-4 py-2 bg-green-500 text-white rounded">
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isDownloadingTranscripts && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 bg-gray-800 bg-opacity-50">
                        <div className="bg-white p-6 rounded shadow-lg">
                            <p className="text-lg font-semibold">Downloading transcripts...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnifiedCodingPage;
