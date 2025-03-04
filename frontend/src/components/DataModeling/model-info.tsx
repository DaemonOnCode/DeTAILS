import { useEffect, useState } from 'react';
import { useModelingContext } from '../../context/modeling-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useCollectionContext } from '../../context/collection-context';
import { useApi } from '../../hooks/Shared/use-api';

const ModelInfo = () => {
    const { datasetId } = useCollectionContext();
    const { models, activeModelId } = useModelingContext();

    const currentModel = models.find((model) => model.id === activeModelId)!;

    const [metadata, setMetadata] = useState<{
        type: string;
        createdOn: string;
        numTopics: number;
        numPasses: number;
        isProcessing: boolean;
    } | null>(null);

    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

    const fetchActiveModelMetadata = async (signal: AbortController) => {
        try {
            const { data, error } = await fetchData<{
                id: string;
                dataset_id: string;
                model_name: string;
                type: string;
                topics: string[];
                start_time: string;
                end_time: string;
                num_topics: number;
            }>(
                REMOTE_SERVER_ROUTES.GET_MODEL_METADATA,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model_id: activeModelId,
                        dataset_id: datasetId ?? '',
                        workspace_id: currentWorkspace?.id ?? ''
                    })
                },
                signal
            );

            if (error) {
                console.error('Error fetching model metadata:', error);
                return;
            }

            setMetadata({
                type: data.type,
                createdOn: data.start_time,
                numTopics: data.num_topics,
                numPasses: 100,
                isProcessing: data.end_time === null
            });
        } catch (e) {
            console.log(e);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        if (activeModelId) fetchActiveModelMetadata(controller);

        return () => {
            controller.abort('Extra');
        };
    }, [activeModelId]);

    return metadata ? (
        <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Model Info</h2>
            <p>
                <strong>Model type:</strong> {metadata.type.toUpperCase()}
            </p>
            <p>
                <strong>Processing:</strong> {currentModel.isProcessing ? 'Yes' : 'No'}
            </p>
            <p>
                <strong>Created On:</strong> {metadata.createdOn}
            </p>
            <p>
                <strong>Number of Topics:</strong> {metadata.numTopics}
            </p>
            <p>
                <strong>Number of Passes:</strong> {metadata.numPasses}
            </p>
        </div>
    ) : (
        <div>
            <p>Loading metadata....</p>
        </div>
    );
};

export default ModelInfo;
