/// <reference types="nativewind/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL: string;
    EXPO_PUBLIC_WEB_BASE: string;
  }
}
