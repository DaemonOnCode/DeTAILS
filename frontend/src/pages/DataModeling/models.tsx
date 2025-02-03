import Topbar from '../../components/DataModeling/topbar';
import LeftPanel from '../../components/DataModeling/left-panel';
import RightPanel from '../../components/DataModeling/right-panel';
import { useModelingContext } from '../../context/modeling-context';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/DataModeling/shared';
import { ROUTES as SHARED_ROUTES } from '../../constants/Shared';
import { useMemo } from 'react';
import ModelLoader from '../../components/DataModeling/model-loader';

const ModelsPage = () => {
    const { models, activeModelId } = useModelingContext();

    const navigate = useNavigate();

    const currentModel = useMemo(
        () => models.find((model) => model.id === activeModelId),
        [models, activeModelId]
    );
    // models.find((model) => model.id === activeModelId);

    console.log(models, activeModelId, currentModel, 'models page');

    return models.length ? (
        <div className="flex flex-col -m-6">
            <Topbar />
            <div className="flex flex-grow h-[calc(100vh-7.25rem)]">
                {currentModel?.isProcessing ? (
                    // <div>
                    <ModelLoader message={currentModel.stage ?? ''} />
                ) : (
                    // </div>
                    <>
                        <LeftPanel />
                        <RightPanel />
                    </>
                )}
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
