const mockReactNativeUrl = new URL('./mocks/react-native.js', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') {
    return {
      url: mockReactNativeUrl,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
