import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { SettingsLayout } from '../../components/Settings';

const SettingsPage = ({ authenticated }: { authenticated: boolean }) => {
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

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[200] bg-white">
            <SettingsLayout authenticated={authenticated} />
        </div>,
        portalElement
    );
};

export default SettingsPage;
