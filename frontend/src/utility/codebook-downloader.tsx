import { downloadFile } from './file-downloader';

export async function downloadCodebook(
    filteredData: any[],
    fileName?: string,
    _window: any = window
) {
    if (!filteredData.length) {
        return false;
    }

    function escapeCSV(value) {
        if (value == null) return '""';
        const str = String(value);
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
    }

    const optionalFields = ['theme', 'type', 'subCode'];
    const presentFields = new Set();
    filteredData.forEach((row) => {
        optionalFields.forEach((field) => {
            if (field in row) presentFields.add(field);
        });
    });

    const coreHeaders = ['Post ID', 'Quote', 'Code', 'Explanation'];
    const fieldToHeader = {
        theme: 'Theme',
        type: 'Type',
        subCode: 'Sub Code'
    };
    const optionalHeaders = Array.from(presentFields).map(
        (field) => fieldToHeader[field as string]
    );
    const headers = [...coreHeaders, ...optionalHeaders];

    const headerToValue = {
        'Post ID': (row) => row.postId,
        Quote: (row) => row.quote,
        Code: (row) => row.code ?? row.coded_word ?? '',
        Explanation: (row) => row.explanation,
        Theme: (row) => ('theme' in row ? row.theme : 'N/A'),
        Type: (row) => ('type' in row ? row.type : 'N/A'),
        'Sub Code': (row) => ('subCode' in row ? row.subCode : 'N/A')
    };

    const csvRows = [headers.join(',')];
    filteredData.forEach((row) => {
        const rowValues = headers.map((header) => escapeCSV(headerToValue[header](row)));
        csvRows.push(rowValues.join(','));
    });

    const csvContent = csvRows.join('\n');

    const success = await downloadFile(
        csvContent,
        fileName ?? 'codebook.csv',
        undefined,
        undefined,
        undefined,
        _window
    );
    return success;
}
