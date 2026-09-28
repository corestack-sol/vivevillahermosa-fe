declare module 'libheif-js/wasm-bundle' {
  interface LibheifHeifImage {
    get_width(): number;
    get_height(): number;
    display(imageData: ImageData, callback: (resultado: ImageData | null) => void): void;
    free(): void;
  }
  interface LibheifDecoderInstance {
    decode(bytes: Uint8Array): LibheifHeifImage[];
  }
  interface LibheifModule {
    HeifDecoder: new () => LibheifDecoderInstance;
  }
  const libheif: LibheifModule;
  export default libheif;
}
