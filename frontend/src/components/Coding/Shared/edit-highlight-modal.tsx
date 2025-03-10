import { FC, useState, useEffect } from 'react';
import { EditHighlightModalProps } from '../../../types/Coding/props';
import { IReference } from '../../../types/Coding/shared';

const EditHighlightModal: FC<EditHighlightModalProps> = ({
    references,
    applyCodeToSelection,
    setIsHighlightModalOpen,
    selectedText,
    setSelectedText
}) => {
    // Define three phases:
    // "selectHighlight": Choose the quote to edit.
    // "waiting": Temporarily hide the modal while the user selects a new region.
    // "selectReplacement": Confirm the new text region.
    const [phase, setPhase] = useState<'selectHighlight' | 'waiting' | 'selectReplacement'>(
        'selectHighlight'
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReference, setSelectedReference] = useState<{
        code: string;
        reference: IReference;
    } | null>(null);

    // When a new transcript selection is made, transition to confirmation phase and re-open the modal.
    useEffect(() => {
        if (selectedText && selectedReference) {
            setPhase('selectReplacement');
            // Re-open the modal after the transcript selection is made.
            setIsHighlightModalOpen(true);
        }
    }, [selectedText, setIsHighlightModalOpen]);

    // Flatten the references into an array.
    const allHighlights = Object.entries(references).flatMap(([code, refs]) =>
        refs.map((ref) => ({ code, reference: ref }))
    );

    // Filter highlights by the search term.
    const filteredHighlights = allHighlights.filter((item) =>
        item.reference.text.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // During the waiting phase, render nothing (modal is hidden)
    if (phase === 'waiting') {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-1/2 relative">
                {/* Close Button */}
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => {
                        setSelectedText(null);
                        setIsHighlightModalOpen(false);
                    }}>
                    &#x2715;
                </button>

                {phase === 'selectHighlight' && (
                    <>
                        <h2 className="text-xl font-semibold mb-4">
                            Edit Highlight – Select a Quote to Change
                        </h2>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search highlights..."
                            className="w-full p-2 border rounded mb-4"
                        />
                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
                            {filteredHighlights.length > 0 ? (
                                filteredHighlights.map((item, idx) => (
                                    <div
                                        key={`${item.code}-${idx}`}
                                        className="p-2 cursor-pointer border-b border-gray-100 hover:bg-blue-100"
                                        onClick={() => {
                                            setSelectedReference(item);
                                            alert(
                                                'You will now be shown the transcript. Please select the new text region. When done, the modal will re-open for confirmation.'
                                            );
                                            setPhase('waiting');
                                        }}>
                                        <p className="text-sm text-gray-800">
                                            {item.reference.text}
                                        </p>
                                        <p className="text-xs text-gray-500">Code: {item.code}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center">No highlights found</p>
                            )}
                        </div>
                    </>
                )}

                {phase === 'selectReplacement' && (
                    <>
                        <h2 className="text-xl font-semibold mb-4">
                            Edit Highlight – Confirm New Text Region
                        </h2>
                        <p className="mb-4">
                            <span className="font-semibold">Selected Quote:</span>{' '}
                            {selectedReference?.reference.text}
                        </p>
                        <p className="mb-4">
                            <span className="font-semibold">New Text Region:</span> {selectedText}
                        </p>
                        <div className="flex justify-end space-x-2">
                            <button
                                className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
                                onClick={() => {
                                    if (selectedReference && selectedText) {
                                        applyCodeToSelection({
                                            ...selectedReference,
                                            newText: selectedText
                                        });
                                        setSelectedText(null);
                                        setSelectedReference(null);
                                        setIsHighlightModalOpen(false);
                                    } else {
                                        alert('Please select a new text region.');
                                    }
                                }}
                                disabled={!selectedText}>
                                Save Changes
                            </button>
                            <button
                                className="bg-yellow-500 text-white px-4 py-2 rounded"
                                onClick={() => {
                                    // Allow the user to redo the selection.
                                    setSelectedText(null);
                                    setPhase('waiting');
                                }}>
                                Redo Selection
                            </button>
                            <button
                                className="bg-red-500 text-white px-4 py-2 rounded"
                                onClick={() => {
                                    setSelectedText(null);
                                    setSelectedReference(null);
                                    setPhase('selectHighlight');
                                }}>
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default EditHighlightModal;
