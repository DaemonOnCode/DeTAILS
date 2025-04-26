import { ratio } from 'fuzzball';
import { generateColor } from '../utility/color-generator';

interface Code {
    id: string;
    text: string;
    code: string;
    rangeMarker?: { itemId: string; range: [number, number] };
}

interface Segment {
    line: string;
    id: string;
    type: string;
    parent_id: string | null;
    index: string;
    relatedCodeText: string[];
    backgroundColours: string[];
    fullText: string[];
    codeQuotes: Record<string, string>;
    codeToOriginalQuotes: Record<string, string[]>;
}

function displayText(text: string): string {
    return text.replace(/\s+/gm, ' ').trim();
}

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/\s+/gm, ' ')
        .replace(/[^\w\s]|_/gm, '')
        .trim();
}

function getAllPositions(text: string, search: string): number[] {
    const positions = [];
    let pos = 0;
    while (pos < text.length) {
        const index = text.indexOf(search, pos);
        if (index === -1) break;
        positions.push(index);
        pos = index + search.length;
    }
    return positions;
}

function createSegment(
    segmentText: string,
    data: any,
    dataIndex: number,
    segmentIndex: number,
    activeCodeIds: string[],
    codeColors: Record<string, string>,
    codes: Code[]
): Segment {
    const activeCodes = activeCodeIds
        .map((id) => codes.find((c) => c.id === id))
        .filter(Boolean) as Code[];

    const codeToOriginalQuotes: Record<string, string[]> = {};
    activeCodes.forEach((c) => {
        if (!codeToOriginalQuotes[c.code]) {
            codeToOriginalQuotes[c.code] = [];
        }
        codeToOriginalQuotes[c.code].push(c.text);
    });

    const relatedCodeText = Array.from(new Set(activeCodes.map((c) => c.code)));

    const codeQuotes = relatedCodeText.reduce(
        (acc, code) => {
            acc[code] = segmentText;
            return acc;
        },
        {} as Record<string, string>
    );

    return {
        line: displayText(segmentText),
        id: data.id,
        type: data.type,
        parent_id: data.parent_id,
        index: `${dataIndex}|${segmentIndex}`,
        relatedCodeText,
        backgroundColours: relatedCodeText.map((code) => codeColors[code]),
        fullText: activeCodes.map((c) => c.text),
        codeQuotes,
        codeToOriginalQuotes
    };
}

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

function processTranscript(
    post: any,
    codes: Code[],
    extraCodes: string[] = []
): {
    processedSegments: Segment[];
    codeSet: string[];
    codeColors: Record<string, string>;
} {
    console.log(`Worker: Starting processTranscript for post ${post.id}`);

    const codeSet = Array.from(new Set([...codes.map((c) => c.code), ...extraCodes]));

    const codeColors: Record<string, string> = {};
    codeSet.forEach((code) => {
        codeColors[code] = generateColor(code);
    });

    const transcriptFlatMap = [
        { id: post.id, text: displayText(post.title), type: 'title', parent_id: null },
        { id: post.id, text: displayText(post.selftext), type: 'selftext', parent_id: null },
        ...post.comments.flatMap((comment: any) => traverseComments(comment, post.id))
    ];

    const codesWithMarker = codes.filter((c) => c.rangeMarker);
    const codesWithoutMarker = codes.filter((c) => !c.rangeMarker);

    const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
        const text = data.text;

        // Marker-based intervals
        const markerIntervals = codesWithMarker
            .filter((c) => c.rangeMarker?.itemId === dataIndex.toString())
            .map((c) => ({
                start: c.rangeMarker?.range[0] ?? 0,
                end: c.rangeMarker?.range[1] ?? 0,
                codeId: c.id,
                text: c.text
            }));

        // Fuzzy matching for codes without markers
        const normalizedText = normalizeText(text);
        const matchingIntervals = codesWithoutMarker.flatMap((c) => {
            const normalizedCodeText = normalizeText(c.text);
            const exactMatch = text.includes(c.text);

            const fuzzyScore = exactMatch
                ? 100
                : ratio(normalizedText, normalizedCodeText, { full_process: true });
            if (dataIndex === 72) {
                console.log(`Worker: Data index ${dataIndex} normalizedText:`, normalizedText);
                console.log(
                    `Worker: Data index ${dataIndex} normalizedCodeText:`,
                    normalizedCodeText
                );
                console.log(`Worker: Data index ${dataIndex} exactMatch:`, exactMatch);
                console.log(`Worker: Data index ${dataIndex} fuzzyScore:`, fuzzyScore);
            }

            if (fuzzyScore >= 85) {
                const positions = getAllPositions(text, displayText(c.text));

                if (dataIndex === 72) {
                    console.log(
                        `Worker: Data index ${dataIndex} positions:`,
                        positions,
                        c.text,
                        text
                    );
                }
                return positions.map((pos) => ({
                    start: pos,
                    end: pos + c.text.length,
                    codeId: c.id,
                    text: c.text
                }));
            }
            return [];
        });

        // Combine all intervals
        const allIntervals = [...markerIntervals, ...matchingIntervals];

        if (dataIndex === 72) {
            console.log(`Worker: Data index ${dataIndex} intervals1:`, allIntervals);
        }

        if (allIntervals.length === 0) {
            return [createSegment(text, data, dataIndex, 0, [], codeColors, codes)];
        }

        const events: { position: number; type: 'start' | 'end'; codeId: string }[] = [];
        allIntervals.forEach(({ start, end, codeId }) => {
            events.push({ position: start, type: 'start', codeId });
            events.push({ position: end, type: 'end', codeId });
        });

        events.sort(
            (a, b) => a.position - b.position || (a.type === 'end' && b.type === 'start' ? -1 : 1)
        );

        const itemSegments: Segment[] = [];
        let currentPos = 0;
        const currentCodeIds = new Set<string>();

        events.forEach((event) => {
            if (event.position > currentPos) {
                const segmentText = text.slice(currentPos, event.position);
                if (segmentText) {
                    const segment = createSegment(
                        segmentText,
                        data,
                        dataIndex,
                        itemSegments.length,
                        Array.from(currentCodeIds),
                        codeColors,
                        codes
                    );
                    itemSegments.push(segment);
                }
                currentPos = event.position;
            }

            if (event.type === 'start') {
                currentCodeIds.add(event.codeId);
            } else {
                currentCodeIds.delete(event.codeId);
            }
        });

        // Handle remaining text after the last event
        if (currentPos < text.length) {
            const segment = createSegment(
                text.slice(currentPos),
                data,
                dataIndex,
                itemSegments.length,
                Array.from(currentCodeIds),
                codeColors,
                codes
            );
            itemSegments.push(segment);
        }

        if (dataIndex === 72) {
            console.log(`Worker: Data index ${dataIndex} segments:`, itemSegments);
        }

        return itemSegments;
    });

    console.log(`Worker: Processing complete. Segments:`, segments);
    return { processedSegments: segments, codeSet, codeColors };
}

onmessage = (event: MessageEvent) => {
    const { type, data } = event.data;
    if (type === 'processTranscript') {
        try {
            const { post, codes, extraCodes } = data;
            const result = processTranscript(post, codes, extraCodes);
            postMessage({ type: 'processTranscriptResult', data: result });
        } catch (error) {
            postMessage({ type: 'error', error: (error as Error).message });
        }
    }
};
