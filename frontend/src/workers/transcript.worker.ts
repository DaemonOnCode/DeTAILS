import { ratio } from 'fuzzball';
import { generateColor } from '../utility/color-generator';

interface Code {
    id: string;
    text: string;
    code: string;
    rangeMarker?: { itemId: string; range: [number, number] };
    source?: string;
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
    codeSet.forEach((code) => (codeColors[code] = generateColor(code)));

    const transcriptFlatMap = [
        { id: post.id, text: displayText(post.title), type: 'title', parent_id: null },
        { id: post.id, text: displayText(post.selftext), type: 'selftext', parent_id: null },
        ...post.comments.flatMap((comment: any) => traverseComments(comment, post.id))
    ];

    const codesWithMarker = codes.filter((c) => c.rangeMarker);
    const codesWithoutMarker = codes.filter((c) => !c.rangeMarker);

    const segments = transcriptFlatMap.flatMap((data, dataIndex) => {
        const text = data.text;
        const intervals: { start: number; end: number; codeId: string; text: string }[] = [];
        const matched = new Set<string>();

        for (const c of codesWithMarker) {
            if (c.rangeMarker!.itemId === String(dataIndex)) {
                const [start, end] = c.rangeMarker!.range;
                intervals.push({ start, end, codeId: c.id, text: c.text });
                matched.add(c.id);
            }
        }

        const withSource = codesWithoutMarker.filter((c) => c.source);
        const noSource = codesWithoutMarker.filter((c) => !c.source);
        const codesWithSourceErrors = [];

        for (const c of withSource) {
            if (matched.has(c.id)) continue;

            let isApplicable = false;
            try {
                const src = typeof c.source === 'string' ? JSON.parse(c.source) : c.source;

                if (src.type === 'comment') {
                    isApplicable = data.type === 'comment' && data.id === src.comment_id;
                } else if (src.type === 'post') {
                    isApplicable = src.title ? data.type === 'title' : data.type === 'selftext';
                }
            } catch {
                console.error(`Failed to parse source for code ${c.code}: ${c.source}`);
                codesWithSourceErrors.push(c);
                continue;
            }

            if (!isApplicable) continue;

            const positions = getAllPositions(text, displayText(c.text));
            for (const pos of positions) {
                intervals.push({
                    start: pos,
                    end: pos + c.text.length,
                    codeId: c.id,
                    text: c.text
                });
            }
            matched.add(c.id);
        }

        const codesForTextMatching = [...noSource, ...codesWithSourceErrors].filter(
            (c) => !matched.has(c.id)
        );

        for (const c of codesForTextMatching) {
            const positions = getAllPositions(text, displayText(c.text));
            for (const pos of positions) {
                intervals.push({
                    start: pos,
                    end: pos + c.text.length,
                    codeId: c.id,
                    text: c.text
                });
            }
            if (positions.length > 0) {
                matched.add(c.id);
            }
        }

        for (const c of codesForTextMatching) {
            if (matched.has(c.id)) continue;
            const normText = normalizeText(text);
            const normCodeText = normalizeText(c.text);
            const score = text.includes(c.text)
                ? 100
                : ratio(normText, normCodeText, { full_process: true });
            if (score >= 85) {
                const positions = getAllPositions(text, displayText(c.text));
                for (const pos of positions) {
                    intervals.push({
                        start: pos,
                        end: pos + c.text.length,
                        codeId: c.id,
                        text: c.text
                    });
                }
                matched.add(c.id);
            }
        }

        if (intervals.length === 0) {
            return [createSegment(text, data, dataIndex, 0, [], codeColors, codes)];
        }

        const events: { position: number; type: 'start' | 'end'; codeId: string }[] = [];
        for (const iv of intervals) {
            events.push({ position: iv.start, type: 'start', codeId: iv.codeId });
            events.push({ position: iv.end, type: 'end', codeId: iv.codeId });
        }
        events.sort(
            (a, b) => a.position - b.position || (a.type === 'end' && b.type === 'start' ? -1 : 1)
        );

        const itemSegments: Segment[] = [];
        let currentPos = 0;
        const currentCodes = new Set<string>();

        for (const ev of events) {
            if (ev.position > currentPos) {
                const segText = text.slice(currentPos, ev.position);
                if (segText) {
                    itemSegments.push(
                        createSegment(
                            segText,
                            data,
                            dataIndex,
                            itemSegments.length,
                            Array.from(currentCodes),
                            codeColors,
                            codes
                        )
                    );
                }
                currentPos = ev.position;
            }
            if (ev.type === 'start') currentCodes.add(ev.codeId);
            else currentCodes.delete(ev.codeId);
        }

        if (currentPos < text.length) {
            itemSegments.push(
                createSegment(
                    text.slice(currentPos),
                    data,
                    dataIndex,
                    itemSegments.length,
                    Array.from(currentCodes),
                    codeColors,
                    codes
                )
            );
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
