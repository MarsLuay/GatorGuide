"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleSigninButton = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const SignInButtonNativeComponent_1 = __importDefault(require("../spec/SignInButtonNativeComponent"));
const NativeGoogleSignin_1 = require("../spec/NativeGoogleSignin");
const statics_1 = require("./statics");
const { BUTTON_SIZE_WIDE, BUTTON_SIZE_ICON, BUTTON_SIZE_STANDARD } = NativeGoogleSignin_1.NativeModule.getConstants();
/**
 * @group React Components
 * */
const GoogleSigninButton = ({ onPress, style, color, size = BUTTON_SIZE_STANDARD, ...rest }) => {
    const activeColorScheme = (0, react_native_1.useColorScheme)();
    const usedColor = color ?? activeColorScheme ?? 'light';
    const recommendedSize = getSizeStyle(size);
    const stripOnPressParams = (0, react_1.useCallback)(() => {
        // this is to make sure that the onPress callback prop is called with no params
        // as the RNGoogleSigninButton onPress does pass some in here
        onPress?.();
    }, [onPress]);
    return (react_1.default.createElement(SignInButtonNativeComponent_1.default, { ...rest, size: size, onPress: stripOnPressParams, color: usedColor, style: react_native_1.StyleSheet.compose(recommendedSize, style) }));
};
exports.GoogleSigninButton = GoogleSigninButton;
const nativeSizes = {
    Icon: BUTTON_SIZE_ICON,
    Standard: BUTTON_SIZE_STANDARD,
    Wide: BUTTON_SIZE_WIDE,
};
exports.GoogleSigninButton.Size = nativeSizes;
exports.GoogleSigninButton.Color = statics_1.Color;
function getSizeStyle(size) {
    switch (size) {
        case BUTTON_SIZE_ICON:
            return styles.iconSize;
        case BUTTON_SIZE_WIDE:
            return styles.wideSize;
        default:
            return styles.standardSize;
    }
}
// sizes according to https://developers.google.com/identity/sign-in/ios/reference/Classes/GIDSignInButton
const styles = react_native_1.StyleSheet.create({
    iconSize: {
        width: 48,
        height: 48,
    },
    standardSize: { width: 230, height: 48 },
    wideSize: { width: 312, height: 48 },
});
