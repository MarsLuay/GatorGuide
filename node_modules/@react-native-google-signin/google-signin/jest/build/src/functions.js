"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSuccessResponse = exports.isNoSavedCredentialFoundResponse = exports.isCancelledResponse = exports.isErrorWithCode = void 0;
/**
 * TypeScript helper to check if an object has the `code` property.
 * This is used to avoid `as` casting when you access the `code` property on errors returned by the module.
 */
const isErrorWithCode = (error) => {
    // to account for https://github.com/facebook/react-native/issues/41950
    // fixed in https://github.com/facebook/react-native/commit/9525074a194b9cf2b7ef8ed270978e3f7f2c41f7 0.74
    const isNewArchErrorIOS = typeof error === 'object' && error != null;
    return (error instanceof Error || isNewArchErrorIOS) && 'code' in error;
};
exports.isErrorWithCode = isErrorWithCode;
/**
 * TypeScript helper to check if a response is a `cancelled` response. This is the same as checking if the `response.type === "cancelled"`.
 *
 * Use this if you prefer to use a function instead of comparing with a raw string.
 *
 * It supports both One Tap and Original Google Sign In responses.
 *
 * @example
 * ```ts
 * const response = await GoogleOneTapSignIn.createAccount();
 *
 * if (isCancelledResponse(response)) {
 *   // handle cancelled response
 * }
 * ```
 */
function isCancelledResponse(response) {
    return response.type === 'cancelled';
}
exports.isCancelledResponse = isCancelledResponse;
/**
 * TypeScript helper to check if a response is a `noSavedCredentialFound` response. This is the same as checking if the `response.type === "noSavedCredentialFound"`.
 *
 * Use this if you prefer to use a function instead of comparing with a raw string.
 *
 * It supports both One Tap and Original Google Sign In responses.
 *
 * @example
 * ```ts
 * const response = await GoogleOneTapSignIn.signIn();
 *
 * if (isNoSavedCredentialFoundResponse(response)) {
 *   // the case when no user was previously signed in
 * }
 * ```
 */
function isNoSavedCredentialFoundResponse(response) {
    return response.type === 'noSavedCredentialFound';
}
exports.isNoSavedCredentialFoundResponse = isNoSavedCredentialFoundResponse;
/**
 * TypeScript helper to check if a response is a `cancelled` response. This is the same as checking if the `response.type === "success"`.
 *
 * Use this if you prefer to use a function instead of comparing with a raw string.
 *
 * It supports both One Tap and Original Google Sign In responses.
 *
 * @example
 * ```ts
 * const response = await GoogleOneTapSignIn.createAccount();
 *
 * if (isSuccessResponse(response)) {
 *   // handle user signed in
 * }
 * ```
 */
function isSuccessResponse(response) {
    return response.type === 'success';
}
exports.isSuccessResponse = isSuccessResponse;
