import { FC, useRef } from 'react';
import { useIntersectionObserver } from '../../../hooks/Shared/use-intersection-observer';

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

    return (
        <tr ref={rowRef}>
            <td className="border border-gray-400 p-2 w-64 max-w-64 break-words">{entry.code}</td>
            <td className="border border-gray-400 p-2 w-full">
                {isVisible ? (
                    <textarea
                        className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                        value={entry.definition}
                        onChange={(e) => onDefinitionChange(index, e.target.value)}
                    />
                ) : (
                    <div className="w-full p-2 h-24 overflow-hidden">{entry.definition}</div>
                )}
            </td>
        </tr>
    );
};

export default VirtualizedTableRow;
