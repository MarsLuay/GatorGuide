import type { TurboModule } from 'react-native';
import type { GetTokensResponse } from '../types';
export interface Spec extends TurboModule {
    signIn(params: Object): Promise<Object>;
    configure(params: Object): Promise<void>;
    addScopes(params: Object): Promise<Object | null>;
    playServicesAvailable(showPlayServicesUpdateDialog: boolean): Promise<boolean>;
    signInSilently(): Promise<Object>;
    signOut(): Promise<null>;
    revokeAccess(): Promise<null>;
    clearCachedAccessToken(tokenString: string): Promise<null>;
    hasPreviousSignIn(): boolean;
    getCurrentUser(): Object | null;
    getTokens(): Promise<GetTokensResponse>;
    getConstants(): {
        SIGN_IN_CANCELLED: string;
        IN_PROGRESS: string;
        PLAY_SERVICES_NOT_AVAILABLE: string;
        SIGN_IN_REQUIRED: string;
        SCOPES_ALREADY_GRANTED: string;
        BUTTON_SIZE_ICON: number;
        BUTTON_SIZE_WIDE: number;
        BUTTON_SIZE_STANDARD: number;
        ONE_TAP_START_FAILED: string;
        NO_SAVED_CREDENTIAL_FOUND: string;
    };
}
export declare const NativeModule: Spec;
//# sourceMappingURL=NativeGoogleSignin.d.ts.map