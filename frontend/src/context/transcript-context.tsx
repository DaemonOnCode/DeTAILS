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
import {
    SetState,
    ChatMessage,
    Segment,
    IQECResponse,
    IQECTResponse,
    IQECTTyResponse,
    Explanation
} from '../types/Coding/shared';

type TextMarker = {
    itemId: string;
    range: [number, number];
} | null;

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
        id: string;
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
        extraCodes?: string[]
    ) => Promise<{
        processedSegments: Segment[];
        codeSet: string[];
        codeColors: Record<string, string>;
    }>;
    selectionRangeRef: MutableRefObject<Range | null>;
    containerRef: RefObject<HTMLDivElement>;
    selectedTextMarker: TextMarker | null;
    setSelectedTextMarker: SetState<TextMarker | null>;
    isValidSelection: (
        selectedText: string,
        marker: TextMarker | null,
        container: HTMLElement | null
    ) => boolean;
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
    processTranscript: async () => ({
        processedSegments: [],
        codeSet: [],
        codeColors: {}
    }),
    selectionRangeRef: { current: null },
    containerRef: { current: null },
    selectedTextMarker: null,
    setSelectedTextMarker: () => {},
    isValidSelection: () => false
});

export const TranscriptContextProvider: FC<{
    children: React.ReactNode;
    postId: string;
    review: boolean;
    codeResponses: (IQECResponse | IQECTResponse | IQECTTyResponse)[];
    splitCheck?: boolean;
}> = ({ children, review, codeResponses, postId, splitCheck = false }) => {
    console.log('Running provider', review);

    const worker = useMemo(() => {
        const url = `${process.env.PUBLIC_URL}/workers/transcript.worker.js`;
        return new Worker(url, { type: 'module' });
    }, []);

    const [allExplanations, setAllExplanations] = useState<Explanation[]>(
        codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                explanation: r.explanation,
                code: r.code,
                fullText: r.quote
            }))
    );

    const codes: {
        id: string;
        text: string;
        code: string;
        rangeMarker?: { itemId: string; range: [number, number] };
        source?: string;
    }[] = useMemo(
        () =>
            codeResponses
                .filter((r) => r.postId === postId)
                .map((r) => ({
                    id: r.id,
                    text: r.quote,
                    code: r.code,
                    rangeMarker: r.rangeMarker,
                    source: r.source
                })),
        [codeResponses, postId]
    );

    useEffect(() => {
        console.log(
            'codeResponses or postId changed - recalc explanations, codes, chat history.',
            codeResponses.filter((r) => r.postId === postId)
        );

        const newAllExplanations: Explanation[] = codeResponses
            .filter((r) => r.postId === postId)
            .map((r) => ({
                explanation: r.explanation,
                code: r.code,
                fullText: r.quote
            }));

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
        setChatHistories(newChatHistories);
    }, [codeResponses, postId]);

    const [selectedText, setSelectedText] = useState<string | null>(null);
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);
    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);
    const [additionalCodes, setAdditionalCodes] = useState<string[]>([]);
    const [switchModalOn, setSwitchModalOn] = useState(false);
    const [selectedTextMarker, setSelectedTextMarker] = useState<TextMarker | null>(null);

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

    function isValidSelection(
        selectedText: string,
        marker: TextMarker | null,
        container: HTMLElement | null
    ): marker is TextMarker {
        if (!selectedText.trim() || !marker || !container) return false;

        const [start, end] = marker.range;
        if (start >= end) return false;

        return !!container.querySelector(`span[data-segment-id^="${marker.itemId}|"]`);
    }

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

        console.log('Start item ID:', startItemId, 'End item ID:', endItemId);

        if (!startItemId || !endItemId || startItemId !== endItemId) {
            // alert('Please select text within a single comment only to make changes.');

            console.log(
                'Selection invalid (either started outside, ended outside, or spanned two comments).'
            );
            return;
        }

        console.log('Start and end item IDs match:', startItemId, overallSelectedText);
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
        setSelectedText(overallSelectedText);

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

    const processTranscript = useCallback(
        async (post: any, extraCodes: string[] = []) => {
            return new Promise<any>((resolve, reject) => {
                const handleMessage = (event: MessageEvent) => {
                    if (event.data.type === 'processTranscriptResult') {
                        worker.removeEventListener('message', handleMessage);
                        resolve(event.data.data);
                    } else if (event.data.type === 'error') {
                        worker.removeEventListener('message', handleMessage);
                        reject(new Error(event.data.error));
                    }
                };
                worker.addEventListener('message', handleMessage);
                worker.postMessage({
                    type: 'processTranscript',
                    data: { post, codes, extraCodes }
                });
            });
        },
        [worker, codes]
    );

    const handleSegmentInteraction = useCallback(
        (segment: Segment | null, isPermanent = false, relatedCodeText?: string[]) => {
            console.log('Handling segment interaction:', segment, isPermanent);
            if (!segment || !segment.fullText.length) return;

            if (review && isPermanent && !splitCheck) {
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
            setSelectedTextMarker,
            isValidSelection
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
