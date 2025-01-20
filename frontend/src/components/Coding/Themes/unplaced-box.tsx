import { useDrop } from 'react-dnd';
import CodeItem from './code-item';

// Unplaced Codes Box Component
const UnplacedCodesBox = ({
    unplacedCodes,
    onDrop
}: {
    unplacedCodes: string[];
    onDrop: (code: string) => void;
}) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'CODE',
        drop: (item: any) => {
            onDrop(item.code);
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver()
        })
    }));

    return (
        <div
            ref={drop}
            className={`mt-8 p-4 border border-dashed border-gray-500 rounded-lg bg-gray-50 ${
                isOver ? 'bg-yellow-100' : ''
            }`}
            style={{ minHeight: '100px' }}>
            <h2 className="text-xl font-semibold mb-4">Unplaced Codes</h2>
            <div className="flex gap-4 flex-wrap">
                {unplacedCodes.map((code) => (
                    <CodeItem key={code} code={code} />
                ))}
            </div>
        </div>
    );
};

export default UnplacedCodesBox;
