import { FC, useState, useMemo, useRef } from 'react';
import { useCodingContext } from '../../../context/coding_context';
import { ratio } from 'fuzzball';
import { Comments } from '../../../types/Coding/shared';
import RedditComments from './reddit-comments';
import HighlightedSegment from './highlighted-segment';
import RelatedCodes from './related-codes';
import { generateColor } from '../../../utility/color-generator';

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

                <div className="h-[calc(100vh-15rem)] min-h-[calc(100vh-15rem)] overflow-auto">
                    {/* Post Content */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold mb-2">{post.title}</h2>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line break-words">
                            {processedSegments
                                .filter(
                                    (segment) =>
                                        segment.id === post.id && segment.type === 'selftext'
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
            </div>

            {/* Related Codes Panel */}
            <div className="w-1/3 pl-4 h-[calc(100vh-15rem)] min-h-[calc(100vh-15rem)] overflow-auto">
                <RelatedCodes
                    codeSet={codeSet}
                    codeColors={codeColors}
                    hoveredCodeText={hoveredCodeText}
                />
            </div>
        </div>
    );
};

export default PostTranscript;
