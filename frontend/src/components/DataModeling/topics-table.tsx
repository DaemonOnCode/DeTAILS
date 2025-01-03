import { useEffect, useState } from 'react';
import { useWorkspaceContext } from '../../context/workspace_context';
import { useModelingContext } from '../../context/modeling_context';
import useServerUtils from '../../hooks/Shared/get_server_url';
import { REMOTE_SERVER_ROUTES } from '../../constants/Shared';

const TopicsTable = () => {
    const { activeModelId } = useModelingContext();

    const [topicData, setTopicData] = useState<
        {
            topic: string;
            words: string[];
        }[]
    >([]);

    const { currentWorkspace } = useWorkspaceContext();
    const { getServerUrl } = useServerUtils();

    const fetchActiveModelMetadata = async (signal: AbortSignal) => {
        try {
            const res = await fetch(getServerUrl(REMOTE_SERVER_ROUTES.GET_MODEL_SAMPLES), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_id: activeModelId,
                    workspace_id: currentWorkspace?.id
                }),
                signal
            });

            const data = await res.json();
            console.log(data, res.ok);
            if (!res.ok) return;
            setTopicData(data);
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

    return (
        <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Topics</h2>
            <table className="w-full border-collapse border border-gray-300">
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
