import { useState, useMemo } from 'react';
import { AnimatedCardContent, StaticCard } from '.';

interface CardsGridBackgroundProps {
    rows: number;
    columns: number;
    wordList: string[];
}

function CardsGridBackground({ rows, columns, wordList }: CardsGridBackgroundProps) {
    const totalCards = rows * columns;

    const [runCount, setRunCount] = useState<number>(0);

    // Pick some random subset of cards that will do typing. Others remain static.
    const typedIndices = useMemo(() => {
        const subsetSize = Math.min(Math.floor(totalCards / 3), totalCards);
        const chosen = new Set<number>();
        while (chosen.size < subsetSize) {
            const r = Math.floor(Math.random() * totalCards);
            chosen.add(r);
        }
        return chosen;
    }, [rows, columns, runCount]);

    return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: totalCards }).map((_, i) => {
                const colIndex = i % columns;
                const displacement = colIndex % 2 === 0 ? 50 : -50;

                return (
                    <div
                        key={i}
                        className="w-56 h-[284px] flex items-center justify-center text-lg p-2 leading-6 bg-white/50 border border-gray-400 shadow-lg rounded-lg"
                        style={{ transform: `translateY(${displacement}px)` }}>
                        {typedIndices.has(i) ? (
                            <AnimatedCardContent
                                wordList={wordList}
                                idx={i}
                                handleAnimationDone={setRunCount}
                            />
                        ) : (
                            <StaticCard idx={i} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default CardsGridBackground;
