export type Language = 'en' | 'de';

export const translations = {
  en: {
    title: 'LidarBot Control',
    connect: 'Connect LidarBot',
    connected: 'Connected',
    disconnect: 'Disconnect',
    run_live: 'Run Live',
    run_sim: 'Run Simulation',
    move: 'move',
    stop: 'stop',
    forward: 'forward',
    backward: 'backward',
    left: 'left',
    right: 'right',
    rotate: 'rotate',
    rotate_left: 'left (turn)',
    rotate_right: 'right (turn)',
    speed: 'speed',
    duration: 'duration',
    ms: 'ms',
    movement: 'Movement',
    lights: 'Lights',
    sensing: 'Sensing',
    logic: 'Logic',
    loops: 'Loops',
    math: 'Math',
    led_show: 'LED Show (Disco)',
    led_blink: 'Blink Color',
    set_color: 'Set LED Color',
    flash_lights: 'Flash Lights',
    times: 'times',
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
    bridge_bt: 'BLE',
    simulation: 'Simulation',
    lidar: 'Lidar',
    reset: 'Reset',
    install_app: 'Install App',
    update_available: 'New version available!',
    refresh: 'Refresh',
    offline_ready: 'App ready to work offline',
  },
  de: {
    title: 'LidarBot Steuerung',
    connect: 'LidarBot verbinden',
    connected: 'Verbunden',
    disconnect: 'Trennen',
    run_live: 'Live Ausführen',
    run_sim: 'Simulation Ausführen',
    move: 'bewegen',
    stop: 'stoppen',
    forward: 'vorwärts',
    backward: 'rückwärts',
    left: 'links',
    right: 'rechts',
    rotate: 'drehen',
    rotate_left: 'links (drehen)',
    rotate_right: 'rechts (drehen)',
    speed: 'Geschwindigkeit',
    duration: 'Dauer',
    ms: 'ms',
    movement: 'Bewegung',
    lights: 'Lichter',
    sensing: 'Sensorik',
    logic: 'Logik',
    loops: 'Schleifen',
    math: 'Mathe',
    led_show: 'Lichtershow (Disco)',
    led_blink: 'Farbe Blinken',
    set_color: 'LED Farbe setzen',
    flash_lights: 'Blinken',
    times: 'Mal',
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
    bridge_bt: 'BLE',
    simulation: 'Simulation',
    lidar: 'Lidar',
    reset: 'Zurücksetzen',
    install_app: 'App Installieren',
    update_available: 'Neue Version verfügbar!',
    refresh: 'Aktualisieren',
    offline_ready: 'App ist bereit für Offline-Nutzung',
  },
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

export function t(key: keyof (typeof translations)['en']): string {
  return translations[currentLanguage][key] || key;
}
