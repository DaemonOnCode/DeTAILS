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

interface ExtendedSegment {
    id: string;
    type: 'title' | 'selftext' | 'comment' | 'reply';
    parent_id: string | null;
    start: number;
    end: number;
    matchedText: string;
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
        rangeMarker?: { itemId: string; range: [number, number] };
    }[];
    allExplanations: Explanation[];
    // Selection helpers
    handleTextSelection: (_selectionRef: MutableRefObject<Range | null>) => void;
    restoreSelection: () => void;
    removeSelection: () => void;
    handleSegmentInteraction: (segment: Segment, isPermanent?: boolean) => void;
    handleSegmentLeave: (isPermanent?: boolean) => void;
    // Transcript processing helpers
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

    /**
     * We now store these in state so they can update if codeResponses changes.
     */
    const [allExplanations, setAllExplanations] = useState<Explanation[]>([]);
    const [codes, setCodes] = useState<
        { text: string; code: string; rangeMarker?: { itemId: string; range: [number, number] } }[]
    >([]);

    /**
     * Recomputes allExplanations, codes, and chatHistories whenever codeResponses or postId changes.
     */
    useEffect(() => {
        console.log(
            'codeResponses or postId changed – recalc explanations, codes, chat history.',
            codeResponses.filter((r) => r.postId === postId)
        );

        // 1) Build new explanations
        const newAllExplanations: Explanation[] = codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                explanation: r.explanation,
                code: r.code,
                fullText: r.quote
            }));

        // 2) Build new codes
        const newCodes = codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                text: r.quote,
                code: r.code,
                rangeMarker: r.rangeMarker
            }));

        // 3) Rebuild chat histories
        const newChatHistories: Record<string, ChatMessage[]> = {};
        codeResponses
            .filter((response) => response.postId === postId)
            .forEach((response) => {
                const key = `${postId}-${response.code}-${response.quote}`;
                newChatHistories[key] = response.chatHistory ?? [
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

        setAllExplanations(newAllExplanations);
        setCodes(newCodes);
        setChatHistories(newChatHistories);
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

    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

    const [hoveredSegment, setHoveredSegment] = useState<Segment | null>(null);
    const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

    // By default, we'll show all newAllExplanations, but we can refine which ones are selected
    // when the user hovers or selects a segment
    const [selectedExplanations, setSelectedExplanations] = useState<Explanation[]>([]);

    const activeSegment = selectedSegment || hoveredSegment;

    const selectionRangeRef = useRef<Range | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Re-run any additional logic if codeResponses changes and we have a selectedSegment
    useEffect(() => {
        if (!selectedSegment) return;

        console.log('Re-check codes for currently selected segment, if any.');

        const currentCodes = Array.from(
            new Set(
                codeResponses
                    .filter((r) => r.postId === postId && r.quote === selectedSegment.fullText)
                    .map((r) => r.code)
            )
        );

        setHoveredCodeText(currentCodes);

        const filteredExplanations = allExplanations.filter(
            (e) => currentCodes.includes(e.code) && e.fullText === selectedSegment.fullText
        );

        setSelectedExplanations(filteredExplanations);
    }, [codeResponses, selectedSegment, postId, allExplanations]);

    // --------------------------------------------------
    // Selection + highlight logic
    // --------------------------------------------------

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

        // Attempt to find the data-segment-id up the chain
        const findItemIdFromElement = (el: HTMLElement | null): string | null => {
            while (el) {
                const ds = el.getAttribute?.('data-segment-id');
                if (ds) return ds.split('|')[0];
                el = el.parentElement;
            }
            return null;
        };

        const startItemId = findItemIdFromElement(startNode);
        const endItemId = findItemIdFromElement(endNode);

        if (!startItemId || !endItemId) {
            console.log('Could not find data-segment-id for either start or end.');
            return;
        }

        // If user selection spans multiple items, bail
        if (startItemId !== endItemId) {
            console.log('Selection spans multiple items; not handled.');
            return;
        }

        const selectedItemId = startItemId;
        const container = document.getElementById('transcript-container');
        if (!container) {
            console.log('Transcript container not found.');
            return;
        }

        const itemSpans = Array.from(
            container.querySelectorAll(`span[data-segment-id^="${selectedItemId}|"]`)
        ) as HTMLElement[];

        if (itemSpans.length === 0) {
            console.log('No spans found for itemId:', selectedItemId);
            return;
        }

        // Sort itemSpans by the integer after the "|"
        itemSpans.sort((a, b) => {
            const aIndex = parseInt(a.getAttribute('data-segment-id')!.split('|')[1], 10) || 0;
            const bIndex = parseInt(b.getAttribute('data-segment-id')!.split('|')[1], 10) || 0;
            return aIndex - bIndex;
        });

        let relativeSelectionStart = 0;
        let relativeSelectionEnd = 0;
        let foundStart = false;
        let currentOffset = 0;

        for (const span of itemSpans) {
            const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                const nodeText = node.textContent ?? '';
                if (!foundStart && node === range.startContainer) {
                    relativeSelectionStart = currentOffset + range.startOffset;
                    foundStart = true;
                }
                if (node === range.endContainer) {
                    relativeSelectionEnd = currentOffset + range.endOffset;
                    break;
                }
                currentOffset += nodeText.length;
            }
            if (relativeSelectionEnd > 0) {
                break;
            }
        }

        console.log('Selected item ID:', selectedItemId);
        console.log('Relative selection offsets:', relativeSelectionStart, relativeSelectionEnd);

        setSelectedTextMarker({
            itemId: selectedItemId,
            range: [relativeSelectionStart, relativeSelectionEnd]
        });
    };

    const restoreSelection = (): void => {
        console.log('Restoring selection from TranscriptContext');
        if (!selectionRangeRef.current) return;
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(selectionRangeRef.current);
    };

    const removeSelection = (): void => {
        console.log('Removing selection from TranscriptContext');
        const selection = window.getSelection();
        if (!selection) return;
        selection.removeAllRanges();
        selectionRangeRef.current = null;
    };

    // --------------------------------------------------
    // Transcript Processing (unchanged from your snippet)
    // --------------------------------------------------

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
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]|_/g, '')
            .trim();
    };

    const processTranscript = useCallback(
        (post: any, extraCodes: string[] = []) => {
            const codeSet = Array.from(new Set([...codes.map((c) => c.code), ...extraCodes]));
            const codeColors: Record<string, string> = {};

            codeSet.forEach((code) => {
                codeColors[code] = generateColor(code);
            });

            // Build code => originalQuote map
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

            const codesWithMarker = codes.filter((c) => c.rangeMarker);
            const codesWithoutMarker = codes.filter((c) => !c.rangeMarker);

            const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
                const text = data.text;

                // Intervals from codes with rangeMarker
                const markerIntervals: CodeInterval[] = codesWithMarker
                    .filter((c) => c.rangeMarker?.itemId === dataIndex.toString())
                    .map((c) => ({
                        start: c.rangeMarker?.range[0] ?? 0,
                        end: c.rangeMarker?.range[1] ?? 0,
                        code: c.code,
                        text: text.slice(c.rangeMarker?.range[0] ?? 0, c.rangeMarker?.range[1] ?? 0)
                    }));

                // Intervals from codes w/o marker (string matching)
                const normalizedText = normalizeText(text);
                const matchingIntervals: CodeInterval[] = codesWithoutMarker.flatMap((c) => {
                    const normalizedCodeText = normalizeText(c.text);
                    const exactMatch = text.includes(c.text);
                    const fuzzyScore = exactMatch
                        ? 100
                        : ratio(normalizedText, normalizedCodeText, { full_process: true });
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

                const allIntervals = [...markerIntervals, ...matchingIntervals];
                if (allIntervals.length === 0) {
                    // Single segment with no codes
                    return [
                        createSegment(text, data, dataIndex, 0, [], codeColors, codeToOriginalQuote)
                    ];
                }

                // Build start/end events
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
                                    Array.from(currentCodes),
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

                // Trailing text
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

    const createSegment = (
        segmentText: string,
        data: any,
        dataIndex: number,
        segmentIndex: number,
        activeCodes: string[],
        codeColors: Record<string, string>,
        codeToOriginalQuote: Record<string, string>
    ): Segment => {
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
            fullText: segmentText,
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

    // --------------------------------------------------
    // Segment Interaction
    // --------------------------------------------------
    const handleSegmentInteraction = useCallback(
        (segment: Segment | null, isPermanent = false, relatedCodeText?: string[]) => {
            if (!segment) return;

            if (review && isPermanent) {
                setSwitchModalOn(true);
                return;
            }

            if (selectedSegment) {
                // If there's already a permanently selectedSegment, do nothing
                return;
            }

            const targetSetter = isPermanent ? setSelectedSegment : setHoveredSegment;
            targetSetter(segment);

            const currentCodeText = relatedCodeText ?? segment.relatedCodeText;
            setHoveredCodeText(currentCodeText);

            // Gather matching explanations
            const foundExplanations: Explanation[] = [];

            currentCodeText.forEach((code) => {
                codeResponses.forEach((response) => {
                    if (response.code === code) {
                        // Instead of comparing segment.fullText to response.quote,
                        // we can use segment.codeQuotes[code] if needed.
                        if (segment.fullText === response.quote) {
                            foundExplanations.push({
                                explanation: response.explanation,
                                code: response.code,
                                fullText: response.quote
                            });
                        }
                    }
                });
            });

            const uniqueExplanations = Array.from(
                new Set(foundExplanations.map((e) => JSON.stringify(e)))
            ).map((str) => JSON.parse(str));

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

    // --------------------------------------------------
    // Build the provider value
    // --------------------------------------------------
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
            hoveredSegment,
            selectedSegment,
            selectedExplanations,
            switchModalOn,
            codes,
            allExplanations,
            processTranscript,
            selectedTextMarker
        ]
    );

    return <TranscriptContext.Provider value={value}>{children}</TranscriptContext.Provider>;
};

export const useTranscriptContext = () => useContext(TranscriptContext);
