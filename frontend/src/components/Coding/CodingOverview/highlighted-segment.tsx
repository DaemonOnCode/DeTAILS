import { FC } from 'react';

const HighlightedSegment: FC<{
    segment: any;
    setHoveredCodeText: (codes: string[] | null) => void;
}> = ({ segment, setHoveredCodeText }) => {
    if (segment.backgroundColours.length === 0) {
        return <span>{segment.line}</span>;
    }

    return segment.backgroundColours.reduceRight(
        (inner: any, bgColor: string, layerIndex: number) => (
            <span
                key={layerIndex}
                style={{
                    backgroundColor: bgColor,
                    display: 'inline-block',
                    position: 'relative',
                    zIndex: segment.backgroundColours.length - layerIndex
                }}
                onMouseEnter={() => setHoveredCodeText(segment.relatedCodeText)}
                onMouseLeave={() => setHoveredCodeText(null)}>
                {inner}
            </span>
        ),
        <span>{segment.line}</span>
    );
};

export default HighlightedSegment;
