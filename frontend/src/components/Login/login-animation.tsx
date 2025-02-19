import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { BackgroundWithCards, SplitScreenPhase2 } from '.';

type Phase = 0 | 1;

export default function LoginAnimation({ GoogleOauth }: { GoogleOauth: JSX.Element }) {
    const [phase, setPhase] = useState<Phase>(0);
    useEffect(() => {
        console.log('phase', phase);
        if (phase === 0) {
            const t = setTimeout(() => {
                setPhase(1);
            }, 1000);
            return () => clearTimeout(t);
        }
    }, [phase]);

    return (
        <div className="relative h-screen flex items-center justify-center p-4 overflow-hidden">
            <div className="relative h-screen w-screen" style={{ perspective: '1000px' }}>
                <LayoutGroup>
                    <motion.div
                        className="absolute inset-0 z-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.75 }}
                        transition={{ duration: 1, delay: 0.5 }}>
                        <BackgroundWithCards />
                    </motion.div>

                    <AnimatePresence>
                        {phase === 1 && <SplitScreenPhase2 GoogleOauth={GoogleOauth} />}
                    </AnimatePresence>
                </LayoutGroup>
            </div>
        </div>
    );
}
