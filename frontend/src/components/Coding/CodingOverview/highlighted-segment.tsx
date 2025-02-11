import { FC } from 'react';

interface HighlightedSegmentProps {
    segment: {
        line: string;
        backgroundColours: string[];
        relatedCodeText: string[];
    };
    setHoveredCodeText: (codes: string[] | null) => void;
}

const HighlightedSegment: FC<HighlightedSegmentProps> = ({ segment, setHoveredCodeText }) => {
    if (segment.backgroundColours.length === 0) {
        return <span>{segment.line}</span>;
    }

    return (
        <span
            style={{
                /* This parent is the stacking context */
                position: 'relative',
                display: 'inline-block',
                zIndex: 0 /* so children can go behind with negative z-index */,
                background: 'transparent'
            }}
            onMouseEnter={() => setHoveredCodeText(segment.relatedCodeText)}
            onMouseLeave={() => setHoveredCodeText(null)}>
            {/* The actual text, forced to be on top */}
            <span style={{ position: 'relative', zIndex: 1 }}>{segment.line}</span>

            {/* Absolutely positioned color layers, each behind the text. */}
            {segment.backgroundColours.map((bgColor, i) => {
                // Optional offset to see each layer a bit "shifted"
                const verticalOffset = i * 4;

                return (
                    <span
                        key={i}
                        style={{
                            position: 'absolute',
                            top: `${verticalOffset}px`,
                            left: 0,
                            right: 0,
                            height: '100%',
                            backgroundColor: bgColor,

                            /* Put them behind the text */
                            zIndex: -1,
                            pointerEvents: 'none',
                            opacity: 0.8
                        }}
                    />
                );
            })}
        </span>
    );
};

export default HighlightedSegment;
