import { useEffect, useState } from "react";
import NavigationBottomBar from "../components/Shared/navigation_bottom_bar";
import { ROUTES } from "../constants/shared";

const GenerationPage = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setLoading(false);
        }, 5*1000);
    }, []);

    return (
        <div className="p-6 h-full flex justify-between flex-col">
            <div className="text-center">
                {loading ?<>
                <h2 className="">Generation in progress</h2>
                <p>Generation of the word cloud is in progress. Please wait...</p>
                <div className="flex justify-center mt-4">
                    <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
                </div></>:
                <>
                <h2 className="">Codings generated. Please click proceed</h2>
                </>}
            </div>

            <NavigationBottomBar previousPage={ROUTES.WORD_CLOUD} nextPage={ROUTES.CODING_VALIDATION}  isReady={!loading}/>
        </div>
    );
};

export default GenerationPage;