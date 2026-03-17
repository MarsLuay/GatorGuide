import { AddScopesParams, CancelledResponse, ConfigureParams, GetTokensResponse, HasPlayServicesParams, NoSavedCredentialFound, SignInParams, User } from '../types';
declare function configure(options?: ConfigureParams): void;
/**
 * The response object when the user signs in successfully.
 *
 * @group Original Google sign in
 * */
export type SignInSuccessResponse = {
    type: 'success';
    /**
     * The user details.
     * */
    data: User;
};
/**
 * @group Original Google sign in
 * */
export type SignInResponse = SignInSuccessResponse | CancelledResponse;
declare function signIn(options?: SignInParams): Promise<SignInResponse>;
declare function hasPlayServices(options?: HasPlayServicesParams): Promise<boolean>;
declare function addScopes(options: AddScopesParams): Promise<SignInResponse | null>;
/**
 * The response object for calling `signInSilently`. Either the user details are available (without user interaction) or there was no saved credential found.
 * @group Original Google sign in
 * */
export type SignInSilentlyResponse = SignInSuccessResponse | NoSavedCredentialFound;
declare function signInSilently(): Promise<SignInSilentlyResponse>;
declare function signOut(): Promise<null>;
declare function revokeAccess(): Promise<null>;
declare function hasPreviousSignIn(): boolean;
declare function getCurrentUser(): User | null;
declare function clearCachedAccessToken(tokenString: string): Promise<null>;
declare function getTokens(): Promise<GetTokensResponse>;
/**
 * The entry point of the Google Sign In API, exposed as `GoogleSignin`.
 * @group Original Google sign in
 * */
export declare const GoogleSignin: {
    hasPlayServices: typeof hasPlayServices;
    configure: typeof configure;
    signIn: typeof signIn;
    addScopes: typeof addScopes;
    signInSilently: typeof signInSilently;
    signOut: typeof signOut;
    revokeAccess: typeof revokeAccess;
    hasPreviousSignIn: typeof hasPreviousSignIn;
    getCurrentUser: typeof getCurrentUser;
    clearCachedAccessToken: typeof clearCachedAccessToken;
    getTokens: typeof getTokens;
};
export {};
//# sourceMappingURL=GoogleSignin.d.ts.map