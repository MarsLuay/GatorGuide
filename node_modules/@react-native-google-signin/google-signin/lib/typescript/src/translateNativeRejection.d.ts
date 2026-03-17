/**
 * Since the introduction of a new JS api, the native rejections need to be processed in JS layer.
 *
 * This is easier than reworking 2 native modules
 **/
export declare function translateCancellationError(e: unknown): Readonly<{
    type: "cancelled";
    data: null;
}>;
//# sourceMappingURL=translateNativeRejection.d.ts.map