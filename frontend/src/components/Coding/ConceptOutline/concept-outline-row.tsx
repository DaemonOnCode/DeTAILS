import { FC, useState, useEffect, useMemo } from 'react';
import { FaTrash } from 'react-icons/fa';
import debounce from 'lodash/debounce';
import { ConceptEntry } from '../../../types/Coding/shared';
import { DEBOUNCE_DELAY } from '../../../constants/Shared';

interface ConceptTableRowProps {
    entry: ConceptEntry;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
    onToggleMark: (index: number, isMarked: boolean | undefined) => void;
    onDeleteRow: (index: number) => void;
}

const ConceptTableRow: FC<ConceptTableRowProps> = ({
    entry,
    index,
    onFieldChange,
    onToggleMark,
    onDeleteRow
}) => {
    const [localWord, setLocalWord] = useState(entry.word);
    const [localDescription, setLocalDescription] = useState(entry.description);

    useEffect(() => {
        setLocalWord(entry.word);
        setLocalDescription(entry.description);
    }, [entry]);

    const debouncedUpdate = useMemo(
        () =>
            debounce((field: string, value: any) => {
                onFieldChange(index, field, value);
            }, DEBOUNCE_DELAY),
        [index, onFieldChange]
    );

    useEffect(() => {
        return () => {
            debouncedUpdate.cancel();
        };
    }, [debouncedUpdate]);

    return (
        <tr className="text-center">
            <td className="border border-gray-400 p-2 max-w-32">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localWord}
                    onChange={(e) => {
                        const v = e.target.value;
                        setLocalWord(v);
                        debouncedUpdate('word', v);
                    }}
                />
            </td>
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localDescription}
                    onChange={(e) => {
                        const v = e.target.value;
                        setLocalDescription(v);
                        debouncedUpdate('description', v);
                    }}
                />
            </td>
            <td className="border border-gray-400 p-2 max-w-40" id={`action-row-${index}`}>
                <div className="flex items-center justify-center space-x-2">
                    <button
                        id={`accept-btn-${index}`}
                        className={`w-8 h-8 flex items-center justify-center rounded ${
                            entry.isMarked === true
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 text-gray-500'
                        }`}
                        onClick={() =>
                            onToggleMark(index, entry.isMarked !== true ? true : undefined)
                        }>
                        ✓
                    </button>
                    <button
                        id={`deselect-btn-${index}`}
                        className={`w-8 h-8 flex items-center justify-center rounded ${
                            entry.isMarked === false
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-300 text-gray-500'
                        }`}
                        onClick={() =>
                            onToggleMark(index, entry.isMarked !== false ? false : undefined)
                        }>
                        ✕
                    </button>
                    <button
                        id={`delete-btn-${index}`}
                        className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700"
                        onClick={() => onDeleteRow(index)}>
                        <FaTrash />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default ConceptTableRow;
