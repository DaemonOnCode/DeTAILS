import { FC, useRef, useState, useEffect } from 'react';
import { useIntersectionObserver } from '../../../hooks/Shared/use-intersection-observer';
import { DEBOUNCE_DELAY } from '../../../constants/Shared';

interface VirtualizedTableRowProps {
    entry: { code: string; definition: string };
    index: number;
    onDefinitionChange: (index: number, value: string) => void;
    root: HTMLElement | null;
}

const VirtualizedTableRow: FC<VirtualizedTableRowProps> = ({
    entry,
    index,
    onDefinitionChange,
    root
}) => {
    const rowRef = useRef<HTMLTableRowElement>(null);
    const isVisible = useIntersectionObserver(rowRef, {
        root,
        rootMargin: '100px'
    });

    const [localDefinition, setLocalDefinition] = useState(entry.definition);

    useEffect(() => {
        setLocalDefinition(entry.definition);
    }, [entry.definition]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (localDefinition !== entry.definition) {
                onDefinitionChange(index, localDefinition);
            }
        }, DEBOUNCE_DELAY);
        return () => clearTimeout(timeoutId);
    }, [localDefinition, index, onDefinitionChange, entry.definition]);

    return (
        <tr ref={rowRef}>
            <td className="border border-gray-400 p-2 w-64 max-w-64 break-words">{entry.code}</td>
            <td className="border border-gray-400 p-2 w-full">
                {isVisible ? (
                    <textarea
                        className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                        value={localDefinition}
                        onChange={(e) => setLocalDefinition(e.target.value)}
                    />
                ) : (
                    <div className="w-full p-2 h-24 overflow-hidden">{entry.definition}</div>
                )}
            </td>
        </tr>
    );
};

export default VirtualizedTableRow;
