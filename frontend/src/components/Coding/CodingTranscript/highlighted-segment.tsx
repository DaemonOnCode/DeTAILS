import { FC, useState } from 'react';
import { generateColor } from '../../../utility/color-generator';
import type { Segment } from '../../../types/Coding/shared';

interface HighlightedSegmentProps {
    segment: Segment;
    hoveredCode: string | null;
    setHoveredCodeText: (codes: string[] | null) => void;
    onDoubleClickSegment: (segment: Segment) => void;
}

const HighlightedSegment: FC<HighlightedSegmentProps> = ({
    segment,
    setHoveredCodeText,
    hoveredCode,
    onDoubleClickSegment
}) => {
    const [isHovered, setIsHovered] = useState(false);

    if (segment.backgroundColours.length === 0) {
        return <span className="relative z-10">{segment.line} </span>;
    }

    return (
        <span
            style={{
                position: 'relative',
                display: 'inline-block',
                zIndex: 0,
                background: 'transparent',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.2s'
            }}
            onDoubleClick={() => {
                onDoubleClickSegment(segment);
            }}
            onMouseEnter={() => {
                setIsHovered(true);
                setHoveredCodeText(segment.relatedCodeText);
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                setHoveredCodeText(null);
            }}>
            {/* Text, always on top */}
            <span className="relative pr-1" style={{ zIndex: 5 }}>
                {segment.line}
            </span>

            {/* Absolutely positioned color layers, each behind the text. */}
            {segment.backgroundColours.map((bgColor, i) => {
                // Determine if this layer should be visible
                const isMatch = hoveredCode !== null && generateColor(hoveredCode) === bgColor;

                // When hoveredCode exists, hide all non-matching colours.
                if (hoveredCode !== null && !isMatch) {
                    return null;
                }

                const verticalOffset = i * 4;
                return (
                    <span
                        key={i}
                        style={{
                            position: 'absolute',
                            top: `${verticalOffset}px`,
                            left: 0,
                            right: 0,
                            height: '80%',
                            backgroundColor: bgColor,
                            zIndex: 1, // Always below the text
                            pointerEvents: 'none',
                            opacity: 1, // Fully visible for the matching layer
                            transition: 'opacity 0.2s, z-index 0.2s'
                        }}
                    />
                );
            })}
        </span>
    );
};

export default HighlightedSegment;
