import { FC, Suspense, useEffect, useRef, useState } from 'react';
import PostTab from './post-tab';
import { REMOTE_SERVER_ROUTES } from '../../../constants/Shared';
import useServerUtils from '../../../hooks/Shared/get-server-url';
import { useCollectionContext } from '../../../context/collection-context';
import { SetState } from '../../../types/Coding/shared';

interface LeftPanelProps {
    postIds: string[];
    codes: string[];
    onFilterSelect: (filter: string | null) => void;
    showTypeFilterDropdown?: boolean;
    selectedTypeFilter: 'New Data' | 'Codebook' | 'Human' | 'LLM' | 'All';
    handleSelectedTypeFilter?: (e: any) => void;
    setCurrentPost: SetState<string | null>;
    showCoderType?: boolean;
    codedPostsCount: number;
}

const LeftPanel: FC<LeftPanelProps> = ({
    postIds,
    codes,
    onFilterSelect,
    showTypeFilterDropdown = false,
    selectedTypeFilter,
    handleSelectedTypeFilter,
    setCurrentPost,
    showCoderType,
    codedPostsCount
}) => {
    const [activeTab, setActiveTab] = useState<'posts' | 'codes'>('posts');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const [postIdTitles, setPostIdTitles] = useState<{ id: string; title: string }[]>([]);

    const [loading, setLoading] = useState(false);

    const containerRef = useRef<HTMLUListElement>(null);

    const { getServerUrl } = useServerUtils();
    const { datasetId } = useCollectionContext();

    const handleSelect = (filter: string | null) => {
        setCurrentPost(filter);
        setSelectedItem((prev) => {
            console.log(prev, filter);
            if (
                (prev === 'coded-data' || prev?.split('|')?.[1] === 'coded-data') &&
                filter !== null
            ) {
                let newFilter = `${filter}|coded-data`;
                onFilterSelect(newFilter);
                return newFilter;
            }
            onFilterSelect(filter);
            return filter;
        });
    };

    const fetchTabData = async (postIds: string[], datasetId: string) => {
        if (!postIds.length || !datasetId) {
            return [];
        }
        setLoading(true);
        const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_POST_ID_TITLE_BATCH), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ post_ids: postIds, dataset_id: datasetId })
        });

        if (!res.ok) {
            setLoading(false);
            throw new Error('Failed to fetch data');
        }

        const results = await res.json();

        console.log('Results:', results);

        setPostIdTitles(
            results?.map((result: any) => ({ id: result.id, title: result.title })) ?? []
        );
        setLoading(false);
    };

    useEffect(() => {
        fetchTabData(postIds, datasetId);
    }, [postIds]);

    const allPostsCount = postIdTitles.length;
    return (
        <div className="h-full flex flex-col">
            {showTypeFilterDropdown && (
                <div className="mb-4">
                    <label className="block text-gray-700 font-bold mb-2">Load codes of:</label>
                    <select
                        value={selectedTypeFilter}
                        onChange={(e) => handleSelectedTypeFilter?.(e.target.value)}
                        className="w-full p-2 border rounded shadow bg-white cursor-pointer">
                        <option value="All">All</option>
                        {showCoderType ? (
                            <>
                                <option value="Human">Human</option>
                                <option value="LLM">LLM</option>
                            </>
                        ) : (
                            <>
                                <option value="New Data">New Data</option>
                                <option value="Codebook">Codebook</option>
                            </>
                        )}
                    </select>
                </div>
            )}

            <div className="flex justify-around mb-4">
                <button
                    className={`py-1 lg:py-2 px-2 lg:px-4 w-1/2 ${
                        activeTab === 'posts' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                    onClick={() => {
                        setActiveTab('posts');
                        handleSelect(null);
                    }}>
                    Posts
                </button>
                <button
                    className={`py-1 lg:py-2 px-1 lg:px-4 w-1/2 ${
                        activeTab === 'codes' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                    onClick={() => {
                        setActiveTab('codes');
                        handleSelect(null);
                    }}>
                    Codes
                </button>
            </div>

            <div>
                {activeTab === 'posts' ? (
                    <div className="flex justify-evenly items-center">
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === null
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect(null)}>
                            All Posts ({allPostsCount})
                        </span>
                        <span
                            className={`p-1.5 lg:p-3 border rounded shadow cursor-pointer transition-all ${
                                selectedItem === 'coded-data' ||
                                selectedItem?.split('|')?.[1] === 'coded-data'
                                    ? 'bg-blue-200 font-bold'
                                    : 'hover:bg-blue-100'
                            }`}
                            onClick={() => handleSelect('coded-data')}>
                            Coded Posts ({codedPostsCount})
                        </span>
                    </div>
                ) : (
                    <div
                        className={`p-3 border rounded shadow cursor-pointer transition-all ${
                            selectedItem === null ? 'bg-blue-200 font-bold' : 'hover:bg-blue-100'
                        }`}
                        onClick={() => handleSelect(null)}>
                        Show All ({codes.length})
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto min-h-0 my-2 gap-y-2">
                {activeTab === 'posts' ? (
                    <ul className="space-y-2" ref={containerRef}>
                        {loading ? (
                            <li>Loading...</li>
                        ) : postIdTitles.length === 0 ? (
                            <div>No posts found</div>
                        ) : (
                            postIdTitles.map((postIdTitle) => (
                                <PostTab
                                    key={postIdTitle.id}
                                    postIdTitle={postIdTitle}
                                    selectedItem={selectedItem}
                                    handleSelect={handleSelect}
                                    containerRef={containerRef}
                                />
                            ))
                        )}
                    </ul>
                ) : (
                    <ul className="space-y-2">
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
        </div>
    );
};

export default LeftPanel;
