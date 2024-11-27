import { useEffect } from 'react';
import { useLogger } from '../../../context/logging_context';
import { createTimer } from '../../../utility/timer';

const WordCloudLoaderPage = () => {
    const logger = useLogger();

    useEffect(() => {
        const timer = createTimer();
        logger.info('Loaded Word cloud loader Page');

        return () => {
            logger.info('Unloaded Word cloud loader Page').then(() => {
                logger.time('Word cloud loader Page stay time', { time: timer.end() });
            });
        };
    }, []);
    return (
        <div className="h-full w-full flex flex-col gap-6 items-center justify-center">
            <h1>Generating Word cloud...</h1>
            <div className="flex justify-center mt-4">
                <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
            </div>
        </div>
    );
};

export default WordCloudLoaderPage;
