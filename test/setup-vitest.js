// Set up global mocks and configuration for tests
import '@testing-library/jest-dom';

// Set a polyfill for queueMicrotask which was used in your tests
if (!global.queueMicrotask) {
  global.queueMicrotask = setImmediate;
}