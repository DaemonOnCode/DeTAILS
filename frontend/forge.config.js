const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
    hooks: {
        prePackage: async () => {
            const { execSync } = require('child_process');
            console.log('Cleaning old builds...');
            execSync('rm -rf out/ make/', { stdio: 'inherit' });
        }
        // preMake: async () => {
        //     const { execSync } = require('child_process');
        //     console.log('Cleaning old builds before making...');
        //     execSync('rm -rf out/ make/', { stdio: 'inherit' });
        // }
    },
    packagerConfig: {
        name: 'DeTAILS',
        asar: true,
        appCategoryType: 'public.app-category.developer-tools',
        icon: 'public/details-icon',
        extraResource: [path.resolve(__dirname, '..', 'executables')]
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                setupIcon: 'public/favicon.ico'
            }
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin', 'linux', 'win32']
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                // background: './public/acqa-icon.icns',
                format: 'ULFO',
                icon: 'public/details-icon.icns',
                overwrite: true,
                additionalDMGOptions: {
                    icon: 'public/details-icon.icns' // Volume icon
                }
            }
        },
        {
            name: '@electron-forge/maker-deb',
            config: {
                options: {
                    maintainer: 'Ansh Sharma',
                    categories: ['Utility'],
                    icon: 'public/details-icon.png',
                    section: 'utility'
                }
            }
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {
                options: {
                    summary: 'DeTAILS',
                    description: 'A developer tool for CTA',
                    license: 'MIT',
                    group: 'Development',
                    icon: 'public/details-icon.png'
                }
            }
        }
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {}
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true
        })
    ]
};
