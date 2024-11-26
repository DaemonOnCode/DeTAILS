import { FC, useState } from 'react';
import { LeftPanelProps } from '../../../types/Coding/props';

const LeftPanel: FC<LeftPanelProps> = ({
    selectedTab,
    setSelectedTab,
    posts,
    setSelectedPost,
    codes,
    setSelectedCodeForReferences
}) => {
    const [searchText, setSearchText] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Filtered posts or codes based on search text
    const filteredPosts = posts.filter((post) =>
        post.title.toLowerCase().includes(searchText.toLowerCase())
    );
    const filteredCodes = codes.filter((code) =>
        code.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="w-1/4 bg-white border-r border-gray-300 h-full flex flex-col">
            {/* Tabs Section (Sticky) */}
            <div className="flex justify-around mb-2 border-b sticky top-0 bg-white z-10">
                <button
                    className={`flex-1 text-center py-2 font-semibold transition-colors ${
                        selectedTab === 'data'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-blue-500'
                    }`}
                    onClick={() => setSelectedTab('data')}>
                    Data
                </button>
                <button
                    className={`flex-1 text-center py-2 font-semibold transition-colors ${
                        selectedTab === 'codes'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-blue-500'
                    }`}
                    onClick={() => setSelectedTab('codes')}>
                    Codes
                </button>
            </div>

            {/* Search Section */}
            <div className="p-2 sticky top-[50px] bg-white z-10 border-b">
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={`Search ${selectedTab === 'data' ? 'Data' : 'Codes'}...`}
                    className="w-full p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Scrollable Content Section */}
            <div className="overflow-y-auto overflow-x-hidden flex-1">
                {selectedTab === 'data' && (
                    <ul className="space-y-2 p-2">
                        {filteredPosts.map((post) => (
                            <li
                                key={post.id}
                                className={`p-3 rounded-md transition-colors cursor-pointer shadow-sm ${
                                    selectedItemId === post.id
                                        ? 'bg-blue-100 border border-blue-500'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                                onClick={() => {
                                    setSelectedPost(post);
                                    setSelectedCodeForReferences(null);
                                    setSelectedItemId(post.id); // Highlight selected post
                                }}>
                                <span className="text-gray-800 font-medium">{post.title}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {selectedTab === 'codes' && (
                    <ul className="space-y-2 p-2">
                        {filteredCodes.map((code, idx) => (
                            <li
                                key={idx}
                                className={`p-3 rounded-md transition-colors cursor-pointer shadow-sm ${
                                    selectedItemId === code
                                        ? 'bg-blue-100 border border-blue-500'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                                onClick={() => {
                                    setSelectedCodeForReferences(code);
                                    setSelectedPost(null);
                                    setSelectedItemId(code); // Highlight selected code
                                }}>
                                <span className="text-gray-800 font-medium">{code}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default LeftPanel;
