const UnsavedChangesModal = ({ onSave = () => {}, onDiscard = () => {}, onCancel = () => {} }) => {
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded shadow-lg">
                <p className="mb-4">
                    You have unsaved changes. Do you want to save them before leaving?
                </p>
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onSave}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                        Save
                    </button>
                    <button
                        onClick={onDiscard}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                        Discard
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnsavedChangesModal;
