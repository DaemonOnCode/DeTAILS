import { useEffect, useState } from 'react';
import { useWorkspaceContext } from '../../context/workspace-context';
import { useModelingContext } from '../../context/modeling-context';
import useServerUtils from '../../hooks/Shared/get-server-url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';
import { useApi } from '../../hooks/Shared/use-api';

const TopicsTable = () => {
    const { activeModelId } = useModelingContext();

    const [topicData, setTopicData] = useState<
        {
            topic: string;
            words: string[];
        }[]
    >([]);

    const { currentWorkspace } = useWorkspaceContext();
    const { fetchData } = useApi();

    const fetchActiveModelMetadata = async (controller: AbortController) => {
        try {
            const { data, error } = await fetchData<any>(
                REMOTE_SERVER_ROUTES.GET_MODEL_SAMPLES,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model_id: activeModelId,
                        workspace_id: currentWorkspace?.id
                    })
                },
                controller
            );

            console.log(data);
            if (error) {
                console.error('Error fetching model samples:', error);
                return;
            }

            setTopicData(data);
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
        <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Topics</h2>
            <table className="w-full border border-gray-300">
                <thead>
                    <tr>
                        <th className="border p-2">Topic #</th>
                        <th className="border p-2">Words</th>
                    </tr>
                </thead>
                <tbody>
                    {topicData.map((topic, idx) => (
                        <tr key={idx}>
                            <td className="border p-2">{topic.words.join(', ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TopicsTable;
