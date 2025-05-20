import React, { FC, useRef, useState, useEffect, useMemo } from 'react';
import { useIntersectionObserver } from '../../../hooks/Shared/use-intersection-observer';
import debounce from 'lodash/debounce';
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

    const [localDefinition, setLocalDefinition] = useState(entry.definition);

    useEffect(() => {
        setLocalDefinition(entry.definition);
    }, [entry.definition]);

    const debouncedUpdate = useMemo(
        () =>
            debounce((idx: number, value: string) => {
                onDefinitionChange(idx, value);
            }, DEBOUNCE_DELAY),
        [onDefinitionChange]
    );

    useEffect(() => {
        return () => {
            debouncedUpdate.cancel();
        };
    }, [debouncedUpdate]);

    return (
        <tr ref={rowRef}>
            <td className="border border-gray-400 p-2 w-64 max-w-64 break-words">{entry.code}</td>
            <td className="border border-gray-400 p-2 w-full">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localDefinition}
                    onChange={(e) => {
                        const v = e.target.value;
                        setLocalDefinition(v);
                        debouncedUpdate(index, v);
                    }}
                />
            </td>
        </tr>
    );
};

export default VirtualizedTableRow;
