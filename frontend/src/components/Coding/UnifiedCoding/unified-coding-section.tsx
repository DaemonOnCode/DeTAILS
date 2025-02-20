import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseResponseHandlerActions } from '../../../types/Coding/shared';
import { useFilteredData } from '../../../hooks/Coding/use-filtered-data';
import { useCodingContext } from '../../../context/coding-context';
import { downloadCodebook } from '../../../utility/codebook-downloader';
import LeftPanel from './left-panel';
import ReviewToggle from './review-toggle';
import ValidationTable from './validation-table';

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
    const {
        sampledPostResponse,
        unseenPostResponse,
        sampledPostIds,
        unseenPostIds,
        dispatchSampledPostResponse,
        dispatchUnseenPostResponse
    } = useCodingContext();

    const [review, setReview] = useState(true);
    const [filter, setFilter] = useState<string | null>(null);
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<
        'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All'
    >(showCoderType ? 'All' : 'New Data');

    const { filteredData, filteredPostIds } = useFilteredData({
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

    // Precompute a Set of sampled IDs for fast lookup.
    const sampledIds = useMemo(
        () => new Set(sampledPostResponse.map((r: any) => r.id)),
        [sampledPostResponse]
    );

    // Helper to determine if a response is sampled.
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

    // Use our routeDispatch if showCoderType is true.
    const effectiveDispatch =
        coderType && !(selectedTypeFilter === 'Human' || selectedTypeFilter === 'LLM')
            ? routeDispatch
            : dispatchFunction;

    // Navigate to transcript view.
    const handleViewTranscript = (postId: string | null) => {
        if (manualCoding) {
            onPostSelect(postId);
            return;
        }
        const params = new URLSearchParams();
        if (split !== undefined) {
            if (coderType) {
                params.append('type', coderType);
            } else if (selectedTypeFilter !== 'All') {
                params.append('type', selectedTypeFilter);
            } else {
                params.append('split', split.toString());
            }
        }
        if (showCodebook) params.append('codebook', 'true');

        const mode = review ? 'review' : 'refine';
        navigate(`/coding/transcript/${postId}/${mode}?${params.toString()}`);
    };

    const handleUpdateResponses = (updatedResponses: any[]) => {
        effectiveDispatch({
            type: 'SET_RESPONSES',
            responses: updatedResponses
        });
    };

    const handleSelectedTypeFilter = (type: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All') => {
        setSelectedTypeFilter(type);
    };

    const handleReRunCoding = () => {
        handleRerun();
    };

    return (
        <div className="h-full flex flex-col -m-6 overflow-hidden responsive-text">
            <div className="flex flex-1 overflow-y-auto">
                <div className="w-1/4 border-r flex-1 overflow-auto p-6 pb-0">
                    <LeftPanel
                        postIds={filteredPostIds}
                        codes={Array.from(new Set(data.map((item) => item.code)))}
                        onFilterSelect={setFilter}
                        showTypeFilterDropdown={showFilterDropdown}
                        selectedTypeFilter={selectedTypeFilter}
                        handleSelectedTypeFilter={handleSelectedTypeFilter}
                        setCurrentPost={() => {}}
                        showCoderType={showCoderType}
                    />
                </div>
                <div className="w-3/4 flex flex-col h-full">
                    <div className="flex justify-evenly items-center p-6">
                        {download && (
                            <button
                                onClick={() => downloadCodebook(filteredData)}
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
                            currentPostId={null}
                            showCoderType={showCoderType}
                        />
                    </div>
                    {showRerunCoding && !review && (
                        <div className="flex justify-center p-6">
                            <button
                                onClick={handleReRunCoding}
                                className="px-4 py-2 bg-green-500 text-white rounded">
                                Re-run Coding
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedCodingPage;
