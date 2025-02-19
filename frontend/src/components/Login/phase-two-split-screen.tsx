import { motion } from 'framer-motion';
import { useState } from 'react';

function SplitScreenPhase2({ GoogleOauth = <></> }: { GoogleOauth: JSX.Element }) {
    const [googleVisible, setGoogleVisible] = useState(true);
    const [flex, setFlex] = useState(false);

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 z-10">
            <motion.div className="h-1/2 flex items-end justify-end">
                <div className="font-bold flex" style={{ perspective: '1000px' }}>
                    <motion.img
                        src="details-full-logo.png"
                        alt="DeTAILS"
                        className="
                        w-[18rem] h-auto 
                        sm:w-[24rem] 
                        md:w-[30rem] 
                        lg:w-[36rem] 
                        xl:w-[42rem]"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                    />
                </div>
            </motion.div>

            {googleVisible && (
                <motion.div
                    className="h-1/2"
                    style={{ willChange: 'transform, opacity' }}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1 }}
                    onAnimationComplete={() => setFlex(true)}>
                    {GoogleOauth}
                </motion.div>
            )}
        </div>
    );
}

export default SplitScreenPhase2;
