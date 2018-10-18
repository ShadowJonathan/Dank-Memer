/** @typedef {import("../models/GenericCommand").Memer} Memer
 * @typedef {import("../models/UserEntry").UserData} UserData
 * @typedef {import("../models/GuildEntry").GuildData} GuildData
 * @typedef {import("../models/UserEntry")} UserEntry
 * @typedef {import("../models/GuildEntry")} GuildEntry
 */

/** @typedef {Object} SubscriptionData The data relevant to a guild's subscription to dev announcements
 * @prop {String} id The ID of the guild
 * @prop {String} channelID The ID of the channel where to send dev announcements
 */

/** @typedef {Object} CooldownData The data relevant to a user's cooldowns
 * @prop {String} id The ID of the user
 * @prop {Array<Object>} cooldowns An array of objects containing a single property, the property name being a command name and representing the user's cooldown for this command, like `{ daily: 1538651634908 }`
 */

/** @typedef {Object} PlsData The data relevant to a guild's command usage
 * @prop {String} id The ID of the guild
 * @prop {Number} pls The amount of commands ran on this guild
 */

/** @typedef {Object} DonorData The data relevant to a donor
 * @prop {String} id The ID of the user
 * @prop {Number} donorAmount The $ amount this user is donating monthly
 * @prop {Array<String>} guilds An array of guild IDs set as premium by this donor
 * @prop {Number} guildRedeems The amount of guilds set as premium by this donor, should equal `guilds.length`
 * @prop {String} firstDonationDate The date of when the user first donated
 * @prop {String|null} declinedSince The date of when the user first started to decline the payment, can be `null` and isn't guaranteed to be accurate
 * @prop {Number} totalPaid The total amount this user donated, not guaranteed to be accurate
 * @prop {String} patreonID The ID of this user's patreon account
 */

/** @typedef {Object} TagData The data relevant to a guild tag
 * @prop {String} guild_id The ID of the guild
 * @prop {String} name The name of the tag
 * @prop {String} text The text this tag contains
 */

/** @typedef {Object} BaseAutopostData The data relevant to a guild's autopost setup
 * @prop {String} id The ID of the guild
 * @prop {String} channel The ID of the channel where autopost is set to be sent to, may be innacurate as it is efficitely decided by where the webhook points
 * @prop {Number} interval The interval in minutes set between each post, can only be a multiple of `5`
 * @prop {String} webhookID The ID of the webhook created for this autopost
 * @prop {String} webhookToken The ID of the webhook created for this autopost
 */

/** @typedef {Object} ComplementaryNSFWAutopostData
 * @prop {String} type The type of porn set for this autopost, can be either `4k`, `boobs`, `ass`, `lesbian` or `gif`
 */

/** @typedef {BaseAutopostData & ComplementaryNSFWAutopostData} NSFWAutopostData The data relevant to a guild's autonsfw setup */

const User = require('../models/UserEntry');
const Guild = require('../models/GuildEntry');

class DatabaseFunctions {
  /**
   *  @param {Memer} Memer The Memer instance
   */
  constructor (Memer) {
    /** @type {Memer} The Memer instance */
    this.client = Memer;
  }

  /**
   *
   * @param {String} id The ID of the guild entry to delete
   * @returns {Promise<void>}
   */
  async deleteGuild (id) {
    return this.client.r.table('guilds')
      .get(id)
      .delete()
      .run();
  }

  /**
   * Get all the guilds subscribed to dev announcements
   * @returns {Promise<Array<SubscriptionData>>}
   */
  async getDevSubscribers () {
    return this.client.r.table('updates')
      .run();
  }

  /**
   * Update/insert a guild's subscription to dev announcements
   * @param {String} guildID The ID of the guild to update
   * @param {String} channelID The ID of the channel where dev announcements should be sent
   * @returns {Promise<void>}
   */
  async updateDevSubscriber (guildID, channelID) {
    return this.client.r.table('updates')
      .insert({
        id: guildID,
        channelID
      }, { conflict: 'update' })
      .run();
  }

  /**
   *
   * @param {String} id The ID of the guild to delete the subscription from
   * @returns {Promise<void>}
   */
  async deleteDevSubscriber (guildID) {
    return this.client.r.table('updates')
      .get(guildID)
      .delete()
      .run();
  }

  /**
   * Update a user's cooldowns, this can be used to both create or update existing cooldowns
   * @param {String} command The name of the command the user just ran, can be any of its triggers
   * @param {String} userID The ID of the user who just ran the command
   * @param {Boolean} isGlobalPremiumGuild Whether the guild on which the command was ran is a premium guild redeemed by a 20$+ donor
   * @returns {Promise<void>}
   */
  async updateCooldowns (command, userID, isGlobalPremiumGuild) {
    const pCommand = this.client.cmds.find(c => c.props.triggers.includes(command.toLowerCase()));
    if (!pCommand) {
      return;
    }
    const isDonor = isGlobalPremiumGuild || await this.getDonor(userID);
    let cooldown;
    if (isDonor) {
      cooldown = pCommand.props.donorCD;
    } else {
      cooldown = pCommand.props.cooldown;
    }
    const profile = await this.getCooldowns(userID, cooldown > 20000 ? 'db' : false);
    if (!profile) {
      return this.createCooldowns(command, userID, isGlobalPremiumGuild);
    }
    if (profile.cooldowns.some(cmd => cmd[command])) {
      profile.cooldowns.forEach(cmd => {
        if (cmd[command]) {
          cmd[command] = Date.now() + cooldown;
        }
      });
    } else {
      profile.cooldowns.push({ [command]: Date.now() + cooldown });
    }
    if (cooldown <= 20000) {
      return this.client.cooldowns.set(userID, { id: userID, cooldowns: profile.cooldowns });
    }
    return this.client.r.table('cooldowns')
      .insert({ id: userID, cooldowns: profile.cooldowns }, { conflict: 'update' });
  }

  /**
   * "Create" a cooldown for this user
   * @param {String} command The name of the command the user just ran, can be any of its triggers
   * @param {String} userID The ID of the user who just ran the command
   * @param {Boolean} isGlobalPremiumGuild Whether the guild on which the command was ran is a premium guild redeemed by a 20$+ donor
   * @returns {Promise<void>}
   */
  async createCooldowns (command, userID, isGlobalPremiumGuild) {
    const pCommand = this.client.cmds.find(c => c.props.triggers.includes(command.toLowerCase()));
    if (!pCommand) {
      return;
    }
    const isDonor = isGlobalPremiumGuild || await this.getDonor(userID);
    const cooldown = isDonor ? pCommand.props.donorCD : pCommand.props.cooldown;
    if (cooldown < 20000) {
      return this.client.cooldowns.set(userID, { id: userID, cooldowns: [ { [command]: Date.now() + cooldown } ] });
    } else {
      return this.client.r.table('cooldowns')
        .insert({ id: userID, cooldowns: [ { [command]: Date.now() + cooldown } ] });
    }
  }

  /**
   * Get the cooldowns of a user
   * @param {String} userID The ID of the user to get cooldowns from
   * @param {String} [type] Can be either `all` or `db`, `db` will only get the cooldowns in the database, `all` will get those in-memory too. Anything else will only return the in-memory cooldowns
   * @returns {Promise<CooldownData>}
   */
  async getCooldowns (userID, type) {
    let all = type === 'all';
    if (all || type !== 'db') {
      const cooldown = this.client.cooldowns.get(userID) || {
        cooldowns: [],
        id: userID
      };
      if (!all) {
        return cooldown;
      } else {
        all = cooldown;
      }
    }
    return this.client.r.table('cooldowns')
      .get(userID)
      .run()
      .then(cd => {
        if (all) {
          all.cooldowns = all.cooldowns.concat(cd ? cd.cooldowns : []);
          return all;
        }
        return cd;
      });
  }

  /**
   *
   * @param {String} userID The ID of the user to delete the cooldowns from
   * @returns {Promise<void>}
   */
  async deleteCooldowns (userID) {
    this.client.cooldowns.delete(userID);
    return this.client.r.table('cooldowns')
      .get(userID)
      .delete()
      .run();
  }

  /**
   * Get a specific cooldown of a user
   * @param {Object} command The command properties
   * @param {String} userID The ID of the user to get the cooldown of this command from
   * @param {Boolean} isDonor Whether the user is a donor
   * @param {Boolean} isGlobalPremiumGuild Whether this guild is a premium guild redeemed by a 20$+ donor
   * @returns {Promise<Number>} The UNIX epoch timestamp at which this cooldown will expire, will be `1` if the user had no cooldowns previously set
   */
  async getSpecificCooldown (command, userID, isDonor, isGlobalPremiumGuild) {
    const cooldown = isDonor || isGlobalPremiumGuild ? (command.donorCD || command.cooldown) : command.cooldown;
    const profile = cooldown < 20000 ? this.client.cooldowns.get(userID) : await this.client.r.table('cooldowns').get(userID).run();
    if (!profile) {
      return 1;
    }
    const cooldowns = profile.cooldowns.find(item => item[command.triggers[0]]);
    if (!cooldowns) {
      return 1;
    }
    return profile.cooldowns.find(item => item[command.triggers[0]])[command.triggers[0]];
  }

  /**
   * Block (blacklist) the given user/guild
   * @param {String} id The ID of the user/guild to block
   * @returns {Promise<void>}
   */
  async createBlock (id) {
    return this.client.r.table('blocked')
      .insert({ id })
      .run();
  }

  /**
   * Unblock (un-blacklist) the given user/guild
   * @param {String} id The ID of the user/guild to unblock
   * @returns {Promise<void>}
   */
  async removeBlock (id) {
    return this.client.r.table('blocked')
      .get(id)
      .delete()
      .run();
  }

  /**
   * Checks if the given guild/user is blocked
   * @param {String} guildID The ID of the guild to check, if a guild
   * @param {String} authorID The ID of the user to check, if a user
   * @returns {Promise<Boolean>}
   */
  async checkBlocked (guildID, userID = 1) {
    return this.client.r.table('blocked').filter(u => u('id').eq(guildID) || u('id').eq(userID)).count().gt(0).run();
  }

  /**
   * Update a guild and user command usage
   * @param {String} guildID The ID of the guild to update command usage from
   * @param {String} userID The ID of the user to update command usage from
   * @returns {Promise<void>}
   */
  async addPls (guildID, userID) {
    this.client.r.table('guildUsage')
      .get(guildID)
      .default({
        id: guildID,
        pls: 0
      })
      .update({
        pls: this.client.r.row('pls').add(1)
      }, { conflict: 'update' })
      .run();

    return this.client.r.table('users')
      .get(userID)
      .update({
        pls: this.client.r.row('pls').add(1)
      })
      .run();
  }

  /**
   * Delete the tracked command usage of a guild
   * @param {String} guildID The ID of the guild to delete command usage of
   * @returns {Promise<void>}
   */
  async deletePls (guildID) {
    return this.client.r.table('guildUsage')
      .get(guildID)
      .delete()
      .run();
  }

  /**
   * Get the given guild command usage
   * @param {String} guildID The ID of the guild to get command usage from
   * @returns {Promise<PlsData>}
   */
  async getPls (guildID) {
    return this.client.r.table('guildUsage')
      .get(guildID)
      .default({ id: guildID, pls: 0 })
      .run();
  }

  /**
   * Get the first 10 guilds that used commands the most
   * @returns {Promise<Array<PlsData>>}
   */
  async topPls () {
    return this.client.r.table('guildUsage')
      .orderBy({index: this.client.r.desc('pls')})
      .limit(10)
      .run();
  }

  /**
   * Get the first 10 users who ran the most commands
   * @returns {Promise<Array<UserData>>}
   */
  async topUsers () {
    return this.client.r.table('users')
      .orderBy({index: this.client.r.desc('pls')})
      .limit(10)
      .run();
  }

  /**
   * Delete the given user from the database
   * @param {String} userID The ID of the user to delete from the database
   */
  async removeUser (userID) {
    return this.client.r.table('users')
      .get(userID)
      .delete()
      .run();
  }

  /**
   * Get the first 10 richest users
   * @returns {Promise<Array<UserData>>}
   */
  async topPocket () {
    return this.client.r.table('users')
      .orderBy({index: this.client.r.desc('pocket')})
      .limit(10)
      .run();
  }

  /**
   * Get the first 10 users who spammed the most
   * @returns {Promise<Array<UserData>>}
   */
  async topSpam () {
    return this.client.r.table('users')
      .orderBy({index: this.client.r.desc('spam')})
      .limit(10)
      .run();
  }

  /**
   * Insert a donor into the database
   * @param {String} id The ID of the discord user
   * @param {Number} donorAmount The amount the user is donating monthly
   * @param {String} donationDate The date of the user's first donation
   * @param {String} declineDate The date of when the user first started to decline (may be `null`)
   * @param {String} patreonID The ID of the user's patreon account
   * @returns {Promise<void>}
   */
  async addDonor (id, donorAmount, donationDate, declineDate, patreonID) {
    return this.client.r.table('donors')
      .get(id)
      .replace({
        id,
        donorAmount,
        guilds: this.client.r.row('donorAmount').default(donorAmount).ge(donorAmount).branch(this.client.r.row('guilds').default([]), []),
        guildRedeems: this.client.r.row('donorAmount').default(donorAmount).ge(donorAmount).branch(this.client.r.row('guildRedeems').default(0), 0),
        firstDonationDate: donationDate || this.client.r.row('donationDate').default(this.client.r.now()),
        declinedSince: declineDate || null,
        totalPaid: donorAmount,
        patreonID: this.client.r.row('patreonID').default(patreonID || 0)
      })
      .run();
  }

  /**
   * Get a donor by their discord ID
   * @param {String} id The ID of the donor to get (discord id)
   * @returns {Promise<DonorData>}
   */
  async getDonor (id) {
    return this.client.r.table('donors')
      .get(id)
      .default(false)
      .run();
  }

  /**
   * Checks if the given guild is a premium guild
   * @param {String} id The ID of the guild to check
   * @returns {Promise<Boolean>} Whether the guild is a premium guild
   */
  async checkPremiumGuild (id) {
    return !!await this.client.r.table('donors')
      .filter(this.client.r.row('guilds').contains(id))
      .count();
  }

  /**
   * Update the premium guilds redeemed by the given donor
   * @param {String} id The ID of the donor
   * @param {Array<String>} guilds An array of guild IDs redeemed by this donor
   * @param {Number} guildRedeems The amount of guilds redeemed by this donor, should equal `guilds.length`
   * @returns {Promise<void>}
   */
  async updateDonorGuild (id, guilds, guildRedeems) {
    return this.client.r.table('donors')
      .insert({
        id,
        guilds,
        guildRedeems
      }, { conflict: 'update' })
      .run();
  }

  /**
   * Removes the given donor from the donors table
   * @param {String} id The ID of the donor
   * @returns {Promise<void>}
   */
  async removeDonor (id) {
    return this.client.r.table('donors')
      .get(id)
      .delete()
      .run();
  }

  /**
   * Get an array of donors who first declined more than 1 months ago
   * @returns {Promise<Array<DonorData>>}
   */
  async findExpiredDonors () {
    return this.client.r.table('donors')
      .filter(this.client.r.row('declinedSince').lt(this.client.r.now().sub(30 * 24 * 60 * 60)))
      .run(); // only 1 month after decline date
  }

  /**
   * Wipe the donors who first declined more than two months ago
   * @returns {Promise<Array<DonorData>>}
   */
  async wipeExpiredDonors () {
    return this.client.r.table('donors')
      .filter(this.client.r.row('declinedSince').lt(this.client.r.now().sub(60 * 24 * 60 * 60))) // 2 months after decline date
      .delete({returnChanges: 'always'})
      .run()
      .then(d => d.changes.map(o => o.old_val));
  }

  /**
   * Check if the given guild is a premium guild redeemed by a 20$+ donor
   * @param {String} id The ID of the guild to check
   * @returns {Promise<void>}
   */
  async checkGlobalPremiumGuild (id) {
    return this.client.r.table('donors')
      .filter(this.client.r.row('guilds').contains(id))
      .run()
      .then(results => results[0] && results[0].donorAmount >= 20);
  }

  /**
   * Get the global stats of the bot
   * @returns {Promise<Object>}
   */
  async getStats () {
    return this.client.r.table('stats')
      .get(1)('stats')
      .run();
  }

  /**
   * Add a new tag
   * @param {String} id The ID of the guild this tag belongs to
   * @param {String} name The name of the tag
   * @param {String} text The text this tag contains
   * @returns {Promise<void>}
   */
  async addTag (id, name, text) {
    return this.client.r.table('tags')
      .insert({guild_id: id, name: name, text: text});
  }

  /**
   * Get all tags of a guild
   * @param {String} id The ID of the guild to get all tags from
   * @returns {Promise<Array<TagData>>}
   */
  async getAllTags (id) {
    let tags = await this.client.r.table('tags')
      .getAll(id, {index: 'guild_id'});
    return tags;
  }

  /**
   *
   * @param {String} id The ID of the guild to get the tag from
   * @param {String} name The name of the tag to get
   * @returns {Promise<TagData>}
   */
  async getTag (id, name) {
    let tags = await this.client.r.table('tags')
      .filter({name: name, guild_id: id})
      .run();
    return tags[0] || false;
  }

  /**
   *
   * @param {String} id The ID of the guild to delete a tag from
   * @param {String} name The name of the tag to delete
   * @returns {Promise<void>}
   */
  async removeTag (id, name) {
    return this.client.r.table('tags')
      .filter({name: name, guild_id: id})
      .delete()
      .run();
  }

  /**
   *
   * @param {String} id The ID of the guild to get the automeme setup of
   * @returns {Promise<BaseAutopostData}
   */
  async getAutomemeChannel (id) {
    let channel = await this.client.r.table('automeme')
      .get(id)
      .run();
    return channel || false;
  }

  /**
   *
   * @param {String} id The ID of the guild to delete the automeme setup
   * @returns {Promise<void>}
   */
  async removeAutomemeChannel (id) {
    return this.client.r.table('automeme')
      .get(id)
      .delete()
      .run();
  }

  /**
   * Get all the automeme channels set
   * @returns {Promise<Array<BaseAutopostData>>}
   */
  async allAutomemeChannels () {
    return this.client.r.table('automeme')
      .run();
  }

  /**
   * Configure an automeme channel
   * @param {String} id The ID of the guild
   * @param {String} channelID The ID of the channel where to post to
   * @param {Number} interval The interval at which to post to, may only be a multiple of `5`
   * @param {String} webhookID The ID of the webhook created for this autopost
   * @param {String} webhookToken The token of the webhook created for this autopost
   * @returns {Promise<void>}
   */
  async addAutomemeChannel (id, channelID, interval, webhookID, webhookToken) { // id = guild ID
    return this.client.r.table('automeme')
      .insert({id: id, channel: channelID, interval, webhookID, webhookToken}, { conflict: 'update' });
  }

  /**
   *
   * @param {String} id The ID of the guild to get the autonsfw setup of
   * @returns {Promise<NSFWAutopostData>}
   */
  async getAutonsfwChannel (id) {
    let channel = await this.client.r.table('autonsfw')
      .get(id)
      .run();
    return channel || false;
  }

  /**
   *
   * @param {String} id The ID of the guild to remove the autonsfw setup of
   * @returns {Promise<void>}
   */
  async removeAutonsfwChannel (id) {
    return this.client.r.table('autonsfw')
      .get(id)
      .delete()
      .run();
  }

  /**
   * Get all the autonsfw channels set
   * @returns {Promise<Array<NSFWAutopostData>>}
   */
  async allAutonsfwChannels () {
    return this.client.r.table('autonsfw')
      .run();
  }

  /**
   * Configure an autonsfw channel
   * @param {String} id The ID of the guild
   * @param {String} channelID The ID of the channel where to post to
   * @param {Number} interval The interval at which to post to, may only be a multiple of `5`
   * @param {String} type The type of porn to send
   * @param {String} webhookID The ID of the webhook created for this autopost
   * @param {String} webhookToken The token of the webhook created for this autopost
   * @returns {Promise<void>}
   */
  async addAutonsfwChannel (id, channelID, interval, type, webhookID, webhookToken) { // id = guild ID
    return this.client.r.table('autonsfw')
      .insert({id, channel: channelID, interval, type, webhookID, webhookToken}, { conflict: 'update' })
      .run();
  }

  /**
   * Get the default user entry data for a user
   * @param {String} id The ID of the user to get a default entry for
   * @returns {UserData}
   */
  getDefaultUser (id) {
    return {
      id, // User id/rethink id
      pls: 1, // Total commands ran
      lastCmd: Date.now(), // Last command time
      lastRan: 'nothing', // Last command ran
      spam: 0, // Spam means 2 commands in less than 1s
      pocket: 0, // Coins not in bank account
      bank: 0, // Coins in bank account
      lost: 0, // Total coins lost
      won: 0, // Total coins won
      shared: 0, // Transferred to other players
      streak: {
        time: 0, // Time since last daily command
        streak: 0 // Total current streak
      },
      upvoted: false, // DBL voter status
      dblUpvoted: false // discordbotlist.com voter status
    };
  }

  /**
   * Get the default guild entry data for a guild
   * @param {String} id The ID of the guild to get a default entry for
   * @returns {GuildData}
   */
  getDefaultGuild (id) {
    return {
      id,
      prefix: this.client.config.options.prefix,
      modlog: '',
      disabledCategories: [],
      disabledCommands: [],
      enabledCommands: [],
      whitelistRoles: [],
      autoResponse: {
        dad: false,
        ree: false,
        sec: false,
        nou: false
      },
      swearFilter: false
    };
  }

  /**
   *
   * @param {String} id The ID of the user to get
   * @returns {Promise<UserEntry>}
   */
  async getUser (id) {
    return this.client.r.table('users').get(id).default(this.getDefaultUser(id)).run().then(u => new User(u, this.client));
  }

  /**
   *
   * @param {String} id The ID of the guild to get
   * @returns {Promise<GuildEntry>}
   */
  async getGuild (id) {
    return this.client.r.table('guilds').get(id).default(this.getDefaultGuild(id)).run().then(g => new Guild(g, this.client));
  }
}

module.exports = DatabaseFunctions;
