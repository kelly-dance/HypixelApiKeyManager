/// <reference types="../CTAutocomplete" />
/// <reference lib="es2015" />

import { addCustomCompletion } from '../CustomTabCompletions';
import { request } from '../requestV2';
import { Promise } from '../PromiseV2';

const keyPath = `${Config.modulesFolder}/HypixelApiKeyManager/key.txt`;

let key = FileLib.read(keyPath);

let valid = !!key;

/**
 * Returns undefined if no is found or it is invalid
 * @returns {string | undefined}
 */
export const getKey = () => {
  if(valid) return key;
}

let listeners = [];

/**
 * @param {(key: string) => void} cb
 * @param {boolean=} single
 */
export const onKeyChange = (cb, single=true) => listeners.push([cb, single]);

/**
 * Prompts the user to set their API key and resolves it.
 * If the users denies or times out in 30s it rejects.
 * Gives a message like `${module} requires your API key to work! ...`
 * @param {string} mod 
 * @returns {Promise<String>}
 */
export const promptKey = mod => {
  if(valid) return Promise.resolve(key);
  ChatLib.chat(`&b${mod} &arequires your API key to operate!`);
  ChatLib.chat(`&aGenerate a new API key with &b/api new &aor set it with &b/api set <key>&a.`);
  return new Promise((resolve, reject) => {
    let resolved = false;
    onKeyChange(newkey => {
      if(!resolved) resolve(newkey);
    })
    setTimeout(() => reject(), 30e3)
  });
}

export const hasKey = () => valid;

const saveKey = () => FileLib.write(keyPath, key);

const setKey = newkey => {
  key = newkey;
  valid = true;
  listeners.forEach(([cb]) => cb(key));
  listeners = listeners.filter(([_, single]) => !single);
  saveKey();
}

/**
 * Get the info for a key
 * Rejects with a string containing the cause if the key is invalid
 * @param {string} key 
 * @returns {Promise<{
 *  key: string,
 *  owner: string,
 *  limit: number,
 *  queriesInPastMin: number,
 *  totalQueries: number
 * }>}
 */
export const getKeyInfo = key => {
  return request({
    url: `https://api.hypixel.net/key?key=${key}`,
    json: true,
  }).then(({success, record, cause}) => {
    if(!success) return Promise.reject(cause);
    return record;
  });
}

/**
 * Check if a key is valid
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
export const validify = key => getKeyInfo(key).then(() => true).catch(() => false);

/**
 * @param {number} x 
 * @returns {string}
 */
const numberWithCommas = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

register('chat', setKey).setCriteria('&aYour new API key is &r&b${key}&r');

const makeApiKeyComponent = key => new TextComponent(`&b${key}`).setHover('show_text', '&eClick to put the key in chat so you can copy!').setClick('suggest_command', key);

const sayInvalidWarn = () => {
  ChatLib.chat('&cYour current API key is invalid!');
  sayMakeKey();
}

const sayNoKeyWarn = () => {
  ChatLib.chat('&cYou do not have an API key set!');
  sayMakeKey();
}

const sayMakeKey = () => ChatLib.chat('&cSet one with /api set <key> or generate a new one with /api new.');

const subcommands = {
  new: () => {
    ChatLib.command('api new');
  },
  get: () => {
    if(valid) ChatLib.chat(new Message('&aYour API key is ', makeApiKeyComponent(key)));
    else {
      if(!key) sayNoKeyWarn();
      else sayInvalidWarn();
    }
  },
  set: newkey => {
    if(!newkey) return ChatLib.chat('&cPlease enter your key with /api set <key>.')
    validify(newkey).then(isValid => {
      if(isValid){
        setKey(newkey)
        ChatLib.chat(new Message('&aSaved your API key as ', makeApiKeyComponent(newkey)));
      }else{
        ChatLib.chat(`&cIt appears your API key was invalid!`);
      }
    });
  },
  stats: otr => {
    let checking = key;
    let self = true;
    if(otr){
      checking = otr;
      self = false;
    }
    if(!checking){
      sayNoKeyWarn();
      return;
    }
    getKeyInfo(checking).then(data => {
      ChatLib.chat(new Message('&aKey: ', makeApiKeyComponent(checking)));
      ChatLib.chat(new Message('&aOwner: ', new TextComponent(`&b${data.owner}`).setHover('show_text', '&eClick to put the uuid in chat so you can copy!').setClick('suggest_command', data.owner)));
      ChatLib.chat(`&aLimit: &b${data.limit}`);
      ChatLib.chat(`&aQueries in the last minute: &b${numberWithCommas(data.queriesInPastMin)}`);
      ChatLib.chat(`&aTotal Queries: &b${numberWithCommas(data.totalQueries)}`);
    }).catch(() => {
      if(self) {
        ChatLib.chat(`&cUh oh! Looks like your API key was invalid!`)
        valid = false;
      } else {
        ChatLib.chat(`&cLooks like that key is invalid!`);
      }
    })
  }
}

const commandTrigger = register('command', (...args) => {
  const subcommand = args[0]?.toLowerCase();
  if(!subcommand) {
    ChatLib.chat(`&a&l--- API KEY MANAGER ---`);
    ChatLib.chat(`&b/api new &a- Generate a new API key`);
    ChatLib.chat(`&b/api get &a- Display your current API key`);
    ChatLib.chat(`&b/api set <key> &a- Set your current API key`);
    ChatLib.chat(`&b/api stats &a- View stats about your API key`);
  }
  else if(!(subcommand in subcommands)) ChatLib.chat(`&cInvalid Command! &aThe available commands are: &b${Object.keys(subcommands).join('&a, &b')}&a.`);
  else subcommands[subcommand](...args.slice(1));
}).setName('api');
addCustomCompletion(commandTrigger, args => {
  const first = args[0]?.toLowerCase() || '';
  console.log(args.toString())
  console.log(first)
  console.log(Object.keys(subcommands).filter(c => c.startsWith(first)).toString())
  return Object.keys(subcommands).filter(c => c.startsWith(first))
})
