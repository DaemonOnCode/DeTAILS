import { FC } from 'react';
import { ContentAreaTabs, IRedditPostData, SetState } from '../../types/shared';

interface LeftPanelProps {
    selectedTab: ContentAreaTabs;
    setSelectedTab: SetState<ContentAreaTabs>;
    mockPosts: IRedditPostData[];
    setSelectedPost: SetState<IRedditPostData | null>;
    codes: string[];
    setSelectedCodeForReferences: SetState<string | null>;
}

const LeftPanel: FC<LeftPanelProps> = ({
    selectedTab,
    setSelectedTab,
    mockPosts,
    setSelectedPost,
    codes,
    setSelectedCodeForReferences
}) => (
    <div className="w-1/4 bg-gray-100 p-4 border-r overflow-y-auto">
        <div className="flex space-x-4 mb-4">
            <button
                className={`font-semibold ${
                    selectedTab === 'data'
                        ? 'text-blue-500 border-b-2 border-blue-500'
                        : 'text-gray-600'
                }`}
                onClick={() => setSelectedTab('data')}>
                Data
            </button>
            <button
                className={`font-semibold ${
                    selectedTab === 'codes'
                        ? 'text-blue-500 border-b-2 border-blue-500'
                        : 'text-gray-600'
                }`}
                onClick={() => setSelectedTab('codes')}>
                Codes
            </button>
        </div>
        {selectedTab === 'data' && (
            <ul>
                {mockPosts.map((post) => (
                    <li
                        key={post.id}
                        className="cursor-pointer p-2 hover:bg-gray-200"
                        onClick={() => {
                            setSelectedPost(post);
                            setSelectedCodeForReferences(null);
                        }}>
                        {post.title}
                    </li>
                ))}
            </ul>
        )}
        {selectedTab === 'codes' && (
            <ul>
                {codes.map((code, idx) => (
                    <li
                        key={idx}
                        className="cursor-pointer p-2 hover:bg-gray-200"
                        onClick={() => setSelectedCodeForReferences(code)}>
                        {code}
                    </li>
                ))}
            </ul>
        )}
    </div>
);

export default LeftPanel;
