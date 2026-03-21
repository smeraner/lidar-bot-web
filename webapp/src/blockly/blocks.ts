import * as Blockly from 'blockly';
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
                .appendField(new Blockly.FieldNumber(50, 0, 100), "SPEED");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
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