import { FC, memo, useRef } from 'react';
import { useTranscriptContext } from '../../../context/transcript-context';
import { generateColor } from '../../../utility/color-generator';
import type { Segment } from '../../../types/Coding/shared';

interface HighlightedSegmentProps {
    segment: Segment;
}

const HighlightedSegment: FC<HighlightedSegmentProps> = memo(({ segment }) => {
    const {
        activeSegment,
        handleSegmentInteraction,
        handleSegmentLeave,
        hoveredCode,
        selectedSegment,
        setSelectedSegment,
        isSelecting
    } = useTranscriptContext();
    const segmentRef = useRef<HTMLSpanElement>(null);

    const isActive = activeSegment?.index === segment.index && !isSelecting;

    if (segment.backgroundColours.length === 0) {
        return (
            <span
                ref={segmentRef}
                data-segment-id={segment.index}
                className="relative z-10 mr-0.5 whitespace-pre-line min-w-96">
                {segment.line}
            </span>
        );
    }

    const overlapRatio = 0.8;
    const stripeCount = segment.backgroundColours.length;

    const heightPct = 100 / ((stripeCount - 1) * (1 - overlapRatio) + 1);

    const stripes: JSX.Element[] = [];
    let cumulativeOffset = 0;

    segment.backgroundColours.forEach((bgColor, i) => {
        const isMatch = hoveredCode !== null && generateColor(hoveredCode) === bgColor;
        if (hoveredCode !== null && !isMatch) return;

        const topPct = cumulativeOffset;

        stripes.push(
            <span
                key={i}
                style={{
                    position: 'absolute',
                    top: `${topPct}%`,
                    left: 0,
                    right: 0,
                    height: `${heightPct}%`,
                    backgroundColor: bgColor,
                    zIndex: 1,
                    pointerEvents: 'none',
                    opacity: 1,
                    transition: 'opacity 0.2s, z-index 0.2s'
                }}
            />
        );

        // shift for the next stripe by the visible portion of this one
        cumulativeOffset += heightPct * (1 - overlapRatio);
    });

    return (
        <span
            ref={segmentRef}
            style={{
                position: 'relative',
                display: 'inline-block',
                zIndex: 0,
                background: 'transparent',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 0.2s'
            }}
            onDoubleClick={() => {
                if (selectedSegment?.index === segment.index) {
                    setSelectedSegment(null);
                } else {
                    handleSegmentInteraction(segment, true);
                }
            }}
            onMouseEnter={() => {
                handleSegmentInteraction(segment);
            }}
            onMouseLeave={() => {
                handleSegmentLeave();
            }}>
            <span
                data-segment-id={segment.index}
                className="relative pr-1 whitespace-pre-line"
                style={{ zIndex: 5 }}>
                {segment.line}
            </span>
            {stripes}
        </span>
    );
});

export default HighlightedSegment;
