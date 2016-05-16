import _ from 'lodash';
import $ from 'jquery';
import cid from '../../services/cid';
import store from '../../services/store';
import mapReducers from '../../services/map-reducers';

/*
 Available classes:

 jqconsole: The main console container.
 jqconsole, jqconsole-blurred: The main console container, when not in focus.
 jqconsole-cursor: The cursor.
 jqconsole-header: The welcome message at the top of the console.
 jqconsole-input: The prompt area during input. May have multiple lines.
 jqconsole-old-input: Previously-entered inputs.
 jqconsole-prompt: The prompt area during prompting. May have multiple lines.
 jqconsole-old-prompt: Previously-entered prompts.
 jqconsole-composition: The div encapsulating the composition of multi-byte characters.
 jqconsole-prompt-text: the text entered in the current prompt
 */

/**
 * @typedef {object} TerminalState
 * @property {string} label
 * @property {string} id
 * @property {string} tabId
 * @property {boolean} hasFocus
 * @property {string} icon
 * @property {number} fontSize
 * @property {string} status
 * @property {[{id: string, text: string}]} history
 * @property {string} [executable]
 * @property {string} [cwd]
 * @property {Array} [packages]
 * @property {string} [version]
 */

const initialState = [getDefault()];

/**
 * @returns {[TerminalState]}
 */
function getDefault() {
  return {
    label: 'Console',
    id: cid(),
    tabId: cid(),
    hasFocus: true,
    icon: 'terminal',
    fontSize: _.toNumber(store.get('fontSize')) || 12,
    status: 'idle',
    history: []
  };
}

function getTerminalConsole(action) {
  const el = document.querySelector('#' + action.id);

  return el && $(el).data('jqconsole');
}

/**
 * Update the terminal with idle/busy
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function setTerminalState(state, action) {
  const instance = _.find(state, {id: action.id});

  if (instance.status !== action.status) {
    state = _.clone(state);
    instance.status = action.status;
  }

  return state;
}

/**
 * Update the terminal with executed input
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function addTerminalExecutedInput(state, action) {
  const jqconsole = getTerminalConsole(action),
    historyMaxSetting = store.get('terminalHistory'),
    historyMax = historyMaxSetting === null ? 5 : historyMaxSetting;

  if (store.get('terminalShowExecutedInput')) {
    jqconsole.Write(action.code + '\n');
  }

  if (historyMax > 0 && _.isString(action.code) && action.code.trim().length > 0) {
    state = _.clone(state);
    const instance = _.find(state, {id: action.id});

    instance.history = _.clone(instance.history);
    instance.history.push({id: cid(), text: action.code});
    if (instance.history.length > historyMax) {
      instance.history.shift();
    }
  }

  return state;
}

/**
 * Update the terminal with text
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function addTerminalText(state, action) {
  const jqconsole = getTerminalConsole(action);

  jqconsole.Write(action.text + '\n', 'jqconsole-output');

  return state;
}

/**
 * @param {object} jqconsole
 * @param {object} data
 */
function appendIFrame(jqconsole, data) {
  let iframeId = cid(),
    str = `<iframe style="resize: vertical; width: 100%" seamless id="${iframeId}" src="${data['text/html']}" sandbox="allow-scripts"></iframe>`;

  jqconsole.Append(str);
  jqconsole.Write('\n');
}

/**
 * @param {object} jqconsole
 * @param {object} data
 */
function appendPNG(jqconsole, data) {
  const src = data['image/png'];

  jqconsole.Append(`<img src="${src}">`);
  jqconsole.Write('\n');
}

/**
 * @param {object} jqconsole
 * @param {object} data
 */
function appendSVG(jqconsole, data) {
  const src = data['image/svg'];

  jqconsole.Append(`<img src="${src}">`);
  jqconsole.Write('\n');
}

/**
 * Update the terminal with display data
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function addTerminalDisplayData(state, action) {
  const jqconsole = getTerminalConsole(action),
    data = action.data;

  if (data['text/html']) {
    if (store.get('allowIFrameInTerminal')) {
      appendIFrame(jqconsole, data);
    }
  } else if (data['image/png']) {
    appendPNG(jqconsole, data);
    // do nothing at the moment
  } else if (data['image/svg']) {
    appendSVG(jqconsole, data);
  } else {
    console.warn('addTerminalDisplayData', 'unknown data type', data);
  }

  return state;
}

/**
 * Update the terminal with display data
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function addTerminalResult(state, action) {
  const jqconsole = getTerminalConsole(action),
    data = action.data;

  if (data['text/plain']) {
    jqconsole.Write(data['text/plain'] + '\n', 'jqconsole-output');
  } else {
    console.warn('addTerminalResult', 'unknown data type', data);
  }

  return state;
}

/**
 * Update the terminal with display data
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function addTerminalError(state, action) {
  const jqconsole = getTerminalConsole(action),
    htmlEscape = false;

  jqconsole.Write(action.traceback + '\n', 'jqconsole-output', htmlEscape);

  return state;
}

/**
 * Update the terminal with the new python options
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function updateFirstTerminalWithKernel(state, action) {
  state = _.cloneDeep(state);
  let target = state.length ? state[0] : getDefault();

  target.pythonOptions = action.pythonOptions;
  return state;
}

/**
 * Update the terminal with the new variable state
 * @param {[TerminalState]} state
 * @param {object} action
 * @returns {[TerminalState]}
 */
function updateFirstTerminalWithVariables(state, action) {
  state = _.cloneDeep(state);
  let target = state.length ? state[0] : getDefault();

  target.variables = action.variables;
  return state;
}

/**
 *
 * @param {object} state
 * @param {string} propertyName
 * @param {*} value
 * @param {function} [transform]
 * @returns {object}
 */
function changeProperty(state, propertyName, value, transform) {
  state = _.cloneDeep(state);

  if (transform) {
    value = transform(value);
  }

  _.each(state, (item) => _.set(item, propertyName, value));

  return state;
}

function changePreference(state, action) {
  switch (action.key) {
    case 'fontSize': return changeProperty(state, 'fontSize', action.value, _.toNumber);
    case 'pythonCmd': return changeProperty(state, 'pythonOptions.cmd', action.value);
    case 'pythonShell': return changeProperty(state, 'pythonOptions.shell', action.value);
    default: return state;
  }
}

export default mapReducers({
  TERMINAL_STATE: setTerminalState,
  ADD_TERMINAL_EXECUTED_INPUT: addTerminalExecutedInput,
  ADD_TERMINAL_TEXT: addTerminalText,
  ADD_TERMINAL_RESULT: addTerminalResult,
  ADD_TERMINAL_ERROR: addTerminalError,
  ADD_DISPLAY_DATA: addTerminalDisplayData,
  KERNEL_DETECTED: updateFirstTerminalWithKernel,
  VARIABLES_DETECTED: updateFirstTerminalWithVariables,
  CHANGE_PREFERENCE: changePreference
}, initialState);