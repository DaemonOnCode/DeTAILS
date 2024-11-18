import { useState } from 'react';
import { ROUTES, mockPosts } from '../constants/shared';
import { IRedditPostData } from '../types/shared';
import HighlightModal from '../components/InitialCoding/highlight_modal';
import AddCodeModal from '../components/InitialCoding/add_code_modal';
import ContentArea from '../components/InitialCoding/content_area';
import LeftPanel from '../components/InitialCoding/left_panel';
import TopToolbar from '../components/InitialCoding/top_toolbar';
import NavigationBottomBar from '../components/Shared/navigation_bottom_bar';

const InitialCodingPage = () => {
    const [selectedPost, setSelectedPost] = useState<IRedditPostData | null>(null);
    const [codes, setCodes] = useState<string[]>(['Important', 'Follow-up']);
    const [references, setReferences] = useState<{
        [code: string]: { text: string; postId: number; isComment: boolean }[];
    }>({});
    const [isAddCodeModalOpen, setIsAddCodeModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState<string>('');
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [selectedTab, setSelectedTab] = useState<'data' | 'codes'>('data');
    const [selectedCodeForReferences, setSelectedCodeForReferences] = useState<string | null>(null);

    // Capture selected text
    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const selected = selection.toString();
            setSelectedText(selected || null);
        }
    };

    // Apply code to the selected text
    const applyCodeToSelection = () => {
        if (!selectedText || !selectedCode) {
            alert('Please select text and choose a code to apply.');
            return;
        }

        const isComment =
            (selectedPost?.comments ?? []).some((comment) =>
                comment.body.includes(selectedText || '')
            ) || false;
        setReferences((prevRefs) => ({
            ...prevRefs,
            [selectedCode]: [
                ...(prevRefs[selectedCode] || []),
                { text: selectedText, postId: selectedPost!.id, isComment }
            ]
        }));

        setSelectedText(null);
        setIsHighlightModalOpen(false);
    };

    // Handle reference click to switch to data tab and show correct post
    const handleReferenceClick = (postId: number) => {
        const post = mockPosts.find((p) => p.id === postId);
        if (post) {
            setSelectedTab('data');
            setSelectedPost(post);
            setSelectedCodeForReferences(null);
        }
    };

    return (
        <div className="p-6 h-full flex justify-between flex-col">
            <div className="h-full flex flex-col -m-6">
                <TopToolbar
                    selectedPost={selectedPost}
                    setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                    setIsHighlightModalOpen={setIsHighlightModalOpen}
                />
                <div className="flex h-full">
                    <LeftPanel
                        selectedTab={selectedTab}
                        setSelectedTab={setSelectedTab}
                        mockPosts={mockPosts}
                        setSelectedPost={setSelectedPost}
                        codes={codes}
                        setSelectedCodeForReferences={setSelectedCodeForReferences}
                    />
                    <ContentArea
                        selectedPost={selectedPost}
                        selectedCodeForReferences={selectedCodeForReferences}
                        references={references}
                        handleReferenceClick={handleReferenceClick}
                        handleTextSelection={handleTextSelection}
                    />
                </div>
                {isAddCodeModalOpen && (
                    <AddCodeModal
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setCodes={setCodes}
                        setSelectedCode={setSelectedCode}
                    />
                )}
                {isHighlightModalOpen && (
                    <HighlightModal
                        codes={codes}
                        selectedCode={selectedCode}
                        setSelectedCode={setSelectedCode}
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        applyCodeToSelection={applyCodeToSelection}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                    />
                )}
            </div>
            <NavigationBottomBar
                previousPage={ROUTES.WORD_CLOUD}
                nextPage={ROUTES.GENERATION}
                isReady={true}
            />
        </div>
    );
};

export default InitialCodingPage;
