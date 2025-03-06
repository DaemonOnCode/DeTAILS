import { GroupedCodeBucket, ThemeBucket } from '../types/Coding/shared';

export const getThemeByCode = (
    code: string,
    themes: ThemeBucket[],
    groupedCodes: GroupedCodeBucket[]
) => {
    for (const themeObj of themes) {
        if (themeObj.codes.includes(getGroupedCodeOfSubCode(code, groupedCodes))) {
            return themeObj.name;
        }
    }
    return 'Unknown Theme';
};

export const getGroupedCodeOfSubCode = (subCode: string, groupedCodes: GroupedCodeBucket[]) => {
    for (const group of groupedCodes) {
        if (group.codes.includes(subCode)) {
            return group.name;
        }
    }
    return 'Unknown Code';
};
