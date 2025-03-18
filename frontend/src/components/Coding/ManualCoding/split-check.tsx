import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import { useCodingContext } from '../../../context/coding-context';
import { useCollectionContext } from '../../../context/collection-context';
import { TranscriptContextProvider } from '../../../context/transcript-context';
import { useApi } from '../../../hooks/Shared/use-api';
import PostTranscript from '../CodingTranscript/post-transcript';
import { useManualCodingContext } from '../../../context/manual-coding-context';

const SplitCheckPage = ({ id, onBack }: { id: string; onBack: () => void }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    console.log('searchParams:', Object.fromEntries(searchParams.entries()));
    const selectedTypeFilter = searchParams.get('selectedTypeFilter') || 'All';

    // State for post data and loading status
    const [post, setPost] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    // State for transcript interaction
    const [activeTranscript, setActiveTranscript] = useState<'top' | 'bottom' | null>(null);
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const topSelectionRef = useRef<Range | null>(null);
    const bottomSelectionRef = useRef<Range | null>(null);

    // Context hooks
    const { fetchData } = useApi();
    const { datasetId } = useCollectionContext();
    const { unseenPostResponse } = useCodingContext();
    const { manualCodingResponses } = useManualCodingContext();

    // Fetch post data when ID or dataset changes
    const fetchPostById = async (postId: string, datasetId: string) => {
        if (!postId || !datasetId) return;
        setLoading(true);
        try {
            const { data: fetchedPost, error } = await fetchData<any>(
                REMOTE_SERVER_ROUTES.GET_REDDIT_POST_BY_ID,
                {
                    method: 'POST',
                    body: JSON.stringify({ postId, datasetId })
                }
            );
            if (error) {
                console.error('Error fetching post:', error);
                return;
            }
            setPost(fetchedPost);
        } catch (error) {
            console.error('Error fetching post:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchPostById(id, datasetId);
        }
    }, [id, datasetId]);

    // Filter responses for human and LLM coding
    const humanResponses = manualCodingResponses.filter((response) => response.type === 'Human');
    const llmResponses = manualCodingResponses.filter((response) => response.type === 'LLM');

    // Loading and error states
    if (loading) {
        return (
            <div className="w-full h-screen flex flex-col justify-center items-center">
                Loading split check page...
                <div className="flex justify-center mt-4">
                    <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
                </div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="w-full h-screen flex justify-center items-center">Post not found</div>
        );
    }

    return (
        <div
            className="flex flex-col h-full"
            onClick={() => setActiveTranscript(null)} // Reset active transcript on outside click
        >
            {/* Dynamic Header based on selectedTypeFilter */}
            <div className="p-4 text-center bg-gray-100 text-lg font-bold text-[#203636]">
                {selectedTypeFilter === 'All'
                    ? 'Split Check: Human vs. LLM Coding Comparison'
                    : selectedTypeFilter === 'Human'
                      ? 'Human Coding Review'
                      : selectedTypeFilter === 'LLM'
                        ? 'LLM Coding Review'
                        : 'Coding Review'}
            </div>

            <button onClick={onBack} className="my-4 text-blue-500 self-start">
                ← <span className="underline">Back to Posts</span>
            </button>

            {/* Split view layout */}
            <div className="h-full flex flex-col gap-2 overflow-hidden">
                {/* LLM Coding Transcript */}
                {(selectedTypeFilter === 'All' || selectedTypeFilter === 'LLM') && (
                    <div
                        className={`h-${selectedTypeFilter === 'All' ? '1/2' : 'full'} ${
                            activeTranscript === 'bottom'
                                ? 'border-4 border-blue-500'
                                : 'border-gray-200'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTranscript('bottom');
                        }}>
                        <h2 className="text-lg font-semibold italic mx-6">LLM Coding</h2>
                        <TranscriptContextProvider
                            postId={id ?? ''}
                            review={true}
                            codeResponses={llmResponses}>
                            <PostTranscript
                                post={post}
                                onBack={() => {}}
                                review={true}
                                showBackButton={false}
                                clearedToLeaveRef={{ current: { check: false } }}
                                dispatchCodeResponse={() => {}}
                                codeResponses={llmResponses}
                                isActive={activeTranscript === 'bottom'}
                                _selectionRef={bottomSelectionRef}
                                selectedText={selectedText}
                                setSelectedText={setSelectedText}
                                isAddCodeModalOpen={false}
                                isEditCodeModalOpen={false}
                                isDeleteCodeModalOpen={false}
                                isHighlightModalOpen={false}
                                isEditHighlightModalOpen={false}
                                isDeleteHighlightModalOpen={false}
                                setIsAddCodeModalOpen={() => {}}
                                setIsEditCodeModalOpen={() => {}}
                                setIsDeleteCodeModalOpen={() => {}}
                                setIsHighlightModalOpen={() => {}}
                                setIsEditHighlightModalOpen={() => {}}
                                setDeleteIsHighlightModalOpen={() => {}}
                            />
                        </TranscriptContextProvider>
                    </div>
                )}

                {/* Human Coding Transcript */}
                {(selectedTypeFilter === 'All' || selectedTypeFilter === 'Human') && (
                    <div
                        className={`h-${selectedTypeFilter === 'All' ? '1/2' : 'full'} ${
                            activeTranscript === 'top'
                                ? 'border-4 border-blue-500'
                                : 'border-gray-200'
                        }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTranscript('top');
                        }}>
                        <h2 className="text-lg font-semibold italic mx-6">Human Coding</h2>
                        <TranscriptContextProvider
                            postId={id ?? ''}
                            review={true}
                            codeResponses={humanResponses}>
                            <PostTranscript
                                post={post}
                                onBack={() => {}}
                                review={true}
                                showBackButton={false}
                                clearedToLeaveRef={{ current: { check: false } }}
                                dispatchCodeResponse={() => {}}
                                codeResponses={humanResponses}
                                isActive={activeTranscript === 'top'}
                                _selectionRef={topSelectionRef}
                                selectedText={selectedText}
                                setSelectedText={setSelectedText}
                                isAddCodeModalOpen={false}
                                isEditCodeModalOpen={false}
                                isDeleteCodeModalOpen={false}
                                isHighlightModalOpen={false}
                                isEditHighlightModalOpen={false}
                                isDeleteHighlightModalOpen={false}
                                setIsAddCodeModalOpen={() => {}}
                                setIsEditCodeModalOpen={() => {}}
                                setIsDeleteCodeModalOpen={() => {}}
                                setIsHighlightModalOpen={() => {}}
                                setIsEditHighlightModalOpen={() => {}}
                                setDeleteIsHighlightModalOpen={() => {}}
                            />
                        </TranscriptContextProvider>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SplitCheckPage;
