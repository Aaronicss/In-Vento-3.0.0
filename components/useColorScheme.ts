// Force the app to use light mode globally.
// Returning the string literal keeps existing call sites working
// which expect a value like 'light' | 'dark' | undefined.
export function useColorScheme() {
	return 'light';
}
