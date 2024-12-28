import { FC, useState } from 'react';
import { EditCodeModalProps } from '../../../types/Coding/props';

const EditCodeModal: FC<EditCodeModalProps> = ({
    codes,
    setCodes,
    setIsEditCodeModalOpen,
    setSelectedCode
}) => {
    const [selectedCodeToEdit, setSelectedCodeToEdit] = useState('');
    const [editedCode, setEditedCode] = useState('');

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded shadow-lg w-1/3 relative">
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                    onClick={() => setIsEditCodeModalOpen(false)}>
                    &#x2715;
                </button>
                <h2 className="text-xl font-semibold mb-4">Edit Code</h2>
                <select
                    className="w-full p-2 border rounded mb-4"
                    value={selectedCodeToEdit}
                    onChange={(e) => {
                        setSelectedCodeToEdit(e.target.value);
                        setSelectedCode(e.target.value);
                    }}>
                    <option value="">Select a code to edit</option>
                    {codes.map((code, idx) => (
                        <option key={idx} value={code}>
                            {code}
                        </option>
                    ))}
                </select>
                {selectedCodeToEdit && (
                    <input
                        type="text"
                        className="w-full p-2 border rounded mb-4"
                        placeholder="Edit code name"
                        value={editedCode}
                        onChange={(e) => setEditedCode(e.target.value)}
                    />
                )}
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                    onClick={() => {
                        if (selectedCodeToEdit && editedCode) {
                            // console.log(typeof setCodes);
                            // console.log(Object.arguments(setCodes));
                            setCodes((prevCodes) =>
                                prevCodes.map((code) =>
                                    code === selectedCodeToEdit ? editedCode : code
                                )
                            );
                            // setSelectedCode(editedCode);
                            setEditedCode('');
                            setSelectedCodeToEdit('');
                            setIsEditCodeModalOpen(false);
                        }
                    }}>
                    Save Changes
                </button>
            </div>
        </div>
    );
};

export default EditCodeModal;
