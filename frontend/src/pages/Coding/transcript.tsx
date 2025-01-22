import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PostTranscript from '../../components/Coding/CodingOverview/post-transcript';
import TopToolbar from '../../components/Coding/Shared/top-toolbar';
import ValidationTable from '../../components/Coding/UnifiedCoding/validation-table';
import { useCodingContext } from '../../context/coding_context';

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
        unseenPostWithThemeData,
        llmCodeResponses,
        humanCodeResponses,
        dispatchLLMCodeResponses,
        dispatchHumanCodeResponses
    } = useCodingContext();

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

    const handleUpdateResponses = (updatedResponses: any[]) => {
        console.log('Updated responses:', updatedResponses);
        dispatchHumanCodeResponses({
            type: 'SET_RESPONSES',
            responses: updatedResponses.filter((r) => r.type === 'Human')
        });
        dispatchLLMCodeResponses({
            type: 'SET_RESPONSES',
            responses: updatedResponses.filter((r) => r.type === 'LLM')
        });
    };

    useEffect(() => {
        // Simulating API fetch, replace with real API call
        const fetchPostById = async (postId: string) => {
            setLoading(true);
            try {
                // Simulated fetch request - replace with actual fetch
                const fetchedPost = {
                    id: postId,
                    title: `Post Title for ID ${postId}`,
                    selftext: 'This is a sample transcript content.',
                    comments: [
                        { id: 'c1', body: 'Great insights!', comments: [] },
                        {
                            id: 'c2',
                            body: 'Nice analysis.',
                            comments: [{ id: 'c3', body: 'Agreed!' }]
                        },
                        {
                            id: 'c4',
                            body: 'Nice analysis.',
                            comments: [{ id: 'c5', body: 'Agreed!' }]
                        },
                        {
                            id: 'c6',
                            body: 'Nice analysis.',
                            comments: [{ id: 'c7', body: 'Agreed!' }]
                        }
                    ]
                };
                setPost(fetchedPost);
            } catch (error) {
                console.error('Error fetching post:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchPostById(id);
        }
    }, [id]);

    useEffect(() => {
        console.log(activeTranscript);
    }, [activeTranscript]);

    if (loading) {
        return <div>Loading transcript...</div>;
    }

    if (!post) {
        return <div>Post not found</div>;
    }

    // const filteredData = unseenPostWithThemeData;

    const [topTranscript, bottomTranscript] = splitIsTrue ? ['Human', 'LLM'] : [null, type];

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
                                ? (topTranscript as any)
                                : activeTranscript === 'bottom'
                                  ? (bottomTranscript as any)
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
                            codeResponses={[...llmCodeResponses, ...humanCodeResponses]}
                            onViewTranscript={() => {}}
                            review={true}
                            showThemes={true}
                            onReRunCoding={() => {}}
                            onUpdateResponses={handleUpdateResponses}
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
                                            codeResponses={[
                                                ...llmCodeResponses,
                                                ...humanCodeResponses
                                            ]}
                                            onViewTranscript={() => {}}
                                            review={false}
                                            showThemes
                                            onReRunCoding={() => {}}
                                            onUpdateResponses={handleUpdateResponses}
                                        />
                                    </>
                                ) : (
                                    <PostTranscript
                                        post={post}
                                        onBack={() => window.history.back()}
                                        codeResponses={humanCodeResponses}
                                        isActive={activeTranscript === 'top'}
                                        dispatchCodeResponse={dispatchHumanCodeResponses}
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
                                codeResponses={
                                    type === 'Human' ? humanCodeResponses : llmCodeResponses
                                }
                                isActive={activeTranscript === 'bottom'}
                                dispatchCodeResponse={
                                    type === 'Human'
                                        ? dispatchHumanCodeResponses
                                        : dispatchLLMCodeResponses
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
