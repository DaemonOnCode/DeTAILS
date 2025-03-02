import { ThemeBucket } from '../types/Coding/shared';

export const getThemeByCode = (code: string, themes: ThemeBucket[]) => {
    for (const themeObj of themes) {
        if (themeObj.codes.includes(code)) {
            return themeObj.name;
        }
    }
    return 'Unknown Theme';
};
