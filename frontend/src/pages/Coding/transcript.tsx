import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PostTranscript from '../../components/Coding/CodingOverview/post-transcript';

const TranscriptPage = () => {
    const { id, state } = useParams<{ id: string; state: 'review' | 'refine' }>();
    const [post, setPost] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

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
        <div className="p-6">
            <h1 className="text-xl font-bold mb-4">Transcript for Post ID: {id}</h1>
            <PostTranscript
                post={post}
                onBack={() => window.history.back()}
                review={state === 'review'}
            />
        </div>
    );
};

export default TranscriptPage;
