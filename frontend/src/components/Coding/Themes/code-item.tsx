import { FC } from 'react';
import { useDrag } from 'react-dnd';

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
            className={`p-2 border rounded-md bg-blue-100 shadow-md cursor-move ${
                isDragging ? 'opacity-50' : 'opacity-100'
            }`}>
            {code}
        </div>
    );
};

export default CodeItem;
