import React from 'react';

const HomePage = () => {
    // Event Handlers
    const handleRandomSampling = () => {
        console.log('Random Sampling selected');
        // Add logic for Random Sampling
    };

    const handleTopicModelSelection = (model: string) => {
        console.log(`${model} Sampling selected`);
        // Add logic for selected Topic Model Sampling
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
                        onClick={() => handleTopicModelSelection('Latent Dirichlet Allocation')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Latent Dirichlet Allocation</strong>
                        <p className="text-sm text-gray-600">
                            This topic model is suited to identifying topics in long texts, such as
                            discussions, where multiple topics can co-occur.
                        </p>
                    </button>

                    <button
                        onClick={() => handleTopicModelSelection('Biterm')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Biterm</strong>
                        <p className="text-sm text-gray-600">
                            This topic model is suited to identifying topics in short texts, such as
                            tweets and instant messages.
                        </p>
                    </button>

                    <button
                        onClick={() =>
                            handleTopicModelSelection('Non-Negative Matrix Factorization')
                        }
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md border border-gray-400 text-left">
                        <strong>Non-Negative Matrix Factorization</strong>
                        <p className="text-sm text-gray-600">
                            This topic model is suited to rough identifying topics when performing
                            initial explorations.
                        </p>
                    </button>

                    <button
                        onClick={() => handleTopicModelSelection('Bertopic')}
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
