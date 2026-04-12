import * as Blockly from 'blockly';
import { FieldColour } from '@blockly/field-colour';
import { t } from '../i18n';

export function defineBlocks() {
  Blockly.Blocks['lidarbot_move'] = {
    init: function () {
      this.appendDummyInput()
        .appendField(t('move'))
        .appendField(
          new Blockly.FieldDropdown([
            [t('forward'), 'FORWARD'],
            [t('backward'), 'BACKWARD'],
            [t('left'), 'LEFT'],
            [t('right'), 'RIGHT'],
          ]),
          'DIRECTION',
        );
      this.appendValueInput('SPEED').setCheck('Number').appendField(t('speed'));
      this.appendValueInput('DURATION').setCheck('Number').appendField(t('duration'));
      this.appendDummyInput().appendField(t('ms'));
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip(
        'Move the robot in a direction. Speed: 0-100%, Duration: ms (0 for continuous).',
      );
    },
  };

  Blockly.Blocks['lidarbot_rotate'] = {
    init: function () {
      this.appendDummyInput()
        .appendField(t('rotate'))
        .appendField(
          new Blockly.FieldDropdown([
            [t('rotate_left'), 'LEFT'],
            [t('rotate_right'), 'RIGHT'],
          ]),
          'DIRECTION',
        );
      this.appendValueInput('SPEED').setCheck('Number').appendField(t('speed'));
      this.appendValueInput('DURATION').setCheck('Number').appendField(t('duration'));
      this.appendDummyInput().appendField(t('ms'));
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip(
        'Rotate the robot left or right. Speed: 0-100%, Duration: ms (0 for continuous).',
      );
    },
  };

  Blockly.Blocks['lidarbot_led_blink'] = {
    init: function () {
      this.appendDummyInput()
        .appendField(t('led_blink'))
        .appendField(new FieldColour('#ffffff'), 'COLOR');
      this.appendValueInput('DURATION').setCheck('Number').appendField(t('duration'));
      this.appendDummyInput().appendField(t('ms'));
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Flash the robot LED ring with a color for a duration. Unit: ms.');
    },
  };

  Blockly.Blocks['lidarbot_led_show'] = {
    init: function () {
      this.appendDummyInput().appendField(t('led_show'));
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Trigger the pre-programmed LED disco animation.');
    },
  };

  Blockly.Blocks['lidarbot_set_color'] = {
    init: function () {
      this.appendDummyInput()
        .appendField(t('set_color'))
        .appendField(new FieldColour('#ff0000'), 'COLOR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('Set the robot LED ring to a static color.');
    },
  };

  Blockly.Blocks['lidarbot_get_distance'] = {
    init: function () {
      this.appendValueInput('ANGLE').setCheck('Number').appendField(t('distance'));
      this.setOutput(true, 'Number');
      this.setColour(160);
      this.setTooltip(
        'Get the current distance reading in mm at a specific angle (0-359). 0 is front.',
      );
    },
  };

  Blockly.Blocks['lidarbot_is_obstacle'] = {
    init: function () {
      this.appendValueInput('START').setCheck('Number').appendField(t('is_obstacle'));
      this.appendValueInput('END').setCheck('Number').appendField(t('and'));
      this.appendValueInput('THRESHOLD').setCheck('Number').appendField(t('threshold'));
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setColour(160);
      this.setTooltip(
        'Check if any obstacle is detected within an angle range below the threshold (mm).',
      );
    },
  };

  Blockly.Blocks['lidarbot_stop'] = {
    init: function () {
      this.appendDummyInput().appendField(t('stop') + ' LidarBot');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(0);
      this.setTooltip('Immediately stop all robot movements.');
    },
  };
}
