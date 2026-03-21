import * as Blockly from 'blockly';
import { FieldColour } from '@blockly/field-colour';
import { t } from '../i18n';

export function defineBlocks() {
    Blockly.Blocks['lidarbot_move'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('move'))
                .appendField(new Blockly.FieldDropdown([
                    [t('forward'), "FORWARD"],
                    [t('backward'), "BACKWARD"],
                    [t('left'), "LEFT"],
                    [t('right'), "RIGHT"]
                ]), "DIRECTION")
                .appendField(t('speed'))
                .appendField(new Blockly.FieldNumber(50, 0, 100), "SPEED")
                .appendField(t('duration'))
                .appendField(new Blockly.FieldNumber(1000, 0, 10000), "DURATION")
                .appendField(t('ms'));
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };

    Blockly.Blocks['lidarbot_led_show'] = {
        init: function () {
            this.appendDummyInput().appendField(t('led_show'));
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(290);
        }
    };

    Blockly.Blocks['lidarbot_set_color'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('set_color'))
                .appendField(new FieldColour('#ff0000'), 'COLOR');
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(290);
        }
    };

    Blockly.Blocks['lidarbot_get_distance'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('distance'))
                .appendField(new Blockly.FieldNumber(0, 0, 359), "ANGLE");
            this.setOutput(true, "Number");
            this.setColour(160);
        }
    };

    Blockly.Blocks['lidarbot_is_obstacle'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('is_obstacle'))
                .appendField(new Blockly.FieldNumber(0, 0, 359), "START")
                .appendField(t('and'))
                .appendField(new Blockly.FieldNumber(0, 0, 359), "END")
                .appendField(t('threshold'))
                .appendField(new Blockly.FieldNumber(200, 0, 2000), "THRESHOLD");
            this.setOutput(true, "Boolean");
            this.setColour(160);
        }
    };

    Blockly.Blocks['lidarbot_stop'] = {
        init: function () {
            this.appendDummyInput().appendField(t('stop') + " LidarBot");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(0);
        }
    };
}