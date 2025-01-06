import { useEffect, useRef } from 'react';
import useWorkspaceUtils from '../../hooks/Shared/workspace-utils';
import { useModelingContext } from '../../context/modeling_context';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useCollectionContext } from '../../context/collection_context';
import { useWorkspaceContext } from '../../context/workspace_context';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/DataModeling/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

const HomePage = () => {
    const { addNewModel, models, addModel, setActiveModelId, activeModelId } = useModelingContext();
    const { datasetId } = useCollectionContext();
    const { currentWorkspace } = useWorkspaceContext();
    const { saveWorkspaceData } = useWorkspaceUtils();

    const { getServerUrl } = useServerUtils();
    const hasSavedRef = useRef(false);

    const navigate = useNavigate();

    useEffect(() => {
        // if (models.length > 0 && !addNewModel) {
        //     if (!activeModelId) {
        //         setActiveModelId(models[0].id);
        //     }
        //     navigate(`/${SHARED_ROUTES.DATA_MODELING}/${ROUTES.MODELS}`);
        // }
        return () => {
            if (!hasSavedRef.current) {
                saveWorkspaceData();
                hasSavedRef.current = true;
            }
        };
    }, []);

    // Event Handlers
    const handleRandomSampling = () => {
        console.log('Random Sampling selected');
        // Add logic for Random Sampling
    };

    const handleTopicModelSelection = async (modelType: string) => {
        console.log(`${modelType} Sampling selected`);
        const res = await fetch(getServerUrl(`${REMOTE_SERVER_ROUTES.ADD_MODEL}/${modelType}`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workspace_id: currentWorkspace?.id,
                dataset_id: datasetId
            })
        });

        const data: {
            method: string;
            topics: string[];
            id: string;
            model_name: string;
        } = await res.json();

        console.log(data, 'Model Data');
        // addModel(data.id, data.model_name, modelType); // Add the model to the context
        // setActiveModelId(data.id); // Set it as the active model
    };

    return (
        <div className="bg-white text-gray-800 min-h-screen flex flex-col items-center p-6 space-y-8">
            <h1 className="text-4xl font-bold text-center">Sampling Methods</h1>

            {/* Generic Sampling Section */}
            <div className="w-full max-w-4xl bg-gray-100 p-6 rounded-lg shadow-md border border-gray-300">
                <h2 className="text-2xl font-semibold mb-4">Generic Sampling</h2>
                <p className="text-gray-600 mb-4">
                    This sampling approach depends on the assumption that codes are uniformly
                    distributed across the data. However, assuming codes follow a uniform
                    distribution may restrict visibility of interesting infrequent codes in the
                    data.
                </p>
                <button
                    onClick={handleRandomSampling}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition">
                    Random
                </button>
            </div>

            {/* Topic Model Sampling Section */}
            <div className="w-full max-w-4xl bg-gray-100 p-6 rounded-lg shadow-md border border-gray-300">
                <h2 className="text-2xl font-semibold mb-4">Topic Model Sampling</h2>
                <p className="text-gray-600 mb-6">
                    Topic model sampling attempts to generate samples in the form of groups of
                    documents that are likely to contain similar topics. These groups can contain
                    interesting phenomena that can be used to explore the data, develop codes, and
                    review themes.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => handleTopicModelSelection('lda')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Latent Dirichlet Allocation</strong>
                        <p className="text-sm text-gray-600">
                            This topic model is suited to identifying topics in long texts, such as
                            discussions, where multiple topics can co-occur.
                        </p>
                    </button>

                    <button
                        onClick={() => handleTopicModelSelection('biterm')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Biterm</strong>
                        <p className="text-sm text-gray-600">
                            This topic model is suited to identifying topics in short texts, such as
                            tweets and instant messages.
                        </p>
                    </button>

                    <button
                        onClick={() => handleTopicModelSelection('nnmf')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Non-Negative Matrix Factorization</strong>
                        <p className="text-sm text-gray-600">
                            This topic model is suited to rough identifying topics when performing
                            initial explorations.
                        </p>
                    </button>

                    <button
                        onClick={() => handleTopicModelSelection('bertopic')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Bertopic</strong>
                        <p className="text-sm text-gray-600">
                            This model is a transformers-based hierarchical topic modeling for
                            efficient exploratory analysis.
                        </p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
