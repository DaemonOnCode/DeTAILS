import { useMemo } from 'react';
import { generateRandomTextColumnsArray } from '../../utility/random-text-generator';

function StaticCard({ idx }: { idx: number }) {
    const textArray = useMemo(() => generateRandomTextColumnsArray(idx), [idx]);
    return (
        <div className="grid grid-cols-12 gap-1 font-mono text-lg">
            {textArray.map((char, i) => (
                <span key={i} style={{ color: '#808080' }}>
                    {char}
                </span>
            ))}
        </div>
    );
}

export default StaticCard;
