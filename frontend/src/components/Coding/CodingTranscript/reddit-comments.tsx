import React from 'react';
import HighlightedSegment from './highlighted-segment';
import { Comments, Segment } from '../../../types/Coding/shared';

interface RedditCommentsProps {
    comments: Comments[];
    processedSegments: Segment[];
    setHoveredCodeText: (codes: string[] | null) => void;
    level: number;
    showHorizontalConnector?: boolean;
    hoveredCode: string | null;
}

const RedditComments: React.FC<RedditCommentsProps> = ({
    comments,
    processedSegments,
    setHoveredCodeText,
    level,
    showHorizontalConnector = true,
    hoveredCode
}) => {
    if (!comments || comments.length === 0) return null;

    return (
        <>
            {comments.map((comment) => {
                // For indentation, we add `ml-4` if level > 0.
                const indentClass = level > 0 ? 'ml-4' : '';

                // We'll conditionally add a special class that applies the pseudo-element for the elbow.
                // We only want that elbow if level > 0 AND showHorizontalConnector = true.
                const elbowClass =
                    showHorizontalConnector && level > 0
                        ? "before:content-[''] before:absolute before:top-3 before:left-0 before:w-4 before:border-t before:border-gray-300 before:-ml-4"
                        : '';

                return (
                    <div
                        key={comment.id}
                        className={`
              relative
              border-l border-gray-300
              pl-4
              my-2
               min-w-96
              ${indentClass}
              ${elbowClass}
            `}>
                        {/* The actual comment text using processedSegments */}
                        <div className="text-gray-700 leading-relaxed overflow-wrap py-2 relative  min-w-96">
                            {processedSegments
                                .filter(
                                    (segment) =>
                                        segment.id === comment.id && segment.type === 'comment'
                                )
                                .map((segment, idx) => (
                                    <HighlightedSegment key={idx} segment={segment} />
                                ))}
                        </div>

                        {/* Recursive call for children */}
                        <RedditComments
                            comments={comment.comments || []}
                            hoveredCode={hoveredCode}
                            processedSegments={processedSegments}
                            setHoveredCodeText={setHoveredCodeText}
                            level={level + 1}
                            showHorizontalConnector={showHorizontalConnector}
                        />
                    </div>
                );
            })}
        </>
    );
};

export default RedditComments;
