import React, {
    createContext,
    FC,
    useContext,
    useState,
    useRef,
    useMemo,
    useEffect,
    MutableRefObject,
    RefObject,
    useCallback
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
    // splitIntoSegments: (text: string) => string[];
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
    // splitIntoSegments: () => [],
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

    console.log('All explanations:', allExplanations);

    const codes = codeResponses
        .filter((r) => r.postId === postId)
        .map((r) => ({ text: r.quote, code: r.code }));

    console.log(
        'All responses:',
        codeResponses.filter((r) => r.postId === postId)
    );

    const gatherChatHistory = useCallback(() => {
        let allChatHistory: Record<string, ChatMessage[]> = {};
        console.log(
            'Gathering chat history',
            codeResponses.filter((response) => response.postId === postId)
        );
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
    }, [codeResponses, postId]);
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

    useEffect(() => {
        console.log('Code responses changed');
        setChatHistories(gatherChatHistory());
        if (selectedSegment) {
            const currentCodes = Array.from(
                new Set(
                    codeResponses
                        .filter((r) => r.postId === postId && r.quote === selectedSegment?.fullText)
                        .map((r) => r.code)
                )
            );

            // const unionWithoutIntersection = Array.from(
            //     new Set([
            //         ...(currentSegment?.relatedCodeText ?? []).filter(
            //             (item) => !currentCodes.includes(item)
            //         ),
            //         ...currentCodes.filter(
            //             (item) => !currentSegment?.relatedCodeText.includes(item)
            //         )
            //     ])
            // );

            // console.log(
            //     'Updating explanations',
            //     unionWithoutIntersection,
            //     currentCodes,
            //     currentSegment?.relatedCodeText
            // );
            if (currentCodes.length === 0) return;

            setHoveredCodeText(currentCodes ?? []);
            // const previousSet = new Set(
            //     codeResponses
            //         .filter((r) => r.postId === postId && r.quote === currentSegment?.fullText)
            //         .map((r) => r.code)
            // );

            // const currentCodes = Array.from(

            // );
            // setSelectedSegment(null);
            // handleSegmentInteraction(currentSegment, true);
        }
    }, [codeResponses]);

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

    interface TextInterval {
        start: number;
        end: number;
        text: string;
        codes: string[]; // now an array of codes
    }

    // Helper: Split text into segments.
    // const splitIntoSegments = (text: string): string[] => {
    //     const newlineToken = '<NEWLINE>';
    //     const cleanedText = text.replace(/\n+/g, newlineToken);
    //     const segments = cleanedText
    //         .split(/(?<=[.?!:,])/)
    //         .map((segment) => segment.trim())
    //         .filter(Boolean);
    //     return segments.map((segment) => segment.replace(new RegExp(newlineToken, 'g'), '\n'));
    // };

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
        return text.replace(/[.*+?^${}()|[\]\\]/gi, '\\$&');
    }

    interface CodeInterval {
        start: number;
        end: number;
        code: string;
        text: string;
    }

    interface TextEvent {
        position: number;
        type: 'start' | 'end';
        code: string;
    }

    const normalizeText = (text: string) => {
        return text
            .toLowerCase()
            .replace(/\s+/g, ' ') // Collapse multiple whitespace
            .replace(/[^\w\s]|_/g, '') // Remove punctuation
            .trim();
    };

    const processTranscript = useCallback(
        (
            post: any,
            // codes: { code: string; text: string }[],
            extraCodes: string[] | undefined
        ) => {
            if (!extraCodes) {
                extraCodes = [];
            }
            const codeSet = Array.from(new Set([...codes.map((c) => c.code), ...extraCodes]));
            const codeColors: Record<string, string> = {};
            codeSet.forEach((code) => {
                codeColors[code] = generateColor(code);
            });

            // Flatten all text content (post title, selftext, and comments)
            const transcriptFlatMap = [
                { id: post.id, text: post.title, type: 'title', parent_id: null },
                { id: post.id, text: post.selftext, type: 'selftext', parent_id: null },
                ...post.comments.flatMap((comment: any) => traverseComments(comment, post.id))
            ];

            const processedCodes = codes.map((c: any) => ({
                ...c,
                normalized: normalizeText(c.text)
            }));

            const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
                const text = data.text;
                const normalizedText = normalizeText(text);

                // Find all matches using combination of exact and fuzzy
                const matches = processedCodes
                    .map((code) => {
                        const exactMatch = text.includes(code.text);
                        const fuzzyScore = exactMatch
                            ? 100
                            : ratio(normalizedText, code.normalized, { full_process: true });

                        return {
                            code: code.code,
                            text: code.text,
                            score: exactMatch ? 100 : fuzzyScore,
                            positions: getAllPositions(text, code.text)
                        };
                    })
                    .filter((m) => m.score >= 85);

                // Merge matches using interval tree approach
                const intervals = matches.flatMap((m) =>
                    m.positions.map((pos) => ({
                        start: pos,
                        end: pos + m.text.length,
                        code: m.code,
                        text: m.text,
                        score: m.score
                    }))
                ); // Generate and sort events
                const events: TextEvent[] = [];
                intervals.forEach(({ start, end, code }) => {
                    events.push({ position: start, type: 'start', code });
                    events.push({ position: end, type: 'end', code });
                });

                // Sort events: position asc, end before start at same position
                events.sort(
                    (a, b) =>
                        a.position - b.position || (a.type === 'end' && b.type === 'start' ? -1 : 1)
                );

                // Process events to build segments
                const segments: Segment[] = [];
                let currentPos = 0;
                const activeCodes = new Set<string>();
                let currentCodes = new Set<string>();

                events.forEach((event, i) => {
                    if (event.position > currentPos) {
                        // Add segment from currentPos to event.position
                        const segmentText = text.slice(currentPos, event.position);
                        if (segmentText) {
                            segments.push(
                                createSegment(
                                    segmentText,
                                    data,
                                    dataIndex,
                                    segments.length,
                                    Array.from(currentCodes),
                                    codeColors
                                )
                            );
                        }
                        currentPos = event.position;
                    }

                    // Update active codes
                    event.type === 'start'
                        ? currentCodes.add(event.code)
                        : currentCodes.delete(event.code);
                });

                // Add remaining text after last event
                if (currentPos < text.length) {
                    const segmentText = text.slice(currentPos);
                    segments.push(
                        createSegment(
                            segmentText,
                            data,
                            dataIndex,
                            segments.length,
                            Array.from(currentCodes),
                            codeColors
                        )
                    );
                }

                return segments;
            });

            return { processedSegments: segments, codeSet, codeColors };
        },
        [codes]
    );

    // Helper function to create segments
    const createSegment = (
        text: string,
        data: any,
        dataIndex: number,
        segmentIndex: number,
        activeCodes: string[],
        codeColors: Record<string, string>
    ): Segment => ({
        line: text,
        id: data.id,
        type: data.type,
        parent_id: data.parent_id,
        backgroundColours: activeCodes.map((code) => codeColors[code]),
        relatedCodeText: activeCodes,
        fullText: activeCodes.length > 0 ? text : '',
        index: `${dataIndex}|${segmentIndex}`
    });

    const getAllPositions = (text: string, search: string) => {
        const positions = [];
        let pos = 0;
        while (pos < text.length) {
            const index = text.indexOf(search, pos);
            if (index === -1) break;
            positions.push(index);
            pos = index + search.length;
        }
        return positions;
    };

    const handleSegmentInteraction = (
        segment: Segment | null,
        isPermanent = false,
        relatedCodeText?: string[]
    ) => {
        if (!segment) return;
        if (review && isPermanent) {
            setSwitchModalOn(true);
            return;
        }

        if (selectedSegment) {
            return;
        }

        const targetSegment = isPermanent ? setSelectedSegment : setHoveredSegment;
        targetSegment(segment);

        const currentCodeText = relatedCodeText ?? segment.relatedCodeText;

        console.log('Handling segment interaction', segment, currentCodeText);
        setHoveredCodeText(currentCodeText);

        // Directly find explanations by code match
        const foundExplanations: { explanation: string; code: string; fullText: string }[] = [];
        currentCodeText.forEach((code) => {
            codeResponses.forEach((response) => {
                if (response.code === code && segment.fullText === response.quote) {
                    foundExplanations.push({
                        explanation: response.explanation,
                        code: response.code,
                        fullText: response.quote
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
            // splitIntoSegments,
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
            codeResponses,
            // splitIntoSegments,
            processTranscript
        ]
    );

    return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
};

export const useTranscriptContext = () => useContext(TranscriptContext);
