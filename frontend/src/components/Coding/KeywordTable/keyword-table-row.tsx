import { FC, useState, useEffect } from 'react';
import { FaTrash } from 'react-icons/fa';
import { KeywordEntry } from '../../../types/Coding/shared';

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
    // Local state for text fields
    // const [localWord, setLocalWord] = useState(entry.word);
    const [localDescription, setLocalDescription] = useState(entry.description);
    const [localInclusion, setLocalInclusion] = useState(entry.inclusion_criteria.join(', '));
    const [localExclusion, setLocalExclusion] = useState(entry.exclusion_criteria.join(', '));

    // Sync local state with parent state when entry changes (e.g., due to undo)
    useEffect(() => {
        // setLocalWord(entry.word);
        setLocalDescription(entry.description);
        setLocalInclusion(entry.inclusion_criteria.join(', '));
        setLocalExclusion(entry.exclusion_criteria.join(', '));
    }, [entry]);

    // Debounce updates and notify parent
    useEffect(() => {
        const timer = setTimeout(() => {
            // if (localWord !== entry.word) {
            //     onFieldChange(index, 'word', localWord);
            // }
            if (localDescription !== entry.description) {
                onFieldChange(index, 'description', localDescription);
            }
            if (localInclusion !== entry.inclusion_criteria.join(', ')) {
                onFieldChange(
                    index,
                    'inclusion_criteria',
                    localInclusion.split(',').map((v) => v.trim())
                );
            }
            if (localExclusion !== entry.exclusion_criteria.join(', ')) {
                onFieldChange(
                    index,
                    'exclusion_criteria',
                    localExclusion.split(',').map((v) => v.trim())
                );
            }
        }, 500); // 500ms debounce delay
        return () => clearTimeout(timer);
    }, [localDescription, localInclusion, localExclusion, entry, index, onFieldChange]);

    return (
        <tr className="text-center">
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 resize-none h-24 pointer-events-none"
                    value={entry.word}
                    readOnly
                    // onChange={(e) => setLocalWord(e.target.value)}
                />
            </td>
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                />
            </td>
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localInclusion}
                    onChange={(e) => setLocalInclusion(e.target.value)}
                />
            </td>
            <td className="border border-gray-400 p-2">
                <textarea
                    className="w-full p-2 border border-gray-300 rounded resize-none h-24"
                    value={localExclusion}
                    onChange={(e) => setLocalExclusion(e.target.value)}
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
