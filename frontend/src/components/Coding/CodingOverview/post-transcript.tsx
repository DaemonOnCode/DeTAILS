import React, { FC, useState, useMemo, useRef } from 'react';
import { useCodingContext } from '../../../context/coding_context';
import { getTranscript } from '../../../utility/transcript';
import { ratio, partial_ratio } from 'fuzzball';

interface PostTranscriptProps {
    post: any | null;
    onBack: () => void;
}

const PostTranscript: FC<PostTranscriptProps> = ({ post, onBack }) => {
    const transcript = getTranscript(
        post.title,
        post.selftext,
        ...[post.comments.map((c: any) => c.body)]
    );

    const [hoveredCodeText, setHoveredCodeText] = useState<string[] | null>(null);

    const { finalCodeResponses } = useCodingContext();

    const codes = finalCodeResponses
        .filter((response) => response.postId === post.id)
        .map((response) => ({
            text: response.sentence,
            code: response.coded_word
        }));

    const codeSet = Array.from(new Set(codes.map((code) => code.code)));

    const [hoveredLines, setHoveredLines] = useState<
        { x1: number; y1: number; x2: number; y2: number; color: string }[]
    >([]);

    const codeRefs = useRef<Record<string, HTMLLIElement | null>>({});
    const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);

    const generateColor = (key: string): string => {
        const hash = Array.from(key).reduce((acc, char) => char.charCodeAt(0) + acc, 0);
        const r = Math.min(((hash * 19) % 200) + 55, 255);
        const g = Math.min(((hash * 37) % 200) + 55, 255);
        const b = Math.min(((hash * 53) % 200) + 55, 255);
        return `rgba(${r}, ${g}, ${b}, 0.8)`; // Slight transparency
    };

    const codeColors = useMemo(() => {
        return codes.reduce(
            (acc, { code }) => {
                acc[code] = generateColor(code);
                return acc;
            },
            {} as Record<string, string>
        );
    }, [codes]);

    const processedSegments = useMemo(() => {
        const transcriptLines = transcript
            .split(/\n/)
            .flatMap((line) => line.split(/(?<=[.?!])\s+|,/)); // Split into sentences/phrases

        const charData: {
            line: string;
            hasSingleLineMatch: boolean;
            bestMatchSimilarity: number; // Track the highest similarity
            backgroundColours: string[];
            relatedCodeText: string[];
            similarityRatios: Record<string, number>;
        }[] = transcriptLines.map((line) => ({
            line,
            hasSingleLineMatch: false,
            bestMatchSimilarity: 0,
            backgroundColours: [],
            relatedCodeText: [],
            similarityRatios: {}
        }));

        const addMatch = (lineData: (typeof charData)[0], code: string, similarity: number) => {
            if (similarity > lineData.bestMatchSimilarity) {
                lineData.bestMatchSimilarity = similarity;
                lineData.backgroundColours = [codeColors[code]];
                lineData.relatedCodeText = [code];
                lineData.similarityRatios = { [code]: similarity };
            } else if (similarity === lineData.bestMatchSimilarity) {
                lineData.backgroundColours.push(codeColors[code]);
                lineData.relatedCodeText.push(code);
                lineData.similarityRatios[code] = similarity;
            }
        };

        // Split target text into segments
        const splitIntoSegments = (text: string) =>
            text.split(/\n/).flatMap((line) => line.split(/(?<=[.?!])\s+|,/));

        // Single-line and multiline search
        charData.forEach((lineData) => {
            codes.forEach(({ text, code }) => {
                const targetSegments = splitIntoSegments(text); // Split the target text
                targetSegments.forEach((segment) => {
                    const partialSimilarity = partial_ratio(lineData.line, segment);
                    const strictSimilarity = ratio(lineData.line, segment);

                    // Calculate length ratio
                    const lengthRatio =
                        Math.min(lineData.line.length, segment.length) /
                        Math.max(lineData.line.length, segment.length);

                    // Validate match
                    const isValidMatch = strictSimilarity >= 90;
                    // && (lengthRatio >= 0.5 || strictSimilarity >= 70); // Allow strict similarity for imbalanced lengths

                    console.log(
                        'Partial ratio:',
                        partialSimilarity,
                        'Strict Similarity:',
                        strictSimilarity,
                        'Length Ratio:',
                        lengthRatio,
                        'Line:',
                        lineData.line,
                        'Segment:',
                        segment
                    );

                    if (isValidMatch) {
                        addMatch(lineData, code, partialSimilarity);
                        lineData.hasSingleLineMatch = true;
                    }
                });
            });
        });

        // Finalize segments (return broken segments)
        return charData.map((lineData) => ({
            text: lineData.line,
            backgroundColours: Array.from(new Set(lineData.backgroundColours)),
            relatedCodeText: Array.from(new Set(lineData.relatedCodeText)),
            similarityRatios: lineData.similarityRatios
        }));
    }, [transcript, codes, codeColors]);

    console.log('Processed segments:', processedSegments);

    return !post ? (
        <></>
    ) : (
        <div className="flex relative">
            <svg
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                xmlns="http://www.w3.org/2000/svg">
                {hoveredLines.map((line, index) => (
                    <line
                        key={index}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke={line.color}
                        strokeWidth="2"
                    />
                ))}
            </svg>
            <div className="flex-1 min-w-0">
                <button onClick={onBack} className="mb-4 text-blue-500">
                    &lt;- <span className="underline">Back to Posts</span>
                </button>
                <div className="min-h-[calc(100vh-18rem)] h-[calc(100vh-18rem)] overflow-auto">
                    <h2 className="text-xl font-bold mb-4">{post.title}</h2>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {processedSegments.map((segment, index) => {
                            if (segment.backgroundColours.length === 0) {
                                return <span key={index}>{segment.text}</span>;
                            } else if (segment.backgroundColours.length === 1) {
                                return (
                                    <span
                                        key={index}
                                        style={{
                                            backgroundColor: segment.backgroundColours[0]
                                        }}
                                        onMouseEnter={() =>
                                            setHoveredCodeText(segment.relatedCodeText)
                                        }
                                        onMouseLeave={() => setHoveredCodeText(null)}>
                                        {segment.text}
                                    </span>
                                );
                            } else {
                                return segment.backgroundColours.reduceRight(
                                    (inner, bgColor, layerIndex) => (
                                        <span
                                            key={`${index}-${layerIndex}`}
                                            style={{
                                                backgroundColor: bgColor,
                                                position: 'relative',
                                                zIndex: layerIndex + 1
                                            }}
                                            onMouseEnter={() =>
                                                setHoveredCodeText(segment.relatedCodeText)
                                            }
                                            onMouseLeave={() => setHoveredCodeText(null)}>
                                            {inner}
                                        </span>
                                    ),
                                    <span key={index}>{segment.text}</span>
                                );
                            }
                        })}
                    </div>
                    {/* </div> */}
                </div>
            </div>

            <div className="w-1/3 pl-4">
                <h3 className="text-lg font-bold mb-2">Related Codes</h3>
                <ul className="space-y-2">
                    {hoveredCodeText
                        ? hoveredCodeText.map((text, index) => (
                              <li
                                  key={index}
                                  className="p-2 rounded bg-gray-200"
                                  style={{
                                      backgroundColor: codeColors[text]
                                  }}>
                                  {text}
                              </li>
                          ))
                        : codeSet.map((code, index) => (
                              <li
                                  key={index}
                                  ref={(el) => {
                                      codeRefs.current[code] = el;
                                  }}
                                  onMouseEnter={(e) => {
                                      console.log(e, 'Mouse Enter');
                                  }}
                                  className="p-2 rounded"
                                  style={{
                                      backgroundColor: codeColors[code]
                                  }}>
                                  {code}
                              </li>
                          ))}
                </ul>
            </div>
        </div>
    );
};

export default PostTranscript;
