"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSignin = void 0;
const react_native_1 = require("react-native");
const NativeGoogleSignin_1 = require("../spec/NativeGoogleSignin");
const errorCodes_1 = require("../errors/errorCodes");
const constants_1 = require("../constants");
const translateNativeRejection_1 = require("../translateNativeRejection");
const functions_1 = require("../functions");
let configPromise = Promise.resolve();
function configure(options = {}) {
    if (options.offlineAccess && !options.webClientId) {
        throw new Error('RNGoogleSignin: offline use requires server web ClientID');
    }
    if (__DEV__ && 'androidClientId' in options) {
        console.error('RNGoogleSignIn: `androidClientId` is not a valid configuration parameter, please remove it.');
    }
    configPromise = NativeGoogleSignin_1.NativeModule.configure(options);
}
async function signIn(options = {}) {
    await configPromise;
    try {
        const user = (await NativeGoogleSignin_1.NativeModule.signIn(options));
        return createSuccessResponse(user);
    }
    catch (err) {
        return (0, translateNativeRejection_1.translateCancellationError)(err);
    }
}
async function hasPlayServices(options) {
    if (react_native_1.Platform.OS === 'ios') {
        return true;
    }
    else {
        if (process.env.NODE_ENV !== 'production') {
            if (options && options.showPlayServicesUpdateDialog === undefined) {
                throw new Error('RNGoogleSignin: Missing property `showPlayServicesUpdateDialog` in options object for `hasPlayServices`');
            }
        }
        return NativeGoogleSignin_1.NativeModule.playServicesAvailable(options?.showPlayServicesUpdateDialog !== false);
    }
}
async function addScopes(options) {
    if (react_native_1.Platform.OS === 'ios') {
        try {
            const user = (await NativeGoogleSignin_1.NativeModule.addScopes(options));
            if (!user) {
                return null;
            }
            return createSuccessResponse(user);
        }
        catch (err) {
            if ((0, functions_1.isErrorWithCode)(err) &&
                err.code === errorCodes_1.ios_only_SCOPES_ALREADY_GRANTED) {
                // return the scopes that are already granted
                const user = exports.GoogleSignin.getCurrentUser();
                if (!user) {
                    return null;
                }
                return createSuccessResponse(user);
            }
            return (0, translateNativeRejection_1.translateCancellationError)(err);
        }
    }
    else {
        // false if no user is signed in
        const hasUser = await NativeGoogleSignin_1.NativeModule.addScopes(options);
        if (!hasUser) {
            return null;
        }
        // on Android, the user returned in onActivityResult() will contain only the scopes added, not the ones present previously
        // we work around it by calling signInSilently() which returns the user object with all scopes
        // @ts-expect-error `noSavedCredentialFound` is not possible here, because we just added scopes
        return signInSilently();
    }
}
async function signInSilently() {
    try {
        await configPromise;
        const user = (await NativeGoogleSignin_1.NativeModule.signInSilently());
        return createSuccessResponse(user);
    }
    catch (err) {
        if ((0, functions_1.isErrorWithCode)(err) && err.code === errorCodes_1.SIGN_IN_REQUIRED_CODE) {
            return constants_1.noSavedCredentialFoundResult;
        }
        throw err;
    }
}
async function signOut() {
    return NativeGoogleSignin_1.NativeModule.signOut();
}
async function revokeAccess() {
    return NativeGoogleSignin_1.NativeModule.revokeAccess();
}
function hasPreviousSignIn() {
    return NativeGoogleSignin_1.NativeModule.hasPreviousSignIn();
}
function getCurrentUser() {
    return NativeGoogleSignin_1.NativeModule.getCurrentUser();
}
async function clearCachedAccessToken(tokenString) {
    if (!tokenString || typeof tokenString !== 'string') {
        return Promise.reject('GoogleSignIn: clearCachedAccessToken() expects a string token.');
    }
    return react_native_1.Platform.OS === 'ios'
        ? null
        : NativeGoogleSignin_1.NativeModule.clearCachedAccessToken(tokenString);
}
async function getTokens() {
    if (react_native_1.Platform.OS === 'ios') {
        return NativeGoogleSignin_1.NativeModule.getTokens();
    }
    else {
        const userObject = await NativeGoogleSignin_1.NativeModule.getTokens();
        return {
            idToken: userObject.idToken,
            accessToken: userObject.accessToken,
        };
    }
}
const createSuccessResponse = (data) => ({
    type: 'success',
    data,
});
/**
 * The entry point of the Google Sign In API, exposed as `GoogleSignin`.
 * @group Original Google sign in
 * */
exports.GoogleSignin = {
    hasPlayServices,
    configure,
    signIn,
    addScopes,
    signInSilently,
    signOut,
    revokeAccess,
    hasPreviousSignIn,
    getCurrentUser,
    clearCachedAccessToken,
    getTokens,
};
