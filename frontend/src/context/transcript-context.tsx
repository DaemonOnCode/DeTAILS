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

interface ITranscriptContext {
    review: boolean;
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
    handleTextSelection: (_selectionRef: MutableRefObject<Range | null>) => void;
    restoreSelection: () => void;
    removeSelection: () => void;
    handleSegmentInteraction: (segment: Segment, isPermanent?: boolean) => void;
    handleSegmentLeave: (isPermanent?: boolean) => void;
    processTranscript: (
        post: any,
        extraCodes?: string[],
        codeResponses?: any[]
    ) => {
        processedSegments: Segment[];
        codeSet: string[];
        codeColors: Record<string, string>;
    };
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

    const [allExplanations, setAllExplanations] = useState<Explanation[]>(
        codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                explanation: r.explanation,
                code: r.code,
                fullText: r.quote
            }))
    );
    // const [codes, setCodes] = useState<
    //     { text: string; code: string; rangeMarker?: { itemId: string; range: [number, number] } }[]
    // >([]);

    const codes: {
        text: string;
        code: string;
        rangeMarker?: { itemId: string; range: [number, number] };
    }[] = useMemo(
        () =>
            codeResponses
                .filter((r) => r.postId === postId)
                .map((r) => ({ text: r.quote, code: r.code })),
        [codeResponses, postId]
    );

    useEffect(() => {
        console.log(
            'codeResponses or postId changed – recalc explanations, codes, chat history.',
            codeResponses.filter((r) => r.postId === postId)
        );

        const newAllExplanations: Explanation[] = codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                explanation: r.explanation,
                code: r.code,
                fullText: r.quote
            }));

        const newCodes = codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                text: r.quote,
                code: r.code,
                rangeMarker: r.rangeMarker
            }));

        console.log('New codes rerender:', newCodes);

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
        // setCodes([...newCodes]);
        setChatHistories(newChatHistories);
    }, [codeResponses, postId]);

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

    const [selectedExplanations, setSelectedExplanations] = useState<Explanation[]>([]);

    const activeSegment = selectedSegment || hoveredSegment;

    const selectionRangeRef = useRef<Range | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('Code responses changed – rerendering');
    }, [codeResponses]);

    useEffect(() => {
        if (!selectedSegment) return;
        if (!Array.isArray(selectedSegment.fullText)) return;

        console.log('Re-check codes for currently selected segment, if any.');

        const currentCodes = Array.from(
            new Set(
                codeResponses
                    .filter(
                        (r) => r.postId === postId && selectedSegment.fullText.includes(r.quote)
                    )
                    .map((r) => r.code)
            )
        );

        setHoveredCodeText(currentCodes);

        const filteredExplanations = allExplanations.filter(
            (e) => currentCodes.includes(e.code) && selectedSegment.fullText.includes(e.fullText)
        );

        setSelectedExplanations(filteredExplanations);
    }, [codeResponses, selectedSegment, postId, allExplanations]);

    useEffect(() => {
        if (!selectedSegment && !hoveredSegment) {
            setSelectedExplanations(allExplanations);
        }
    }, [selectedSegment, hoveredSegment, allExplanations]);

    const handleTextSelection = (_selectionRef: React.MutableRefObject<Range | null>): void => {
        console.log('Handling text selection from TranscriptContext');
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            console.log('No selection found or empty range.');
            return;
        }

        const range = selection.getRangeAt(0);
        _selectionRef.current = range;

        const overallSelectedText = selection.toString().trim();
        if (!overallSelectedText) return;

        console.log('Overall selected text (quote):', overallSelectedText);
        setSelectedText(overallSelectedText);

        const startNode = range.startContainer.parentElement;
        const endNode = range.endContainer.parentElement;
        if (!startNode || !endNode) {
            console.log('Could not find start or end parentElement.');
            return;
        }

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

    function traverseComments(comment: any, parentId: string | null): any[] {
        return [
            {
                id: comment.id,
                text: displayText(comment.body),
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
            console.log(codeResponses, 'processTranscript rerendering', codes);
            const codeSet = Array.from(new Set([...codes.map((c) => c.code), ...extraCodes]));
            const codeColors: Record<string, string> = {};

            codeSet.forEach((code) => {
                codeColors[code] = generateColor(code);
            });

            const codeToOriginalQuote: Record<string, string> = {};
            codes.forEach((c) => {
                codeToOriginalQuote[c.code] = c.text;
            });

            const transcriptFlatMap = [
                { id: post.id, text: displayText(post.title), type: 'title', parent_id: null },
                {
                    id: post.id,
                    text: displayText(post.selftext),
                    type: 'selftext',
                    parent_id: null
                },
                ...post.comments.flatMap((comment: any) => traverseComments(comment, post.id))
            ];

            const codesWithMarker = codes.filter((c) => c.rangeMarker);
            const codesWithoutMarker = codes.filter((c) => !c.rangeMarker);

            const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
                const text = data.text;

                const markerIntervals: CodeInterval[] = codesWithMarker
                    .filter((c) => c.rangeMarker?.itemId === dataIndex.toString())
                    .map((c) => ({
                        start: c.rangeMarker?.range[0] ?? 0,
                        end: c.rangeMarker?.range[1] ?? 0,
                        code: c.code,
                        text: text.slice(c.rangeMarker?.range[0] ?? 0, c.rangeMarker?.range[1] ?? 0)
                    }));

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
                    return [
                        createSegment(text, data, dataIndex, 0, [], codeColors, codeToOriginalQuote)
                    ];
                }

                const events: TextEvent[] = [];
                allIntervals.forEach(({ start, end, code }) => {
                    events.push({ position: start, type: 'start', code });
                    events.push({ position: end, type: 'end', code });
                });

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

    const displayText = (text: string) => {
        return text.replace(/\s+/g, ' ').trim();
    };

    function createSegment(
        segmentText: string,
        data: any,
        dataIndex: number,
        segmentIndex: number,
        activeCodes: string[],
        codeColors: Record<string, string>,
        codeToOriginalQuote: Record<string, string>
    ): Segment {
        const relevantOriginalQuotes = activeCodes.map((code) => codeToOriginalQuote[code] || '');

        return {
            line: displayText(segmentText),
            id: data.id,
            type: data.type,
            parent_id: data.parent_id,
            index: `${dataIndex}|${segmentIndex}`,
            relatedCodeText: activeCodes,
            backgroundColours: activeCodes.map((code) => codeColors[code]),
            fullText: relevantOriginalQuotes,
            codeQuotes: activeCodes.reduce(
                (acc, code) => {
                    acc[code] = codeToOriginalQuote[code] || '';
                    return acc;
                },
                {} as Record<string, string>
            )
        };
    }

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
            console.log('Handling segment interaction:', segment, isPermanent);
            if (!segment || !segment.fullText.length) return;

            if (review && isPermanent) {
                setSwitchModalOn(true);
                return;
            }

            if (selectedSegment) {
                return;
            }

            const targetSetter = isPermanent ? setSelectedSegment : setHoveredSegment;
            targetSetter(segment);

            const currentCodeText = relatedCodeText ?? segment.relatedCodeText;
            setHoveredCodeText(currentCodeText);

            const foundExplanations: Explanation[] = [];

            currentCodeText.forEach((code) => {
                codeResponses.forEach((response) => {
                    if (response.code === code) {
                        if (
                            Array.isArray(segment.fullText) &&
                            segment.fullText.includes(response.quote)
                        ) {
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
