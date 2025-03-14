import { FC, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { generateColor } from '../../../utility/color-generator';

interface CodeItemProps {
    code: string;
    setCodeRef: (code: string, node: HTMLDivElement | null) => void;
}

const CodeItem: FC<CodeItemProps> = ({ code, setCodeRef }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'CODE',
        item: { code },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging()
        })
    }));

    // const codeRef = useRef<HTMLDivElement>(null);

    // useEffect(() => {
    //     console.log('Setting code ref', code);
    //     setCodeRef(code, codeRef.current);
    //     return () => setCodeRef(code, null);
    // }, [code, setCodeRef]);

    return (
        <div
            ref={(node) => {
                drag(node); // Set the drag ref for drag-and-drop
                setCodeRef(code, node); // Set the code ref in the Map
            }}
            style={{
                backgroundColor: generateColor(code)
            }}
            className={`code-item p-2 border rounded-md shadow-md cursor-move overflow-wrap ${
                isDragging ? 'opacity-50' : 'opacity-100'
            }`}>
            {code}
        </div>
    );
};

export default CodeItem;
