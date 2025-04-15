const convertToCSV = (data: Record<string, any>[]) => {
    if (!data || !data.length) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
        headers
            .map((header) => {
                const value = row[header];

                if (Array.isArray(value)) {
                    return `"${value.join(', ')}"`;
                } else if (typeof value === 'boolean') {
                    return `"${value ? 'true' : 'false'}"`;
                } else if (value && typeof value === 'object') {
                    return `"${JSON.stringify(value)}"`;
                }

                return `"${value || ''}"`;
            })
            .join(',')
    );

    return [headers.join(','), ...rows].join('\n');
};

export const saveCSV = async (renderer: any, data: Record<string, any>[], fileName = 'data') => {
    const csvContent = convertToCSV(data);
    const result = await renderer.invoke('save-csv', { data: csvContent, fileName });

    if (result.success) {
        console.log('File saved:', result.filePath);
    } else {
        console.error('File save error:', result.message);
    }
};

export const saveExcel = async (renderer: any, data: Record<string, any>[], fileName = 'data') => {
    const result = await renderer.invoke('save-excel', { data, fileName });

    if (result.success) {
        console.log('File saved:', result.filePath);
    } else {
        console.error('File save error:', result.message);
    }
};
