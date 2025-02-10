import { FC, useState } from 'react';
import { useDrop } from 'react-dnd';
import CodeItem from './code-item';
import { FaTrashAlt } from 'react-icons/fa';

interface BucketProps {
    theme: { id: string; name: string; codes: string[] };
    onDrop: (themeId: string, code: string) => void;
    onDelete: (themeId: string) => void;
}

const Bucket: FC<BucketProps> = ({ theme, onDrop, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(theme.name);

    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CODE',
        drop: (item: { code: string }) => onDrop(theme.id, item.code),
        collect: (monitor) => ({
            isOver: !!monitor.isOver()
        })
    }));

    const handleEditSubmit = () => {
        if (newName.trim()) {
            theme.name = newName;
        }
        setIsEditing(false);
    };

    return (
        <div
            ref={drop}
            className={`p-4 border rounded-lg shadow-md ${isOver ? 'bg-green-100' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-2">
                {isEditing ? (
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={handleEditSubmit}
                        onKeyPress={(e) => e.key === 'Enter' && handleEditSubmit()}
                        autoFocus
                        className="border p-1 rounded w-full"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{theme.name}</h2>
                        <span
                            className="text-gray-500 cursor-pointer"
                            title="Click to edit"
                            onClick={() => setIsEditing(true)}>
                            ✏️
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
                    theme.codes.map((code) => <CodeItem key={code} code={code} />)
                ) : (
                    <p className="text-gray-400 italic">No codes assigned</p>
                )}
            </div>
        </div>
    );
};

export default Bucket;
