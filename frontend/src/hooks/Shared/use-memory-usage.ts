import { useEffect, useState } from 'react';

// Extend the Performance interface
interface PerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

declare global {
    interface Performance {
        memory?: PerformanceMemory;
    }
}

interface MemoryUsage {
    used: string;
    total: string;
    limit: string;
}

export const useMemoryUsage = (): MemoryUsage | null => {
    const [memoryUsage, setMemoryUsage] = useState<MemoryUsage | null>(null);

    // useEffect(() => {
    //     // Check if the Memory API is supported
    //     if (!performance.memory) {
    //         console.warn('Memory API is not supported in this browser.');
    //         return;
    //     }

    //     const updateMemoryUsage = () => {
    //         const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory!;
    //         setMemoryUsage({
    //             used: (usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    //             total: (totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
    //             limit: (jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB'
    //         });
    //     };

    //     const interval = setInterval(updateMemoryUsage, 5000); // Update every 5 seconds
    //     updateMemoryUsage();

    //     return () => clearInterval(interval); // Cleanup on unmount
    // }, []);

    return memoryUsage;
};
