export default {
  expo: {
    name: "Mania",
    slug: "mania-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mania.app",
      infoPlist: {
        UIBackgroundModes: ["audio"],
        NSPhotoLibraryUsageDescription: "Mania needs access to your photos to add images to your journal entries.",
        NSPhotoLibraryAddUsageDescription: "Mania needs access to save photos to your library."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000"
      },
      package: "com.mania.app"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      openaiApiKey: process.env.OPENAI_API_KEY,
    },
    plugins: [
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/zain.ttf",
            "./assets/fonts/titles.ttf",
            "./assets/fonts/alt.ttf"
          ]
        }
      ]
    ]
  }
};
