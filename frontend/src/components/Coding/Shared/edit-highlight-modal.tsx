import { FC, useState } from 'react';
import { EditHighlightModalProps } from '../../../types/Coding/props';
import { IReference } from '../../../types/Coding/shared';

const EditHighlightModal: FC<EditHighlightModalProps> = ({
    references,
    setReferences,
    applyCodeToSelection,
    setIsHighlightModalOpen
}) => {
    const [editedText, setEditedText] = useState('');

    const [selectedReference, setSelectedReference] = useState<{
        code: string;
        reference: IReference;
    }>();

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded shadow-lg w-1/3 relative">
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => setIsHighlightModalOpen(false)}>
                    &#x2715;
                </button>
                <h2 className="text-xl font-semibold mb-4">Edit Highlight</h2>
                <select
                    className="w-full p-2 border rounded mb-4"
                    value={JSON.stringify(selectedReference)}
                    onChange={(e) => setSelectedReference(JSON.parse(e.target.value))}>
                    <option value="">Select a highlight to edit</option>
                    {Object.entries(references).map(([code, references]) =>
                        references.map((reference, idx) => (
                            <option
                                key={idx}
                                value={JSON.stringify({
                                    code,
                                    reference
                                })}>
                                {reference.text}
                            </option>
                        ))
                    )}
                </select>
                {selectedReference && (
                    <input
                        type="text"
                        className="w-full p-2 border rounded mb-4"
                        placeholder="Edit highlighted text"
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                    />
                )}
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    onClick={() => {
                        if (selectedReference && editedText) {
                            applyCodeToSelection();
                            setEditedText('');
                            setIsHighlightModalOpen(false);
                        }
                    }}>
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default EditHighlightModal;
