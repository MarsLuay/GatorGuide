"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withGoogleUrlScheme = void 0;
const config_plugins_1 = require("expo/config-plugins");
const pkg = require('@react-native-google-signin/google-signin/package.json');
function validateOptions(options) {
    const messagePrefix = `google-sign-in without Firebase config plugin`;
    if (!options?.iosUrlScheme) {
        throw new Error(`${messagePrefix}: Missing \`iosUrlScheme\` in provided options: ${JSON.stringify(options)}`);
    }
    if (!options.iosUrlScheme.startsWith('com.googleusercontent.apps.')) {
        throw new Error(`${messagePrefix}: \`iosUrlScheme\` must start with "com.googleusercontent.apps": ${JSON.stringify(options)}`);
    }
}
const withGoogleSignInWithoutFirebase = (config, options) => {
    validateOptions(options);
    return (0, config_plugins_1.withPlugins)(config, [
        // iOS
        (cfg) => (0, exports.withGoogleUrlScheme)(cfg, options),
    ]);
};
const withGoogleUrlScheme = (config, options) => {
    return (0, config_plugins_1.withInfoPlist)(config, (config) => {
        const scheme = options.iosUrlScheme;
        const infoPlist = config.modResults;
        if (!config_plugins_1.IOSConfig.Scheme.hasScheme(scheme, infoPlist)) {
            config.modResults = config_plugins_1.IOSConfig.Scheme.appendScheme(scheme, infoPlist);
        }
        return config;
    });
};
exports.withGoogleUrlScheme = withGoogleUrlScheme;
/**
 * Apply google-signin configuration for Expo SDK 47+ projects. This plugin reads information from the Firebase config file.
 */
const withGoogleSignIn = (config) => {
    return (0, config_plugins_1.withPlugins)(config, [
        // Android
        config_plugins_1.AndroidConfig.GoogleServices.withClassPath,
        config_plugins_1.AndroidConfig.GoogleServices.withApplyPlugin,
        config_plugins_1.AndroidConfig.GoogleServices.withGoogleServicesFile,
        // iOS
        config_plugins_1.IOSConfig.Google.withGoogle,
        config_plugins_1.IOSConfig.Google.withGoogleServicesFile,
    ]);
};
const withGoogleSignInRoot = (config, options) => {
    return options
        ? withGoogleSignInWithoutFirebase(config, options)
        : withGoogleSignIn(config);
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(withGoogleSignInRoot, pkg.name, pkg.version);
