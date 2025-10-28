import "@testing-library/jest-native/extend-expect";

jest.mock(
  "react-native/Libraries/Animated/NativeAnimatedHelper",
  () => ({}),
  { virtual: true }
);

jest.mock(
  "react-native/Libraries/Components/Keyboard/Keyboard",
  () => {
    const listeners = new Map();
    return {
      addListener: (evt, cb) => {
        if (!listeners.has(evt)) listeners.set(evt, new Set());
        listeners.get(evt).add(cb);
        return { remove: () => listeners.get(evt)?.delete(cb) };
      },
      dismiss: jest.fn(),
      __emit: (evt, payload = {}) => {
        for (const cb of listeners.get(evt) ?? []) cb(payload);
      },
    };
  },
  { virtual: true }
);

jest.mock(
  "react-native/Libraries/TurboModule/TurboModuleRegistry",
  () => ({
    get: () => ({}),
    getEnforcing: () => ({}),
  }),
  { virtual: true }
);

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }) => children,
  };
});
