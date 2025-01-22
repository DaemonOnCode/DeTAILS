import { FC, useState } from 'react';

interface LeftPanelProps {
    sampledPosts: { id: string; title: string }[];
    codes: string[];
    onFilterSelect: (filter: string | null) => void;
    showTypeFilterDropdown?: boolean; // Optional prop to control filter dropdown visibility
    selectedTypeFilter: 'Human' | 'LLM' | 'All';
    handleSelectedTypeFilter?: (e: any) => void;
}

const LeftPanel: FC<LeftPanelProps> = ({
    sampledPosts,
    codes,
    onFilterSelect,
    showTypeFilterDropdown = false,
    selectedTypeFilter,
    handleSelectedTypeFilter
}) => {
    const [activeTab, setActiveTab] = useState<'posts' | 'codes'>('posts');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const handleSelect = (filter: string | null) => {
        setSelectedItem(filter);
        onFilterSelect(filter);
    };

    // const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    //     setSelectedFilter(event.target.value as 'Human' | 'LLM' | 'All');
    //     handleSelect(null); // Reset selection when filter changes
    // };

    return (
        <div className="p-6">
            {/* Conditional Filter Dropdown */}
            {showTypeFilterDropdown && (
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2">Load codes of:</label>
                    <select
                        value={selectedTypeFilter}
                        onChange={(e) => handleSelectedTypeFilter?.(e.target.value)}
                        className="w-full p-2 border rounded shadow bg-white cursor-pointer">
                        <option value="All">All</option>
                        <option value="Human">Human</option>
                        <option value="LLM">LLM</option>
                    </select>
                </div>
            )}
            {/* Tabs */}
            <div className="flex justify-around mb-4">
                <button
                    className={`py-2 px-4 w-1/2 ${activeTab === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    onClick={() => {
                        setActiveTab('posts');
                        handleSelect(null);
                    }}>
                    Posts
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

            {/* Posts Tab */}
            {activeTab === 'posts' ? (
                <ul className="space-y-2">
                    <li
                        className={`p-3 border rounded shadow cursor-pointer transition-all ${
                            selectedItem === null ? 'bg-blue-200 font-bold' : 'hover:bg-blue-100'
                        }`}
                        onClick={() => handleSelect(null)}>
                        Show All
                    </li>
                    {sampledPosts
                        // .filter(
                        //     (post) =>
                        //         selectedFilter === 'All' || post.title.includes(selectedFilter)
                        // )
                        .map((post, idx) => (
                            <li
                                key={idx}
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
                    {codes
                        // .filter((code) => selectedFilter === 'All' || code.includes(selectedFilter))
                        .map((code, index) => (
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
