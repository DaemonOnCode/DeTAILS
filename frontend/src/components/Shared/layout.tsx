import { FC } from 'react';
import Sidebar from './sidebar';
import { ILayout } from '../../types/Coding/shared';

export const Layout: FC<ILayout> = ({ children }) => {
    return (
        <div className="flex w-full relative">
            <Sidebar />
            <div className="pl-48 min-h-screen overflow-auto w-full">
                <div className="p-6 h-full">{children}</div>
            </div>
        </div>
    );
};
