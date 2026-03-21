import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

export function defineGenerators() {
    javascriptGenerator.forBlock['lidarbot_move'] = function (block: any) {
        const direction = block.getFieldValue('DIRECTION');
        const speed = block.getFieldValue('SPEED');

        let x = 0, y = 0, z = 0;
        const s = parseInt(speed);
        if (direction === 'FORWARD') y = s;
        if (direction === 'BACKWARD') y = -s;
        if (direction === 'LEFT') x = -s;
        if (direction === 'RIGHT') x = s;

        return `await serialBridge.sendCommand(${x}, ${y}, ${z});\nawait new Promise(r => setTimeout(r, 1000));\n`;
    };

    javascriptGenerator.forBlock['lidarbot_stop'] = function () {
        return `await serialBridge.sendCommand(0, 0, 0);\n`;
    };
}