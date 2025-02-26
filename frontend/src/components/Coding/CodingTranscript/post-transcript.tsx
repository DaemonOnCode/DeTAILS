import { FC, useState, useMemo, useRef, useEffect } from 'react';
import { useCodingContext } from '../../../context/coding-context';
import { ratio, partial_ratio } from 'fuzzball';
import { Comments, IComment, IReference, Segment } from '../../../types/Coding/shared';
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
import SwitchModal from './switch-modal';
import { TranscriptContextProvider } from '../../../context/transcript-context';

const PostTranscript: FC<PostTranscriptProps> = ({
    post,
    onBack,
    review,
    isActive = false,
    codeResponses,
    extraCodes = [],
    dispatchCodeResponse,
    selectedText,
    setSelectedText,
    conflictingCodes,
    handleSwitchToEditMode,
    isAddCodeModalOpen,
    setIsAddCodeModalOpen,
    isEditCodeModalOpen,
    setIsEditCodeModalOpen,
    isDeleteCodeModalOpen,
    setIsDeleteCodeModalOpen,
    isHighlightModalOpen,
    setIsHighlightModalOpen,
    isEditHighlightModalOpen,
    setIsEditHighlightModalOpen,
    isDeleteHighlightModalOpen,
    setDeleteIsHighlightModalOpen
}) => {
    // console.log('Post:', post, codeResponses);
    // const transcript = getTranscript(
    //     post.title,
    //     post.selftext,
    //     ...[post.comments.map((c: any) => c.body)]
    // );
    // const { codeResponses, dispatchCodeResponse } = useCodingContext();

    const codes = useMemo(() => {
        console.log('recalculated codes');
        const responseCodes = codeResponses
            .filter((r) => r.postId === post.id)
            .map((r) => ({ text: r.quote, code: r.code }));
        return responseCodes;
    }, [codeResponses, post]);

    const allExplanations: {
        explanation: string;
        code: string;
        fullText: string;
    }[] = useMemo(
        () =>
            codeResponses
                .filter((responses) => responses.postId === post.id)
                .map((responses) => ({
                    explanation: responses.explanation,
                    code: responses.code,
                    fullText: responses.quote
                })),
        [codeResponses, post]
    );

    const codeSet = Array.from(new Set([...codes.map((c) => c.code), ...extraCodes]));
    const [additionalCodes, setAdditionalCodes] = useState<string[]>([...codeSet]);

    // useEffect(() => {
    //     setAdditionalCodes((prev) => {
    //         if (prev.length !== codeSet.length) return [...codeSet];
    //         for (let i = 0; i < prev.length; i++) {
    //             if (prev[i] !== codeSet[i]) return [...codeSet];
    //         }
    //         return prev;
    //     });
    // }, [codeSet]);

    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);

    const currentSegment = useRef<any>(null);

    // const [hoveredLines, setHoveredLines] = useState<
    //     { x1: number; y1: number; x2: number; y2: number; color: string }[]
    // >([]);

    const [selectedCode, setSelectedCode] = useState<string>('');
    const [reasoning, setReasoning] = useState<string>('');

    const [switchModalOn, setSwitchModalOn] = useState(false);

    const selectionRangeRef = useRef<Range | null>(null);

    useEffect(() => {
        console.log('Additional codes:', additionalCodes);
    }, [additionalCodes]);

    const currentReferences = Object.fromEntries(
        codeSet.map((code) => [
            code,
            codeResponses
                .filter((response) => response.code === code && response.postId === post.id)
                .map((response) => ({
                    text: response.quote,
                    isComment: true,
                    postId: response.postId
                }))
        ])
    );

    const [references, setReferences] = useState<Record<string, IReference[]>>(currentReferences);

    const [selectedExplanations, setSelectedExplanations] = useState<
        {
            explanation: string;
            code: string;
            fullText: string;
        }[]
    >(allExplanations);

    const handleSegmentDoubleClick = (segment: Segment) => {
        if (review) {
            // alert('Go back, change to edit mode and try again');
            setSwitchModalOn(true);
            return;
        }
        console.log(segment, 'segment');

        console.log(currentSegment.current, segment);
        if (JSON.stringify(currentSegment.current) === JSON.stringify(segment)) {
            currentSegment.current = null;
            setSelectedExplanations(allExplanations);
            return;
        }

        currentSegment.current = segment;

        const foundExplanations: {
            explanation: string;
            code: string;
            fullText: string;
        }[] = [];

        segment.relatedCodeText.forEach((code) => {
            codeResponses.forEach((response) => {
                if (response.code === code) {
                    const splitQuote = splitIntoSegments(response.quote);
                    splitQuote.forEach((quote) => {
                        if (ratio(segment.line, quote) >= 90) {
                            foundExplanations.push({
                                code: response.code,
                                explanation: response.explanation || '', // fallback
                                fullText: response.quote
                            });
                        }
                    });
                }
            });
        });
        const unique = Array.from(new Set(foundExplanations.map((e) => JSON.stringify(e)))).map(
            (str) => JSON.parse(str)
        );

        setSelectedExplanations(unique);
    };

    const setCodes = (value: any, type: string) => {
        if (!isActive) return;
        let result: string[] = [];
        if (typeof value !== 'function') {
            result = value;
        } else {
            console.log('Setting codes:', value);
            result = value(codeSet);
        }
        console.log('Result:', result);
        // if (result.length) {
        switch (type) {
            case 'ADD_CODE':
                console.log('Adding code:', result);
                setAdditionalCodes([...result]);
                break;
            case 'UPDATE_CODE_NAME':
                let newCode = result.find((code) => !codeSet.includes(code));
                dispatchCodeResponse({
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
                dispatchCodeResponse({
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
        // }
        setSelectedCode('');
    };

    // const handleTextSelection = () => {
    //     console.log('Handling text selection');
    //     if (!isActive) return;
    //     const selection = window.getSelection();
    //     if (!selection || selection.rangeCount === 0) return;

    //     selectionRangeRef.current = selection.getRangeAt(0);
    //     setSelectedText(selection.toString() || null);
    // };

    const containerRef = useRef<HTMLDivElement>(null);

    const handleTextSelection = (): void => {
        console.log('Handling text selection');

        if (!isActive) {
            console.log('isActive is false. Exiting selection handler.');
            return;
        }

        const selection: Selection | null = window.getSelection();
        if (!selection) {
            console.log('No selection found.');
            return;
        }
        if (selection.rangeCount === 0) {
            console.log('Selection range count is 0. Nothing selected.');
            return;
        }

        const range: Range = selection.getRangeAt(0);
        console.log('Selection range obtained:', {
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset
        });
        selectionRangeRef.current = range;

        const selectedText = selection.toString().trim();

        const container: HTMLElement = containerRef?.current || document.body;
        console.log('Using container element:', container);

        const segmentElements: HTMLSpanElement[] = Array.from(
            container.querySelectorAll('span[data-segment-id]')
        ) as HTMLSpanElement[];
        console.log(`Found ${segmentElements.length} segment elements.`);

        const highlightedSegments: HTMLSpanElement[] = [];

        segmentElements.forEach((segmentElement: HTMLSpanElement) => {
            const segmentId = segmentElement.getAttribute('data-segment-id');
            const segText = segmentElement.textContent?.trim() || '';
            if (!segText) {
                console.log(`Segment ${segmentId} has no text. Skipping.`);
                return;
            }

            let match = false;
            if (selectedText.includes(segText)) {
                console.log(`Selected text fully contains segment ${segmentId}.`);
                match = true;
            } else if (segText.includes(selectedText)) {
                console.log(`Segment ${segmentId} fully contains the selected text.`);
                match = true;
            } else {
                const segWords = segText.split(/\s+/);
                const selectedWords = selectedText.split(/\s+/);
                const commonWords = segWords.filter((word) => selectedWords.includes(word));
                const ratio = commonWords.length / segWords.length;
                console.log(
                    `Segment ${segmentId} word overlap ratio: ${ratio.toFixed(2)} (common words: [${commonWords.join(', ')}])`
                );
                if (ratio > 0.5) {
                    match = true;
                }
            }
            console.log(
                `Text match for segment ${segmentId}: ${match} (segment text: "${segText}", selected text: "${selectedText}")`
            );

            if (match) {
                highlightedSegments.push(segmentElement);
                console.log(`Segment ${segmentId} is highlighted.`);
            } else {
                console.log(`Segment ${segmentId} is not highlighted.`);
            }
        });

        console.log('Highlighted segments:', highlightedSegments);
        const combinedText = highlightedSegments
            .map((span) => span.textContent?.trim() || '')
            .join(' ');

        console.log('Combined text:', combinedText);

        setSelectedText(combinedText || null);
    };

    const restoreSelection = () => {
        console.log('Restoring selection');
        if (!isActive) return;
        if (!selectionRangeRef.current) return;

        const selection = window.getSelection();
        if (!selection) return;

        selection.removeAllRanges();

        selection.addRange(selectionRangeRef.current);
    };

    const removeSelection = () => {
        console.log('Removing selection');
        if (!isActive) return;
        if (!selectionRangeRef.current) return;

        const selection = window.getSelection();
        if (!selection) return;

        selection.removeAllRanges();
        selectionRangeRef.current = null;
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
    const applyCodeToSelection = (type: string, extra?: any) => {
        if (!isActive) return;
        console.log('Applying code to selection:', selectedText, selectedCode, type);
        if (!selectedText && isHighlightModalOpen) {
            alert(
                'Please select text. Make sure you explicitly select the text in an active tab, which can be distinguished by a blue border.'
            );
            return;
        }

        if (!selectedCode && isHighlightModalOpen) {
            alert('Please select a code.');
            return;
        }

        let difference: {
            code: string;
            result: IReference;
            originalReference?: IReference;
        } | null = null;

        switch (type) {
            case 'ADD_HIGHLIGHT':
                dispatchCodeResponse({
                    type: 'ADD_RESPONSE',
                    response: {
                        id: Math.random().toString(36),
                        postId: post.id,
                        code: selectedCode,
                        quote: selectedText,
                        explanation: reasoning,
                        isMarked: true,
                        comment: '',
                        // type: 'Human',
                        theme: 'Some theme'
                    }
                });
                break;
            case 'EDIT_HIGHLIGHT':
                difference = findSingleKeyDifference(currentReferences, references, 'modified');
                console.log('Edit Difference:', difference, extra);
                dispatchCodeResponse({
                    type: 'EDIT_HIGHLIGHT',
                    postId: post.id,
                    sentence: extra?.reference.text,
                    code: extra?.code,
                    newSentence: extra?.newText
                });
                break;
            case 'DELETE_HIGHLIGHT':
                difference = findSingleKeyDifference(currentReferences, references, 'removed');
                console.log('Delete Difference:', difference, extra);
                dispatchCodeResponse({
                    type: 'DELETE_HIGHLIGHT',
                    postId: post.id,
                    sentence: extra?.reference.text,
                    code: extra?.code
                });
                break;
            default:
                break;
        }

        setSelectedText(null);
        setIsHighlightModalOpen(false);
    };

    const codeColors = useMemo(() => {
        const map: Record<string, string> = {};
        codeSet.forEach((code) => {
            map[code] = generateColor(code);
        });
        return map;
    }, [codeSet]);

    const splitIntoSegments = (text: string) => {
        const newlineToken = '<NEWLINE>';
        const cleanedText = text.replace(/\n+/g, newlineToken);
        const segments = cleanedText
            .split(/(?<=[.?!:,])/)
            .map((segment) => segment.trim())
            .filter(Boolean);
        return segments.map((segment) => segment.replace(new RegExp(newlineToken, 'g'), '\n'));
    };

    const processedSegments = useMemo(() => {
        if (!post || !Object.keys(post).length) return [];

        const transcriptFlatMap: {
            id: string;
            text: string;
            type: 'title' | 'selftext' | 'comment' | 'reply';
            parent_id: string | null;
        }[] = [
            { id: post.id, text: post.title, type: 'title', parent_id: null },
            { id: post.id, text: post.selftext, type: 'selftext', parent_id: null }
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

        const segments = transcriptFlatMap.flatMap((data, idx1) => {
            const segmentTexts = splitIntoSegments(data.text);
            return segmentTexts.map((line, idx2) => ({
                line,
                id: data.id,
                type: data.type,
                parent_id: data.parent_id,
                backgroundColours: [] as string[],
                relatedCodeText: [] as string[],
                fullText: '' as string,
                index: idx1 + idx2
            }));
        });

        segments.forEach((segment) => {
            codes.forEach(({ text, code }) => {
                const segmentedCodeTexts = splitIntoSegments(text);
                segmentedCodeTexts.forEach((segmentedText) => {
                    const similarity = ratio(segment.line, segmentedText);
                    if (similarity >= 90) {
                        segment.backgroundColours.push(codeColors[code]);
                        segment.relatedCodeText.push(code);
                        segment.fullText = text;
                    }
                });
            });
        });

        return segments.map((segment) => ({
            ...segment,
            backgroundColours: Array.from(new Set(segment.backgroundColours)),
            relatedCodeText: Array.from(new Set(segment.relatedCodeText))
        }));
    }, [post, codes, codeColors]);

    // useEffect(() => {
    //     console.log('Selected text:', selectedText);
    // }, [selectedText]);

    // console.log('Processed segments:', processedSegments);

    return !post ? (
        <p>Post not found</p>
    ) : (
        <TranscriptContextProvider>
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-1 overflow-hidden m-6">
                    {/* Left Section: Transcript */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <button onClick={onBack} className="mb-4 text-blue-500 self-start">
                            ← <span className="underline">Back to Posts</span>
                        </button>

                        <div
                            className={`flex-1 overflow-y-auto ${isEditHighlightModalOpen ? 'cursor-pencil' : ''}`}
                            onMouseUp={handleTextSelection}
                            ref={containerRef}>
                            <div className="mb-6">
                                <h2 className="text-xl font-bold mb-2 relative">
                                    {processedSegments
                                        .filter(
                                            (segment) =>
                                                segment.id === post.id && segment.type === 'title'
                                        )
                                        .map((segment, index) => (
                                            <HighlightedSegment
                                                key={index}
                                                hoveredCode={hoveredCode}
                                                segment={segment}
                                                setHoveredCodeText={setHoveredCodeText}
                                                onDoubleClickSegment={handleSegmentDoubleClick}
                                            />
                                        ))}
                                </h2>
                                <p className="text-gray-700 leading-relaxed relative">
                                    {processedSegments
                                        .filter(
                                            (segment) =>
                                                segment.id === post.id &&
                                                segment.type === 'selftext'
                                        )
                                        .map((segment, index) => (
                                            <HighlightedSegment
                                                key={index}
                                                hoveredCode={hoveredCode}
                                                segment={segment}
                                                setHoveredCodeText={setHoveredCodeText}
                                                onDoubleClickSegment={handleSegmentDoubleClick}
                                            />
                                        ))}
                                </p>
                            </div>

                            {/* Comments Section */}
                            <h2 className="text-lg font-semibold mb-2">Comments</h2>
                            <div className="max-h-full">
                                <RedditComments
                                    comments={post.comments}
                                    hoveredCode={hoveredCode}
                                    processedSegments={processedSegments}
                                    setHoveredCodeText={setHoveredCodeText}
                                    level={0}
                                    onDoubleClickSegment={handleSegmentDoubleClick}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Section: Related Codes */}
                    <div className="w-1/3 pl-4 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto">
                            <RelatedCodes
                                postId={post.id}
                                datasetId={post.dataset_id}
                                codeSet={additionalCodes}
                                codeResponses={codeResponses}
                                codeColors={codeColors}
                                hoveredCodeText={hoveredCodeText}
                                conflictingCodes={conflictingCodes}
                                codeCounts={additionalCodes.reduce(
                                    (acc, code) => {
                                        acc[code] = codeResponses.filter(
                                            (response) =>
                                                response.code === code &&
                                                response.postId === post.id
                                        ).length;
                                        return acc;
                                    },
                                    {} as Record<string, number>
                                )}
                                hoveredCode={hoveredCode}
                                setHoveredCode={setHoveredCode}
                                selectedExplanationsWithCode={selectedExplanations}
                                dispatchFunction={dispatchCodeResponse}
                            />
                        </div>
                    </div>
                    {/* Modals */}
                    {isAddCodeModalOpen && isActive && (
                        <AddCodeModal
                            setIsAddCodeModalOpen={setIsAddCodeModalOpen}
                            setIsHighlightModalOpen={setIsHighlightModalOpen}
                            setCodes={setAdditionalCodes}
                            setSelectedCode={setSelectedCode}
                        />
                    )}
                    {isEditCodeModalOpen && isActive && (
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
                    {isDeleteCodeModalOpen && isActive && (
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
                    {isHighlightModalOpen && isActive && (
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
                            restoreSelection={restoreSelection}
                            removeSelection={removeSelection}
                        />
                    )}
                    {isEditHighlightModalOpen && isActive && (
                        <EditHighlightModal
                            references={references}
                            applyCodeToSelection={(extra) =>
                                applyCodeToSelection('EDIT_HIGHLIGHT', extra)
                            }
                            setIsHighlightModalOpen={setIsEditHighlightModalOpen}
                            selectedText={selectedText}
                            setSelectedText={setSelectedText}
                        />
                    )}
                    {isDeleteHighlightModalOpen && isActive && (
                        <DeleteHighlightModal
                            references={references}
                            setReferences={setReferences}
                            applyCodeToSelection={(extra) =>
                                applyCodeToSelection('DELETE_HIGHLIGHT', extra)
                            }
                            setIsHighlightModalOpen={setDeleteIsHighlightModalOpen}
                        />
                    )}
                    {switchModalOn && (
                        <SwitchModal
                            message="To make changes to codes, change to edit mode and try again"
                            onCancel={() => setSwitchModalOn(false)}
                            onConfirm={() => {
                                handleSwitchToEditMode?.();
                                setSwitchModalOn(false);
                            }}
                            confirmLabel="Change to Edit Mode"
                        />
                    )}
                </div>
            </div>
        </TranscriptContextProvider>
    );
};

export default PostTranscript;
