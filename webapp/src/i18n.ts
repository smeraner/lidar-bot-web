
export type Language = 'en' | 'de';

export const translations = {
    en: {
        title: 'LidarBot Control',
        connect: 'Connect LidarBot',
        connected: 'Connected',
        disconnect: 'Disconnect',
        run: 'Run Program',
        move: 'move',
        stop: 'stop',
        forward: 'forward',
        backward: 'backward',
        left: 'left',
        right: 'right',
        speed: 'speed',
        duration: 'duration',
        ms: 'ms',
    },
    de: {
        title: 'LidarBot Steuerung',
        connect: 'LidarBot verbinden',
        connected: 'Verbunden',
        disconnect: 'Trennen',
        run: 'Programm ausführen',
        move: 'bewegen',
        stop: 'stoppen',
        forward: 'vorwärts',
        backward: 'rückwärts',
        left: 'links',
        right: 'rechts',
        speed: 'Geschwindigkeit',
        duration: 'Dauer',
        ms: 'ms',
    }
};

function detectLanguage(): Language {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'en' || saved === 'de')) return saved;

    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'de') return 'de';
    
    return 'en'; // Default to English
}

let currentLanguage: Language = detectLanguage();
document.documentElement.lang = currentLanguage;

export function getLanguage(): Language {
    return currentLanguage;
}

export function setLanguage(lang: Language) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
}

export function t(key: keyof typeof translations['en']): string {
    return translations[currentLanguage][key] || key;
}
