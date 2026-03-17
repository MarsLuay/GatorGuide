"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockGoogleSignInResponse = exports.mockUserInfo = void 0;
exports.mockUserInfo = Object.freeze({
    idToken: 'mockIdToken',
    serverAuthCode: 'mockServerAuthCode',
    scopes: [],
    user: {
        email: 'mockEmail',
        id: 'mockId',
        givenName: 'mockGivenName',
        familyName: 'mockFamilyName',
        photo: null,
        name: 'mockFullName',
    },
});
exports.mockGoogleSignInResponse = Object.freeze({
    type: 'success',
    data: exports.mockUserInfo,
});
function mockFactory() {
    const mockNativeModule = Object.freeze({
        configure: jest.fn(),
        playServicesAvailable: jest.fn().mockReturnValue(true),
        getTokens: jest
            .fn()
            .mockResolvedValue({
            accessToken: 'mockAccessToken',
            idToken: 'mockIdToken',
        }),
        signIn: jest.fn().mockResolvedValue(exports.mockUserInfo),
        signInSilently: jest
            .fn()
            .mockResolvedValue(exports.mockUserInfo),
        revokeAccess: jest.fn().mockResolvedValue(null),
        signOut: jest.fn().mockResolvedValue(null),
        // enableAppCheck: jest.fn().mockResolvedValue(null),
        hasPreviousSignIn: jest.fn().mockReturnValue(true),
        addScopes: jest
            .fn()
            .mockImplementation(({ scopes }) => {
            const userWithScopes = {
                ...exports.mockUserInfo,
                scopes,
            };
            return Promise.resolve(userWithScopes);
        }),
        getCurrentUser: jest
            .fn()
            .mockReturnValue(exports.mockUserInfo),
        clearCachedAccessToken: jest.fn().mockResolvedValue(null),
        getConstants: jest
            .fn()
            .mockReturnValue({
            SIGN_IN_CANCELLED: 'mock_SIGN_IN_CANCELLED',
            IN_PROGRESS: 'mock_IN_PROGRESS',
            PLAY_SERVICES_NOT_AVAILABLE: 'mock_PLAY_SERVICES_NOT_AVAILABLE',
            SIGN_IN_REQUIRED: 'mock_SIGN_IN_REQUIRED',
            SCOPES_ALREADY_GRANTED: 'mock_SCOPES_ALREADY_GRANTED',
            NO_SAVED_CREDENTIAL_FOUND: 'mock_NO_SAVED_CREDENTIAL_FOUND',
            BUTTON_SIZE_ICON: 2,
            BUTTON_SIZE_WIDE: 1,
            BUTTON_SIZE_STANDARD: 0,
            // one-tap specific constants
            ONE_TAP_START_FAILED: 'mock_ONE_TAP_START_FAILED',
        }),
    });
    return {
        NativeModule: mockNativeModule,
    };
}
// mock very close to native module to be able to test JS logic too
jest.mock('../src/spec/NativeGoogleSignin', () => mockFactory());
// the following are for jest testing outside of the library, where the paths are different
// alternative is to use moduleNameMapper in user space
const mockModulePaths = ['../../../lib/module/spec/NativeGoogleSignin'];
mockModulePaths.forEach((path) => {
    try {
        require.resolve(path);
        jest.mock(path, () => mockFactory());
    }
    catch (error) {
        if ('code' in error && error.code === 'MODULE_NOT_FOUND') {
            if (!process.env.SILENCE_MOCK_NOT_FOUND) {
                console.warn(`Unable to resolve ${path}`);
            }
        }
        else {
            throw error;
        }
    }
});
