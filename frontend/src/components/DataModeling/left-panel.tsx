import ModelInfo from './model-info';
import TopicsTable from './topics-table';
import SampleTable from './sample-table';

const LeftPanel = () => {
    return (
        <div className="w-1/3 bg-white h-full overflow-auto">
            <ModelInfo />
            <TopicsTable />
            <SampleTable />
        </div>
    );
};

export default LeftPanel;
