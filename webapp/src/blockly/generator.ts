import { javascriptGenerator, Order } from 'blockly/javascript';

export function defineGenerators() {
    javascriptGenerator.STATEMENT_PREFIX = 'await __highlightBlock(%1);\n';
    javascriptGenerator.addReservedWords('__highlightBlock');

    javascriptGenerator.forBlock['lidarbot_move'] = function (block: any) {
        const direction = block.getFieldValue('DIRECTION');
        const speed = block.getFieldValue('SPEED');
        const duration = block.getFieldValue('DURATION');

        let x = 0, y = 0, z = 0;
        // Map blockly speed (0-100) to LidarBot kinematics (0 to 7)
        const s = Math.round(parseInt(speed) * 7 / 100);
        if (direction === 'FORWARD') y = s;
        if (direction === 'BACKWARD') y = -s;
        if (direction === 'LEFT') x = -s;
        if (direction === 'RIGHT') x = s;

        return `__checkAbort();\nawait serialBridge.sendCommand(${x}, ${y}, ${z}, ${duration});\nawait __sleep(${duration});\n`;
    };

    javascriptGenerator.forBlock['lidarbot_stop'] = function () {
        return `__checkAbort();\nawait serialBridge.sendCommand(0, 0, 0);\n`;
    };

    javascriptGenerator.forBlock['lidarbot_led_show'] = function (block: any) {
        const hex: string = block.getFieldValue('COLOR');
        const duration = block.getFieldValue('DURATION');
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);

        // Native ledshow is fixed, so for custom color/duration we simulate it with colors
        return `
{
  const start = Date.now();
  while (Date.now() - start < ${duration}) {
    __checkAbort();
    await serialBridge.sendLedColor(${r}, ${g}, ${b});
    await __sleep(100);
    __checkAbort();
    await serialBridge.sendLedColor(0, 0, 0);
    await __sleep(100);
  }
}
`;
    };

    javascriptGenerator.forBlock['lidarbot_set_color'] = function (block: any) {
        const hex: string = block.getFieldValue('COLOR');
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        return `__checkAbort();\nawait serialBridge.sendLedColor(${r}, ${g}, ${b});\nawait __sleep(100);\n`;
    };

    javascriptGenerator.forBlock['lidarbot_get_distance'] = function (block: any) {
        const angle = block.getFieldValue('ANGLE');
        return [`lidarStore.getDistance(${angle})`, Order.ATOMIC];
    };

    javascriptGenerator.forBlock['lidarbot_is_obstacle'] = function (block: any) {
        const start = block.getFieldValue('START');
        const end = block.getFieldValue('END');
        const threshold = block.getFieldValue('THRESHOLD');
        return [`lidarStore.isObstacle(${start}, ${end}, ${threshold})`, Order.ATOMIC];
    };
}