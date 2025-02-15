import { FC } from 'react';
import { useDrag } from 'react-dnd';
import { generateColor } from '../../../utility/color-generator';

interface CodeItemProps {
    code: string;
}

const CodeItem: FC<CodeItemProps> = ({ code }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'CODE',
        item: { code },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging()
        })
    }));

    return (
        <div
            ref={drag}
            style={{
                backgroundColor: generateColor(code)
            }}
            className={`p-2 border rounded-md shadow-md cursor-move ${
                isDragging ? 'opacity-50' : 'opacity-100'
            }`}>
            {code}
        </div>
    );
};

export default CodeItem;
