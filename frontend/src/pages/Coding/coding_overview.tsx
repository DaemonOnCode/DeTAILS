import { useState, useEffect, useRef } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { ROUTES } from '../../constants/Coding/shared';
import PostCard from '../../components/Coding/CodingOverview/post-card';
import PostTranscript from '../../components/Coding/CodingOverview/post-transcript';
import { useCodingContext } from '../../context/coding_context';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { useCollectionContext } from '../../context/collection_context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const CodingOverviewPage = () => {
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [currentPost, setCurrentPost] = useState<(typeof posts)[number] | null>(null);
    const [viewTranscript, setViewTranscript] = useState(false);

    const { finalCodeResponses } = useCodingContext();
    const { datasetId } = useCollectionContext();

    const { saveWorkspaceData } = useWorkspaceUtils();

    const { getServerUrl } = useServerUtils();
    const hasSavedRef = useRef(false);

    const postIdSet = new Set(finalCodeResponses.map((response) => response.postId));

    const fetchPosts = async () => {
        setLoading(true);
        const fetchedPosts = await Promise.all(
            Array.from(postIdSet).map(async (postId) => {
                const response = await fetch(
                    getServerUrl(REMOTE_SERVER_ROUTES.GET_REDDIT_POST_BY_ID),
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ postId, datasetId })
                    }
                );
                const data = await response.json();
                return data;
            })
        );
        setPosts(fetchedPosts);
        setLoading(false);
        console.log('Fetched posts:', fetchedPosts);
    };

    useEffect(() => {
        fetchPosts();

        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    const handleViewTranscript = (postId: string) => {
        const post = posts.find((p) => p.id === postId);
        if (!post) return;
        setCurrentPost(post);
        setViewTranscript(true);
    };

    const handleBackToPosts = () => {
        setViewTranscript(false);
    };

    if (loading) return <div>Loading Coding overview...</div>;

    if (!posts.length) return <div>No codes validated</div>;

    return (
        <div className="h-full flex justify-between flex-col">
            <div>
                {!viewTranscript ? (
                    <PostCard posts={posts} onPostClick={handleViewTranscript} />
                ) : (
                    <PostTranscript post={currentPost} onBack={handleBackToPosts} />
                )}
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.CODING_VALIDATION}
                nextPage={ROUTES.FINAL}
                isReady={true}
            />
        </div>
    );
};

export default CodingOverviewPage;
