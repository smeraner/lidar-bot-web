import * as Blockly from 'blockly';

export function defineBlocks() {
    Blockly.Blocks['lidarbot_move'] = {
        init: function () {
            this.appendDummyInput()
                .appendField("Move")
                .appendField(new Blockly.FieldDropdown([
                    ["Forward", "FORWARD"],
                    ["Backward", "BACKWARD"],
                    ["Left", "LEFT"],
                    ["Right", "RIGHT"]
                ]), "DIRECTION")
                .appendField("Speed")
                .appendField(new Blockly.FieldNumber(50, 0, 100), "SPEED");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(230);
        }
    };

    Blockly.Blocks['lidarbot_stop'] = {
        init: function () {
            this.appendDummyInput().appendField("Stop LidarBot");
            this.setPreviousStatement(true, null);
            this.setNextStatement(true, null);
            this.setColour(0);
        }
    };
}