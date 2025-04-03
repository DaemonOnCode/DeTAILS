const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

const extraResourcePath =
    process.platform === 'win32'
        ? path.resolve(__dirname, '..', 'executables_windows')
        : path.resolve(__dirname, '..', 'executables');

module.exports = {
    hooks: {
        prePackage: async () => {
            console.log('Cleaning old builds...');
            const outDir = path.join(__dirname, 'out');
            const makeDir = path.join(__dirname, 'make');
            if (fs.existsSync(outDir)) {
                fs.rmSync(outDir, { recursive: true, force: true });
            }
            if (fs.existsSync(makeDir)) {
                fs.rmSync(makeDir, { recursive: true, force: true });
            }
        }
        // packageAfterPrune: async (forgeConfig, buildPath, electronVersion, platform, arch) => {
        //     forgeConfig.packagerConfig.extraResource =
        //         platform === 'win32'
        //             ? [path.resolve(__dirname, '..', 'executables_windows')]
        //             : [path.resolve(__dirname, '..', 'executables')];
        // }
    },
    packagerConfig: {
        name: 'DeTAILS',
        asar: true,
        appCategoryType: 'public.app-category.developer-tools',
        icon: 'public/details-icon',
        extraResource: [extraResourcePath]
    },
    rebuildConfig: {},
    makers: [
        // {
        //     name: '@electron-forge/maker-wix',
        //     platforms: ['win32'],
        //     config: {
        //         appIcon: 'public/favicon.ico',
        //         setupIcon: 'public/favicon.ico'
        //     }
        // },
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                setupIcon: 'public/favicon.ico',
                iconUrl: `file://${path.resolve(__dirname, 'public', 'favicon.ico')}`
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
