import { FC, useState } from 'react';
import { AddCodeModalProps } from '../../../types/Coding/props';

const AddCodeModal: FC<AddCodeModalProps> = ({
    setIsAddCodeModalOpen,
    setIsHighlightModalOpen,
    isHighlightModalOpen,
    setCodes,
    setSelectedCode
}) => {
    const [newCode, setNewCode] = useState('');

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-1/3 relative">
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => setIsAddCodeModalOpen(false)}>
                    &#x2715;
                </button>
                <h2 className="text-xl font-semibold mb-4">Add a New Code</h2>
                <input
                    type="text"
                    placeholder="Enter code name"
                    className="w-full p-2 border rounded mb-4"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                />
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    onClick={() => {
                        if (newCode) {
                            setCodes((prevCodes) => [...prevCodes, newCode]);
                            setSelectedCode(newCode);
                            setNewCode('');
                            setIsAddCodeModalOpen(false);
                            if (isHighlightModalOpen) {
                                setIsHighlightModalOpen(true);
                            }
                        }
                    }}>
                    Add Code
                </button>
            </div>
        </div>
    );
};

export default AddCodeModal;
