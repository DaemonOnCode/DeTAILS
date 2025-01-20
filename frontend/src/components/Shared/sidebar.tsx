import { FC, useState, useEffect } from 'react';
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
    // 'cleaning',
    // 'modeling',
    'basis',
    'flashcards',
    'word-cloud',
    'coding-validation',
    'transcript/:id/:state'
];

const Sidebar: FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

    // Toggle dropdown visibility
    const toggleDropdown = (path: string) => {
        // console.log('Toggling dropdown:', path);
        setOpenDropdowns((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
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
        if (indexRoute) {
            return indexRoute.path || '';
        }
        return null;
    };

    // useEffect(() => {
    //     console.log('Current location:', location.pathname);
    //     console.log('Open dropdowns:', openDropdowns);
    // }, [location]);

    // Render the routes
    const renderRoutes = (routes: RouteObject[], parentPath = ''): JSX.Element[] => {
        return routes
            .filter((route) => !shouldIgnoreRoute(route.path)) // Filter ignored routes
            .map((route, idx) => {
                if (route.path === undefined && route.children) {
                    return <div key={idx}>{renderRoutes(route.children, parentPath)}</div>;
                }

                const fullPath = `${parentPath}/${route.path || ''}`.replace(/\/+/g, '/');
                // console.log('Full path:', fullPath);

                // Skip "Home" from dropdown and display it as a standalone link
                if (formatRouteName(route.path || '') === 'Home') {
                    return (
                        <li key={idx} className="mb-2">
                            <Link
                                to={fullPath}
                                className={`block p-2 rounded-lg transition font-medium ${
                                    isCurrentPath(fullPath)
                                        ? 'bg-blue-500 text-white'
                                        : 'hover:bg-gray-700'
                                }`}>
                                Home
                            </Link>
                        </li>
                    );
                }

                if (route.children) {
                    const defaultChildPath = findDefaultRoute(route.children);

                    const defaultPath = `${fullPath}/${defaultChildPath}`.replace(/\/+/g, '/');
                    return (
                        <li key={idx} className="mb-2">
                            <div className="flex justify-between items-center">
                                {/* Clickable parent route text */}
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
                                        console.log('Navigating to:', fullPath);
                                        toggleDropdown(fullPath);
                                    }}>
                                    {formatRouteName(route.path || '')}
                                </button>

                                {/* Dropdown toggle button */}
                                <button
                                    className="p-2 text-gray-400 hover:text-white transition-transform transform duration-300"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent navigation when toggling
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

                            {/* Dropdown content */}
                            <ul
                                className={`ml-4 border-l border-gray-700 pl-2 mt-2 transition-all duration-300 overflow-hidden ${
                                    openDropdowns.has(fullPath) ? 'max-h-screen' : 'max-h-0'
                                }`}>
                                {renderRoutes(route.children, fullPath)}
                            </ul>
                        </li>
                    );
                }

                // Render normal route links
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
        <div className="sidebar w-48 h-page bg-gray-800 text-white fixed overflow-y-auto shadow-lg">
            <nav>
                <ul className="p-4">{renderRoutes(AppRoutes)}</ul>
            </nav>
        </div>
    );
};

export default Sidebar;
