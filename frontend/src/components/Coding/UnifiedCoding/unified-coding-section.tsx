import { useState } from 'react';
import LeftPanel from './left-panel';
import ValidationTable from './validation-table';
import PostTranscript from './post-transcript';
import { useNavigate } from 'react-router-dom';

interface UnifiedCodingPageProps {
    review?: boolean;
    showThemes?: boolean;
}

const UnifiedCodingPage: React.FC<UnifiedCodingPageProps> = ({
    review = true,
    showThemes = false
}) => {
    const [viewTranscript, setViewTranscript] = useState(false);
    const [currentPost, setCurrentPost] = useState<any | null>(null);
    const [filter, setFilter] = useState<string | null>(null);
    const [isThemesVisible, setIsThemesVisible] = useState(showThemes);

    const sampledPosts = [
        { id: '1', title: 'Post about AI' },
        { id: '2', title: 'Understanding React' },
        { id: '3', title: 'JavaScript Tips 1' },
        { id: '4', title: 'React Tips 1' }
    ];

    const codeResponses = [
        { postId: '1', sentence: 'AI is evolving rapidly.', coded_word: 'AI', theme: 'Technology' },
        {
            postId: '2',
            sentence: 'React hooks simplify state management.',
            coded_word: 'React',
            theme: 'Web Development'
        },
        {
            postId: '3',
            sentence: 'JavaScript is versatile.',
            coded_word: 'JavaScript',
            theme: 'Programming'
        },
        {
            postId: '4',
            sentence: 'JavaScript is versatile.',
            coded_word: 'React',
            theme: 'Frontend'
        }
    ];

    const navigate = useNavigate();

    // Handle viewing transcript for a post
    const handleViewTranscript = (postId: string) => {
        const post = sampledPosts.find((p) => p.id === postId);
        if (post) {
            setCurrentPost({
                ...post,
                selftext: `This is the full transcript of the post discussing ${post.title}`,
                comments: [
                    { id: 'c1', body: 'Great insights!', comments: [] },
                    {
                        id: 'c2',
                        body: 'I learned something new.',
                        comments: [{ id: 'c3', body: 'Agreed!' }]
                    }
                ]
            });
            navigate(`/coding/transcript/${postId}/${review ? 'review' : 'refine'}`);
            setViewTranscript(true);
        }
    };

    const handleBackToTable = () => {
        setViewTranscript(false);
    };

    const filteredData = filter
        ? codeResponses.filter(
              (response) => response.postId === filter || response.coded_word === filter
          )
        : codeResponses;

    // Function to generate and download codebook CSV
    const downloadCodebook = () => {
        const headers = ['Post ID', 'Sentence', 'Coded Word', 'Theme'];
        const csvRows = [headers.join(',')];

        filteredData.forEach((row) => {
            csvRows.push(
                `${row.postId},"${row.sentence}","${row.coded_word}","${row.theme || 'N/A'}"`
            );
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

    return (
        <div className="flex h-screen">
            {!viewTranscript && (
                <div className="w-1/4 border-r overflow-auto">
                    <LeftPanel
                        sampledPosts={sampledPosts}
                        codes={Array.from(new Set(codeResponses.map((item) => item.coded_word)))}
                        onFilterSelect={setFilter}
                    />
                </div>
            )}

            <div className={viewTranscript ? 'w-full' : 'w-3/4 flex flex-col'}>
                {!viewTranscript ? (
                    <>
                        {showThemes && (
                            <div className="text-center mb-4 p-4">
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
                        />
                    </>
                ) : (
                    <PostTranscript post={currentPost} onBack={handleBackToTable} review={review} />
                )}
            </div>
        </div>
    );
};

export default UnifiedCodingPage;
