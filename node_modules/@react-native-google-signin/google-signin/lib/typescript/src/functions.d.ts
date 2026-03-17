import type { CancelledResponse, NativeModuleError, NoSavedCredentialFound } from './types';
import type { SignInResponse, SignInSilentlyResponse, SignInSuccessResponse } from './signIn/GoogleSignin';
/**
 * TypeScript helper to check if an object has the `code` property.
 * This is used to avoid `as` casting when you access the `code` property on errors returned by the module.
 */
export declare const isErrorWithCode: (error: any) => error is NativeModuleError;
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
export declare function isCancelledResponse(response: SignInResponse): response is CancelledResponse;
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
export declare function isNoSavedCredentialFoundResponse(response: SignInSilentlyResponse): response is NoSavedCredentialFound;
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
export declare function isSuccessResponse(response: SignInResponse): response is SignInSuccessResponse;
//# sourceMappingURL=functions.d.ts.map