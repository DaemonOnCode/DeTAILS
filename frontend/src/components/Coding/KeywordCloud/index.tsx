import { useState, useEffect, useRef, FC } from 'react';
import { IKeywordBox } from '../../../types/Coding/shared';
import { KeywordCloudProps } from '../../../types/Coding/props';
import { FiEdit, FiTrash2 } from 'react-icons/fi';

const MAIN_TOPIC_FONT_SIZE = 20;
const OTHER_KEYWORD_FONT_SIZE = 14;
const PADDING_BETWEEN_WORDS = 10;

function measureTextWidth(text: string, fontSize: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.font = `${fontSize}px Arial`;
        return ctx.measureText(text).width;
    }
    return 50;
}

function areKeywordsColliding(
    a: IKeywordBox,
    b: IKeywordBox,
    padding: number = PADDING_BETWEEN_WORDS
) {
    return !(
        a.x + a.width + padding < b.x ||
        a.x > b.x + b.width + padding ||
        a.y + a.height + padding < b.y ||
        a.y > b.y + b.height + padding
    );
}

function isInsideCircle(x: number, y: number, r: number) {
    return x * x + y * y <= r * r;
}

const KeywordCloud: FC<KeywordCloudProps> = ({
    mainTopic,
    keywords,
    selectedKeywords,
    toggleKeywordSelection,
    setKeywords
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [placedKeywords, setPlacedKeywords] = useState<IKeywordBox[]>([]);
    const [radius, setRadius] = useState<number>(0);

    useEffect(() => {
        if (!svgRef.current) return;

        // 1. Get SVG dimensions and set up circle bounds
        const { width, height } = svgRef.current.getBoundingClientRect();
        const diameter = Math.min(width, height);
        const r = diameter / 2;
        setRadius(r);

        // 2. Place the main topic in the center
        const mainW = measureTextWidth(mainTopic, MAIN_TOPIC_FONT_SIZE) + 30;
        const mainH = MAIN_TOPIC_FONT_SIZE + 10;
        const mainBox: IKeywordBox = {
            text: mainTopic,
            x: -mainW / 2,
            y: -mainH / 2,
            width: mainW,
            height: mainH
        };

        // 3. Measure and sort words into alternating zigzag pattern
        const otherKeywords = keywords.filter((k) => k !== mainTopic);
        const measured = otherKeywords.map((word) => ({
            word,
            width: measureTextWidth(word, OTHER_KEYWORD_FONT_SIZE) + 30
        }));

        // Sort so that spokes alternate (short-long-short-long)
        measured.sort((a, b) => b.width - a.width);
        const longSpokes = measured.filter((_, i) => i % 2 === 0); // Larger words → long spokes
        const shortSpokes = measured.filter((_, i) => i % 2 !== 0); // Smaller words → short spokes
        const sortedWords = longSpokes.flatMap((w, i) => [w, shortSpokes[i]]).filter(Boolean);

        // 4. Define the placement boundaries
        const rInner = mainW / 2 + 30; // Minimum allowed radius
        const rOuter = r * 0.66; // Outer bound limit
        const rMiddle = (rInner + rOuter) / 2;

        // 5. Place words using radial searching
        const MAX_ATTEMPTS = 150;
        const RADIUS_STEP = 5;
        const placed: IKeywordBox[] = [mainBox];

        sortedWords.forEach((item, idx) => {
            const w = item.width;
            const h = OTHER_KEYWORD_FONT_SIZE + 10;

            // **Alternate target radii for zigzag effect**
            const baseRadius = idx % 2 === 0 ? rOuter : rMiddle;
            const angle = (2 * Math.PI * idx) / sortedWords.length;

            let placedBox: IKeywordBox | null = null;

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                const candidateR = baseRadius + attempt * RADIUS_STEP;
                if (candidateR > rOuter) break; // Stop if we exceed the circle

                // Ensure the candidate radius is always above minimum
                if (candidateR < rInner + 20) continue;

                // Compute candidate x, y position
                const centerX = candidateR * Math.cos(angle);
                const centerY = candidateR * Math.sin(angle);
                const x = centerX - w / 2;
                const y = centerY - h / 2;

                const box: IKeywordBox = { text: item.word, x, y, width: w, height: h };

                if (!isInsideCircle(centerX, centerY, r - w / 2)) continue;

                let collision = false;
                for (const p of placed) {
                    if (areKeywordsColliding(box, p)) {
                        collision = true;
                        break;
                    }
                }
                if (!collision) {
                    placedBox = box;
                    placed.push(box);
                    break;
                }
            }

            if (!placedBox) {
                console.warn('Could not place word:', item.word);
            }
        });

        setPlacedKeywords(placed);
    }, [keywords, mainTopic]);

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '100vw',
                height: 'calc(100vh - 7rem)',
                maxHeight: 'calc(100vh - 7rem)',
                margin: '0 auto'
            }}>
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`-${radius} -${radius} ${2 * radius} ${2 * radius}`}
                style={{ display: 'block', borderRadius: '50%' }}>
                <circle cx="0" cy="0" r={radius} className="fill-gray-100" stroke="#ccc" />

                {placedKeywords.map((kw) => {
                    if (kw.text === mainTopic) return null;
                    const centerX = kw.x + kw.width / 2;
                    const centerY = kw.y + kw.height / 2;
                    return (
                        <line
                            key={`line-${kw.text}`}
                            x1={0}
                            y1={0}
                            x2={centerX}
                            y2={centerY}
                            stroke="gray"
                            strokeWidth={1}
                        />
                    );
                })}

                {placedKeywords.map((kw) => (
                    <foreignObject
                        key={kw.text}
                        x={kw.x}
                        y={kw.y}
                        width={kw.width}
                        height={kw.height}
                        style={{ overflow: 'visible' }}>
                        <div className="cursor-pointer font-bold text-black bg-gray-200 rounded-lg flex items-center justify-center w-full h-full">
                            {kw.text}
                        </div>
                    </foreignObject>
                ))}
            </svg>
        </div>
    );
};

export default KeywordCloud;
