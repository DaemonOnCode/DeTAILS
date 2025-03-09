export async function downloadCodebook(
    filteredData: any[],
    fileName?: string,
    _window: any = window
) {
    if (!filteredData.length) {
        return false;
    }

    // Build CSV rows
    const headers = ['Post ID', 'Sentence', 'Coded Word', 'Theme', 'Type'];
    const csvRows = [headers.join(',')];

    filteredData.forEach((row) => {
        if ('type' in row && 'theme' in row) {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","${row.theme || 'N/A'}","${row.type || 'N/A'}","${row.subCode || 'N/A'}"`
            );
        } else if ('theme' in row) {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","${row.theme || 'N/A'}","N/A","${row.subCode || 'N/A'}"`
            );
        } else if ('subCode' in row) {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","${row.theme || 'N/A'}","N/A","${row.subCode}"`
            );
        } else {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","N/A","N/A","N/A"`
            );
        }
    });

    const csvContent = csvRows.join('\n');

    // Use the File System Access API if available
    if (_window.showSaveFilePicker) {
        try {
            const options = {
                suggestedName: fileName ?? 'codebook.csv',
                types: [
                    {
                        description: 'CSV Files',
                        accept: { 'text/csv': ['.csv'] }
                    }
                ]
            };
            const handle = await _window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            return true;
        } catch (error) {
            console.error('File save cancelled or failed', error);
            return false;
        }
    } else {
        // Fallback: trigger a download via a hidden link.
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ?? 'codebook.csv';
        link.click();
        URL.revokeObjectURL(url);
        // Note: this fallback cannot reliably tell if the user saved or cancelled.
        return true;
    }
}
