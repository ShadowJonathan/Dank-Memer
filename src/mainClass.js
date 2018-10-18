const { readdirSync } = require('fs');
const { join } = require('path');
const { Base } = global.memeBase || require('eris-sharder');
const { Cluster } = require('lavalink');
const cluster = require('cluster');
const { StatsD } = require('node-dogstatsd');

let MessageCollector = require('./utils/MessageCollector.js');
let botPackage = require('../package.json');

class Memer extends Base {
  constructor (bot, reload = {}) {
    super(bot);
    this.log = require('./utils/logger.js');
    this.config = require('./config.json');
    this.secrets = require('./secrets.json');
    this.r = reload.r || require('rethinkdbdash')();
    this.ddog = reload.ddog || new StatsD();
    this.db = new (require('./utils/dbFunctions.js'))(this);
    this.http = require('./utils/http');
    this.cmds = [];
    this.tags = {};
    this.indexes = {
      'meme': {},
      'joke': {},
      'copypasta': {},
      '4chan': {},
      'tifu': {},
      'wholesome': {},
      'prequel': {},
      'aww': {},
      'facepalm': {},
      'showerthoughts': {},
      'comics': {},
      'meirl': {},
      'hoppyboi': {},
      'surreal': {},
      'memeeconomy': {},
      'blacktwitter': {},
      'antijoke': {},
      'antiantijoke': {},
      'sequel': {},
      'hootyboi': {},
      'animals': {},
      'foodporn': {},
      'snek': {}
    };
    this.stats = {
      messages: 0,
      commands: 0,
      guildsJoined: 0,
      guildsLeft: 0,
      errReported: 0,
      err: 0
    };
    this.redis = reload.redis;
    this.lavalink = reload.lavalink;
    this.listeners = {};
    this.cooldowns = new Map();
    this.IPC = new (require('./utils/IPCHandler.js'))(this);
    this._cooldownsSweep = setInterval(this._sweepCooldowns.bind(this), 1000 * 60 * 30);
    // work-around to benefit from nice documentation and still have misc functions assigned on the Memer instance
    const MiscFunctions = new (require('./utils/misc.js'))();
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(MiscFunctions))) {
      if (key !== 'constructor') {
        this[key] = MiscFunctions[key];
      }
    }
  }

  async launch () {
    this.redis = this.redis || await require('./utils/redisClient.js')(this.config.redis);

    this.loadCommands();
    this.createIPC();
    this.ddog.increment('function.launch');
    this.MessageCollector = new MessageCollector(this.bot);
    this.loadListeners();
    global.memeBase || this.ready();
    this.autopost = new (require('./utils/Autopost.js'))(this);
    if (cluster.worker.id === 1) {
      this._autopostInterval = setInterval(() => { this.autopost.post(); }, 3e5); // 5 minutes
    }
  }

  async ready () {
    this.IPC.sendTo(1, 'memerIPC', { type: 'restartDone', clusterID: this.clusterID });
    const { bot } = this;
    this.lavalink = this.lavalink || new Cluster({
      nodes: this.config.lavalink.nodes.map(node => ({
        hosts: { ws: `ws://${node.host}:${node.portWS}`, rest: `http://${node.host}:${node.port}` },
        password: this.secrets.memerServices.lavalink,
        shardCount: this.config.sharder.shardCount,
        userID: this.bot.user.id
      })),
      send (guildID, pk) {
        const shardID = bot.guildShardMap[guildID];
        const shard = bot.shards.get(shardID);
        if (!shard) return;
        const { ws } = shard;
        return ws.send(JSON.stringify(pk));
      }
    });
    this.ddog.increment('function.ready');
    this.musicManager = require('./utils/MusicManager')(this);
    this.log(`Ready: ${process.memoryUsage().rss / 1024 / 1024}MB`);
    this.bot.editStatus(null, {
      name: `${this.config.options.prefix} help`,
      type: 0
    });

    this.mentionRX = new RegExp(`^<@!*${this.bot.user.id}>`);
    this.mockIMG = await this.http.get('https://pbs.twimg.com/media/DAU-ZPHUIAATuNy.jpg').then(r => r.body);
  }

  loadListeners () {
    this.listeners.ready = this.ready.bind(this);
    this.bot.on('ready', this.listeners.ready);
    const listeners = require(join(__dirname, 'handlers'));
    for (const listener of listeners) {
      this.listeners[listener] = require(join(__dirname, 'handlers', listener)).handle.bind(this);
      this.bot.on(listener, this.listeners[listener]);
    }
  }

  removeListeners () {
    for (const listener in this.listeners) {
      this.bot.removeListener(listener, this.listeners[listener]);
    }
  }

  createIPC () {
    this.IPC.register('reloadCommands', this.reloadCommands.bind(this));
    this.IPC.register('reloadListeners', this.reloadListeners.bind(this));
    this.IPC.register('reloadAll', this.reload.bind(this));
    this.IPC.register('reloadModels', this.reloadModels.bind(this));
    this.IPC.register('reloadUtils', this.reloadUtils.bind(this));
    this.IPC.register('reloadConfig', this.reloadConfig.bind(this));
  }

  reloadUtils () {
    const utilsPath = join(__dirname, 'utils');
    for (const path in require.cache) {
      if (path.startsWith(utilsPath)) {
        delete require.cache[path];
      }
    }
    this.log = require('./utils/logger.js');
    this.db = new (require('./utils/dbFunctions.js'))(this);
    this.http = require('./utils/http');
    this.bot.removeListener('messageCreate', this.MessageCollector._boundVerify);
    MessageCollector = require('./utils/MessageCollector.js');
    this.MessageCollector = new MessageCollector(this.bot);
    this.autopost = new (require('./utils/Autopost.js'))(this);
    this.IPC = new (require('./utils/IPCHandler.js'))(this);
    const MiscFunctions = new (require('./utils/misc.js'))();
    for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(MiscFunctions))) {
      if (key !== 'constructor') {
        this[key] = MiscFunctions[key];
      }
    }
  }

  loadCommands () {
    this.ddog.increment('function.loadCommands');
    const categories = readdirSync(join(__dirname, 'commands'));

    for (const categoryPath of categories) {
      const category = require(join(__dirname, 'commands', categoryPath));
      for (const command of category.commands) {
        command.category = category.name;
        command.description = category.description;
        command.path = join(__dirname, 'commands', categoryPath, command.props.triggers[0]);
        this.cmds.push(command);
      }
    }
  }

  get package () {
    return botPackage;
  }

  reloadConfig () {
    delete require.cache[require.resolve('./config')];
    delete require.cache[require.resolve('./secrets')];
    delete require.cache[require.resolve('../package')];
    botPackage = require('../package');
    this.config = require('./config');
    this.secrets = require('./secrets');
  }

  reloadModels () {
    const modelsPath = require.resolve(join(__dirname, 'models'));
    for (const path in require.cache) {
      if (path.startsWith(modelsPath)) {
        delete require.cache[path];
      }
    }
    Memer.log(`Reloaded models`);
  }

  reloadListeners () {
    const listenersPath = join(__dirname, 'handlers');
    for (const path in require.cache) {
      if (path.startsWith(listenersPath)) {
        delete require.cache[path];
      }
    }
    this.removeListeners();
    this.loadListeners();
    this.log(`Reloaded event listeners`);
  }

  reloadCommands (msg) {
    if (msg.category) {
      const categoryPath = join(__dirname, 'commands', `${msg.category}Commands`);
      const categoryDir = readdirSync(categoryPath);
      for (const file of categoryDir) {
        delete require.cache[require.resolve(`${categoryPath}/${file}`)];
      }
      const category = require(categoryPath);
      let reloadedCmds = [];
      for (const command of category.commands) {
        command.category = category.name;
        command.description = category.description;
        command.path = require.resolve(`${categoryPath}/${command.props.triggers[0]}`);
        reloadedCmds.push(command);
      }
      this.cmds = this.cmds.filter(c => !c.path.includes(`${msg.category}Commands`)).concat(reloadedCmds);
      this.log(`Reloaded command category ${msg.category}`);
    } else if (msg.command) {
      const cmd = this.cmds.find(c => c.props.triggers.includes(msg.command));
      const cmdPath = require.resolve(cmd.path);
      delete require.cache[cmdPath];
      const reloadedCmd = require(cmdPath);
      reloadedCmd.category = cmd.category;
      reloadedCmd.description = cmd.description;
      reloadedCmd.path = cmd.path;
      this.cmds.splice(this.cmds.findIndex(c => c.props.triggers.includes(msg.command), 1));
      this.cmds.push(reloadedCmd);
      this.log(`Reloaded command ${reloadedCmd.props.triggers[0]}`);
    } else {
      const commandPath = join(__dirname, 'commands');
      for (const path in require.cache) {
        if (path.startsWith(commandPath)) {
          delete require.cache[path];
        }
      }
      this.cmds = [];
      this.loadCommands();
      this.log(`Reloaded all ${this.cmds.length} commands`);
    }
  }

  reload (msg) {
    for (const path in require.cache) {
      if (path.startsWith(__dirname)) {
        delete require.cache[path];
      }
    }
    for (const key of this.ipc.events) {
      this.ipc.events.delete(key);
    }
    process.removeAllListeners('message');
    this.removeListeners();
    this.bot.removeListener('messageCreate', this.MessageCollector._boundVerify);
    if (!msg.preserveConnections) {
      this.r.getPoolMaster().drain();
      this.redis.disconnect();
      this.ddog.close();
      for (const node of this.lavalink.nodes) {
        for (const player of node.players) {
          node.players.get(player).destroy();
        }
        try {
          node.connection.ws.close();
        } catch (err) {}
      }
    }
    const intervals = [this._cooldownsSweep, this._autopostInterval];
    for (const interval of intervals) {
      clearInterval(interval);
    }
    const Memer = require(module.filename);
    new Memer({ bot: this.bot, clusterID: this.clusterID }, msg.preserveConnections ? { r: this.r, lavalink: this.lavalink, redis: this.redis, ddog: this.ddog } : undefined).launch();
    this.lavalink = null;
    this.r = null;
    this.redis = null;
    this.ddog = null;
  }

  _sweepCooldowns () {
    for (const [key, value] of this.cooldowns) {
      let activeCooldowns = [];
      for (const cooldown of value.cooldowns) {
        if (cooldown[Object.keys(cooldown)[0]] > Date.now()) {
          activeCooldowns.push(cooldown);
        }
      }
      if (!activeCooldowns[0]) {
        this.cooldowns.delete(key);
      } else if (activeCooldowns.length !== value.cooldowns.length) {
        this.cooldowns.set(key, {
          cooldowns: activeCooldowns,
          id: key
        });
      }
    }
  }
}

module.exports = Memer;
