import { useCallback } from 'react';
import { REMOTE_SERVER_BASE_URL } from '../../constants/Shared';
import { useAuth } from '../../context/auth-context';

const useServerUtils = () => {
    const { remoteProcessing } = useAuth();
    const getServerUrl = useCallback(
        (route: string) => {
            return `${REMOTE_SERVER_BASE_URL[!remoteProcessing ? 'local' : 'remote']}/${route}`;
        },
        [REMOTE_SERVER_BASE_URL]
    );
    return { getServerUrl };
};

export default useServerUtils;
