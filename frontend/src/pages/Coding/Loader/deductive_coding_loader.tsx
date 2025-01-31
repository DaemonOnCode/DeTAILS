import { useEffect } from 'react';
import { createTimer } from '../../../utility/timer';
import { useLogger } from '../../../context/logging_context';

const FinalLoaderPage = () => {
    const logger = useLogger();

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Final loader Page');

        return () => {
            logger.info('Unloaded Final loader Page').then(() => {
                logger.time('Final loader Page stay time', { time: timer.end() });
            });
        };
    }, []);
    return (
        <div className="h-panel w-full flex flex-col gap-6  items-center justify-center">
            <h1>Performing deductive coding...</h1>
            <div className="flex justify-center mt-4">
                <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
            </div>
        </div>
    );
};

export default FinalLoaderPage;
