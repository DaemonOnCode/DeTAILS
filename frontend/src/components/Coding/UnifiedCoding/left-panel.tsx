import { FC, useState } from 'react';

interface LeftPanelProps {
    sampledPosts: { id: string; title: string }[];
    codes: string[];
    onFilterSelect: (filter: string | null) => void;
}

const LeftPanel: FC<LeftPanelProps> = ({ sampledPosts, codes, onFilterSelect }) => {
    const [activeTab, setActiveTab] = useState<'posts' | 'codes'>('posts');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const handleSelect = (filter: string | null) => {
        setSelectedItem(filter);
        onFilterSelect(filter);
    };

    console.log('Codes', codes);

    return (
        <div className="p-4">
            {/* Tabs */}
            <div className="flex justify-around mb-4">
                <button
                    className={`py-2 px-4 w-1/2 ${activeTab === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => {
                        setActiveTab('posts');
                        handleSelect(null);
                    }}>
                    Sampled Posts
                </button>
                <button
                    className={`py-2 px-4 w-1/2 ${activeTab === 'codes' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => {
                        setActiveTab('codes');
                        handleSelect(null);
                    }}>
                    Codes
                </button>
            </div>

            {/* Sampled Posts Tab */}
            {activeTab === 'posts' ? (
                <ul className="space-y-2">
                    <li
                        className={`p-3 border rounded shadow cursor-pointer transition-all ${
                            selectedItem === null ? 'bg-blue-200 font-bold' : 'hover:bg-blue-100'
                        }`}
                        onClick={() => handleSelect(null)}>
                        Show All
                    </li>
                    {sampledPosts.map((post) => (
                        <li
                            key={post.id}
                            className={`p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === post.id
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect(post.id)}>
                            {post.title}
                        </li>
                    ))}
                </ul>
            ) : (
                // Codes Tab
                <ul className="space-y-2">
                    <li
                        className={`p-3 border rounded shadow cursor-pointer transition-all ${
                            selectedItem === null ? 'bg-blue-200 font-bold' : 'hover:bg-blue-100'
                        }`}
                        onClick={() => handleSelect(null)}>
                        Show All
                    </li>
                    {codes.map((code, index) => (
                        <li
                            key={index}
                            className={`p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === code
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect(code)}>
                            {code}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LeftPanel;
