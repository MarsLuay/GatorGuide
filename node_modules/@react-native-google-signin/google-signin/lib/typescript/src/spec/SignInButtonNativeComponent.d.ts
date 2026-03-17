/// <reference types="react-native/types/modules/Codegen" />
import type { HostComponent, ViewProps } from 'react-native';
import type { BubblingEventHandler, WithDefault, Int32 } from 'react-native/Libraries/Types/CodegenTypes';
interface EventParams {
}
interface NativeProps extends ViewProps {
    onPress?: BubblingEventHandler<EventParams>;
    disabled?: WithDefault<boolean, false>;
    color?: WithDefault<'dark' | 'light', 'light'>;
    size: Int32;
}
declare const _default: HostComponent<NativeProps>;
export default _default;
//# sourceMappingURL=SignInButtonNativeComponent.d.ts.map