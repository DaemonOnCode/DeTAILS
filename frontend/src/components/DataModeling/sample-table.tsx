import { useEffect, useState } from 'react';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useModelingContext } from '../../context/modeling-context';
import { useApi } from '../../hooks/Shared/use-api';

const SampleTable = () => {
    const { activeModelId } = useModelingContext();

    const [samplesData, setSamplesData] = useState<
        {
            topic: string;
            postData: Record<string, any>;
        }[]
    >([]);

    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

    const fetchActiveModelMetadata = async (signal: AbortController) => {
        try {
            const { data, error } = await fetchData<any>(
                REMOTE_SERVER_ROUTES.GET_MODEL_SAMPLES,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        model_id: activeModelId,
                        workspace_id: currentWorkspace?.id
                    })
                },
                signal
            );

            if (error) {
                console.error('Error fetching model samples:', error);
                return;
            }

            setSamplesData(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        if (activeModelId) fetchActiveModelMetadata(controller);

        return () => {
            controller.abort('Extra');
        };
    }, [activeModelId]);

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold">Samples</h2>
            <table className="w-full border border-gray-300">
                <thead>
                    <tr>
                        <th className="border p-2">URL</th>
                        <th className="border p-2">Created At</th>
                        <th className="border p-2">Title</th>
                    </tr>
                </thead>
                <tbody>
                    {samplesData.map((sample, idx) => (
                        <tr key={idx}>
                            <td className="border p-2">{sample.postData.url}</td>
                            <td className="border p-2">{sample.postData.createdUtc}</td>
                            <td className="border p-2">{sample.postData.title}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SampleTable;
