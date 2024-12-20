import { FC } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar'; // Import the Topbar component
import { ILayout } from '../../types/Coding/shared';

export const Layout: FC<ILayout> = ({ children }) => {
    return (
        <div>
            {/* Topbar */}
            <Topbar />
            <div className="flex w-full relative">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Content Wrapper */}
                <div className="flex flex-col w-full pl-48 min-h-page">
                    {/* Main Content Area */}
                    <div className="p-6 h-full overflow-hidden">{children}</div>
                </div>
            </div>
        </div>
    );
};
