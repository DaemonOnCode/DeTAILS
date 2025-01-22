import { FC, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppRoutes } from '../../router';
import { RouteObject } from 'react-router-dom';

// Format route names for display
const formatRouteName = (path: string) => {
    return path
        .replace(/#/g, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .toLowerCase()
        .replace(' v2', '')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Define keywords to filter out paths
const IGNORED_KEYWORDS = [
    '*',
    '/',
    'loader',
    'basis',
    'flashcards',
    'word-cloud',
    'coding-validation',
    'transcript/:id/:state'
];

interface SidebarProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

    // Toggle dropdown visibility
    const toggleDropdown = (path: string) => {
        setOpenDropdowns((prev) => {
            const newSet = new Set(prev);
            newSet.has(path) ? newSet.delete(path) : newSet.add(path);
            return newSet;
        });
    };

    // Check if a route should be ignored
    const shouldIgnoreRoute = (path: string | undefined) => {
        if (!path) return false;
        return IGNORED_KEYWORDS.some((keyword) => path.toLowerCase() === keyword);
    };

    // Highlight current route
    const isCurrentPath = (fullPath: string) => location.pathname === fullPath;

    // Find the default route (index: true) within children
    const findDefaultRoute = (children: RouteObject[]): string | null => {
        const indexRoute = children.find((child) => child.index);
        return indexRoute ? indexRoute.path || '' : null;
    };

    // Render the routes recursively
    const renderRoutes = (routes: RouteObject[], parentPath = ''): JSX.Element[] => {
        return routes
            .filter((route) => !shouldIgnoreRoute(route.path))
            .map((route, idx) => {
                if (route.path === undefined && route.children) {
                    return <div key={idx}>{renderRoutes(route.children, parentPath)}</div>;
                }

                const fullPath = `${parentPath}/${route.path || ''}`.replace(/\/+/g, '/');

                if (route.children) {
                    const defaultChildPath = findDefaultRoute(route.children);
                    const defaultPath = `${fullPath}/${defaultChildPath}`.replace(/\/+/g, '/');

                    return (
                        <li key={idx} className="mb-2">
                            <div className="flex justify-between items-center">
                                <button
                                    className={`flex-grow text-left p-2 rounded-lg transition font-medium ${
                                        isCurrentPath(fullPath)
                                            ? 'bg-blue-500 text-white'
                                            : 'hover:bg-gray-700'
                                    }`}
                                    onClick={() => {
                                        if (defaultChildPath) {
                                            navigate(defaultPath);
                                        }
                                        toggleDropdown(fullPath);
                                    }}>
                                    {formatRouteName(route.path || '')}
                                </button>
                                <button
                                    className="p-2 text-gray-400 hover:text-white transition-transform transform duration-300"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDropdown(fullPath);
                                    }}>
                                    <span
                                        className={`inline-block transform transition-transform duration-300 ease-in-out ${
                                            openDropdowns.has(fullPath) ? '-rotate-180' : 'rotate-0'
                                        }`}>
                                        ▼
                                    </span>
                                </button>
                            </div>
                            <ul
                                className={`ml-4 border-l border-gray-700 pl-2 mt-2 transition-all duration-300 overflow-hidden ${
                                    openDropdowns.has(fullPath) ? 'max-h-screen' : 'max-h-0'
                                }`}>
                                {renderRoutes(route.children, fullPath)}
                            </ul>
                        </li>
                    );
                }

                return (
                    <li key={idx} className="mb-2">
                        <Link
                            to={fullPath}
                            className={`block p-2 rounded-lg transition font-medium ${
                                isCurrentPath(fullPath)
                                    ? 'bg-blue-500 text-white'
                                    : 'hover:bg-gray-700'
                            }`}>
                            {formatRouteName(route.path || 'Home')}
                        </Link>
                    </li>
                );
            });
    };

    return (
        <div
            className={`fixed h-page bg-gray-800 text-white shadow-lg transition-all duration-300 flex ${
                isCollapsed ? 'min-w-16' : 'max-w-64'
            }`}>
            {/* Left Section: Collapsible Navigation */}
            <div className={`flex-1 overflow-hidden ${isCollapsed ? 'max-w-0' : 'max-w-full'}`}>
                <nav className="h-full overflow-y-auto">
                    <ul className="p-4">{renderRoutes(AppRoutes)}</ul>
                </nav>
            </div>

            {/* Right Section: Collapse Button (Always Visible) */}
            <div className="w-16 flex justify-center items-center bg-gray-900">
                <button
                    onClick={() => onToggleCollapse()}
                    className="text-white p-3 rounded-full bg-blue-500 hover:bg-blue-700 transition-transform">
                    <p
                        className={`text-2xl transform transition-transform ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}>
                        ◀
                    </p>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
