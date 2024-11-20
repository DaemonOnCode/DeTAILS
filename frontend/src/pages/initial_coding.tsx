import { useEffect, useState } from 'react';
import { LOADER_ROUTES, ROUTES } from '../constants/shared';
import { IComment, IRedditPostData, IReference, PostIdTitle } from '../types/shared';
import HighlightModal from '../components/InitialCoding/highlight_modal';
import AddCodeModal from '../components/InitialCoding/add_code_modal';
import ContentArea from '../components/InitialCoding/content_area';
import LeftPanel from '../components/InitialCoding/left_panel';
import TopToolbar from '../components/InitialCoding/top_toolbar';
import NavigationBottomBar from '../components/Shared/navigation_bottom_bar';

const { ipcRenderer } = window.require('electron');

const InitialCodingPage = () => {
    const [posts, setPosts] = useState<PostIdTitle[]>([]);

    const [selectedPost, setSelectedPost] = useState<PostIdTitle | null>(null);
    const [codes, setCodes] = useState<string[]>([]);
    const [references, setReferences] = useState<{
        [code: string]: IReference[];
    }>({});
    const [isAddCodeModalOpen, setIsAddCodeModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState<string>('');
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [selectedTab, setSelectedTab] = useState<'data' | 'codes'>('data');
    const [selectedCodeForReferences, setSelectedCodeForReferences] = useState<string | null>(null);
    const [selectedPostData, setSelectedPostData] = useState<IRedditPostData | null>(null);

    useEffect(() => {
        ipcRenderer
            .invoke('get-post-ids-titles', '../test.db')
            .then((data: { id: string; title: string }[]) => {
                setPosts(data);
            });
    }, []);

    useEffect(() => {
        console.log('Getting post by id, initial coding', selectedPost);
    }, [selectedPost]);

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

        console.log('Applying code to selection:', selectedText, selectedCode);

        const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

        const checkComment = (comment: IComment, selectedText: string): boolean => {
            if (!selectedText) {
                console.error('Selected text is empty or null');
                return false;
            }

            const normalizedBody = normalizeText(comment?.body || '');
            const normalizedText = normalizeText(selectedText);

            const check = normalizedBody.includes(normalizedText);
            if (check) {
                console.log('Found in comment:', comment.body);
                return true;
            }

            if (comment?.comments?.length) {
                return comment.comments.some((subComment) => {
                    return checkComment(subComment, normalizedText);
                });
            }

            return false;
        };

        const isComment =
            selectedPostData?.comments?.some((comment) => {
                const result = checkComment(comment, selectedText);
                return result;
            }) || false;

        console.log('Final isComment value:', isComment);

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
    const handleReferenceClick = (postId: string) => {
        const post = posts.find((p) => p.id === postId);
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
                <div className="flex h-[calc(100vh-9rem)] overflow-hidden">
                    {/* Left Panel */}
                    <LeftPanel
                        selectedTab={selectedTab}
                        setSelectedTab={setSelectedTab}
                        posts={posts}
                        setSelectedPost={setSelectedPost}
                        codes={codes}
                        setSelectedCodeForReferences={setSelectedCodeForReferences}
                    />

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-auto">
                        <ContentArea
                            selectedPost={selectedPost}
                            selectedCodeForReferences={selectedCodeForReferences}
                            selectedPostData={selectedPostData}
                            setSelectedPostData={setSelectedPostData}
                            references={references}
                            handleReferenceClick={handleReferenceClick}
                            handleTextSelection={handleTextSelection}
                        />
                    </div>
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
                nextPage={LOADER_ROUTES.CODING_VALIDATION_LOADER}
                isReady={true}
            />
        </div>
    );
};

export default InitialCodingPage;
