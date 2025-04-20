import { FC, useState, useRef, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import CodeItem from './code-item';
import { FaTrashAlt } from 'react-icons/fa';
import { FiEdit } from 'react-icons/fi';
import debounce from 'lodash/debounce'; // Import Lodash debounce

interface BucketProps {
    theme: { id: string; name: string; codes: string[] };
    onDrop: (themeId: string, code: string) => void;
    onDelete: (themeId: string) => void;
    onUpdateName: (themeId: string, newName: string) => void;
    setCodeRef: (code: string, node: HTMLDivElement | null) => void;
    scrollRef: React.RefObject<HTMLDivElement>;
}

const Bucket: FC<BucketProps> = ({
    theme,
    onDrop,
    onDelete,
    onUpdateName,
    setCodeRef,
    scrollRef
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(theme.name);

    // Create a debounced version of onUpdateName with a 500ms delay
    const debouncedUpdateName = useRef(
        debounce((id: string, name: string) => {
            onUpdateName(id, name);
        }, 500)
    ).current;

    const bucketRef = useRef<HTMLDivElement>(null);

    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CODE',
        drop: (item: any) => onDrop(theme.id, item.code),
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop()
        })
    }));

    // Sync newName with theme.name when entering edit mode
    useEffect(() => {
        if (isEditing) {
            setNewName(theme.name);
        }
    }, [isEditing, theme.name]);

    // Handle input changes: update local state instantly, dispatch debounced update
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewName(value); // Update local state immediately for instant feedback
        debouncedUpdateName(theme.id, value.trim()); // Debounced update to onUpdateName
    };

    // Handle submission (Enter or blur): dispatch update immediately
    const handleEditSubmit = () => {
        const trimmedName = newName.trim();
        if (trimmedName) {
            onUpdateName(theme.id, trimmedName); // Immediate dispatch on submit
        }
        setIsEditing(false);
    };

    return (
        <div
            ref={drop}
            className={`p-4 border rounded-lg shadow-md ${isOver ? 'bg-green-100' : 'bg-white'}`}>
            <div ref={bucketRef}>
                <div className="flex justify-between items-center mb-2">
                    {isEditing ? (
                        <input
                            type="text"
                            value={newName}
                            onChange={handleNameChange} // Use the new handler
                            onBlur={handleEditSubmit}
                            onKeyPress={(e) => e.key === 'Enter' && handleEditSubmit()}
                            autoFocus
                            className="border p-1 rounded w-full"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">{theme.name}</h2>
                            <span
                                className="text-blue-500 cursor-pointer h-8 w-8 place-content-center"
                                title="Click to edit"
                                onClick={() => setIsEditing(true)}>
                                <FiEdit />
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => onDelete(theme.id)}
                        className="text-red-500 text-sm font-bold p-2">
                        <FaTrashAlt />
                    </button>
                </div>
                <div className="space-y-2">
                    {theme.codes.length > 0 ? (
                        theme.codes.map((code) => (
                            <CodeItem
                                key={code}
                                code={code}
                                setCodeRef={setCodeRef}
                                scrollRef={scrollRef}
                            />
                        ))
                    ) : (
                        <p className="text-gray-400 italic">No codes assigned</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Bucket;
