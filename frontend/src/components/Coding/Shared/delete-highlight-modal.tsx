import { FC, useState } from 'react';
import { DeleteHighlightModalProps } from '../../../types/Coding/props';
import { IReference } from '../../../types/Coding/shared';

const DeleteHighlightModal: FC<DeleteHighlightModalProps> = ({
    references,
    setReferences,
    applyCodeToSelection,
    setIsHighlightModalOpen
}) => {
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
                <h2 className="text-xl font-semibold mb-4">Delete Highlight</h2>
                <select
                    className="w-full p-2 border rounded mb-4"
                    value={JSON.stringify(selectedReference)}
                    onChange={(e) => setSelectedReference(JSON.parse(e.target.value))}>
                    <option value="">Select a highlight to delete</option>
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
                <button
                    className="bg-red-500 text-white px-4 py-2 rounded"
                    onClick={() => {
                        if (selectedReference) {
                            const { code, reference } = selectedReference;

                            // Remove the selected reference from the references
                            setReferences((prevReferences) => ({
                                ...prevReferences,
                                [code]: prevReferences[code].filter((ref) => ref !== reference)
                            }));

                            applyCodeToSelection();
                            setSelectedReference(undefined);
                            setIsHighlightModalOpen(false);
                        }
                    }}>
                    Confirm Delete
                </button>
            </div>
        </div>
    );
};

export default DeleteHighlightModal;
