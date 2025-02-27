import React, { createContext, FC, useContext, useState, useRef, useMemo, useEffect } from 'react';
import { ratio } from 'fuzzball';
import {
    SetState,
    ChatMessage,
    ILayout,
    Segment,
    IQECTResponse,
    IQECResponse,
    IQECTTyResponse,
    Explanation
} from '../types/Coding/shared';
import { generateColor } from '../utility/color-generator';

interface ITranscriptContext {
    // State values and setters
    selectedText: string | null;
    setSelectedText: SetState<string | null>;
    hoveredCode: string | null;
    setHoveredCode: SetState<string | null>;
    hoveredCodeText: string[] | null;
    setHoveredCodeText: SetState<string[] | null>;
    additionalCodes: string[];
    setAdditionalCodes: SetState<string[]>;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: SetState<Record<string, ChatMessage[]>>;
    activeSegment: Segment | null;
    selectedExplanations: Explanation[];
    setSelectedExplanations: SetState<Explanation[]>;
    hoveredSegment: Segment | null;
    setHoveredSegment: SetState<Segment | null>;
    selectedSegment: Segment | null;
    setSelectedSegment: SetState<Segment | null>;
    codes: {
        text: string;
        code: string;
    }[];
    allExplanations: Explanation[];
    // Selection helpers
    handleTextSelection: () => void;
    restoreSelection: () => void;
    removeSelection: () => void;
    handleSegmentInteraction: (segment: Segment, isPermanent?: boolean) => void;
    handleSegmentLeave: (isPermanent?: boolean) => void;
    // Transcript processing helpers
    splitIntoSegments: (text: string) => string[];
    processTranscript: (
        post: any,
        extraCodes?: string[]
    ) => {
        processedSegments: Segment[];
        codeSet: string[];
        codeColors: Record<string, string>;
    };
    // Refs for DOM access
    selectionRangeRef: React.MutableRefObject<Range | null>;
    containerRef: React.RefObject<HTMLDivElement>;
}

const TranscriptContext = createContext<ITranscriptContext>({
    selectedText: null,
    setSelectedText: () => {},
    hoveredCode: null,
    setHoveredCode: () => {},
    hoveredCodeText: null,
    setHoveredCodeText: () => {},
    additionalCodes: [],
    setAdditionalCodes: () => {},
    chatHistories: {},
    setChatHistories: () => {},
    activeSegment: null,
    selectedExplanations: [],
    setSelectedExplanations: () => {},
    codes: [],
    allExplanations: [],
    hoveredSegment: null,
    setHoveredSegment: () => {},
    selectedSegment: null,
    setSelectedSegment: () => {},
    handleTextSelection: () => {},
    restoreSelection: () => {},
    removeSelection: () => {},
    handleSegmentInteraction: () => {},
    handleSegmentLeave: () => {},
    splitIntoSegments: () => [],
    processTranscript: () => ({
        processedSegments: [],
        codes: [],
        allExplanations: [],
        codeSet: [],
        codeColors: {}
    }),
    selectionRangeRef: { current: null },
    containerRef: { current: null }
});

export const TranscriptContextProvider: FC<{
    children: React.ReactNode;
    postId: string;
    codeResponses: (IQECResponse | IQECTResponse | IQECTTyResponse)[];
}> = ({ children, codeResponses, postId }) => {
    console.log('Running provider');

    const allExplanations: Explanation[] = codeResponses
        .filter((r) => r.postId === postId)
        .map((r) => ({
            explanation: r.explanation,
            code: r.code,
            fullText: r.quote
        }));

    const codes = codeResponses
        .filter((r) => r.postId === postId)
        .map((r) => ({ text: r.quote, code: r.code }));
    // State hooks
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);
    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);
    const [additionalCodes, setAdditionalCodes] = useState<string[]>([]);
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

    const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
    const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

    const [selectedExplanations, setSelectedExplanations] =
        useState<Explanation[]>(allExplanations);

    const activeSegment = selectedSegment || hoveredSegment;

    // Refs for selection handling
    const selectionRangeRef = useRef<Range | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log(additionalCodes, 'additional codes');
    }, []);

    // Advanced text selection handler
    const handleTextSelection = (): void => {
        console.log('Handling text selection from TranscriptContext');
        const selection: Selection | null = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found or empty range.');
            return;
        }
        const range = selection.getRangeAt(0);
        selectionRangeRef.current = range;
        const text = selection.toString().trim();
        console.log('Selected text:', text);

        // Find segment elements within the container.
        const container: HTMLElement = containerRef.current || document.body;
        const segmentElements: HTMLSpanElement[] = Array.from(
            container.querySelectorAll('span[data-segment-id]')
        ) as HTMLSpanElement[];

        const highlightedSegments: HTMLSpanElement[] = [];
        segmentElements.forEach((segmentElement) => {
            const segText = segmentElement.textContent?.trim() || '';
            if (!segText) return;
            // Basic matching logic
            if (segText.includes(text) || text.includes(segText)) {
                highlightedSegments.push(segmentElement);
            }
        });
        const combinedText = highlightedSegments
            .map((span) => span.textContent?.trim() || '')
            .join(' ');
        setSelectedText(combinedText || text);
    };

    // Restore the saved selection.
    const restoreSelection = (): void => {
        console.log('Restoring selection from TranscriptContext');
        if (!selectionRangeRef.current) return;
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(selectionRangeRef.current);
    };

    // Remove the active selection.
    const removeSelection = (): void => {
        console.log('Removing selection from TranscriptContext');
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selectionRangeRef.current = null;
    };

    // Helper: Split text into segments.
    const splitIntoSegments = (text: string): string[] => {
        const newlineToken = '<NEWLINE>';
        const cleanedText = text.replace(/\n+/g, newlineToken);
        const segments = cleanedText
            .split(/(?<=[.?!:,])/)
            .map((segment) => segment.trim())
            .filter(Boolean);
        return segments.map((segment) => segment.replace(new RegExp(newlineToken, 'g'), '\n'));
    };

    // Wrap processTranscript in useCallback so that its reference remains stable.
    const processTranscript = (post: any, extraCodes: string[] = []) => {
        // console.log('inside processTranscript', post, codeResponses, extraCodes);

        const codeSet = Array.from(new Set([...codes.map((c: any) => c.code), ...extraCodes]));
        // setAdditionalCodes(codeSet);
        // Map each code to a color.
        const codeColors: Record<string, string> = {};
        codeSet.forEach((code: string) => {
            codeColors[code] = generateColor(code);
        });

        // Build a flat transcript map from title, selftext, and comments.
        const transcriptFlatMap: {
            id: string;
            text: string;
            type: 'title' | 'selftext' | 'comment' | 'reply';
            parent_id: string | null;
        }[] = [
            { id: post.id, text: post.title, type: 'title', parent_id: null },
            { id: post.id, text: post.selftext, type: 'selftext', parent_id: null }
        ];

        const traverseComments = (comments: any[], parentId: string | null) => {
            comments.forEach((comment: any) => {
                transcriptFlatMap.push({
                    id: comment.id,
                    text: comment.body,
                    type: 'comment',
                    parent_id: parentId
                });
                if (comment.comments) {
                    traverseComments(comment.comments, comment.id);
                }
            });
        };
        traverseComments(post.comments, post.id);

        // Create segments by splitting each text field.
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
                index: `${idx1}|${idx2}`
            }));
        });

        // Associate codes with segments based on similarity.
        segments.forEach((segment: any) => {
            codes.forEach(({ text, code }: any) => {
                const segmentedCodeTexts = splitIntoSegments(text);
                segmentedCodeTexts.forEach((segmentedText: string) => {
                    const similarity = ratio(segment.line, segmentedText);
                    if (similarity >= 90) {
                        segment.backgroundColours.push(codeColors[code]);
                        segment.relatedCodeText.push(code);
                        segment.fullText = text;
                    }
                });
            });
        });

        const processedSegments: Segment[] = segments.map((segment: any) => ({
            ...segment,
            backgroundColours: Array.from(new Set(segment.backgroundColours)),
            relatedCodeText: Array.from(new Set(segment.relatedCodeText))
        }));

        return { processedSegments, codeSet, codeColors };
    };

    const handleSegmentInteraction = (segment: Segment, isPermanent: boolean = false) => {
        if (isPermanent) {
            setSelectedSegment(segment);
        } else {
            setHoveredSegment(segment);
        }
        setHoveredCodeText(segment.relatedCodeText);

        // Filter related explanations based on the segment's related codes.
        const foundExplanations: { explanation: string; code: string; fullText: string }[] = [];
        segment.relatedCodeText.forEach((code) => {
            codeResponses.forEach((response) => {
                if (response.code === code) {
                    const splitQuote = splitIntoSegments(response.quote);
                    splitQuote.forEach((quote) => {
                        if (ratio(segment.line, quote) >= 90) {
                            foundExplanations.push({
                                code: response.code,
                                explanation: response.explanation || '',
                                fullText: response.quote
                            });
                        }
                    });
                }
            });
        });
        const unique: Explanation[] = Array.from(
            new Set(foundExplanations.map((e) => JSON.stringify(e)))
        ).map((str) => JSON.parse(str));
        setSelectedExplanations(unique);
    };

    const handleSegmentLeave = (isPermanent: boolean = true) => {
        setHoveredSegment(null);
        if (selectedSegment && isPermanent) {
            setHoveredCodeText(selectedSegment.relatedCodeText);
        } else {
            setHoveredCodeText(null);
            setSelectedExplanations(allExplanations);
        }
    };

    const value = useMemo(
        () => ({
            selectedText,
            setSelectedText,
            hoveredCode,
            setHoveredCode,
            hoveredCodeText,
            setHoveredCodeText,
            additionalCodes,
            setAdditionalCodes,
            chatHistories,
            setChatHistories,
            activeSegment,
            hoveredSegment,
            setHoveredSegment,
            selectedSegment,
            setSelectedSegment,
            selectedExplanations,
            setSelectedExplanations,
            codes,
            allExplanations,
            handleTextSelection,
            handleSegmentInteraction,
            handleSegmentLeave,
            restoreSelection,
            removeSelection,
            splitIntoSegments,
            processTranscript,
            selectionRangeRef,
            containerRef
        }),
        [
            selectedText,
            hoveredCode,
            hoveredCodeText,
            additionalCodes,
            chatHistories,
            activeSegment,
            selectedExplanations,
            hoveredSegment,
            selectedSegment,
            // splitIntoSegments,
            processTranscript
        ]
    );

    return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
};

export const useTranscriptContext = () => useContext(TranscriptContext);
