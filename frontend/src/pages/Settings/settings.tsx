import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { SettingsLayout } from '../../components/Settings';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/Shared';

const SettingsPage = ({ authenticated }: { authenticated: boolean }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const previousUrl = location.state?.from || (authenticated ? `/${ROUTES.WORKSPACE}` : '/');

    console.log(previousUrl);
    const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let el = document.getElementById('portal-root');
        if (!el) {
            el = document.createElement('div');
            el.id = 'portal-root';
            document.body.appendChild(el);
        }
        setPortalElement(el);
    }, []);

    if (!portalElement) {
        return null;
    }

    const onBackClick = () => {
        navigate(previousUrl);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] bg-white">
            <SettingsLayout
                authenticated={authenticated}
                onBackClick={onBackClick}
                previousUrl={previousUrl}
            />
        </div>,
        portalElement
    );
};

export default SettingsPage;
