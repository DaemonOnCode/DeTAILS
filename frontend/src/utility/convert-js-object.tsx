// Helper function to convert JSON to CSV
const convertToCSV = (data: Record<string, any>[]) => {
    if (!data || !data.length) return '';

    const headers = Object.keys(data[0]); // Get all headers
    const rows = data.map((row) =>
        headers
            .map((header) => {
                const value = row[header];

                if (Array.isArray(value)) {
                    return `"${value.join(', ')}"`; // Serialize arrays
                } else if (typeof value === 'boolean') {
                    return `"${value ? 'true' : 'false'}"`; // Convert booleans
                } else if (value && typeof value === 'object') {
                    return `"${JSON.stringify(value)}"`; // Serialize objects
                }

                return `"${value || ''}"`; // Handle strings, numbers, or null/undefined
            })
            .join(',')
    );

    return [headers.join(','), ...rows].join('\n'); // Combine headers and rows
};

// Save CSV file
export const saveCSV = async (renderer: any, data: Record<string, any>[], fileName = 'data') => {
    const csvContent = convertToCSV(data); // Convert JSON data to CSV
    const result = await renderer.invoke('save-csv', { data: csvContent, fileName });

    if (result.success) {
        console.log('File saved:', result.filePath);
    } else {
        console.error('File save error:', result.message);
    }
};

// Save Excel file
export const saveExcel = async (renderer: any, data: Record<string, any>[], fileName = 'data') => {
    const result = await renderer.invoke('save-excel', { data, fileName });

    if (result.success) {
        console.log('File saved:', result.filePath);
    } else {
        console.error('File save error:', result.message);
    }
};
