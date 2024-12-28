import { FC, useState } from 'react';
import { DeleteCodeModalProps } from '../../../types/Coding/props';

const DeleteCodeModal: FC<DeleteCodeModalProps> = ({
    codes,
    setCodes,
    setIsDeleteCodeModalOpen,
    setSelectedCode
}) => {
    const [selectedCodeToDelete, setSelectedCodeToDelete] = useState('');

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded shadow-lg w-1/3 relative">
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => setIsDeleteCodeModalOpen(false)}>
                    &#x2715;
                </button>
                <h2 className="text-xl font-semibold mb-4">Delete Code</h2>
                <select
                    className="w-full p-2 border rounded mb-4"
                    value={selectedCodeToDelete}
                    onChange={(e) => {
                        setSelectedCodeToDelete(e.target.value);
                        setSelectedCode(e.target.value);
                    }}>
                    <option value="">Select a code to delete</option>
                    {codes.map((code, idx) => (
                        <option key={idx} value={code}>
                            {code}
                        </option>
                    ))}
                </select>
                <button
                    className="bg-red-500 text-white px-4 py-2 rounded"
                    onClick={() => {
                        if (selectedCodeToDelete) {
                            // console.log(typeof setCodes);
                            setCodes((prevCodes) =>
                                prevCodes.filter((code) => code !== selectedCodeToDelete)
                            );
                            // setSelectedCode('');
                            setSelectedCodeToDelete('');
                            setIsDeleteCodeModalOpen(false);
                        }
                    }}>
                    Confirm Delete
                </button>
            </div>
        </div>
    );
};

export default DeleteCodeModal;
