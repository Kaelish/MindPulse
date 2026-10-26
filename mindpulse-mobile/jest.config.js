module.exports = {
  preset: '@react-native/jest-preset',
  // Unit tests live next to the service they cover. Screen rendering is left to
  // the manual/device pass because Expo native modules need a device host.
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  },
};
