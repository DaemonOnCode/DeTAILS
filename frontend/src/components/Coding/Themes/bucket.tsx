import { FC, useState, useRef } from 'react';
import { useDrop } from 'react-dnd';
import CodeItem from './code-item';
import { FaTrashAlt } from 'react-icons/fa';
import { FiEdit } from 'react-icons/fi';
import { useIntersectionObserver } from '../../../hooks/Shared/use-intersection-observer';

interface BucketProps {
    theme: { id: string; name: string; codes: string[] };
    onDrop: (themeId: string, code: string) => void;
    onDelete: (themeId: string) => void;
    setCodeRef: (code: string, node: HTMLDivElement | null) => void;
    scrollRef: React.RefObject<HTMLDivElement>;
}

const Bucket: FC<BucketProps> = ({ theme, onDrop, onDelete, setCodeRef, scrollRef }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(theme.name);

    const bucketRef = useRef<HTMLDivElement>(null);
    const isVisible = useIntersectionObserver(bucketRef, {
        root: scrollRef.current,
        rootMargin: '100px'
    });

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

    const estimatedHeight = 50 + theme.codes.length * 40;

    return (
        <div
            ref={drop}
            className={`p-4 border rounded-lg shadow-md ${isOver ? 'bg-green-100' : 'bg-white'}`}>
            <div ref={bucketRef}>
                {isVisible ? (
                    <>
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
                    </>
                ) : (
                    <div
                        style={{ height: `${estimatedHeight}px` }}
                        className="bg-gray-200 animate-pulse" // Optional: Add subtle animation for placeholders
                    />
                )}
            </div>
        </div>
    );
};

export default Bucket;
