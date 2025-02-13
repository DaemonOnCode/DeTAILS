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
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Flatten the references into an array of objects.
    const allHighlights = Object.entries(references).flatMap(([code, refs]) =>
        refs.map((ref) => ({ code, reference: ref }))
    );

    // Filter highlights by the search term (case-insensitive).
    const filteredHighlights = allHighlights.filter((item) =>
        item.reference.text.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-1/2 relative">
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => setIsHighlightModalOpen(false)}>
                    &#x2715;
                </button>
                <h2 className="text-xl font-semibold mb-4">Delete Highlight</h2>

                {/* Search Input */}
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search highlights..."
                    className="w-full p-2 border rounded mb-4"
                />

                {/* Scrollable list of highlights */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
                    {filteredHighlights.length > 0 ? (
                        filteredHighlights.map((item, idx) => {
                            const isSelected =
                                selectedReference &&
                                selectedReference.code === item.code &&
                                selectedReference.reference === item.reference;

                            return (
                                <div
                                    key={`${item.code}-${idx}`}
                                    className={`p-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                                        isSelected ? 'bg-blue-100' : ''
                                    }`}
                                    onClick={() => setSelectedReference(item)}>
                                    {/* Display a truncated preview of the paragraph */}
                                    <p
                                        className="text-sm text-gray-800 overflow-hidden text-ellipsis whitespace-normal"
                                        style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical'
                                        }}>
                                        {item.reference.text}
                                    </p>
                                    <p className="text-xs text-gray-500">Code: {item.code}</p>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-gray-500 text-center">No highlights found</p>
                    )}
                </div>

                <button
                    className="bg-red-500 text-white px-4 py-2 rounded mt-4"
                    onClick={() => {
                        if (selectedReference) {
                            const { code, reference } = selectedReference;

                            // Remove the selected reference from the references.
                            setReferences((prevReferences) => ({
                                ...prevReferences,
                                [code]: prevReferences[code].filter((ref) => ref !== reference)
                            }));

                            applyCodeToSelection(selectedReference);
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
