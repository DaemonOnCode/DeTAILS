import { FC, useState, useEffect, useMemo } from 'react';
import { FaTrash } from 'react-icons/fa';
import debounce from 'lodash/debounce';
import { KeywordEntry } from '../../../types/Coding/shared';
import { DEBOUNCE_DELAY } from '../../../constants/Shared';

interface KeywordTableRowProps {
    entry: KeywordEntry;
    index: number;
    onFieldChange: (index: number, field: string, value: any) => void;
    onToggleMark: (index: number, isMarked: boolean | undefined) => void;
    onDeleteRow: (index: number) => void;
}

const KeywordTableRow: FC<KeywordTableRowProps> = ({
    entry,
    index,
    onFieldChange,
    onToggleMark,
    onDeleteRow
}) => {
    // --- local editable state ---
    const [localWord, setLocalWord] = useState(entry.word);
    const [localDescription, setLocalDescription] = useState(entry.description);
    const [localInclusion, setLocalInclusion] = useState(entry.inclusion_criteria);
    const [localExclusion, setLocalExclusion] = useState(entry.exclusion_criteria);

    // Sync up when parent entry changes (e.g. after unlock)
    useEffect(() => {
        setLocalWord(entry.word);
        setLocalDescription(entry.description);
        setLocalInclusion(entry.inclusion_criteria);
        setLocalExclusion(entry.exclusion_criteria);
    }, [entry]);

    // Debounced updater
    const debouncedUpdate = useMemo(
        () =>
            debounce((field: string, value: any) => {
                onFieldChange(index, field, value);
            }, DEBOUNCE_DELAY),
        [index, onFieldChange]
    );

    // Cancel any pending update on unmount
    useEffect(() => {
        return () => {
            debouncedUpdate.cancel();
        };
    }, [debouncedUpdate]);

    return (
        <tr className="text-center">
            <td className="border border-gray-400 p-2">
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
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localInclusion}
                    onChange={(e) => {
                        const v = e.target.value;
                        setLocalInclusion(v);
                        debouncedUpdate('inclusion_criteria', v);
                    }}
                />
            </td>
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localExclusion}
                    onChange={(e) => {
                        const v = e.target.value;
                        setLocalExclusion(v);
                        debouncedUpdate('exclusion_criteria', v);
                    }}
                />
            </td>
            <td className="border border-gray-400 p-2" id={`action-row-${index}`}>
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

export default KeywordTableRow;
