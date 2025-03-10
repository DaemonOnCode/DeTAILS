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
    selectedTextMarker: {
        itemId: string;
        range: [number, number];
    } | null;
    setSelectedTextMarker: SetState<{
        itemId: string;
        range: [number, number];
    } | null>;
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
    containerRef: { current: null },
    selectedTextMarker: null,
    setSelectedTextMarker: () => {}
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
        .map((r) => ({ text: r.quote, code: r.code, rangeMarker: r.rangeMarker }));

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
    const [selectedTextMarker, setSelectedTextMarker] = useState<{
        itemId: string;
        range: [number, number];
    } | null>(null);

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

            if (currentCodes.length === 0) return;

            setHoveredCodeText(currentCodes ?? []);
            setSelectedExplanations(
                allExplanations.filter(
                    (e) => currentCodes.includes(e.code) && e.fullText === selectedSegment?.fullText
                )
            );
        }
    }, [codeResponses]);

    function getSelectionOffsets(
        container: HTMLElement,
        range: Range
    ): { selectionStart: number; selectionEnd: number } {
        let selectionStart = 0;
        let selectionEnd = 0;
        let currentOffset = 0;
        let foundStart = false;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
        let node: Node | null = null;

        while ((node = walker.nextNode())) {
            const nodeText = node.textContent || '';
            // When we find the start node, record the offset.
            if (!foundStart && node === range.startContainer) {
                selectionStart = currentOffset + range.startOffset;
                foundStart = true;
            }
            if (node === range.endContainer) {
                selectionEnd = currentOffset + range.endOffset;
                break;
            }
            currentOffset += nodeText.length;
        }
        return { selectionStart, selectionEnd };
    }

    const handleTextSelection = (_selectionRef: React.MutableRefObject<Range | null>): void => {
        console.log('Handling text selection from TranscriptContext');
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found or empty range.');
            return;
        }

        // Grab the user’s selection range
        const range = selection.getRangeAt(0);
        _selectionRef.current = range;

        const overallSelectedText = selection.toString().trim();
        if (!overallSelectedText) return;

        console.log('Overall selected text (quote):', overallSelectedText);
        setSelectedText(overallSelectedText);

        // Identify the start and end text nodes’ parent elements
        const startNode = range.startContainer.parentElement;
        const endNode = range.endContainer.parentElement;
        if (!startNode || !endNode) {
            console.log('Could not find start or end parentElement.');
            return;
        }

        // Walk up the DOM until we find a data-segment-id.
        // Then extract the itemId (the part before "|").
        const findItemIdFromElement = (el: HTMLElement | null): string | null => {
            while (el) {
                const ds = el.getAttribute?.('data-segment-id');
                if (ds) return ds.split('|')[0]; // e.g. "comment123"
                el = el.parentElement;
            }
            return null;
        };

        const startItemId = findItemIdFromElement(startNode);
        const endItemId = findItemIdFromElement(endNode);

        if (!startItemId || !endItemId) {
            console.log('Could not find data-segment-id for either the start or end.');
            return;
        }

        // If user selection spans multiple items, bail out
        if (startItemId !== endItemId) {
            console.log('Selection spans multiple items; not handled.');
            return;
        }

        // The user is selecting within exactly one item (e.g., one comment)
        const selectedItemId = startItemId;

        // Get the transcript container in order to query inside it
        const container = document.getElementById('transcript-container');
        if (!container) {
            console.log('Transcript container not found.');
            return;
        }

        // Grab all <span> elements that have data-segment-id starting with
        // `selectedItemId + "|"`. Sort them by segment number for stable text order.
        const itemSpans = Array.from(
            container.querySelectorAll(`span[data-segment-id^="${selectedItemId}|"]`)
        ) as HTMLElement[];

        if (itemSpans.length === 0) {
            console.log('No spans found for itemId:', selectedItemId);
            return;
        }

        itemSpans.sort((a, b) => {
            const aIndex = parseInt(a.getAttribute('data-segment-id')!.split('|')[1], 10) || 0;
            const bIndex = parseInt(b.getAttribute('data-segment-id')!.split('|')[1], 10) || 0;
            return aIndex - bIndex;
        });

        // We'll compute the selection's start/end offset relative to
        // the concatenated text of these spans
        let relativeSelectionStart = 0;
        let relativeSelectionEnd = 0;
        let foundStart = false;
        let currentOffset = 0;

        // Walk through each span’s text nodes in order
        for (const span of itemSpans) {
            const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                const nodeText = node.textContent ?? '';

                // If this is the start node, record offset
                if (!foundStart && node === range.startContainer) {
                    relativeSelectionStart = currentOffset + range.startOffset;
                    foundStart = true;
                }
                // If this is the end node, record offset and finish
                if (node === range.endContainer) {
                    relativeSelectionEnd = currentOffset + range.endOffset;
                    break;
                }

                currentOffset += nodeText.length;
            }
            // Once we’ve found the end, no need to keep looping
            if (relativeSelectionEnd > 0) {
                break;
            }
        }

        console.log('Selected item ID:', selectedItemId);
        console.log('Relative selection offsets:', relativeSelectionStart, relativeSelectionEnd);

        // Store in your marker state
        setSelectedTextMarker({
            itemId: selectedItemId,
            range: [relativeSelectionStart, relativeSelectionEnd]
        });
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
        (post: any, extraCodes: string[] | undefined) => {
            if (!extraCodes) extraCodes = [];
            const codeSet = Array.from(new Set([...codes.map((c) => c.code), ...extraCodes]));
            const codeColors: Record<string, string> = {};

            // 1) Build the color lookup
            codeSet.forEach((code) => {
                codeColors[code] = generateColor(code);
            });

            // 2) Build the code => original quote map
            const codeToOriginalQuote: Record<string, string> = {};
            codes.forEach((c) => {
                codeToOriginalQuote[c.code] = c.text;
            });

            // Flatten transcript data
            const transcriptFlatMap = [
                { id: post.id, text: post.title, type: 'title', parent_id: null },
                { id: post.id, text: post.selftext, type: 'selftext', parent_id: null },
                ...post.comments.flatMap((comment: any) => traverseComments(comment, post.id))
            ];

            // Separate codes with vs. without rangeMarker
            const codesWithMarker = codes.filter((c) => c.rangeMarker);
            const codesWithoutMarker = codes.filter((c) => !c.rangeMarker);

            // For each transcript item
            const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
                const text = data.text;

                // Step 1: intervals from codes with rangeMarker for this item
                const markerIntervals: CodeInterval[] = codesWithMarker
                    .filter((c) => c.rangeMarker?.itemId === dataIndex.toString())
                    .map((c) => ({
                        start: c.rangeMarker?.range[0] ?? 0,
                        end: c.rangeMarker?.range[1] ?? 0,
                        code: c.code,
                        text: text.slice(c.rangeMarker?.range[0] ?? 0, c.rangeMarker?.range[1] ?? 0)
                    }));

                // Step 2: intervals from codes without rangeMarker (string matching)
                const normalizedText = normalizeText(text);
                const matchingIntervals: CodeInterval[] = codesWithoutMarker.flatMap((c) => {
                    const normalizedCodeText = normalizeText(c.text);
                    const exactMatch = text.includes(c.text);
                    const fuzzyScore = exactMatch
                        ? 100
                        : ratio(normalizedText, normalizedCodeText, { full_process: true });

                    // If text is “close enough,” find all occurrences
                    if (fuzzyScore >= 85) {
                        const positions = getAllPositions(text, c.text);
                        return positions.map((pos) => ({
                            start: pos,
                            end: pos + c.text.length,
                            code: c.code,
                            text: c.text
                        }));
                    }
                    return [];
                });

                // Step 3: combine intervals
                const allIntervals = [...markerIntervals, ...matchingIntervals];

                // If no intervals, single segment with no codes
                if (allIntervals.length === 0) {
                    return [
                        createSegment(
                            text,
                            data,
                            dataIndex,
                            0,
                            [], // no active codes
                            codeColors,
                            codeToOriginalQuote
                        )
                    ];
                }

                // Step 4: build "start" and "end" events
                const events: TextEvent[] = [];
                allIntervals.forEach(({ start, end, code }) => {
                    events.push({ position: start, type: 'start', code });
                    events.push({ position: end, type: 'end', code });
                });

                // Sort events
                events.sort(
                    (a, b) =>
                        a.position - b.position || (a.type === 'end' && b.type === 'start' ? -1 : 1)
                );

                // Step 5: generate final segments
                const itemSegments: Segment[] = [];
                let currentPos = 0;
                const currentCodes = new Set<string>();

                events.forEach((event) => {
                    if (event.position > currentPos) {
                        const segmentText = text.slice(currentPos, event.position);
                        if (segmentText) {
                            itemSegments.push(
                                createSegment(
                                    segmentText,
                                    data,
                                    dataIndex,
                                    itemSegments.length,
                                    Array.from(currentCodes), // the codes active until now
                                    codeColors,
                                    codeToOriginalQuote
                                )
                            );
                        }
                        currentPos = event.position;
                    }
                    if (event.type === 'start') {
                        currentCodes.add(event.code);
                    } else {
                        currentCodes.delete(event.code);
                    }
                });

                // Add trailing text, if any
                if (currentPos < text.length) {
                    itemSegments.push(
                        createSegment(
                            text.slice(currentPos),
                            data,
                            dataIndex,
                            itemSegments.length,
                            Array.from(currentCodes),
                            codeColors,
                            codeToOriginalQuote
                        )
                    );
                }

                return itemSegments;
            });

            return { processedSegments: segments, codeSet, codeColors };
        },
        [codes]
    );

    // Helper function to create segments
    // codeToOriginalQuote[code] is the full text for that code's snippet

    const createSegment = (
        segmentText: string,
        data: any,
        dataIndex: number,
        segmentIndex: number,
        activeCodes: string[],
        codeColors: Record<string, string>,
        codeToOriginalQuote: Record<string, string>
    ): Segment => {
        // Build an object code => originalQuote
        const mapOfQuotes: Record<string, string> = {};
        activeCodes.forEach((code) => {
            mapOfQuotes[code] = codeToOriginalQuote[code];
        });

        return {
            line: segmentText,
            id: data.id,
            type: data.type,
            parent_id: data.parent_id,
            index: `${dataIndex}|${segmentIndex}`,
            relatedCodeText: activeCodes,
            backgroundColours: activeCodes.map((code) => codeColors[code]),
            // If you want to keep "fullText" for quick text display, that’s OK,
            // but it might just be the sub-segment portion:
            fullText: segmentText,

            // The big improvement: for each code, store the *actual* original text
            codeQuotes: mapOfQuotes
        };
    };

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

    const handleSegmentInteraction = useCallback(
        (segment: Segment | null, isPermanent = false, relatedCodeText?: string[]) => {
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
                // Now, instead of comparing `segment.fullText` with `response.quote`,
                // we check segment.codeQuotes[code].
                codeResponses.forEach((response) => {
                    if (response.code === code) {
                        // If the user’s code matches the response’s code:
                        const originalSnippet = segment.codeQuotes?.[code];
                        // Compare that snippet with response.quote:
                        if (originalSnippet && originalSnippet === response.quote) {
                            foundExplanations.push({
                                explanation: response.explanation,
                                code: response.code,
                                fullText: response.quote
                            });
                        }
                    }
                });
            });

            // Remove duplicates (if any)
            const uniqueExplanations = Array.from(
                new Set(foundExplanations.map((e) => JSON.stringify(e)))
            ).map((str) => JSON.parse(str));

            console.log('Found explanations:', uniqueExplanations);
            setSelectedExplanations(uniqueExplanations);
        },
        [codeResponses, selectedSegment, review]
    );

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
            containerRef,
            selectedTextMarker,
            setSelectedTextMarker
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
            processTranscript,
            selectedTextMarker
        ]
    );

    return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
};

export const useTranscriptContext = () => useContext(TranscriptContext);
