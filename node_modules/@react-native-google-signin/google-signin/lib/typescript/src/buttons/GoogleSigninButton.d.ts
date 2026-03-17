import React from 'react';
import { ViewProps } from 'react-native';
/**
 * @group React Components
 * */
export type GoogleSigninButtonProps = ViewProps & {
    size?: number;
    color?: 'dark' | 'light';
    disabled?: boolean;
    onPress?: () => void;
};
/**
 * @group React Components
 * */
export declare const GoogleSigninButton: {
    ({ onPress, style, color, size, ...rest }: GoogleSigninButtonProps): React.JSX.Element;
    Size: {
        Icon: number;
        Standard: number;
        Wide: number;
    };
    Color: {
        readonly Dark: "dark";
        readonly Light: "light";
    };
};
//# sourceMappingURL=GoogleSigninButton.d.ts.map