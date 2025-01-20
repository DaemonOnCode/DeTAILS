import { FC } from 'react';

interface SampledPostsProps {
    posts: { id: string; title: string }[];
    onSelectPost: (postId: string) => void;
}

const SampledPosts: FC<SampledPostsProps> = ({ posts, onSelectPost }) => {
    return (
        <div className="p-4">
            <h2 className="text-lg font-bold mb-4">Sampled Posts</h2>
            <ul className="space-y-2">
                {posts.map((post) => (
                    <li
                        key={post.id}
                        className="p-3 border rounded shadow cursor-pointer hover:bg-blue-100 transition-all"
                        onClick={() => onSelectPost(post.id)}>
                        {post.title}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SampledPosts;
