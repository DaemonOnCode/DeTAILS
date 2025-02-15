import { FC, useEffect, useRef } from 'react';
// import useInterviewData from '../../hooks/Home/use-interview-data';
// import InterviewTableRenderer from '../../components/Shared/interview-table-renderer';
import { useCollectionContext } from '../../context/collection-context';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';

const LoadInterview: FC = () => {
    // Assume that useInterviewData works similarly to useRedditData.
    // const { data, loadInterviewData, error, loading } = useInterviewData();
    // Here we assume that your collection context now has interviewInput and a setter.
    const { interviewInput, setInterviewInput } = useCollectionContext();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const hasSavedRef = useRef(false);

    useEffect(() => {
        // If interview text data is provided, load the interview data.
        if (interviewInput) {
            // loadInterviewData();
        }
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
        // Optionally include interviewInput as a dependency if you want to reload when it changes.
    }, [interviewInput]);

    // Check if data is loaded
    const isDataLoaded = !!interviewInput;

    if (isDataLoaded) {
        return (
            <div className="flex flex-col h-page">
                {/* <InterviewTableRenderer data={data} loading={loading} /> */}
            </div>
        );
    }

    // Render input when no interview data has been provided yet.
    return (
        <div className="flex flex-col h-page">
            <header className="p-4">
                <h1 className="text-2xl font-bold mb-4">Interview Data Input</h1>
            </header>

            <main className="flex-1 min-h-0 overflow-auto p-4">
                <div>
                    <textarea
                        value={interviewInput || ''}
                        onChange={(e) => setInterviewInput(e.target.value)}
                        placeholder="Paste your interview text data here..."
                        className="p-2 border border-gray-300 rounded w-full h-48"
                    />
                </div>
                {/* {error && <p className="text-red-500 mt-4">{error}</p>} */}
            </main>
        </div>
    );
};

export default LoadInterview;
