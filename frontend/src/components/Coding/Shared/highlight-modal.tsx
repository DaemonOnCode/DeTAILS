import { FC, useEffect } from 'react';
import { HighlightModalProps } from '../../../types/Coding/props';

const HighlightModal: FC<HighlightModalProps> = ({
    codes,
    selectedCode,
    setSelectedCode,
    setIsAddCodeModalOpen,
    applyCodeToSelection,
    setIsHighlightModalOpen,
    addReasoning,
    reasoning,
    setReasoning,
    restoreSelection,
    removeSelection,
    hidden,
    setHidden,
    showAddNewCode = true
}) => {
    useEffect(() => {
        restoreSelection();
        return () => {
            removeSelection();
        };
    }, []);

    return hidden ? (
        <></>
    ) : (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-1/3 relative">
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => {
                        setSelectedCode('null');
                        setIsHighlightModalOpen(false);
                    }}>
                    &#x2715;
                </button>
                <h2 className="text-xl font-semibold mb-4">Highlight Text</h2>
                <select
                    className="w-full p-2 border rounded mb-4"
                    value={selectedCode}
                    onChange={(e) => {
                        if (e.target.value === 'addNewCode') {
                            setIsAddCodeModalOpen(true);
                            setHidden(true);
                        } else {
                            setSelectedCode(e.target.value);
                        }
                    }}>
                    <option value="null">Select a code</option>
                    {codes.map((code, idx) => (
                        <option key={idx} value={code}>
                            {code}
                        </option>
                    ))}
                    {showAddNewCode && <option value="addNewCode">+ Add New Code</option>}
                </select>
                {addReasoning && (
                    <textarea
                        className="w-full p-2 border rounded mb-4 resize-none"
                        placeholder="Add explanation here..."
                        value={reasoning ?? ''}
                        onChange={(e) => setReasoning!(e.target.value)}
                    />
                )}
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    onClick={applyCodeToSelection}>
                    Apply Highlight
                </button>
            </div>
        </div>
    );
};

export default HighlightModal;
