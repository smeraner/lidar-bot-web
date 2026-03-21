import { javascriptGenerator, Order } from 'blockly/javascript';

export function defineGenerators() {
    javascriptGenerator.forBlock['lidarbot_move'] = function (block: any) {
        const direction = block.getFieldValue('DIRECTION');
        const speed = block.getFieldValue('SPEED');
        const duration = block.getFieldValue('DURATION');

        let x = 0, y = 0, z = 0;
        const s = parseInt(speed);
        if (direction === 'FORWARD') y = s;
        if (direction === 'BACKWARD') y = -s;
        if (direction === 'LEFT') x = -s;
        if (direction === 'RIGHT') x = s;

        return `await serialBridge.sendCommand(${x}, ${y}, ${z});\nawait new Promise(r => setTimeout(r, ${duration}));\nawait serialBridge.sendCommand(0, 0, 0);\n`;
    };

    javascriptGenerator.forBlock['lidarbot_stop'] = function () {
        return `await serialBridge.sendCommand(0, 0, 0);\n`;
    };

    javascriptGenerator.forBlock['lidarbot_led_show'] = function () {
        return `await serialBridge.sendLedShow();\n`;
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