export function downloadCodebook(filteredData: any[]) {
    const headers = ['Post ID', 'Sentence', 'Coded Word', 'Theme', 'Type'];
    const csvRows = [headers.join(',')];

    filteredData.forEach((row) => {
        if ('type' in row && 'theme' in row) {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","${row.theme || 'N/A'}","${row.type || 'N/A'}"`
            );
        } else if ('theme' in row) {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","${row.theme || 'N/A'}","N/A"`
            );
        } else {
            csvRows.push(
                `${row.postId},"${row.quote}","${row.code ?? row.coded_word ?? ''}","N/A","N/A"`
            );
        }
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'codebook.csv';
    link.click();
    URL.revokeObjectURL(url);
}
