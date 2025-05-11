import { toast } from 'react-toastify';
import { FetchResponse } from '../hooks/Shared/use-api';
import { Workspace } from '../types/Shared';

export async function downloadFile(
    content: string,
    fileName: string,
    mimeType: string = 'text/csv',
    fileDescription: string = 'CSV Files',
    acceptedExtensions: string[] = ['.csv'],
    _window: any = window
): Promise<boolean> {
    if (_window.showSaveFilePicker) {
        try {
            const options = {
                suggestedName: fileName,
                types: [
                    {
                        description: fileDescription,
                        accept: { [mimeType]: acceptedExtensions }
                    }
                ]
            };
            const handle = await _window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (error) {
            console.error('File save cancelled or failed', error);
            return false;
        }
    } else {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
        const url = _window.URL.createObjectURL(blob);
        const link = _window.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        _window.URL.revokeObjectURL(url);
        return true;
    }
}

export const downloadFileWithStreaming = async (
    fetchData: (route: string, options?: RequestInit) => Promise<FetchResponse<any>>,
    route,
    payload,
    suggestedName,
    fileType = { description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }
) => {
    let fileHandle;
    const _window = window as any;

    if (_window.showSaveFilePicker) {
        try {
            fileHandle = await _window.showSaveFilePicker({
                suggestedName,
                types: [fileType]
            });
        } catch (error) {
            console.error('File save cancelled or failed', error);
            return false;
        }
    }

    try {
        const { data, error } = await fetchData(route, {
            method: 'POST',
            body: JSON.stringify(payload),
            // @ts-ignore
            rawResponse: true
        });

        if (error) {
            console.error('Error fetching data:', error);
            return false;
        }

        if (fileHandle) {
            const writable = await fileHandle.createWritable();
            try {
                await data.body.pipeTo(writable);
                return true;
            } catch (pipeError) {
                console.error('Error piping stream:', pipeError);
                return false;
            }
        } else {
            const content = await data.text();
            const blob = new Blob([content], { type: Object.keys(fileType.accept)[0] });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = suggestedName;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Download started');
            return true;
        }
    } catch (err) {
        console.error('Download error', err);
        return false;
    }
};

export const generateUniqueFileName = (baseName: string, workspace: Workspace): string => {
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    return `${workspace.name}_${baseName}_${timestamp}`;
};
