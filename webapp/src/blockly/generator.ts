import { javascriptGenerator, Order } from 'blockly/javascript';

export function defineGenerators() {
  javascriptGenerator.STATEMENT_PREFIX = 'await __highlightBlock(%1);\n';
  javascriptGenerator.addReservedWords('__highlightBlock');

  javascriptGenerator.forBlock['lidarbot_move'] = function (block: any) {
    const direction = block.getFieldValue('DIRECTION');
    const speed = javascriptGenerator.valueToCode(block, 'SPEED', Order.ATOMIC) || '50';
    const durationInput =
      javascriptGenerator.valueToCode(block, 'DURATION', Order.ATOMIC) || '1000';

    // Map speed (0-100) to kinematics (0-7), clamped to 100 max. Duration clamped to non-negative.
    const sCode = `Math.round(Math.min(100, Math.max(0, parseInt(${speed}))) * 7 / 100)`;
    const durCode = `Math.max(0, parseInt(${durationInput}))`;

    let moveCode = '';
    if (direction === 'FORWARD')
      moveCode = `await serialBridge.sendCommand(0, ${sCode}, 0, ${durCode});`;
    if (direction === 'BACKWARD')
      moveCode = `await serialBridge.sendCommand(0, -(${sCode}), 0, ${durCode});`;
    if (direction === 'LEFT')
      moveCode = `await serialBridge.sendCommand(-(${sCode}), 0, 0, ${durCode});`;
    if (direction === 'RIGHT')
      moveCode = `await serialBridge.sendCommand(${sCode}, 0, 0, ${durCode});`;

    return `__checkAbort();\n${moveCode}\nawait __sleep(${durCode});\n`;
  };

  javascriptGenerator.forBlock['lidarbot_rotate'] = function (block: any) {
    const direction = block.getFieldValue('DIRECTION');
    const speed = javascriptGenerator.valueToCode(block, 'SPEED', Order.ATOMIC) || '50';
    const durationInput =
      javascriptGenerator.valueToCode(block, 'DURATION', Order.ATOMIC) || '1000';

    const sCode = `Math.round(Math.min(100, Math.max(0, parseInt(${speed}))) * 7 / 100)`;
    const durCode = `Math.max(0, parseInt(${durationInput}))`;

    let moveCode = '';
    if (direction === 'LEFT')
      moveCode = `await serialBridge.sendCommand(0, 0, -(${sCode}), ${durCode});`;
    if (direction === 'RIGHT')
      moveCode = `await serialBridge.sendCommand(0, 0, ${sCode}, ${durCode});`;

    return `__checkAbort();\n${moveCode}\nawait __sleep(${durCode});\n`;
  };

  javascriptGenerator.forBlock['lidarbot_stop'] = function () {
    return `__checkAbort();\nawait serialBridge.sendCommand(0, 0, 0);\n`;
  };

  javascriptGenerator.forBlock['lidarbot_led_show'] = function (block: any) {
    const hex: string = block.getFieldValue('COLOR');
    const duration = javascriptGenerator.valueToCode(block, 'DURATION', Order.ATOMIC) || '1000';
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);

    return `
{
  const start = Date.now();
  const d = ${duration};
  while (Date.now() - start < d) {
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
    const angle = javascriptGenerator.valueToCode(block, 'ANGLE', Order.ATOMIC) || '0';
    return [`lidarStore.getDistance(${angle})`, Order.ATOMIC];
  };

  javascriptGenerator.forBlock['lidarbot_is_obstacle'] = function (block: any) {
    const start = javascriptGenerator.valueToCode(block, 'START', Order.ATOMIC) || '0';
    const end = javascriptGenerator.valueToCode(block, 'END', Order.ATOMIC) || '0';
    const threshold = javascriptGenerator.valueToCode(block, 'THRESHOLD', Order.ATOMIC) || '200';
    return [`lidarStore.isObstacle(${start}, ${end}, ${threshold})`, Order.ATOMIC];
  };
}
