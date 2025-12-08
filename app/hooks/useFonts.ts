import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

export default function useFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        'ZainCustomFont': require('../../assets/fonts/zain.ttf'),
        'TitleFont': require('../../assets/fonts/titles.ttf'),
        'LibreBaskerville': require('../../assets/fonts/alt.ttf'),
      });
      setFontsLoaded(true);
    }

    loadFonts();
  }, []);

  return fontsLoaded;
}
