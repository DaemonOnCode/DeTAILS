import Topbar from '../../components/DataModeling/topbar';
import LeftPanel from '../../components/DataModeling/left-panel';
import RightPanel from '../../components/DataModeling/right-panel';
import { useEffect } from 'react';
import { useModelingContext } from '../../context/modeling_context';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/DataModeling/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';

const ModelsPage = () => {
    const { models } = useModelingContext();

    const navigate = useNavigate();
    // const [activeModel, setActiveModel] = useState('Model_1');

    // const models = [
    //     {
    //         name: 'Model_1',
    //         status: 'active',
    //         createdOn: '2024-07-02',
    //         numTopics: 10,
    //         numPasses: 100
    //     },
    //     {
    //         name: 'Model_2',
    //         status: 'processing',
    //         createdOn: '2024-07-02',
    //         numTopics: 15,
    //         numPasses: 120
    //     }
    // ];

    // const topics = [
    //     { label: '1', words: ['like', 'room', 'people', 'got', 'water', 'know'] },
    //     { label: '2', words: ['course', 'courses', 'term', 'math', 'year'] }
    // ];

    // const samples = [
    //     {
    //         url: '15c9h7i',
    //         createdUtc: '2023-07-28',
    //         title: 'These brand reworks are getting out of hand'
    //     },
    //     { url: '15e94q8', createdUtc: '2023-07-19', title: 'Is my hair rough because of water?' }
    // ];

    // const model = models.find((m) => m.name === activeModel);
    // useEffect(() => {
    //     if (!models.length) {
    //         console.log('No models found');
    //         navigate(`/${SHARED_ROUTES.DATA_MODELING}/${ROUTES.HOME}`);
    //     }
    // }, []);

    return models.length ? (
        <div className="flex flex-col -m-6">
            <Topbar />
            <div className="flex flex-grow h-[calc(100vh-7.25rem)]">
                <LeftPanel />
                <RightPanel />
            </div>
        </div>
    ) : (
        <p>
            No models found, Click{' '}
            <span
                className="text-blue-600 underline cursor-pointer"
                onClick={() => navigate(`/${SHARED_ROUTES.DATA_MODELING}/${ROUTES.HOME}`)}>
                here
            </span>{' '}
            to generate a new model
        </p>
    );
};

export default ModelsPage;
