import React, { FC, useState, useMemo, useRef } from 'react';
import { useCodingContext } from '../../../context/coding_context';
import { getTranscript } from '../../../utility/transcript';
import { ratio, partial_ratio } from 'fuzzball';

type Comments = {
    author: string;
    body: string;
    comments: Comments[];
    controversiality: number;
    created_utc: number;
    dataset_id: string;
    gilded: number;
    id: string;
    parent_id: string;
    post_id: string;
    retrieved_on: number;
    score: number;
    score_hidden: boolean;
    subreddit_id: string;
};

interface PostTranscriptProps {
    post: {
        author: string;
        comments: Comments[];
        created_utc: number;
        dataset_id: string;
        domain: string;
        hide_score: boolean;
        id: string;
        is_self: boolean;
        num_comments: number;
        over_18: boolean;
        permalink: string;
        score: number;
        selftext: string;
        subreddit: string;
        subreddit_id: string;
        thumbnail: string;
        title: string;
        url: string;
    };
    onBack: () => void;
}

const PostTranscript: FC<PostTranscriptProps> = ({ post, onBack }) => {
    console.log('Post:', post);
    // const transcript = getTranscript(
    //     post.title,
    //     post.selftext,
    //     ...[post.comments.map((c: any) => c.body)]
    // );

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
        const transcriptFlatMap: {
            id: string;
            text: string;
            type: 'title' | 'selftext' | 'comment' | 'reply';
            parent_id: string | null;
        }[] = [
            {
                id: post.id,
                text: post.title,
                type: 'title',
                parent_id: null
            },
            {
                id: post.id,
                text: post.selftext,
                type: 'selftext',
                parent_id: null
            }
        ];

        const traverseComments = (comments: Comments[], parentId: string | null) => {
            comments.forEach((comment) => {
                transcriptFlatMap.push({
                    id: comment.id,
                    text: comment.body,
                    type: 'comment',
                    parent_id: parentId
                });
                traverseComments(comment.comments || [], comment.id);
            });
        };

        traverseComments(post.comments, post.id);

        const splitIntoSegments = (text: string) =>
            text
                .split(/\n/)
                .flatMap((line) => line.split(/(?<=[.?!])\s+|,/))
                .map((line) => line.trim());

        const segments = transcriptFlatMap.flatMap((data) =>
            splitIntoSegments(data.text).map((line) => ({
                line,
                id: data.id,
                type: data.type,
                parent_id: data.parent_id,
                backgroundColours: [] as string[],
                relatedCodeText: [] as string[]
            }))
        );

        segments.forEach((segment) => {
            codes.forEach(({ text, code }) => {
                const codeSegments = splitIntoSegments(text);

                codeSegments.forEach((codeSegment) => {
                    const partialSimilarity = ratio(segment.line, codeSegment);
                    if (partialSimilarity >= 90) {
                        segment.backgroundColours.push(codeColors[code]);
                        segment.relatedCodeText.push(code);
                    }
                });
            });
        });

        return segments.map((segment) => ({
            ...segment,
            backgroundColours: Array.from(new Set(segment.backgroundColours)),
            relatedCodeText: Array.from(new Set(segment.relatedCodeText))
        }));
    }, [post, codes, codeColors]);

    console.log('Processed segments:', processedSegments);

    return !post ? (
        <></>
    ) : (
        <div className="flex relative">
            <div className="flex-1 min-w-0">
                <button onClick={onBack} className="mb-4 text-blue-500">
                    &lt;- <span className="underline">Back to Posts</span>
                </button>

                {/* Post Content */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold mb-2">{post.title}</h2>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line break-words">
                        {processedSegments
                            .filter(
                                (segment) => segment.id === post.id && segment.type === 'selftext'
                            )
                            .map((segment, index) => (
                                <HighlightedSegment
                                    key={index}
                                    segment={segment}
                                    setHoveredCodeText={setHoveredCodeText}
                                />
                            ))}
                    </p>
                </div>

                {/* Comments Section */}
                <div>
                    <RedditComments
                        comments={post.comments}
                        processedSegments={processedSegments}
                        setHoveredCodeText={setHoveredCodeText}
                        level={0}
                    />
                </div>
            </div>

            {/* Related Codes Panel */}
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
                                  className="p-2 rounded bg-gray-200"
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

const HighlightedSegment: FC<{
    segment: any;
    setHoveredCodeText: (codes: string[] | null) => void;
}> = ({ segment, setHoveredCodeText }) => {
    if (segment.backgroundColours.length === 0) {
        return <span>{segment.line}</span>;
    }

    // Render nested spans for multiple background colors
    return segment.backgroundColours.reduceRight(
        (inner: any, bgColor: string, layerIndex: number) => (
            <span
                key={layerIndex}
                style={{
                    backgroundColor: bgColor,
                    display: 'inline-block',
                    position: 'relative',
                    zIndex: segment.backgroundColours.length - layerIndex // Topmost layer has the highest index
                }}
                onMouseEnter={() => setHoveredCodeText(segment.relatedCodeText)}
                onMouseLeave={() => setHoveredCodeText(null)}>
                {inner}
            </span>
        ),
        <span>{segment.line}</span> // The innermost content
    );
};

const RedditComments: FC<{
    comments: Comments[];
    processedSegments: any[];
    setHoveredCodeText: (codes: string[] | null) => void;
    level: number;
}> = ({ comments, processedSegments, setHoveredCodeText, level }) => {
    if (!comments || comments.length === 0) return null;

    return (
        <div>
            {comments.map((comment, idx) => (
                <div key={idx} style={{ marginLeft: `${level * 20}px` }}>
                    <div className="text-gray-700 leading-relaxed break-words">
                        {processedSegments
                            .filter(
                                (segment) => segment.id === comment.id && segment.type === 'comment'
                            )
                            .map((segment, index) => (
                                <HighlightedSegment
                                    key={index}
                                    segment={segment}
                                    setHoveredCodeText={setHoveredCodeText}
                                />
                            ))}
                    </div>

                    {/* Recursively Render Replies */}
                    <RedditComments
                        comments={comment.comments || []}
                        processedSegments={processedSegments}
                        setHoveredCodeText={setHoveredCodeText}
                        level={level + 1}
                    />
                </div>
            ))}
        </div>
    );
};
