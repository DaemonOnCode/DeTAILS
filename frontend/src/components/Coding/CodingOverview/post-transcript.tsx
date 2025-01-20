import { FC, useState, useMemo, useRef, useEffect } from 'react';
import { useCodingContext } from '../../../context/coding_context';
import { ratio, partial_ratio } from 'fuzzball';
import { Comments, IComment, IReference } from '../../../types/Coding/shared';
import RedditComments from './reddit-comments';
import HighlightedSegment from './highlighted-segment';
import RelatedCodes from './related-codes';
import { generateColor } from '../../../utility/color-generator';
import TopToolbar from '../Shared/top-toolbar';
import AddCodeModal from '../Shared/add-code-modal';
import HighlightModal from '../Shared/highlight-modal';
import { PostTranscriptProps } from '../../../types/Coding/props';
import EditCodeModal from '../Shared/edit-code-modal';
import DeleteCodeModal from '../Shared/delete-code-modal';
import EditHighlightModal from '../Shared/edit-highlight-modal';
import DeleteHighlightModal from '../Shared/delete-highlight-modal';

const PostTranscript: FC<PostTranscriptProps> = ({ post, onBack, review }) => {
    console.log('Post:', post);
    // const transcript = getTranscript(
    //     post.title,
    //     post.selftext,
    //     ...[post.comments.map((c: any) => c.body)]
    // );
    const { finalCodeResponses, dispatchFinalCodeResponses } = useCodingContext();

    const codes = finalCodeResponses
        .filter((response) => response.postId === post.id)
        .map((response) => ({
            text: response.sentence,
            code: response.coded_word
        }));

    const codeSet = Array.from(new Set(codes.map((code) => code.code)));

    const [additionalCodes, setAdditionalCodes] = useState<string[]>([...codeSet]);

    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);

    // const [hoveredLines, setHoveredLines] = useState<
    //     { x1: number; y1: number; x2: number; y2: number; color: string }[]
    // >([]);

    const [isAddCodeModalOpen, setIsAddCodeModalOpen] = useState(false);
    const [isEditCodeModalOpen, setIsEditCodeModalOpen] = useState(false);
    const [isDeleteCodeModalOpen, setIsDeleteCodeModalOpen] = useState(false);
    const [isHighlightModalOpen, setIsHighlightModalOpen] = useState(false);
    const [isEditHighlightModalOpen, setIsEditHighlightModalOpen] = useState(false);
    const [isDeleteHighlightModalOpen, setDeleteIsHighlightModalOpen] = useState(false);

    const [selectedCode, setSelectedCode] = useState<string>('');
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [reasoning, setReasoning] = useState<string>('');

    useEffect(() => {
        console.log('Additional codes:', additionalCodes);
    }, [additionalCodes]);

    const currentReferences = Object.fromEntries(
        codeSet.map((code) => [
            code,
            finalCodeResponses
                .filter((response) => response.coded_word === code)
                .map((response) => ({
                    text: response.sentence,
                    isComment: true,
                    postId: response.postId
                }))
        ])
    );

    const [references, setReferences] = useState<Record<string, IReference[]>>(currentReferences);

    const setCodes = (value: any, type: string) => {
        let result: string[] = [];
        if (typeof value !== 'function') {
            result = value;
        } else {
            console.log('Setting codes:', value);
            result = value(codeSet);
        }
        console.log('Result:', result);
        if (result.length) {
            switch (type) {
                case 'ADD_CODE':
                    console.log('Adding code:', result);
                    setAdditionalCodes([...result]);
                    break;
                case 'UPDATE_CODE_NAME':
                    let newCode = result.find((code) => !codeSet.includes(code));
                    dispatchFinalCodeResponses({
                        type: 'EDIT_CODE',
                        currentCode: selectedCode,
                        newCode
                    });
                    if (newCode) {
                        setAdditionalCodes((prevCodes) =>
                            prevCodes.map((code) => (code === selectedCode ? newCode! : code))
                        );
                    }
                    break;
                case 'DELETE_CODE':
                    dispatchFinalCodeResponses({
                        type: 'DELETE_CODE',
                        code: selectedCode
                    });
                    setAdditionalCodes((prevCodes) =>
                        prevCodes.filter((code) => code !== selectedCode)
                    );
                    break;
                default:
                    break;
            }
        }
        setSelectedCode('');
    };

    // Capture selected text
    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const selected = selection.toString();
            setSelectedText(selected || null);
        }
    };

    function findSingleKeyDifference(
        oldReferences: Record<string, IReference[]>,
        newReferences: Record<string, IReference[]>,
        type: 'removed' | 'modified'
    ): {
        code: string;
        result: IReference;
        originalReference?: IReference;
    } | null {
        for (const key in oldReferences) {
            const oldArray = oldReferences[key] || [];
            const newArray = newReferences[key] || [];

            let result: IReference | undefined = undefined;
            let originalReference: IReference | undefined = undefined;

            if (type === 'removed') {
                result = oldArray.filter(
                    (oldItem) => !newArray.some((newItem) => newItem.text === oldItem.text)
                )?.[0];
            } else if (type === 'modified') {
                for (const newItem of newArray) {
                    const matchingOldItem = oldArray.find(
                        (oldItem) => oldItem.text !== newItem.text && oldItem.text === newItem.text
                    );
                    if (matchingOldItem) {
                        result = newItem;
                        originalReference = matchingOldItem;
                        break;
                    }
                }
            }

            if (result) {
                return {
                    code: key,
                    result,
                    originalReference
                };
            }
        }
        return null; // No differences found
    }

    // Apply code to the selected text
    const applyCodeToSelection = (type: string) => {
        console.log('Applying code to selection:', selectedText, selectedCode, type);
        if (!selectedText || !selectedCode) {
            alert('Please select text and choose a code to apply.');
            return;
        }

        let difference: {
            code: string;
            result: IReference;
            originalReference?: IReference;
        } | null = null;

        switch (type) {
            case 'ADD_HIGHLIGHT':
                dispatchFinalCodeResponses({
                    type: 'ADD_RESPONSE',
                    response: {
                        postId: post.id,
                        coded_word: selectedCode,
                        sentence: selectedText,
                        reasoning
                    }
                });
                break;
            case 'EDIT_HIGHLIGHT':
                difference = findSingleKeyDifference(currentReferences, references, 'modified');
                dispatchFinalCodeResponses({
                    type: 'EDIT_HIGHLIGHT',
                    postId: post.id,
                    sentence: difference?.originalReference,
                    newSentence: difference?.result.text
                });
                break;
            case 'DELETE_HIGHLIGHT':
                difference = findSingleKeyDifference(currentReferences, references, 'removed');
                dispatchFinalCodeResponses({
                    type: 'DELETE_HIGHLIGHT',
                    postId: post.id,
                    sentence: difference?.result.text
                });
                break;
            default:
                break;
        }

        // console.log('Applying code to selection:', selectedText, selectedCode);

        // const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

        // const checkComment = (comment: IComment, selectedText: string): boolean => {
        //     if (!selectedText) {
        //         console.error('Selected text is empty or null');
        //         return false;
        //     }

        //     const normalizedBody = normalizeText(comment?.body || '');
        //     const normalizedText = normalizeText(selectedText);

        //     const check = normalizedBody.includes(normalizedText);
        //     if (check) {
        //         console.log('Found in comment:', comment.body);
        //         return true;
        //     }

        //     if (comment?.comments?.length) {
        //         return comment.comments.some((subComment) => {
        //             return checkComment(subComment, normalizedText);
        //         });
        //     }

        //     return false;
        // };

        // const isComment =
        //     post?.comments?.some((comment) => {
        //         const result = checkComment(comment, selectedText);
        //         return result;
        //     }) || false;

        // console.log('Final isComment value:', isComment);

        // setReferences((prevRefs) => ({
        //     ...prevRefs,
        //     [selectedCode]: [
        //         ...(prevRefs[selectedCode] || []),
        //         { text: selectedText, postId: post!.id, isComment }
        //     ]
        // }));

        setSelectedText(null);
        setIsHighlightModalOpen(false);
    };

    const codeColors = useMemo(() => {
        return codes.reduce(
            (acc, { code }) => {
                acc[code] = generateColor(code);
                return acc;
            },
            {} as Record<string, string>
        );
    }, [codes]);

    const splitIntoSegments = (text: string) => {
        const segments = [];
        let segment = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            segment += char;

            // Check for delimiters
            if (char === '.' || char === '?' || char === '!' || char === ',' || char === '\n') {
                segments.push(segment);
                segment = ''; // Reset for the next segment
            }
        }

        // Push any remaining text
        if (segment.trim()) {
            segments.push(segment.trim());
        }

        return segments;
    };

    const processedSegments = useMemo(() => {
        const transcriptFlatMap: {
            id: string;
            text: string;
            type: 'title' | 'selftext' | 'comment' | 'reply';
            parent_id: string | null;
        }[] = [
            {
                id: post.id,
                text: post.title,
                type: 'title',
                parent_id: null
            },
            {
                id: post.id,
                text: post.selftext,
                type: 'selftext',
                parent_id: null
            }
        ];

        const traverseComments = (comments: Comments[], parentId: string | null) => {
            comments.forEach((comment) => {
                transcriptFlatMap.push({
                    id: comment.id,
                    text: comment.body,
                    type: 'comment',
                    parent_id: parentId
                });
                traverseComments(comment.comments || [], comment.id);
            });
        };

        traverseComments(post.comments, post.id);

        const segments = transcriptFlatMap.flatMap((data) => {
            const segmentTexts = splitIntoSegments(data.text);
            return segmentTexts.map((line) => ({
                line, // Already includes delimiter
                id: data.id,
                type: data.type,
                parent_id: data.parent_id,
                backgroundColours: [] as string[],
                relatedCodeText: [] as string[]
            }));
        });

        segments.forEach((segment) => {
            codes.forEach(({ text, code }) => {
                const codeSegments = splitIntoSegments(text);

                codeSegments.forEach((codeSegment) => {
                    const partialSimilarity = ratio(segment.line, codeSegment);
                    if (partialSimilarity >= 90) {
                        segment.backgroundColours.push(codeColors[code]);
                        segment.relatedCodeText.push(code);
                    }
                });
            });
        });

        // Consolidate and remove duplicates
        return segments.map((segment) => ({
            ...segment,
            backgroundColours: Array.from(new Set(segment.backgroundColours)),
            relatedCodeText: Array.from(new Set(segment.relatedCodeText))
        }));
    }, [post, codes, codeColors]);

    console.log('Processed segments:', processedSegments);

    return !post ? (
        <></>
    ) : (
        // <div className="h-full flex justify-between flex-col">
        <div className="-m-6">
            {/* <div className=""> */}
            {!review && (
                <TopToolbar
                    selectedPost={post}
                    setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                    setIsHighlightModalOpen={setIsHighlightModalOpen}
                    setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                    setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                    setIsEditHighlightCodeModalOpen={setIsEditHighlightModalOpen}
                    setIsDeleteHighlightCodeModalOpen={setDeleteIsHighlightModalOpen}
                />
            )}
            {/* </div> */}
            <div className="flex relative p-6">
                <div className="flex-1 min-w-0">
                    <button onClick={onBack} className="mb-4 text-blue-500">
                        &lt;- <span className="underline">Back to Posts</span>
                    </button>

                    <div
                        className="h-[calc(100vh-18rem)] min-h-[calc(100vh-18rem)] overflow-auto"
                        onMouseUp={handleTextSelection}>
                        {/* Post Content */}
                        <div className="mb-6">
                            <h2 className="text-xl font-bold mb-2">
                                {processedSegments
                                    .filter(
                                        (segment) =>
                                            segment.id === post.id && segment.type === 'title'
                                    )
                                    .map((segment, index) => (
                                        <HighlightedSegment
                                            key={index}
                                            segment={segment}
                                            setHoveredCodeText={setHoveredCodeText}
                                        />
                                    ))}
                            </h2>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line break-words">
                                {processedSegments
                                    .filter(
                                        (segment) =>
                                            segment.id === post.id && segment.type === 'selftext'
                                    )
                                    .map((segment, index) => (
                                        <HighlightedSegment
                                            key={index}
                                            segment={segment}
                                            setHoveredCodeText={setHoveredCodeText}
                                        />
                                    ))}
                            </p>
                        </div>

                        {/* Comments Section */}
                        <h2 className="text-lg font-semibold mb-2">Comments</h2>
                        <div>
                            <RedditComments
                                comments={post.comments}
                                processedSegments={processedSegments}
                                setHoveredCodeText={setHoveredCodeText}
                                level={0}
                            />
                        </div>
                    </div>
                </div>

                {/* Related Codes Panel */}
                <div className="w-1/4 pl-4 h-[calc(100vh-18rem)] min-h-[calc(100vh-18rem)] overflow-auto">
                    <RelatedCodes
                        codeSet={additionalCodes}
                        codeColors={codeColors}
                        hoveredCodeText={hoveredCodeText}
                    />
                </div>

                {isAddCodeModalOpen && (
                    <AddCodeModal
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setCodes={setAdditionalCodes}
                        setSelectedCode={setSelectedCode}
                    />
                )}
                {isEditCodeModalOpen && (
                    <EditCodeModal
                        setIsEditCodeModalOpen={setIsEditCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setCodes={(value: any) => {
                            setCodes(value, 'UPDATE_CODE_NAME');
                        }}
                        codes={additionalCodes}
                        setSelectedCode={setSelectedCode}
                    />
                )}
                {isDeleteCodeModalOpen && (
                    <DeleteCodeModal
                        setIsDeleteCodeModalOpen={setIsDeleteCodeModalOpen}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        setCodes={(value: any) => {
                            setCodes(value, 'DELETE_CODE');
                        }}
                        codes={additionalCodes}
                        setSelectedCode={setSelectedCode}
                    />
                )}
                {isHighlightModalOpen && (
                    <HighlightModal
                        codes={additionalCodes}
                        selectedCode={selectedCode}
                        setSelectedCode={setSelectedCode}
                        setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                        applyCodeToSelection={() => applyCodeToSelection('ADD_HIGHLIGHT')}
                        setIsHighlightModalOpen={setIsHighlightModalOpen}
                        addReasoning={true}
                        reasoning={reasoning}
                        setReasoning={setReasoning}
                    />
                )}
                {isEditHighlightModalOpen && (
                    <EditHighlightModal
                        references={references}
                        setReferences={setReferences}
                        applyCodeToSelection={() => applyCodeToSelection('EDIT_HIGHLIGHT')}
                        setIsHighlightModalOpen={setIsEditHighlightModalOpen}
                    />
                )}
                {isDeleteHighlightModalOpen && (
                    <DeleteHighlightModal
                        references={references}
                        setReferences={setReferences}
                        applyCodeToSelection={() => applyCodeToSelection('DELETE_HIGHLIGHT')}
                        setIsHighlightModalOpen={setDeleteIsHighlightModalOpen}
                    />
                )}
            </div>
        </div>
        // </div>
    );
};

export default PostTranscript;
