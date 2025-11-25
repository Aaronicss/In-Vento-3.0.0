import 'dotenv/config';

export default {
  expo: {
    name: 'In-Vento App',
    slug: 'in-vento',
    owner: "eyyyronnn",
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'mynewproject',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.aaronics.invento',
    },
    updates: {
      url: "https://u.expo.dev/7ad98b8f-53ca-45c3-8d21-cc12ce021f9d"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      "expo-secure-store",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '7ad98b8f-53ca-45c3-8d21-cc12ce021f9d',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      weatherCity: process.env.EXPO_PUBLIC_WEATHER_CITY,
      weatherApiKey: process.env.EXPO_PUBLIC_WEATHER_API_KEY,
      
    },
    
  },
  
};
