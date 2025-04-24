import { FC, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { generateColor } from '../../../utility/color-generator';

interface CodeItemProps {
    code: string;
    setCodeRef: (code: string, node: HTMLDivElement | null) => void;
    scrollRef: React.RefObject<HTMLDivElement>;
}

const CodeItem: FC<CodeItemProps> = ({ code, setCodeRef, scrollRef }) => {
    const codeItemRef = useRef<HTMLDivElement>(null);

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'CODE',
        item: { code },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging()
        })
    }));

    return (
        <div ref={codeItemRef}>
            <div
                ref={(node) => {
                    drag(node);
                    setCodeRef(code, node);
                }}
                style={{
                    backgroundColor: generateColor(code)
                }}
                className={`code-item p-2 border rounded-md shadow-md cursor-move overflow-wrap ${
                    isDragging ? 'opacity-50' : 'opacity-100'
                }`}>
                {code}
            </div>
        </div>
    );
};

export default CodeItem;
