import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import debounce from 'lodash/debounce';
import { BaseResponseHandlerActions } from '../../../types/Coding/shared';
import { useFilteredData } from '../../../hooks/Coding/use-filtered-data';
import { useCodingContext } from '../../../context/coding-context';
import { downloadCodebook } from '../../../utility/codebook-downloader';
import LeftPanel from './left-panel';
import ReviewToggle from './review-toggle';
import ValidationTable from './validation-table';
import { DetailsLLMIcon } from '../../Shared/Icons';
import { toast } from 'react-toastify';
import { useLoadingContext } from '../../../context/loading-context';

interface UnifiedCodingPageProps {
    postIds: string[];
    data: any[];
    dispatchFunction: (action: any) => void;
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
    coderType?: 'Human' | 'LLM';
    applyFilters?: boolean;
}

const UnifiedCodingPage: React.FC<UnifiedCodingPageProps> = ({
    postIds,
    data,
    review: reviewParam,
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
    const {
        sampledPostResponse,
        unseenPostResponse,
        sampledPostIds,
        unseenPostIds,
        dispatchSampledPostResponse,
        dispatchUnseenPostResponse
    } = useCodingContext();

    const [review, setReview] = useState(reviewParam ?? true);
    const [filter, setFilter] = useState<string | null>(null);
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<
        'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All'
    >(showCoderType ? 'All' : 'New Data');

    // New states for tab, search, and selection
    const [activeTab, setActiveTab] = useState<'posts' | 'codes'>('posts');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [feedback, setFeedback] = useState('');

    // Restore states from URL on mount
    useEffect(() => {
        console.log('Restoring state from URL', location.search);
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab') === 'codes' ? 'codes' : 'posts';
        const typeFromUrl = params.get('selectedTypeFilter');
        const allowedTypes = ['New Data', 'Codebook', 'Human', 'LLM', 'All'];
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
        setSelectedTypeFilter(type as 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All');
    }, [location.search]);

    // Debounced function to update URL
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

    // Update URL when states change
    useEffect(() => {
        debouncedUpdateUrl(activeTab, searchQuery, selectedItem, selectedTypeFilter);
    }, [activeTab, searchQuery, selectedItem, selectedTypeFilter, debouncedUpdateUrl]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => debouncedUpdateUrl.cancel();
    }, [debouncedUpdateUrl]);

    const { filteredData, filteredPostIds, totalData, totalIds } = useFilteredData({
        data,
        postIds,
        filter,
        showCoderType,
        applyFilters,
        selectedTypeFilter,
        sampledPostResponse,
        unseenPostResponse,
        sampledPostIds,
        unseenPostIds
    });

    console.log(
        'Filtered data:',
        filteredData,
        filteredPostIds,
        totalData,
        totalIds,
        showCoderType,
        selectedTypeFilter
    );

    // Precompute a Set of sampled IDs for fast lookup
    const sampledIds = useMemo(
        () => new Set(sampledPostResponse.map((r: any) => r.id)),
        [sampledPostResponse]
    );

    // Helper to determine if a response is sampled
    const isSampled = (response: any) => sampledIds.has(response.id);

    const routeDispatch = (action: BaseResponseHandlerActions<any>) => {
        if (selectedTypeFilter === 'Codebook') {
            console.log(action, 'route dispatch codebook updating sample');
            dispatchSampledPostResponse({ ...action });
        } else if (selectedTypeFilter === 'New Data') {
            console.log(action, 'route dispatch newdata updating unseen');
            dispatchUnseenPostResponse({ ...action });
        } else {
            console.log(action, 'route dispatch');
            if ('responses' in action) {
                const responses = action.responses;
                const sampledResponses = responses.filter((r: any) => isSampled(r));
                const unseenResponses = responses.filter((r: any) => !isSampled(r));
                if (sampledResponses.length > 0) {
                    console.log(action, 'route dispatch responses updating sample');
                    dispatchSampledPostResponse({ ...action, responses: sampledResponses });
                }
                if (unseenResponses.length > 0) {
                    console.log(action, 'route dispatch responses updating unseen');
                    dispatchUnseenPostResponse({ ...action, responses: unseenResponses });
                }
                return;
            } else if ('index' in action) {
                const response = data[action.index];
                if (response && isSampled(response)) {
                    console.log(action, 'route dispatch index updating sample');
                    dispatchSampledPostResponse(action);
                } else {
                    console.log(action, 'route dispatch index updating unseen');
                    dispatchUnseenPostResponse(action);
                }
                return;
            } else {
                console.log(action, 'route dispatch updating both');
                dispatchSampledPostResponse(action);
                dispatchUnseenPostResponse(action);
            }
        }
    };

    const effectiveDispatch =
        coderType && !(selectedTypeFilter === 'Human' || selectedTypeFilter === 'LLM')
            ? routeDispatch
            : dispatchFunction;

    const handleViewTranscript = useCallback(
        (postId: string | null) => {
            if (manualCoding) {
                onPostSelect(postId);
                return;
            }

            const params = new URLSearchParams();
            if (showFilterDropdown && selectedTypeFilter) {
                if (selectedTypeFilter === 'All') {
                    if (sampledPostIds.includes(postId ?? '')) {
                        params.append('type', 'Codebook');
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
                `/coding/transcript/${postId}/${mode}?${params.toString()}`,
                navigationState
            );

            navigate(`/coding/transcript/${postId}/${mode}?${params.toString()}`, {
                state: navigationState
            });
        },
        [activeTab, searchQuery, selectedItem, selectedTypeFilter, review, coderType]
    );

    const handleUpdateResponses = (updatedResponses: any[]) => {
        effectiveDispatch({
            type: 'SET_RESPONSES',
            responses: updatedResponses
        });
    };

    const handleSelectedTypeFilter = (type: string) => {
        setFilter(null);
        setSelectedTypeFilter(type as 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All');
    };

    const handleReRunCoding = () => {
        setShowFeedbackModal(true);
    };

    const uniqueCodes = Array.from(new Set(totalData.map((item) => item.code)));

    return (
        <div
            id="unified-coding-page"
            className="h-full flex flex-col -mx-6 overflow-hidden responsive-text">
            <div className="flex flex-1 overflow-y-auto">
                <div className="w-1/4 border-r flex-1 overflow-auto px-6 pb-0">
                    <LeftPanel
                        totalPosts={totalIds}
                        totalCodedPosts={new Set(totalData.map((data) => data.postId)).size}
                        postIds={filteredPostIds}
                        codes={uniqueCodes}
                        filter={filter}
                        onFilterSelect={setFilter}
                        showTypeFilterDropdown={showFilterDropdown}
                        selectedTypeFilter={selectedTypeFilter}
                        handleSelectedTypeFilter={handleSelectedTypeFilter}
                        showCoderType={showCoderType}
                        codedPostsCount={new Set(filteredData.map((data) => data.postId)).size}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectedItem={selectedItem}
                        setSelectedItem={setSelectedItem}
                    />
                </div>
                <div className="w-3/4 flex flex-col h-full">
                    <div
                        id="coding-controls"
                        className="flex justify-evenly items-center px-6 py-4">
                        {download && (
                            <button
                                onClick={async () => {
                                    const success = await downloadCodebook(filteredData);
                                    if (success) {
                                        toast.success('Codebook downloaded successfully');
                                    } else {
                                        toast.error('Download cancelled or failed');
                                    }
                                }}
                                className="px-4 py-2 bg-green-500 text-white rounded">
                                Download Codebook
                            </button>
                        )}
                        <ReviewToggle review={review} setReview={setReview} />
                    </div>
                    <div className="flex-1 overflow-y-auto px-6">
                        <ValidationTable
                            codeResponses={filteredData}
                            dispatchCodeResponses={effectiveDispatch}
                            onViewTranscript={handleViewTranscript}
                            review={review}
                            showThemes={showThemes}
                            onReRunCoding={handleReRunCoding}
                            onUpdateResponses={handleUpdateResponses}
                            conflictingResponses={conflictingResponses}
                            currentPostId={
                                filter?.split('|')?.[1] === 'coded-data'
                                    ? filter.split('|')?.[0]
                                    : filter
                            }
                            showCoderType={showCoderType}
                        />
                    </div>
                    {showRerunCoding && (
                        <div className="flex justify-end py-4 px-6">
                            <button
                                id="redo-coding-btn"
                                onClick={handleReRunCoding}
                                className="px-4 py-2 bg-gray-600 text-white rounded flex justify-center items-center gap-2">
                                <DetailsLLMIcon className="h-6 w-6" />
                                {coderType !== 'LLM'
                                    ? 'Remake complete codebook'
                                    : 'Redo Deductive Coding'}
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
            </div>
        </div>
    );
};

export default UnifiedCodingPage;
