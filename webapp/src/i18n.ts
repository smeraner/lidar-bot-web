
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
        movement: 'Movement',
        lights: 'Lights',
        sensing: 'Sensing',
        logic: 'Logic',
        loops: 'Loops',
        math: 'Math',
        led_show: 'Flash Lights (Disco)',
        set_color: 'Set LED Color',
        dist_at_angle: 'distance at angle',
        is_obstacle: 'is obstacle between',
        and: 'and',
        threshold: 'threshold',
        distance: 'distance',
        bridge: 'Bridge',
        robot: 'Robot',
        robot_connected: 'Robot Connected',
        robot_disconnected: 'Robot Disconnected',
        robot_searching: 'Robot Searching...',
        pair: 'Pair Robot',
        stop_program: 'Stop',
        running_program: 'Program running...',
        program_finished: 'Program finished',
        program_stopped: 'Program stopped',
        program_error: 'Program error',
        connect_bt: '\u{1F535} Bluetooth',
        disconnect_bt: '\u{1F534} Disconnect BT',
        bridge_usb: 'USB',
        bridge_bt: 'BLE'
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
        movement: 'Bewegung',
        lights: 'Lichter',
        sensing: 'Sensorik',
        logic: 'Logik',
        loops: 'Schleifen',
        math: 'Mathe',
        led_show: 'Lichter blinken (Disco)',
        set_color: 'LED Farbe setzen',
        dist_at_angle: 'Abstand bei Winkel',
        is_obstacle: 'Hindernis zwischen',
        and: 'und',
        threshold: 'Schwellenwert',
        distance: 'Abstand',
        bridge: 'Bridge',
        robot: 'Robot',
        robot_connected: 'Robot verbunden',
        robot_disconnected: 'Robot getrennt',
        robot_searching: 'Suche Robot...',
        pair: 'Robot koppeln',
        stop_program: 'Stop',
        running_program: 'Programm läuft...',
        program_finished: 'Programm beendet',
        program_stopped: 'Programm gestoppt',
        program_error: 'Programmfehler',
        connect_bt: '\u{1F535} Bluetooth',
        disconnect_bt: '\u{1F534} BT Trennen',
        bridge_usb: 'USB',
        bridge_bt: 'BLE'
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
