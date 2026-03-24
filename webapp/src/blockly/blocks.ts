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
                ]), "DIRECTION");
            this.appendValueInput("SPEED")
                .setCheck("Number")
                .appendField(t('speed'));
            this.appendValueInput("DURATION")
                .setCheck("Number")
                .appendField(t('duration'));
            this.appendDummyInput()
                .appendField(t('ms'));
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };

    Blockly.Blocks['lidarbot_rotate'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('rotate'))
                .appendField(new Blockly.FieldDropdown([
                    [t('rotate_left'), "LEFT"],
                    [t('rotate_right'), "RIGHT"]
                ]), "DIRECTION");
            this.appendValueInput("SPEED")
                .setCheck("Number")
                .appendField(t('speed'));
            this.appendValueInput("DURATION")
                .setCheck("Number")
                .appendField(t('duration'));
            this.appendDummyInput()
                .appendField(t('ms'));
            this.setInputsInline(true);
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };

    Blockly.Blocks['lidarbot_led_show'] = {
        init: function () {
            this.appendDummyInput()
                .appendField(t('led_show'))
                .appendField(new FieldColour('#ffffff'), 'COLOR');
            this.appendValueInput("DURATION")
                .setCheck("Number")
                .appendField(t('duration'));
            this.appendDummyInput()
                .appendField(t('ms'));
            this.setInputsInline(true);
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
            this.appendValueInput("ANGLE")
                .setCheck("Number")
                .appendField(t('distance'));
            this.setOutput(true, "Number");
            this.setColour(160);
        }
    };

    Blockly.Blocks['lidarbot_is_obstacle'] = {
        init: function () {
            this.appendValueInput("START")
                .setCheck("Number")
                .appendField(t('is_obstacle'));
            this.appendValueInput("END")
                .setCheck("Number")
                .appendField(t('and'));
            this.appendValueInput("THRESHOLD")
                .setCheck("Number")
                .appendField(t('threshold'));
            this.setInputsInline(true);
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