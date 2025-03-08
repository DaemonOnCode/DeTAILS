import React, {
    createContext,
    FC,
    useContext,
    useState,
    useRef,
    useMemo,
    useEffect,
    MutableRefObject,
    RefObject
} from 'react';
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

// Define interfaces for our types.
interface ExtendedSegment {
    id: string;
    type: 'title' | 'selftext' | 'comment' | 'reply';
    parent_id: string | null;
    start: number;
    end: number;
    matchedText: string;
    // fullCodeText: string;
    backgroundColours: string[];
    relatedCodeText: string[];
    fullText: string;
    index: string;
}

interface TranscriptData {
    id: string;
    text: string;
    type: 'title' | 'selftext' | 'comment' | 'reply';
    parent_id: string | null;
}

interface Code {
    text: string;
    code: string;
}

interface ITranscriptContext {
    review: boolean;
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
    switchModalOn: boolean;
    setSwitchModalOn: SetState<boolean>;
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
    handleTextSelection: (_selectionRef: MutableRefObject<Range | null>) => void;
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
    selectionRangeRef: MutableRefObject<Range | null>;
    containerRef: RefObject<HTMLDivElement>;
}

const TranscriptContext = createContext<ITranscriptContext>({
    review: true,
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
    switchModalOn: false,
    setSwitchModalOn: () => {},
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
        codeSet: [],
        codeColors: {}
    }),
    selectionRangeRef: { current: null },
    containerRef: { current: null }
});

export const TranscriptContextProvider: FC<{
    children: React.ReactNode;
    postId: string;
    review: boolean;
    codeResponses: (IQECResponse | IQECTResponse | IQECTTyResponse)[];
}> = ({ children, review, codeResponses, postId }) => {
    console.log('Running provider', review);

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

    const gatherChatHistory = () => {
        let allChatHistory: Record<string, ChatMessage[]> = {};
        codeResponses
            .filter((response) => response.postId === postId)
            .forEach((response) => {
                allChatHistory[`${postId}-${response.code}-${response.quote}`] =
                    response.chatHistory ?? [
                        {
                            id: 1,
                            text: response.explanation,
                            sender: 'LLM',
                            code: response.code,
                            reaction: true,
                            isEditable: false,
                            command: 'ACCEPT_QUOTE',
                            isCurrentCode: true
                        }
                    ];
            });
        return allChatHistory;
    };
    // State hooks
    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);
    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);
    const [additionalCodes, setAdditionalCodes] = useState<string[]>([]);
    const [switchModalOn, setSwitchModalOn] = useState(false);

    const [chatHistories, setChatHistories] =
        useState<Record<string, ChatMessage[]>>(gatherChatHistory());

    const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
    const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

    const [selectedExplanations, setSelectedExplanations] =
        useState<Explanation[]>(allExplanations);

    const activeSegment = selectedSegment || hoveredSegment;

    const selectionRangeRef = useRef<Range | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTextSelection = (_selectionRef: MutableRefObject<Range | null>): void => {
        console.log('Handling text selection from TranscriptContext');
        const selection: Selection | null = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found or empty range.');
            return;
        }
        const range: Range = selection.getRangeAt(0);
        selectionRangeRef.current = range;
        _selectionRef.current = range;
        const selectedText: string = selection.toString().trim();
        console.log('Selected text:', selectedText);
        if (!selectedText) return;

        setSelectedText(selectedText);

        // let commonAncestor: HTMLElement;
        // if (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE) {
        //     commonAncestor = range.commonAncestorContainer as HTMLElement;
        // } else {
        //     commonAncestor =
        //         range.commonAncestorContainer.parentElement ||
        //         containerRef.current ||
        //         document.body;
        // }

        // const foundSegments: HTMLSpanElement[] = [];
        // const walker: TreeWalker = document.createTreeWalker(
        //     commonAncestor,
        //     NodeFilter.SHOW_ELEMENT,
        //     {
        //         acceptNode: (node: Node): number => {
        //             if (node instanceof HTMLElement && node.hasAttribute('data-segment-id')) {
        //                 return NodeFilter.FILTER_ACCEPT;
        //             }
        //             return NodeFilter.FILTER_SKIP;
        //         }
        //     }
        // );

        // let currentNode: Node | null = walker.currentNode;
        // while (currentNode) {
        //     if (currentNode instanceof HTMLSpanElement && range.intersectsNode(currentNode)) {
        //         foundSegments.push(currentNode);
        //     }
        //     currentNode = walker.nextNode();
        // }

        // if (foundSegments.length === 0 && containerRef.current) {
        //     const containerSegments: HTMLSpanElement[] = Array.from(
        //         containerRef.current.querySelectorAll('span[data-segment-id]')
        //     );
        //     containerSegments.forEach((segment) => {
        //         if (range.intersectsNode(segment)) {
        //             foundSegments.push(segment);
        //         }
        //     });
        // }

        // // Combine the text from all found segments.
        // const combinedText: string = foundSegments
        //     .map((span) => span.textContent?.trim() || '')
        //     .join(' ');

        // console.log(combinedText, 'combined text');
        // setSelectedText(combinedText || selectedText);
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

    // Helper function for comment traversal
    function traverseComments(comment: any, parentId: string | null): any[] {
        return [
            {
                id: comment.id,
                text: comment.body,
                type: 'comment',
                parent_id: parentId
            },
            ...(comment.comments || []).flatMap((c: any) => traverseComments(c, comment.id))
        ];
    }

    function escapeRegExp(text: string) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const processTranscript = (post: any, extraCodes: string[] = []) => {
        const codeSet = Array.from(new Set([...codes.map((c: any) => c.code), ...extraCodes]));
        const codeColors: Record<string, string> = {};
        codeSet.forEach((code: string) => {
            codeColors[code] = generateColor(code);
        });

        // Build transcript flat map (same as original)
        const transcriptFlatMap = [
            { id: post.id, text: post.title, type: 'title', parent_id: null },
            { id: post.id, text: post.selftext, type: 'selftext', parent_id: null },
            ...post.comments.flatMap((comment: any) => traverseComments(comment, post.id))
        ];

        // Get unique code texts sorted by length
        const codeTexts = codes.map((c: any) => c.text);
        const uniqueCodeTexts = Array.from(new Set(codeTexts)).sort((a, b) => b.length - a.length);

        const splitRegex = new RegExp(`(${uniqueCodeTexts.map(escapeRegExp).join('|')})`, 'g');

        // Create segments using exact matches
        const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
            const splitSegments: any[] = data.text.split(splitRegex);
            return splitSegments
                .map((segment, splitIndex) => {
                    if (!segment) return null;
                    const isCodeSegment = splitIndex % 2 === 1;

                    const matchedCodes = isCodeSegment
                        ? codes.filter((c: any) => c.text === segment)
                        : [];

                    return {
                        line: segment,
                        id: data.id,
                        type: data.type,
                        parent_id: data.parent_id,
                        backgroundColours: matchedCodes.map((c: any) => codeColors[c.code]),
                        relatedCodeText: matchedCodes.map((c: any) => c.code),
                        fullText: isCodeSegment ? segment : '',
                        index: `${dataIndex}|${splitIndex}`
                    };
                })
                .filter(Boolean);
        });

        return {
            processedSegments: segments as Segment[],
            codeSet,
            codeColors
        };
    };

    const handleSegmentInteraction = (segment: Segment, isPermanent = false) => {
        if (review && isPermanent) {
            setSwitchModalOn(true);
            return;
        }

        if (selectedSegment) {
            return;
        }

        // if (isPermanent) {
        //     setSelectedSegment(segment);
        // } else {
        //     setHoveredSegment(segment);
        // }
        // setHoveredCodeText(segment.relatedCodeText);

        const targetSegment = isPermanent ? setSelectedSegment : setHoveredSegment;
        targetSegment(segment);

        setHoveredCodeText(segment.relatedCodeText);

        // Directly find explanations by code match
        const explanations = segment.relatedCodeText.flatMap((code) =>
            codeResponses
                .filter((r) => r.code === code)
                .map((r) => ({
                    explanation: r.explanation,
                    code: r.code,
                    fullText: r.quote
                }))
        );

        setSelectedExplanations(
            Array.from(new Set(explanations.map((e) => JSON.stringify(e)))).map((str) =>
                JSON.parse(str)
            )
        );
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
            review,
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
            switchModalOn,
            setSwitchModalOn,
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
            review,
            selectedText,
            hoveredCode,
            hoveredCodeText,
            additionalCodes,
            chatHistories,
            activeSegment,
            selectedExplanations,
            switchModalOn,
            hoveredSegment,
            selectedSegment,
            // splitIntoSegments,
            processTranscript
        ]
    );

    return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
};

export const useTranscriptContext = () => useContext(TranscriptContext);
