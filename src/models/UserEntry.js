/** @typedef {import("../models/GenericCommand").Memer} Memer */

/** @typedef {Object} UserData
 * @prop {String} id The ID of the user
 * @prop {Number} pls The total amount of commands ran by this user
 * @prop {Number} lastCmd The unix epoch timestamp of when this user last ran a command
 * @prop {String} lastRan The name of the latest command ran by this user
 * @prop {Number} spam The amount of times this user spammed the bot (Ran 2 commands in less than 1 sec)
 * @prop {Number} pocket The amount of coins this user has in their pocket
 * @prop {Number} bank The amount of coins this user has in their bank vault
 * @prop {Number} experience The total amount of experience this user has earned
 * @prop {Number} won The total amount of coins this user has won
 * @prop {Number} lost The total amount of coins this user has lost
 * @prop {Number} shared The total amount of coins this user has transferred to another user
 * @prop {Object} streak Data about the date and current streak of this user
 * @prop {Number} streak.time The unix epoch timestamp of the last time this user ran the daily command
 * @prop {Number} streak.streak The total streak for this user
 * @prop {Boolean} upvoted Whether the user upvoted the bot on discordbots.org
 * @prop {Boolean} dblUpvoted Whether the user upvoted the bot on discordbotlist.com
 */

/**
 * - An interface for user entries, all methods except `update()` updates the data on this `UserEntry` instance, and convert the changes into ReQL queries in the background
 * - The changes won't be saved unless `save()` is called
 * - If you want to return the updated data to the user, it is recommended to use the `UserEntry` instance returned by the `save()` method, as it is guaranteed to be what has been inserted into the database
 * - Changes directly done on `UserEntry.props` **won't be saved**, the `update()` method should be used for changes that aren't covered by the other methods
 * - While chaining calls is possible, chaining calls that update the same value (e.g: `addBank()` followed by `removeBank()`) won't work as intended, as the query for this field will be overwritten
 */
class UserEntry {
  /**
   *
   * @param {UserData} userData The user entry
   * @param {Memer} Memer The Memer instance
   */
  constructor (userData, Memer) {
    /** @type {UserData} The entry's properties */
    this.props = { ...Memer.db.getDefaultUser(userData.id), ...userData };
    /** @type {Memer} The Memer instance */
    this._client = Memer;
    this._changes = {};
  }

  /**
   * Manually update the user entry with the given data, note that the changes won't be reflected in the object
   * @param {Object} object The data to update this user with, rethink queries such as `r.row()` can be used in the object properties
   * @example UserEntry.update({ pocket: 2500 }) //This is an example, `addPocket()` should be used for that
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  update (object) {
    if (typeof object !== 'object') {
      throw new Error('Expected "object" parameter to be an object');
    }
    this._changes = this._client.deepMerge(this._changes, object);
    return this;
  }

  /**
   * Add coins to the user's pocket, this updates the `won` property too
   * @param {Number} amount The amount of coins to add to this user's pocket
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  addPocket (amount) {
    if (!amount) {
      throw new Error('Missing mandatory "amount" parameter');
    }
    amount = typeof amount !== 'number' ? Number(amount) : amount;
    this.props.pocket = this.props.pocket + amount;
    this.props.won = this.props.won + amount;
    this.update({pocket: this._client.r.row('pocket').add(amount), won: this._client.r.row('won').add(amount)});
    return this;
  }

  /**
   * Remove coins from the user's pocket, this updates the `lost` property too
   * @param {Number} amount The amount of coins to remove from this user's pocket
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  removePocket (amount) {
    if (!amount) {
      throw new Error('Missing mandatory "amount" parameter');
    }
    amount = typeof amount !== 'number' ? Number(amount) : amount;
    this.props.pocket = Math.max(this.props.pocket - amount, 0);
    this.props.lost = this.props.lost + amount;
    this.update({pocket: this._client.r.expr([this._client.r.row('pocket').sub(amount), 0]).max(), lost: this._client.r.row('lost').add(amount)});
    return this;
  }

  /**
   * Add coins to the user's bank, this can also be used to transfer coins from the user's pocket to their bank vault
   * @param {Number} amount The amount of coins to add to the user's bank vault
   * @param {Boolean} [transfer=true] Whether to transfer the coins from the user's pocket to their bank vault, defaults to `true`
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  addBank (amount, transfer = true) {
    if (!amount) {
      throw new Error('Missing mandatory "amount" parameter');
    }
    amount = typeof amount !== 'number' ? Number(amount) : amount;
    this.props.bank = this.props.bank + amount;
    let changes = { bank: this._client.r.row('bank').add(amount) };
    if (transfer) {
      this.props.pocket = Math.max(this.props.pocket - amount, 0);
      changes['pocket'] = this._client.r.expr([this._client.r.row('pocket').sub(amount), 0]).max();
    }
    this.update(changes);
    return this;
  }

  /**
   * Remove coins from the user's bank, this can also be used to transfer coins from the user's bank vault to their pocket
   * @param {Number} amount The amount of coins to remove from the user's bank vault
   * @param {Boolean} [transfer=true] Whether to transfer the coins from the user's bank vault to their pocket, defaults to `true`
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  removeBank (amount, transfer = true) {
    if (!amount) {
      throw new Error('Missing mandatory "amount" parameter');
    }
    amount = typeof amount !== 'number' ? Number(amount) : amount;
    this.props.bank = Math.max(this.bank - amount, 0);
    let changes = { bank: this._client.r.expr([this._client.r.row('bank').sub(amount), 0]).max() };
    if (transfer) {
      this.props.pocket = this.props.pocket + amount;
      changes['pocket'] = this._client.r.row('pocket').add(amount);
    }
    this.update(changes);
    return this;
  }

  /**
   * Add experience to the user
   * @param {Number} amount The amount of experience the user should gain
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  addExperience (amount) {
    if (!amount) {
      throw new Error('Missing mandatory "amount" parameter');
    }
    amount = typeof amount !== 'number' ? Number(amount) : amount;
    this.props.experience = this.props.experience + amount;
    let changes = { bank: this._client.r.row('experience').add(amount) };
    this.update(changes);
    return this;
  }

  /**
   * Updates the user's `daily` streak
   * @param {Number} [timestamp=Date.now()] The unix epoch timestamp of when the user last ran `daily`, defaults to `Date.now()`
   * @param {Number} [streak=this.streak.streak + 1] The user's streak, defaults to their current streak + 1
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  updateStreak (timestamp = Date.now(), streak = this.streak.streak + 1) {
    this.props.streak = { time: timestamp, streak };
    this.update({ streak: { time: timestamp, streak: this._client.r.row('streak')('streak').add(1) } });
    return this;
  }

  /**
  * Reset the user's `daily` streak
  * @returns {UserEntry} The user entry, so calls can be chained
  */
  resetStreak () {
    this.props.streak.streak = 0;
    this.update({ streak: { streak: 0 } });
    return this;
  }

  /**
   * Increase the user's `pls` count
   * @param {Number} [amount=1] The amount to add to `pls`, defaults to `1`
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  addPls (amount = 1) {
    this.props.pls = this.props.pls + amount;
    this.update({ pls: this._client.r.row('pls').add(amount) });
    return this;
  }

  /**
   * Increase the user's `spam` count
   * @param {Number} [amount=1] The amount to add to `spam`, defaults to `1`
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  addSpam (amount = 1) {
    this.props.spam = this.props.spam + amount;
    this.update({ spam: this._client.r.row('spam').add(amount) });
    return this;
  }

  /**
   * Update the data about the user's last ran command
   * @param {String} [cmd="nothing"] The name of the last command ran by this user, defaults to `nothing`
   * @param {Number} [timestamp=Date.now()] The unix epoch timestamp of when the user last ran a cmd, defauls to `Date.now()`
   * @returns {UserEntry} The user entry, so calls can be chained
   */
  setLastCmd (cmd = 'nothing', timestamp = Date.now()) {
    this.props.lastRan = cmd;
    this.props.lastCmd = timestamp;
    this.update({ lastCmd: timestamp, lastRan: cmd });
    return this;
  }

  /**
   * Saves the user into the database
   * @returns {Promise<UserEntry>} The freshly updated entry
   */
  async save () {
    return this._client.r.table('users')
      .insert(this._client.r.table('users').get(this.id).default(this._client.db.getDefaultUser(this.id)).merge(this._changes), { conflict: 'update', returnChanges: 'always' }).run()
      .then(c => new UserEntry(c.changes[0].new_val, this._client));
  }

  /**
   * Returns this entry but as JSON
   * @returns {String} This entry stringified
   */
  toJSON () {
    return JSON.stringify(this.props);
  }
}

module.exports = UserEntry;
