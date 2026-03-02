import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

const useFontLoader = () => {
    const { appFont } = useAppStore();

    useEffect(() => {
        if (!appFont) return;

        // Strip fallbacks for Google Fonts query (e.g. "'Inter', sans-serif" -> "Inter")
        let fontName = appFont.split(',')[0].replace(/['"]/g, '').trim();

        // Specific mappings or fallbacks
        if (fontName.toLowerCase() === 'system-ui' || fontName.toLowerCase() === 'sans-serif') {
            document.documentElement.style.setProperty('--sys-font-family', appFont);
            return;
        }

        const fontId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;

        // Check if font stylesheet already exists
        if (!document.getElementById(fontId)) {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            // Google Fonts URL format (e.g. Open Sans -> Open+Sans)
            link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800&display=swap`;
            document.head.appendChild(link);
        }

        // Apply it globally
        document.documentElement.style.setProperty('--sys-font-family', appFont);

    }, [appFont]);
};

export default useFontLoader;
