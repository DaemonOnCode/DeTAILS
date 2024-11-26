import { useContext, useEffect, useState } from 'react';
import {
    LOADER_ROUTES,
    ROUTES,
    codeReferences,
    codes as _codes,
    DB_PATH
} from '../../constants/Coding/shared';
import { IComment, IRedditPostData, IReference, PostIdTitle } from '../../types/Coding/shared';
import HighlightModal from '../../components/Coding/InitialCoding/highlight_modal';
import AddCodeModal from '../../components/Coding/InitialCoding/add_code_modal';
import ContentArea from '../../components/Coding/InitialCoding/content_area';
import LeftPanel from '../../components/Coding/InitialCoding/left_panel';
import TopToolbar from '../../components/Coding/InitialCoding/top_toolbar';
import NavigationBottomBar from '../../components/Coding/Shared/navigation_bottom_bar';
import { useNavigate } from 'react-router-dom';
import { DataContext } from '../../context/data_context';

const { ipcRenderer } = window.require('electron');

const InitialCodingPage = () => {
    const dataContext = useContext(DataContext);
    const [posts, setPosts] = useState<PostIdTitle[]>([]);

    const [selectedPost, setSelectedPost] = useState<PostIdTitle | null>(null);
    const [codes, setCodes] = useState<string[]>([]);

    const [isAddCodeModalOpen, setIsAddCodeModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState<string>('');
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [selectedTab, setSelectedTab] = useState<'data' | 'codes'>('data');
    const [selectedCodeForReferences, setSelectedCodeForReferences] = useState<string | null>(null);
    const [selectedPostData, setSelectedPostData] = useState<IRedditPostData | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        ipcRenderer
            .invoke('get-post-ids-titles', DB_PATH)
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

        dataContext.setReferences((prevRefs) => ({
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

    const handleNextClick = async (e: any) => {
        e.preventDefault();
        console.log('Next clicked');

        navigate('../loader/' + LOADER_ROUTES.CODING_VALIDATION_LOADER);
        console.log(dataContext.references, 'dataContext.references');

        let results;
        try {
            results = await ipcRenderer.invoke(
                'generate-codes',
                'llama3.2:3b',
                dataContext.references,
                dataContext.mainCode,
                dataContext.selectedFlashcards.map((id) => {
                    return {
                        question: dataContext.flashcards.find((flashcard) => flashcard.id === id)!
                            .question,
                        answer: dataContext.flashcards.find((flashcard) => flashcard.id === id)!
                            .answer
                    };
                }),
                dataContext.selectedWords,
                dataContext.selectedPosts,
                DB_PATH
            );

            console.log(results, 'Initial Coding Page');

            let parsedResults: {
                unified_codebook: {
                    code: string;
                    definition: string;
                    examples: string[];
                }[];
                recoded_transcript: {
                    segment: string;
                    code: string;
                    reasoning: string;
                }[];
            }[] = results;

            console.log(parsedResults, 'Parsed Results');

            let totalCodes: {
                sentence: string;
                coded_word: string;
                isCorrect?: boolean;
                comment: string;
                postId: string;
                reasoning: string;
            }[] = [];

            parsedResults.forEach((parsedResult, index) => {
                parsedResult.recoded_transcript.forEach((recoded) => {
                    totalCodes.push({
                        sentence: recoded.segment,
                        coded_word: recoded.code,
                        isCorrect: undefined,
                        comment: '',
                        postId: dataContext.selectedPosts[index],
                        reasoning: recoded.reasoning
                    });
                });
            });

            dataContext.dispatchCodeResponses({
                type: 'ADD_RESPONSES',
                responses: totalCodes
                // payload: parsedResults.map((parsedResult, index) => {
                //     parsedResult.recoded_transcript.forEach((recoded) => {

                //     });
                //     return {
                //         sentence: parsedResult.recoded_transcript[0].segment,
                //         code: parsedResult.recoded_transcript[0].code,
                //         isCorrect: undefined,
                //         comment: '',
                //         postId: dataContext.selectedPosts[index]
                //     };
            });
            // });
        } catch (e) {
            console.error(e, 'Error invoking generate-codes');
        }

        console.log(results, 'Initial Coding Page');
    };

    return (
        <div className="h-full flex justify-between flex-col">
            <div className="flex flex-col -m-6">
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
                            references={dataContext.references}
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
                nextPage={ROUTES.CODING_VALIDATION}
                isReady={true}
                onNextClick={handleNextClick}
            />
        </div>
    );
};

export default InitialCodingPage;
