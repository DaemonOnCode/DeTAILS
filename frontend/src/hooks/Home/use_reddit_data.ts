import { useState, useContext } from 'react';
import { DataContext } from '../../context/data_context';
import { RedditPost } from '../../types/shared';
const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');

const useRedditData = () => {
    const dataContext = useContext(DataContext);
    const [data, setData] = useState<RedditPost[]>([]);
    const [error, setError] = useState<string | null>(null);

    const omitFirstIfMatchesStructure = (data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
            const firstElement = data[0];
            if (!firstElement.hasOwnProperty('id')) {
                return data.slice(1);
            }
        }
        return data;
    };

    const loadFolderData = async () => {
        try {
            const folderPath = await ipcRenderer.invoke('select-folder');
            dataContext.setModeInput(folderPath);

            const files: string[] = fs.readdirSync(folderPath);
            const jsonFiles = files
                .filter(
                    (file) =>
                        file.endsWith('.json') && !file.startsWith('._') && file.startsWith('RS')
                )
                .map((file) => {
                    const [prefix, datePart] = file.split('_');
                    const [year, month] = datePart.replace('.json', '').split('-');
                    return {
                        file,
                        type: prefix === 'RS' ? 'submission' : 'comment',
                        year: parseInt(year, 10),
                        month: parseInt(month, 10)
                    };
                })
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'submission' ? -1 : 1;
                    if (a.year !== b.year) return a.year - b.year;
                    return a.month - b.month;
                });

            const parsedData: RedditPost[] = [];
            jsonFiles.forEach(({ file }) => {
                try {
                    const filePath = path.join(folderPath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const data = JSON.parse(content);

                    parsedData.push(...omitFirstIfMatchesStructure(data));
                } catch (error) {
                    console.error(`Failed to parse file ${file}:`, error);
                }
            });

            setData(parsedData);
            setError(null);
        } catch (error) {
            console.error('Failed to load folder:', error);
            setError('Failed to load folder.');
        }
    };

    return { data, error, loadFolderData };
};

export default useRedditData;
