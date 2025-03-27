import { useDrop } from 'react-dnd';
import CodeItem from './code-item';
import { FC } from 'react';

interface UnplacedCodesBoxProps {
    unplacedCodes: string[];
    onDrop: (code: string) => void;
    setCodeRef: (code: string, node: HTMLDivElement | null) => void;
    scrollRef: React.RefObject<HTMLDivElement>;
}

const UnplacedCodesBox: FC<UnplacedCodesBoxProps> = ({
    unplacedCodes,
    onDrop,
    setCodeRef,
    scrollRef
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
                    <CodeItem
                        key={code}
                        code={code}
                        setCodeRef={setCodeRef}
                        scrollRef={scrollRef}
                    />
                ))}
            </div>
        </div>
    );
};

export default UnplacedCodesBox;
