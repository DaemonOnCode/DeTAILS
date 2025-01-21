import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PostTranscript from '../../components/Coding/CodingOverview/post-transcript';

const TranscriptPage = () => {
    const { id, state } = useParams<{ id: string; state: 'review' | 'refine' }>();
    const [searchParams] = useSearchParams();
    const [split] = searchParams.getAll('split');
    const [codebook] = searchParams.getAll('codebook');
    console.log(searchParams, split, codebook);
    const [post, setPost] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCodebook, setShowCodebook] = useState(false);

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

    if (loading) {
        return <div>Loading transcript...</div>;
    }

    if (!post) {
        return <div>Post not found</div>;
    }

    return (
        <div className="h-page flex flex-col -m-6">
            {showCodebook && (
                <div className="h-[40%] overflow-auto border-b border-gray-300 p-4 m-6">
                    {[...Array(30)].map((_, index) => (
                        <p key={index}>Show Codebook {index + 1}</p>
                    ))}
                </div>
            )}

            <div
                className={`${codebook === 'true' ? 'h-[60%]' : 'h-full'} flex-1 flex flex-col overflow-hidden`}>
                {codebook === 'true' && (
                    <div className="flex justify-center p-3">
                        <button
                            className="bg-blue-500 text-white rounded px-4 py-2"
                            onClick={() => setShowCodebook((prev) => !prev)}>
                            {showCodebook ? 'Hide Codebook' : 'Show Codebook'}
                        </button>
                    </div>
                )}

                <div className={`${codebook === 'true' ? 'h-[85%]' : 'h-full'}`}>
                    <PostTranscript
                        post={post}
                        onBack={() => window.history.back()}
                        review={state === 'review'}
                    />
                </div>
            </div>
        </div>
    );
};

export default TranscriptPage;
