import React, { FC, useEffect } from 'react';
import { useLogger } from '../../context/logging_context';

const SystemMetricsLogger: FC = () => {
    const logger = useLogger();

    const getMemoryUsage = () => {
        const deviceMemory = 'deviceMemory' in navigator ? navigator.deviceMemory : undefined; // Check if deviceMemory is available
        return {
            total: deviceMemory
                ? `${deviceMemory} GB - Approximate total device memory.`
                : 'Unavailable - Device memory information not supported in this browser.',
            used: 'Unavailable - Browser APIs do not provide exact memory usage details.'
        };
    };

    useEffect(() => {
        const logMetrics = async () => {
            try {
                const processMemory = getMemoryUsage();

                await logger.health('Periodic System Metrics', {
                    processMemory
                });
            } catch (error) {
                await logger.error('Failed to log system metrics', {
                    error: JSON.stringify(error)
                });
            }
        };

        const interval = setInterval(logMetrics, 60 * 1000); // Log every minute

        return () => {
            clearInterval(interval); // Cleanup on unmount
        };
    }, [logger]);

    return null;
};

export default SystemMetricsLogger;
