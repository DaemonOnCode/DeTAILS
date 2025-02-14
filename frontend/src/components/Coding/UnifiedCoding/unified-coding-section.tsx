import { useState } from 'react';
import LeftPanel from './left-panel';
import ValidationTable from './validation-table';
import PostTranscript from './post-transcript';
import { useNavigate } from 'react-router-dom';
import {
    IQECResponse,
    IQECRow,
    IQECTResponse,
    IQECTRow,
    IQECTTyResponse,
    IQECTTyRow
} from '../../../types/Coding/shared';
import { ROUTES } from '../../../constants/Coding/shared';

interface UnifiedCodingPageProps {
    postIds: string[];
    data: IQECResponse[] | IQECTResponse[] | IQECTTyResponse[];
    dispatchFunction: (data: any) => void;
    review?: boolean;
    showThemes?: boolean;
    download?: boolean;
    showCodebook?: boolean;
    split?: boolean;
    showFilterDropdown?: boolean;
    showRerunCoding?: boolean;
    handleRerun?: () => void;
    conflictingResponses?: IQECResponse[];
}

const UnifiedCodingPage: React.FC<UnifiedCodingPageProps> = ({
    postIds,
    data,
    dispatchFunction,
    // review = true,
    showThemes = false,
    download = true,
    showCodebook = false,
    split = undefined,
    showFilterDropdown = false,
    showRerunCoding = false,
    handleRerun = () => {},
    conflictingResponses = []
}) => {
    console.log('Data:', data);
    const [viewTranscript, setViewTranscript] = useState(false);
    const [currentPost, setCurrentPost] = useState<any | null>(null);
    const [filter, setFilter] = useState<string | null>(null);

    const [review, setReview] = useState(true);

    const [selectedTypeFilter, setSelectedTypeFilter] = useState<'Human' | 'LLM' | 'All'>('All');

    const isThemesVisible = showThemes;
    // const responses = data;
    // const [isThemesVisible, setIsThemesVisible] = useState(showThemes);
    const [responses, setResponses] = useState(data ?? []);

    const navigate = useNavigate();

    // Handle viewing transcript for a post
    const handleViewTranscript = (postId: string | null) => {
        if (!postId) {
            navigate('../' + ROUTES.TRANSCRIPTS, {
                state: {
                    split,
                    showCodebook,
                    review,
                    showThemes,
                    showFilterDropdown,
                    postIds,
                    selectedTypeFilter
                }
            });
            return;
        }
        // const post = responses.find((p) => p.postId === postId);
        // if (post) {
        //     setCurrentPost({
        //         ...post,
        //         selftext: `This is the full transcript of the post discussing ${post.quote}`,
        //         comments: [
        //             { id: 'c1', body: 'Great insights!', comments: [] },
        //             {
        //                 id: 'c2',
        //                 body: 'I learned something new.',
        //                 comments: [{ id: 'c3', body: 'Agreed!' }]
        //             }
        //         ]
        //     });
        let params = new URLSearchParams();
        if (split !== undefined) {
            if (selectedTypeFilter !== 'All') {
                params.append('type', selectedTypeFilter);
            } else {
                params.append('split', split.toString());
            }
        }
        if (showCodebook) {
            params.append('codebook', 'true');
        }

        navigate(
            `/coding/transcript/${postId}/${review ? 'review' : 'refine'}?${params.toString()}`
        );
        // setViewTranscript(true);
        // }
    };

    // const handleBackToTable = () => {
    //     setViewTranscript(false);
    // };

    const filteredData = filter
        ? filter === 'coded-data'
            ? data
            : filter?.split('|')?.[1] === 'coded-data'
              ? data.filter((response) => response.postId === filter.split('|')[0])
              : data.filter((response) => response.postId === filter || response.code === filter)
        : data;

    const filteredPostIds =
        filter === 'coded-data' || filter?.split('|')?.[1] === 'coded-data'
            ? postIds.filter((postId) => data.some((item) => item.postId === postId))
            : postIds;

    console.log('Filtered Data:', filteredData);
    console.log('Filtered Post IDs:', filteredPostIds);

    // Function to generate and download codebook CSV
    const downloadCodebook = () => {
        const headers = ['Post ID', 'Sentence', 'Coded Word', 'Theme', 'Type'];
        const csvRows = [headers.join(',')];

        filteredData.forEach((row) => {
            if ('type' in row && 'theme' in row) {
                csvRows.push(
                    `${row.postId},"${row.quote}","${row.code}","${row.theme || 'N/A'}","${row.type || 'N/A'}"`
                );
            } else if ('theme' in row) {
                csvRows.push(
                    `${row.postId},"${row.quote}","${row.code}","${row.theme || 'N/A'}", "N/A"`
                );
            } else {
                csvRows.push(`${row.postId},"${row.quote}","${row.code}","N/A", "N/A"`);
            }
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = 'codebook.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    // Update responses when users mark/edit them
    const handleUpdateResponses = (updatedResponses: any[]) => {
        // setResponses(updatedResponses);
        dispatchFunction({
            type: 'SET_RESPONSES',
            responses: updatedResponses
        });
    };

    const handleSelectedTypeFilter = (type: 'Human' | 'LLM' | 'All') => {
        setSelectedTypeFilter(type);
        setResponses(
            // @ts-ignore
            data.filter((item) => {
                if ('type' in item) {
                    if (type === 'All') {
                        return true;
                    }
                    return item.type === type;
                }
            })
        );
    };

    // Function to re-run the coding with updates
    const handleReRunCoding = () => {
        console.log('Re-running coding with updated responses:', responses);
        handleRerun();
    };

    const hasActionButton = download || showRerunCoding; // Only one will be true at a time
    // const tableHeight: string = hasActionButton ? 'calc(100vh - 16rem)' : 'calc(100vh - 10rem)';

    return (
        <div className="h-full flex flex-col -m-6 overflow-hidden responsive-text">
            <div className="flex flex-1 overflow-y-auto">
                <div className="w-1/4 border-r flex-1 overflow-auto p-6 pb-0">
                    <LeftPanel
                        postIds={filteredPostIds}
                        codes={Array.from(new Set(responses.map((item) => item.code)))}
                        onFilterSelect={setFilter}
                        showTypeFilterDropdown={showFilterDropdown}
                        selectedTypeFilter={selectedTypeFilter}
                        handleSelectedTypeFilter={handleSelectedTypeFilter}
                    />
                </div>

                <div className={`${viewTranscript ? 'w-full' : 'w-3/4'} flex flex-col h-full`}>
                    <div className="flex justify-evenly items-center p-6">
                        <button
                            onClick={downloadCodebook}
                            className="px-4 py-2 bg-green-500 text-white rounded">
                            Download Codebook
                        </button>

                        <div className="flex text-center justify-center items-center p-2 lg:p-4 gap-x-2">
                            {/* Left Label: Post View */}
                            <span
                                className={`cursor-pointer select-none ${
                                    review ? 'font-bold text-blue-500' : 'text-gray-700'
                                }`}
                                onClick={() => setReview(true)}>
                                Review Mode
                            </span>

                            {/* Toggle Switch */}
                            <label
                                htmlFor="toggleReview"
                                className="relative inline-block w-6 lg:w-12 h-3 lg:h-6 cursor-pointer">
                                <input
                                    id="toggleReview"
                                    type="checkbox"
                                    className="sr-only"
                                    checked={review}
                                    onChange={() => setReview((prev) => !prev)}
                                />
                                <div className="block bg-gray-300 w-6 lg:w-12 h-3 lg:h-6 rounded-full"></div>
                                <div
                                    className={`dot absolute left-0.5 lg:left-1 top-0.5 lg:top-1 bg-white w-2 lg:w-4 h-2 lg:h-4 rounded-full transition-transform ${
                                        !review ? 'translate-x-3 lg:translate-x-6 bg-blue-500' : ''
                                    }`}></div>
                            </label>

                            {/* Right Label: Code View */}
                            <span
                                className={`cursor-pointer select-none ${
                                    !review ? 'font-bold text-blue-500' : 'text-gray-700'
                                }`}
                                onClick={() => setReview(false)}>
                                Edit Mode
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6">
                        <ValidationTable
                            codeResponses={filteredData}
                            dispatchCodeResponses={dispatchFunction}
                            onViewTranscript={handleViewTranscript}
                            review={review}
                            showThemes={isThemesVisible}
                            onReRunCoding={handleReRunCoding}
                            onUpdateResponses={handleUpdateResponses}
                            conflictingResponses={conflictingResponses}
                        />
                    </div>
                    {showRerunCoding && (
                        <div className="flex justify-center p-6">
                            <button
                                onClick={handleReRunCoding}
                                className="px-4 py-2 bg-green-500 text-white rounded">
                                Re-run Coding
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedCodingPage;
