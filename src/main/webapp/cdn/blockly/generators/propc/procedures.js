/**
 * Visual Blocks Language
 *
 * Copyright 2012 Google Inc.
 * http://blockly.googlecode.com/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating propc for variable blocks.
 * @author michel@creatingfuture.eu  (Michel Lampo)
 */
'use strict';

Blockly.Blocks['procedures_defnoreturn'] = {
    /**
     * Block for defining a procedure with no return value.
     * @this Blockly.Block
     */
    init: function () {
        if (profile.default.description === "Scribbler Robot") {
            this.setHelpUrl(Blockly.MSG_S3_FUNCTIONS_HELPURL);
        } else {
            this.setHelpUrl(Blockly.MSG_FUNCTIONS_HELPURL);
        }
        this.setTooltip(Blockly.MSG_PROCEDURES_DEFNORETURN_TOOLTIP);
        var nameField = new Blockly.FieldTextInput(
                Blockly.Msg.PROCEDURES_DEFNORETURN_PROCEDURE,
                Blockly.Procedures.rename);
        nameField.setSpellcheck(false);
        this.appendDummyInput()
                .appendField(Blockly.Msg.PROCEDURES_DEFNORETURN_TITLE)
                .appendField(nameField, 'NAME')
                .appendField('', 'PARAMS');
        this.setColour(colorPalette.getColor('functions'));
        this.arguments_ = [];
        this.setStatements_(true);
        this.statementConnection_ = null;
    },
    /**
     * Initialization of the block has completed, clean up anything that may be
     * inconsistent as a result of the XML loading.
     * @this Blockly.Block
     */
    validate: function () {
        var name = Blockly.Procedures.findLegalName(
                this.getFieldValue('NAME'), this);
        this.setFieldValue(name, 'NAME');
    },
    /**
     * Add or remove the statement block from this function definition.
     * @param {boolean} hasStatements True if a statement block is needed.
     * @this Blockly.Block
     */
    setStatements_: function (hasStatements) {
        if (this.hasStatements_ === hasStatements) {
            return;
        }
        if (hasStatements) {
            this.appendStatementInput('STACK')
                    .appendField(Blockly.Msg.PROCEDURES_DEFNORETURN_DO);
            if (this.getInput('RETURN')) {
                this.moveInputBefore('STACK', 'RETURN');
            }
        } else {
            this.removeInput('STACK', true);
        }
        this.hasStatements_ = hasStatements;
    },
    /**
     * Update the display of parameters for this procedure definition block.
     * Display a warning if there are duplicately named parameters.
     * @private
     * @this Blockly.Block
     */
    updateParams_: function () {
        // Check for duplicated arguments.
        var badArg = false;
        var hash = {};
        for (var i = 0; i < this.arguments_.length; i++) {
            if (hash['arg_' + this.arguments_[i].toLowerCase()]) {
                badArg = true;
                break;
            }
            hash['arg_' + this.arguments_[i].toLowerCase()] = true;
        }
        if (badArg) {
            this.setWarningText(Blockly.Msg.PROCEDURES_DEF_DUPLICATE_WARNING);
        } else {
            this.setWarningText(null);
        }
        // Merge the arguments into a human-readable list.
        var paramString = '';
        if (this.arguments_.length) {
            paramString = Blockly.Msg.PROCEDURES_BEFORE_PARAMS +
                    ' ' + this.arguments_.join(', ');
        }
        // The params field is deterministic based on the mutation,
        // no need to fire a change event.
        Blockly.Events.disable();
        this.setFieldValue(paramString, 'PARAMS');
        Blockly.Events.enable();
    },
    /**
     * Create XML to represent the argument inputs.
     * @param {=boolean} opt_paramIds If true include the IDs of the parameter
     *     quarks.  Used by Blockly.Procedures.mutateCallers for reconnection.
     * @return {!Element} XML storage element.
     * @this Blockly.Block
     */
    mutationToDom: function (opt_paramIds) {
        var container = document.createElement('mutation');
        if (opt_paramIds) {
            container.setAttribute('name', this.getFieldValue('NAME'));
        }
        for (var i = 0; i < this.arguments_.length; i++) {
            var parameter = document.createElement('arg');
            parameter.setAttribute('name', this.arguments_[i]);
            if (opt_paramIds && this.paramIds_) {
                parameter.setAttribute('paramId', this.paramIds_[i]);
            }
            container.appendChild(parameter);
        }

        // Save whether the statement input is visible.
        if (!this.hasStatements_) {
            container.setAttribute('statements', 'false');
        }
        return container;
    },
    /**
     * Parse XML to restore the argument inputs.
     * @param {!Element} xmlElement XML storage element.
     * @this Blockly.Block
     */
    domToMutation: function (xmlElement) {
        this.arguments_ = [];
        for (var i = 0, childNode; childNode = xmlElement.childNodes[i]; i++) {
            if (childNode.nodeName.toLowerCase() === 'arg') {
                this.arguments_.push(childNode.getAttribute('name'));
            }
        }
        this.updateParams_();
        Blockly.Procedures.mutateCallers(this);

        // Show or hide the statement input.
        this.setStatements_(xmlElement.getAttribute('statements') !== 'false');
    },
    /**
     * Populate the mutator's dialog with this block's components.
     * @param {!Blockly.Workspace} workspace Mutator's workspace.
     * @return {!Blockly.Block} Root block in mutator.
     * @this Blockly.Block
     */
    decompose: function (workspace) {
        var containerBlock = workspace.newBlock('procedures_mutatorcontainer');
        containerBlock.initSvg();

        // Check/uncheck the allow statement box.
        if (this.getInput('RETURN')) {
            containerBlock.setFieldValue(this.hasStatements_ ? 'TRUE' : 'FALSE',
                    'STATEMENTS');
        } else {
            containerBlock.getInput('STATEMENT_INPUT').setVisible(false);
        }

        // Parameter list.
        var connection = containerBlock.getInput('STACK').connection;
        for (var i = 0; i < this.arguments_.length; i++) {
            var paramBlock = workspace.newBlock('procedures_mutatorarg');
            paramBlock.initSvg();
            paramBlock.setFieldValue(this.arguments_[i], 'NAME');
            // Store the old location.
            paramBlock.oldLocation = i;
            connection.connect(paramBlock.previousConnection);
            connection = paramBlock.nextConnection;
        }
        // Initialize procedure's callers with blank IDs.
        Blockly.Procedures.mutateCallers(this);
        return containerBlock;
    },
    /**
     * Reconfigure this block based on the mutator dialog's components.
     * @param {!Blockly.Block} containerBlock Root block in mutator.
     * @this Blockly.Block
     */
    compose: function (containerBlock) {
        // Parameter list.
        this.arguments_ = [];
        this.paramIds_ = [];
        var paramBlock = containerBlock.getInputTargetBlock('STACK');
        while (paramBlock) {
            this.arguments_.push(paramBlock.getFieldValue('NAME'));
            this.paramIds_.push(paramBlock.id);
            paramBlock = paramBlock.nextConnection &&
                    paramBlock.nextConnection.targetBlock();
        }
        this.updateParams_();
        Blockly.Procedures.mutateCallers(this);

        // Show/hide the statement input.
        var hasStatements = containerBlock.getFieldValue('STATEMENTS');
        if (hasStatements !== null) {
            hasStatements = hasStatements === 'TRUE';
            if (this.hasStatements_ !== hasStatements) {
                if (hasStatements) {
                    this.setStatements_(true);
                    // Restore the stack, if one was saved.
                    Blockly.Mutator.reconnect(this.statementConnection_, this, 'STACK');
                    this.statementConnection_ = null;
                } else {
                    // Save the stack, then disconnect it.
                    var stackConnection = this.getInput('STACK').connection;
                    this.statementConnection_ = stackConnection.targetConnection;
                    if (this.statementConnection_) {
                        var stackBlock = stackConnection.targetBlock();
                        stackBlock.unplug();
                        stackBlock.bumpNeighbours_();
                    }
                    this.setStatements_(false);
                }
            }
        }
    },
    /**
     * Dispose of any callers.
     * @this Blockly.Block
     */
    dispose: function () {
        var name = this.getFieldValue('NAME');
        Blockly.Procedures.disposeCallers(name, this.workspace);
        // Call parent's destructor.
        this.constructor.prototype.dispose.apply(this, arguments);
    },
    /**
     * Return the signature of this procedure definition.
     * @return {!Array} Tuple containing three elements:
     *     - the name of the defined procedure,
     *     - a list of all its arguments,
     *     - that it DOES NOT have a return value.
     * @this Blockly.Block
     */
    getProcedureDef: function () {
        return [this.getFieldValue('NAME'), this.arguments_, false];
    },
    /**
     * Return all variables referenced by this block.
     * @return {!Array.<string>} List of variable names.
     * @this Blockly.Block
     */
    getVars: function () {
        return this.arguments_;
    },
    /**
     * Notification that a variable is renaming.
     * If the name matches one of this block's variables, rename it.
     * @param {string} oldName Previous name of variable.
     * @param {string} newName Renamed variable.
     * @this Blockly.Block
     */
    renameVar: function (oldName, newName) {
        var change = false;
        for (var i = 0; i < this.arguments_.length; i++) {
            if (Blockly.Names.equals(oldName, this.arguments_[i])) {
                this.arguments_[i] = newName;
                change = true;
            }
        }
        if (change) {
            this.updateParams_();
            // Update the mutator's variables if the mutator is open.
            if (this.mutator.isVisible()) {
                var blocks = this.mutator.workspace_.getAllBlocks();
                for (var i = 0, block; block = blocks[i]; i++) {
                    if (block.type == 'procedures_mutatorarg' &&
                            Blockly.Names.equals(oldName, block.getFieldValue('NAME'))) {
                        block.setFieldValue(newName, 'NAME');
                    }
                }
            }
        }
    },
    /**
     * Add custom menu options to this block's context menu.
     * @param {!Array} options List of menu options to add to.
     * @this Blockly.Block
     */
    customContextMenu: function (options) {
        // Add option to create caller.
        var option = {enabled: true};
        var name = this.getFieldValue('NAME');
        option.text = Blockly.Msg.PROCEDURES_CREATE_DO.replace('%1', name);
        var xmlMutation = goog.dom.createDom('mutation');
        xmlMutation.setAttribute('name', name);
        for (var i = 0; i < this.arguments_.length; i++) {
            var xmlArg = goog.dom.createDom('arg');
            xmlArg.setAttribute('name', this.arguments_[i]);
            xmlMutation.appendChild(xmlArg);
        }
        var xmlBlock = goog.dom.createDom('block', null, xmlMutation);
        xmlBlock.setAttribute('type', this.callType_);
        option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
        options.push(option);

        // Add options to create getters for each parameter.
        if (!this.isCollapsed()) {
            for (var i = 0; i < this.arguments_.length; i++) {
                var option = {enabled: true};
                var name = this.arguments_[i];
                option.text = Blockly.Msg.VARIABLES_SET_CREATE_GET.replace('%1', name);
                var xmlField = goog.dom.createDom('field', null, name);
                xmlField.setAttribute('name', 'VAR');
                var xmlBlock = goog.dom.createDom('block', null, xmlField);
                xmlBlock.setAttribute('type', 'variables_get');
                option.callback = Blockly.ContextMenu.callbackFactory(this, xmlBlock);
                options.push(option);
            }
        }
    },
    callType_: 'procedures_callnoreturn'
};


Blockly.Blocks['procedures_mutatorcontainer'] = {
    /**
     * Mutator block for procedure container.
     * @this Blockly.Block
     */
    init: function () {
        this.appendDummyInput()
                .appendField(Blockly.Msg.PROCEDURES_MUTATORCONTAINER_TITLE);
        this.appendStatementInput('STACK');
        this.appendDummyInput('STATEMENT_INPUT')
                .appendField(Blockly.Msg.PROCEDURES_ALLOW_STATEMENTS)
                .appendField(new Blockly.FieldCheckbox('TRUE'), 'STATEMENTS');
        this.setColour(colorPalette.getColor('functions'));
        this.setTooltip(Blockly.Msg.PROCEDURES_MUTATORCONTAINER_TOOLTIP);
        this.contextMenu = false;
    }
};

Blockly.Blocks['procedures_mutatorarg'] = {
    /**
     * Mutator block for procedure argument.
     * @this Blockly.Block
     */
    init: function () {
        this.appendDummyInput()
                .appendField(Blockly.Msg.PROCEDURES_MUTATORARG_TITLE)
                .appendField(new Blockly.FieldTextInput('x', this.validator_), 'NAME');
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(colorPalette.getColor('functions'));
        this.setTooltip(Blockly.Msg.PROCEDURES_MUTATORARG_TOOLTIP);
        this.contextMenu = false;
    },
    /**
     * Obtain a valid name for the procedure.
     * Merge runs of whitespace.  Strip leading and trailing whitespace.
     * Beyond this, all names are legal.
     * @param {string} newVar User-supplied name.
     * @return {?string} Valid name, or null if a name was not specified.
     * @private
     * @this Blockly.Block
     */
    validator_: function (newVar) {
        newVar = newVar.replace(/[\s\xa0]+/g, ' ').replace(/^ | $/g, '');
        return newVar || null;
    }
};

Blockly.Blocks['procedures_callnoreturn'] = {
    /**
     * Block for calling a procedure with no return value.
     * @this Blockly.Block
     */
    init: function () {
        if (profile.default.description === "Scribbler Robot") {
            this.setHelpUrl(Blockly.MSG_S3_FUNCTIONS_HELPURL);
        } else {
            this.setHelpUrl(Blockly.MSG_FUNCTIONS_HELPURL);
        }
        this.setTooltip(Blockly.MSG_PROCEDURES_CALLNORETURN_TOOLTIP);
        this.appendDummyInput('TOPROW')
                .appendField("run function")
                .appendField("\u201C")
                .appendField(this.id, 'NAME')
                .appendField("\u201D");
        this.setPreviousStatement(true, "Function");
        this.setNextStatement(true);
        this.setColour(colorPalette.getColor('functions'));
        this.arguments_ = [];
        this.quarkConnections_ = {};
        this.quarkIds_ = null;
    },
    onchange: function () {
        var tBlock = this.previousConnection.targetBlock();
        if (tBlock) {
            if (tBlock.toString().indexOf('new processor ') === 0) {
                this.setNextStatement(false);
            } else {
                this.setNextStatement(true);
            }
        } else {
            this.setNextStatement(true);
        }
    },
    /**
     * Returns the name of the procedure this block calls.
     * @return {string} Procedure name.
     * @this Blockly.Block
     */
    getProcedureCall: function () {
        // The NAME field is guaranteed to exist, null will never be returned.
        return /** @type {string} */ (this.getFieldValue('NAME'));
    },
    /**
     * Notification that a procedure is renaming.
     * If the name matches this block's procedure, rename it.
     * @param {string} oldName Previous name of procedure.
     * @param {string} newName Renamed procedure.
     * @this Blockly.Block
     */
    renameProcedure: function (oldName, newName) {
        if (Blockly.Names.equals(oldName, this.getProcedureCall())) {
            this.setFieldValue(newName, 'NAME');
            //this.setTooltip(
            //        (this.outputConnection ? Blockly.Msg.PROCEDURES_CALLRETURN_TOOLTIP :
            //                Blockly.Msg.PROCEDURES_CALLNORETURN_TOOLTIP)
            //        .replace('%1', newName));
        }
    },
    /**
     * Notification that the procedure's parameters have changed.
     * @param {!Array.<string>} paramNames New param names, e.g. ['x', 'y', 'z'].
     * @param {!Array.<string>} paramIds IDs of params (consistent for each
     *     parameter through the life of a mutator, regardless of param renaming),
     *     e.g. ['piua', 'f8b_', 'oi.o'].
     * @private
     * @this Blockly.Block
     */
    setProcedureParameters_: function (paramNames, paramIds) {
        // Data structures:
        // this.arguments = ['x', 'y']
        //     Existing param names.
        // this.quarkConnections_ {piua: null, f8b_: Blockly.Connection}
        //     Look-up of paramIds to connections plugged into the call block.
        // this.quarkIds_ = ['piua', 'f8b_']
        //     Existing param IDs.
        // Note that quarkConnections_ may include IDs that no longer exist, but
        // which might reappear if a param is reattached in the mutator.
        var defBlock = Blockly.Procedures.getDefinition(this.getProcedureCall(),
                this.workspace);
        var mutatorOpen = defBlock && defBlock.mutator &&
                defBlock.mutator.isVisible();
        if (!mutatorOpen) {
            this.quarkConnections_ = {};
            this.quarkIds_ = null;
        }
        if (!paramIds) {
            // Reset the quarks (a mutator is about to open).
            return;
        }
        if (goog.array.equals(this.arguments_, paramNames)) {
            // No change.
            this.quarkIds_ = paramIds;
            return;
        }
        if (paramIds.length != paramNames.length) {
            throw 'Error: paramNames and paramIds must be the same length.';
        }
        this.setCollapsed(false);
        if (!this.quarkIds_) {
            // Initialize tracking for this block.
            this.quarkConnections_ = {};
            if (paramNames.join('\n') == this.arguments_.join('\n')) {
                // No change to the parameters, allow quarkConnections_ to be
                // populated with the existing connections.
                this.quarkIds_ = paramIds;
            } else {
                this.quarkIds_ = [];
            }
        }
        // Switch off rendering while the block is rebuilt.
        var savedRendered = this.rendered;
        this.rendered = false;
        // Update the quarkConnections_ with existing connections.
        for (var i = 0; i < this.arguments_.length; i++) {
            var input = this.getInput('ARG' + i);
            if (input) {
                var connection = input.connection.targetConnection;
                this.quarkConnections_[this.quarkIds_[i]] = connection;
                if (mutatorOpen && connection &&
                        paramIds.indexOf(this.quarkIds_[i]) === -1) {
                    // This connection should no longer be attached to this block.
                    connection.disconnect();
                    connection.getSourceBlock().bumpNeighbours_();
                }
            }
        }
        // Rebuild the block's arguments.
        this.arguments_ = [].concat(paramNames);
        this.updateShape_();
        this.quarkIds_ = paramIds;
        // Reconnect any child blocks.
        if (this.quarkIds_) {
            for (var i = 0; i < this.arguments_.length; i++) {
                var quarkId = this.quarkIds_[i];
                if (quarkId in this.quarkConnections_) {
                    var connection = this.quarkConnections_[quarkId];
                    if (!Blockly.Mutator.reconnect(connection, this, 'ARG' + i)) {
                        // Block no longer exists or has been attached elsewhere.
                        delete this.quarkConnections_[quarkId];
                    }
                }
            }
        }
        // Restore rendering and show the changes.
        this.rendered = savedRendered;
        if (this.rendered) {
            this.render();
        }
    },
    /**
     * Modify this block to have the correct number of arguments.
     * @private
     * @this Blockly.Block
     */
    updateShape_: function () {
        for (var i = 0; i < this.arguments_.length; i++) {
            var field = this.getField('ARGNAME' + i);
            if (field) {
                // Ensure argument name is up to date.
                // The argument name field is deterministic based on the mutation,
                // no need to fire a change event.
                Blockly.Events.disable();
                field.setValue(this.arguments_[i]);
                Blockly.Events.enable();
            } else {
                // Add new input.
                field = new Blockly.FieldLabel(this.arguments_[i]);
                var input = this.appendValueInput('ARG' + i)
                        .setAlign(Blockly.ALIGN_RIGHT)
                        .appendField(field, 'ARGNAME' + i);
                input.init();
            }
        }
        // Remove deleted inputs.
        while (this.getInput('ARG' + i)) {
            this.removeInput('ARG' + i);
            i++;
        }
        // Add 'with:' if there are parameters, remove otherwise.
        var topRow = this.getInput('TOPROW');
        if (topRow) {
            if (this.arguments_.length) {
                if (!this.getField('WITH')) {
                    topRow.appendField(Blockly.Msg.PROCEDURES_CALL_BEFORE_PARAMS, 'WITH');
                    topRow.init();
                }
            } else {
                if (this.getField('WITH')) {
                    topRow.removeField('WITH');
                }
            }
        }
    },
    /**
     * Create XML to represent the (non-editable) name and arguments.
     * @return {!Element} XML storage element.
     * @this Blockly.Block
     */
    mutationToDom: function () {
        var container = document.createElement('mutation');
        container.setAttribute('name', this.getProcedureCall());
        for (var i = 0; i < this.arguments_.length; i++) {
            var parameter = document.createElement('arg');
            parameter.setAttribute('name', this.arguments_[i]);
            container.appendChild(parameter);
        }
        return container;
    },
    /**
     * Parse XML to restore the (non-editable) name and parameters.
     * @param {!Element} xmlElement XML storage element.
     * @this Blockly.Block
     */
    domToMutation: function (xmlElement) {
        var name = xmlElement.getAttribute('name');
        this.renameProcedure(this.getProcedureCall(), name);
        var args = [];
        var paramIds = [];
        for (var i = 0, childNode; childNode = xmlElement.childNodes[i]; i++) {
            if (childNode.nodeName.toLowerCase() === 'arg') {
                args.push(childNode.getAttribute('name'));
                paramIds.push(childNode.getAttribute('paramId'));
            }
        }
        this.setProcedureParameters_(args, paramIds);
    },
    /**
     * Notification that a variable is renaming.
     * If the name matches one of this block's variables, rename it.
     * @param {string} oldName Previous name of variable.
     * @param {string} newName Renamed variable.
     * @this Blockly.Block
     */
    renameVar: function (oldName, newName) {
        for (var i = 0; i < this.arguments_.length; i++) {
            if (Blockly.Names.equals(oldName, this.arguments_[i])) {
                this.arguments_[i] = newName;
                this.getField('ARGNAME' + i).setValue(newName);
            }
        }
    },
    /**
     * Add menu option to find the definition block for this call.
     * @param {!Array} options List of menu options to add to.
     * @this Blockly.Block
     */
    customContextMenu: function (options) {
        var option = {enabled: true};
        option.text = Blockly.Msg.PROCEDURES_HIGHLIGHT_DEF;
        var name = this.getProcedureCall();
        var workspace = this.workspace;
        option.callback = function () {
            var def = Blockly.Procedures.getDefinition(name, workspace);
            def && def.select();
        };
        options.push(option);
    }
};

Blockly.Blocks['procedures_callreturn'] = {
    /**
     * Block for calling a procedure with a return value.
     * @this Blockly.Block
     */
    init: function () {
        this.appendDummyInput('TOPROW')
                .appendField('', 'NAME');
        this.setOutput(true);
        this.setColour(colorPalette.getColor('functions'));
        // Tooltip is set in domToMutation.
        this.setHelpUrl(Blockly.Msg.PROCEDURES_CALLRETURN_HELPURL);
        this.arguments_ = [];
        this.quarkConnections_ = {};
        this.quarkIds_ = null;
    },
    getProcedureCall: Blockly.Blocks['procedures_callnoreturn'].getProcedureCall,
    renameProcedure: Blockly.Blocks['procedures_callnoreturn'].renameProcedure,
    setProcedureParameters_:
            Blockly.Blocks['procedures_callnoreturn'].setProcedureParameters_,
    updateShape_: Blockly.Blocks['procedures_callnoreturn'].updateShape_,
    mutationToDom: Blockly.Blocks['procedures_callnoreturn'].mutationToDom,
    domToMutation: Blockly.Blocks['procedures_callnoreturn'].domToMutation,
    renameVar: Blockly.Blocks['procedures_callnoreturn'].renameVar,
    customContextMenu: Blockly.Blocks['procedures_callnoreturn'].customContextMenu
};

Blockly.propc.procedures_defreturn = function () {
    // Define a procedure with a return value.
    var funcName = Blockly.propc.variableDB_.getName(this.getFieldValue('NAME'),
            Blockly.Procedures.NAME_TYPE);
    var branch = Blockly.propc.statementToCode(this, 'STACK');
    if (Blockly.propc.INFINITE_LOOP_TRAP) {
        branch = Blockly.propc.INFINITE_LOOP_TRAP.replace(/%1/g,
                '\'' + this.id + '\'') + branch;
    }
    var returnValue = Blockly.propc.valueToCode(this, 'RETURN',
            Blockly.propc.ORDER_NONE) || '';
    if (returnValue) {
        returnValue = '  return ' + returnValue + ';\n';
    }
    var returnType = returnValue ? 'int' : 'void';
    var args = [];
    for (var x = 0; x < this.arguments_.length; x++) {
//        args[x] = this.arguments_[x];
//        console.log("argument", this.arguments_[x]);
        var varName = Blockly.propc.variableDB_.getName(this.arguments_[x],
                Blockly.Variables.NAME_TYPE);
        args.push('int ' + varName);
        if (Blockly.propc.vartype_[varName] === undefined) {
            Blockly.propc.vartype_[varName] = 'LOCAL';
        }
    }
    var code = returnType + ' ' + funcName + '(' + args.join(', ') + ') {\n' +
            branch + returnValue + '}\n';

    Blockly.propc.method_declarations_[funcName] = returnType + ' ' +
            funcName + '(' + args.join(', ') + ');\n';

    code = Blockly.propc.scrub_(this, code);
    Blockly.propc.methods_[funcName] = code;
    return null;
};

// Defining a procedure without a return value uses the same generator as
// a procedure with a return value.
Blockly.propc.procedures_defnoreturn = Blockly.propc.procedures_defreturn;

Blockly.propc.procedures_callreturn = function () {
    // Call a procedure with a return value.
    var funcName = Blockly.propc.variableDB_.getName(this.getFieldValue('NAME'),
            Blockly.Procedures.NAME_TYPE);
    var args = [];
    for (var x = 0; x < this.arguments_.length; x++) {
        args[x] = Blockly.propc.valueToCode(this, 'ARG' + x,
                Blockly.propc.ORDER_NONE) || 'null';
    }
    var code = funcName + '(' + args.join(', ') + ')';
    return [code, Blockly.propc.ORDER_UNARY_POSTFIX];
};

Blockly.propc.procedures_callnoreturn = function () {
    // Call a procedure with no return value.
    var funcName = Blockly.propc.variableDB_.getName(this.getFieldValue('NAME'),
            Blockly.Procedures.NAME_TYPE);
    var args = [];
    for (var x = 0; x < this.arguments_.length; x++) {
        args[x] = Blockly.propc.valueToCode(this, 'ARG' + x,
                Blockly.propc.ORDER_NONE) || 'null';
    }
    var code = funcName + '(' + args.join(', ') + ');\n';
    return code;
};

Blockly.propc.procedures_ifreturn = function () {
    // Conditionally return value from a procedure.
    var condition = Blockly.propc.valueToCode(this, 'CONDITION',
            Blockly.propc.ORDER_NONE) || 'false';
    var code = 'if (' + condition + ') {\n';
    if (this.hasReturnValue_) {
        var value = Blockly.propc.valueToCode(this, 'VALUE',
                Blockly.propc.ORDER_NONE) || 'null';
        code += '  return ' + value + ';\n';
    } else {
        code += '  return;\n';
    }
    code += '}\n';
    return code;
};
