import { FC } from 'react';
import HighlightedSegment from './highlighted-segment';
import { Comments } from '../../../types/Coding/shared';

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
                    <div className="text-gray-700 leading-relaxed break-words py-2">
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

export default RedditComments;
