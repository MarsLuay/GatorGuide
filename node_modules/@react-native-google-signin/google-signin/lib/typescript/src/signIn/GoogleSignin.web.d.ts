import type { AddScopesParams, ConfigureParams, GetTokensResponse, HasPlayServicesParams, SignInParams, User } from '../types';
declare function signIn(_options?: SignInParams): Promise<User>;
declare function hasPlayServices(_options?: HasPlayServicesParams): Promise<boolean>;
declare function configure(_options: ConfigureParams): void;
declare function addScopes(_options: AddScopesParams): Promise<User | null>;
declare function signInSilently(): Promise<User>;
declare function signOut(): Promise<null>;
declare function revokeAccess(): Promise<null>;
declare function hasPreviousSignIn(): boolean;
declare function getCurrentUser(): User | null;
declare function clearCachedAccessToken(_tokenString: string): Promise<null>;
declare function getTokens(): Promise<GetTokensResponse>;
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
//# sourceMappingURL=GoogleSignin.web.d.ts.map