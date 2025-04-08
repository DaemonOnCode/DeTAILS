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
