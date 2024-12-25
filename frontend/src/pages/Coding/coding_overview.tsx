import React, { useState, useEffect } from 'react';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { ROUTES } from '../../constants/Coding/shared';
import PostCard from '../../components/Coding/CodingOverview/post-card';
import PostTranscript from '../../components/Coding/CodingOverview/post-transcript';

const CodingOverviewPage = () => {
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<
        {
            id: string;
            title: string;
        }[]
    >([]);
    const [currentPost, setCurrentPost] = useState<(typeof posts)[number] | null>(null);
    const [viewTranscript, setViewTranscript] = useState(false);

    useEffect(() => {
        // Simulating fetch for posts
        setTimeout(() => {
            const fetchedPosts = [
                { id: '1', title: 'Understanding React Hooks' },
                { id: '2', title: 'JavaScript ES6 Features' },
                { id: '3', title: 'Introduction to TypeScript' },
                { id: '4', title: 'Understanding React Hooks' },
                { id: '5', title: 'JavaScript ES6 Features' },
                { id: '6', title: 'Introduction to TypeScript' },
                { id: '7', title: 'Understanding React Hooks' },
                { id: '8', title: 'JavaScript ES6 Features' },
                { id: '9', title: 'Introduction to TypeScript' },
                { id: '10', title: 'Understanding React Hooks' },
                { id: '11', title: 'JavaScript ES6 Features' },
                { id: '12', title: 'Introduction to TypeScript' },
                { id: '13', title: 'Understanding React Hooks' },
                { id: '14', title: 'JavaScript ES6 Features' },
                { id: '15', title: 'Introduction to TypeScript' },
                { id: '16', title: 'Understanding React Hooks' },
                { id: '17', title: 'JavaScript ES6 Features' },
                { id: '18', title: 'Introduction to TypeScript' },
                { id: '19', title: 'Understanding React Hooks' },
                { id: '20', title: 'JavaScript ES6 Features' },
                { id: '21', title: 'Introduction to TypeScript' },
                { id: '22', title: 'Understanding React Hooks' },
                { id: '23', title: 'JavaScript ES6 Features' },
                { id: '24', title: 'Introduction to TypeScript' },
                { id: '25', title: 'Understanding React Hooks' },
                { id: '26', title: 'JavaScript ES6 Features' },
                { id: '27', title: 'Introduction to TypeScript' },
                { id: '28', title: 'Understanding React Hooks' },
                { id: '29', title: 'JavaScript ES6 Features' },
                { id: '30', title: 'Introduction to TypeScript' },
                { id: '31', title: 'Understanding React Hooks' },
                { id: '32', title: 'JavaScript ES6 Features' },
                { id: '33', title: 'Introduction to TypeScript' }
            ];
            setPosts(fetchedPosts);
            setLoading(false);
        }, 1000); // Simulate API delay
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

    return (
        <div className="h-full flex justify-between flex-col">
            <div className="min-h-[calc(100vh-12rem)] h-[calc(100vh-12rem)] overflow-auto">
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
