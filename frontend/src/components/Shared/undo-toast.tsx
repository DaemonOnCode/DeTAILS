function UndoNotification(props: any) {
    const { data, closeToast } = props;

    const handleUndo = () => {
        data?.onUndo();
        closeToast();
    };

    return (
        <div className="flex items-center justify-between space-x-3">
            <span>Item deleted.</span>
            <button
                onClick={handleUndo}
                className="border border-purple-600 px-2 py-1 text-purple-600 rounded hover:bg-purple-50">
                Undo
            </button>
        </div>
    );
}

export default UndoNotification;
