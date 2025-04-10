import { FC, memo, useRef } from 'react';
import { useTranscriptContext } from '../../../context/transcript-context';
import { generateColor } from '../../../utility/color-generator';
import type { Segment } from '../../../types/Coding/shared';
import { useIntersectionObserver } from '../../../hooks/Shared/use-intersection-observer';

interface HighlightedSegmentProps {
    segment: Segment;
}

const HighlightedSegment: FC<HighlightedSegmentProps> = memo(({ segment }) => {
    const {
        containerRef,
        selectedText,
        activeSegment,
        handleSegmentInteraction,
        handleSegmentLeave,
        hoveredCode,
        setHoveredCodeText,
        selectedSegment,
        setSelectedSegment
    } = useTranscriptContext();
    const segmentRef = useRef<HTMLSpanElement>(null);

    // const isVisible = useIntersectionObserver(segmentRef, {
    //     root: containerRef.current,
    //     rootMargin: '100px'
    // });

    // if (!isVisible) {
    //     return (
    //         <span
    //             ref={segmentRef}
    //             style={{
    //                 display: 'inline-block',
    //                 height: '1.5em',
    //                 width: '100%'
    //             }}
    //         />
    //     );
    // }

    const isActive = activeSegment?.index === segment.index;

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
                if (selectedSegment && selectedSegment.index === segment.index) {
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
            {segment.backgroundColours.map((bgColor, i) => {
                const isMatch = hoveredCode !== null && generateColor(hoveredCode) === bgColor;
                if (hoveredCode !== null && !isMatch) return null;
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
                            zIndex: 1,
                            pointerEvents: 'none',
                            opacity: 1,
                            transition: 'opacity 0.2s, z-index 0.2s'
                        }}
                    />
                );
            })}
        </span>
    );
});

export default HighlightedSegment;
