/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare const __BUILD_ID__: string;
