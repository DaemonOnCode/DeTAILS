import { useState, useEffect } from 'react';

function useResponsiveColumns() {
    const cardWidth = 224;
    const xSpacing = 224 + 8;
    const [columns, setColumns] = useState(getColumnCount);

    function getColumnCount() {
        const screenWidth = window.innerWidth;
        return Math.max(1, Math.floor(screenWidth / xSpacing) + 1);
    }

    useEffect(() => {
        function handleResize() {
            setColumns(getColumnCount());
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return columns;
}

export default useResponsiveColumns;
