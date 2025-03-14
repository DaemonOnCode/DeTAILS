import { useDrop } from 'react-dnd';
import CodeItem from './code-item';

const UnplacedCodesBox = ({
    unplacedCodes,
    onDrop,
    setCodeRef
}: {
    unplacedCodes: string[];
    onDrop: (code: string) => void;
    setCodeRef: (code: string, node: HTMLDivElement | null) => void;
}) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CODE',
        drop: (item: { code: string }) => onDrop(item.code),
        collect: (monitor) => ({ isOver: !!monitor.isOver() })
    }));

    return (
        <div
            ref={drop}
            className={`p-4 border border-dashed border-red-500 rounded-lg bg-gray-50 ${
                isOver ? 'bg-yellow-100' : ''
            }`}
            style={{ minHeight: '100px' }}>
            <h2 className="text-xl font-semibold mb-4">Unplaced Codes</h2>
            <div className="flex gap-4 flex-wrap">
                {unplacedCodes.map((code) => (
                    <CodeItem key={code} code={code} setCodeRef={setCodeRef} />
                ))}
            </div>
        </div>
    );
};

export default UnplacedCodesBox;
