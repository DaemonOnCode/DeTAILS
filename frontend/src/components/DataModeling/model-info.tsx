import { useEffect, useState } from 'react';
import { useModelingContext } from '../../context/modeling_context';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useWorkspaceContext } from '../../context/workspace_context';
import { useCollectionContext } from '../../context/collection_context';

const ModelInfo = () => {
    const { datasetId } = useCollectionContext();
    const { models, activeModelId } = useModelingContext();

    const currentModel = models.find((model) => model.id === activeModelId)!;

    const [metadata, setMetadata] = useState<{
        type: string;
        createdOn: string;
        numTopics: number;
        numPasses: number;
    } | null>(null);

    const { currentWorkspace } = useWorkspaceContext();
    const { getServerUrl } = useServerUtils();

    const fetchActiveModelMetadata = async (signal: AbortSignal) => {
        try {
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_MODEL_METADATA), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_id: activeModelId,
                    dataset_id: datasetId ?? '',
                    workspace_id: currentWorkspace?.id ?? ''
                }),
                signal
            });

            const data = await res.json();
            setMetadata(data);
        } catch (e) {
            console.log(e);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        if (activeModelId) fetchActiveModelMetadata(controller.signal);

        return () => {
            controller.abort('Extra');
        };
    }, [activeModelId]);

    return metadata ? (
        <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Model Info</h2>
            <p>
                <strong>Model type:</strong> {currentModel.type.toUpperCase()}
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
