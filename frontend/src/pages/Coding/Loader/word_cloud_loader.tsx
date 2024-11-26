const WordCloudLoaderPage = () => {
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
