import { useState } from 'react';
import LeftPanel from './left-panel';
import ValidationTable from './validation-table';
import PostTranscript from './post-transcript';
import { useNavigate } from 'react-router-dom';

interface UnifiedCodingPageProps {
    data: {
        postId: string;
        quote: string;
        explanation: string;
        code: string;
        theme: string;
    }[];
    review?: boolean;
    showThemes?: boolean;
    download?: boolean;
    showCodebook?: boolean;
    split?: boolean;
}

const UnifiedCodingPage: React.FC<UnifiedCodingPageProps> = ({
    data,
    review = true,
    showThemes = false,
    download = false,
    showCodebook = false,
    split = false
}) => {
    const [viewTranscript, setViewTranscript] = useState(false);
    const [currentPost, setCurrentPost] = useState<any | null>(null);
    const [filter, setFilter] = useState<string | null>(null);
    const [isThemesVisible, setIsThemesVisible] = useState(showThemes);
    const [responses, setResponses] = useState(
        data.map((item) => ({ ...item, isMarked: undefined, comment: '' }))
    );

    const navigate = useNavigate();

    // Handle viewing transcript for a post
    const handleViewTranscript = (postId: string) => {
        const post = responses.find((p) => p.postId === postId);
        if (post) {
            setCurrentPost({
                ...post,
                selftext: `This is the full transcript of the post discussing ${post.quote}`,
                comments: [
                    { id: 'c1', body: 'Great insights!', comments: [] },
                    {
                        id: 'c2',
                        body: 'I learned something new.',
                        comments: [{ id: 'c3', body: 'Agreed!' }]
                    }
                ]
            });
            let params = new URLSearchParams();
            if (split) {
                params.append('split', 'true');
            }
            if (showCodebook) {
                params.append('codebook', 'true');
            }

            navigate(
                `/coding/transcript/${postId}/${review ? 'review' : 'refine'}?${params.toString()}`
            );
            setViewTranscript(true);
        }
    };

    const handleBackToTable = () => {
        setViewTranscript(false);
    };

    const filteredData = filter
        ? responses.filter((response) => response.postId === filter || response.code === filter)
        : responses;

    // Function to generate and download codebook CSV
    const downloadCodebook = () => {
        const headers = ['Post ID', 'Sentence', 'Coded Word', 'Theme'];
        const csvRows = [headers.join(',')];

        filteredData.forEach((row) => {
            csvRows.push(`${row.postId},"${row.quote}","${row.code}","${row.theme || 'N/A'}"`);
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
        setResponses(updatedResponses);
    };

    // Function to re-run the coding with updates
    const handleReRunCoding = () => {
        console.log('Re-running coding with updated responses:', responses);
    };

    return (
        <div className="-m-6 overflow-hidden">
            <div className="flex h-[calc(100vh-8rem)]">
                {!viewTranscript && (
                    <div className="w-1/4 border-r overflow-auto">
                        <LeftPanel
                            sampledPosts={responses.map((item) => ({
                                id: item.postId,
                                title: item.quote
                            }))}
                            codes={Array.from(new Set(responses.map((item) => item.code)))}
                            onFilterSelect={setFilter}
                        />
                    </div>
                )}

                <div className={viewTranscript ? 'w-full' : 'w-3/4 flex flex-col'}>
                    {!viewTranscript ? (
                        <>
                            {download && (
                                <div className="flex justify-between items-center px-6 py-2">
                                    <button
                                        onClick={downloadCodebook}
                                        className="px-4 py-2 bg-green-500 text-white rounded">
                                        Download Codebook
                                    </button>
                                </div>
                            )}

                            <ValidationTable
                                codeResponses={filteredData}
                                onViewTranscript={handleViewTranscript}
                                review={review}
                                showThemes={isThemesVisible}
                                onReRunCoding={handleReRunCoding}
                                onUpdateResponses={handleUpdateResponses}
                            />
                        </>
                    ) : (
                        <PostTranscript
                            post={currentPost}
                            onBack={handleBackToTable}
                            review={review}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedCodingPage;
