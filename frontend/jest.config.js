module.exports = {
  preset: "react-native",
  testEnvironment: "jsdom",
  setupFiles: [
    "<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js",
  ],
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect",
    "<rootDir>/jest.setup.js",
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|react-native-vector-icons|@react-navigation|@10play))",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
};
