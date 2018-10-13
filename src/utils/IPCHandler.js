/** @typedef {import("../models/GenericCommand").Memer} Memer 
*/

/** @typedef {Object} ClusterStats
 * @prop {Number} cluster The ID of the cluster
 * @prop {Number} shards The amount of shards on this cluster
 * @prop {Number} guilds The total amount of guilds across all clusters
 * @prop {Number} ram The RSS RAM usage of this cluster (in MB)
 * @prop {Number} voice The amount of voice connections on this cluster
 * @prop {Number} uptime The uptime of this cluster in milliseconds
 * @prop {Number} exclusiveGuilds The amount of guilds on this cluster
 * @prop {Number} largeGuilds The amount of large guilds on this cluster (250+ members)
 */

class IPCHandler {
    /**
     * @param {Memer} client The Memer instance
     */
    constructor(client) {
        /** @type {Map} A map of the current ongoing requests */
        this.requests = new Map();
        /** @type {Memer} The Memer instance */
        this.client = client;
        this._handleIncomingMessage = this._handleIncomingMessage.bind(this);
        this.client.ipc.register('memerIPC', this._handleIncomingMessage);
        this._idsGenerated = 0;
    }

    /**
     * Returns a new unique ID
     *
     * @readonly
     * @memberof IPCHandler
     * @type {String}
     */
    get uid () {
        return `${Date.now()}-${process.pid}-${this._idsGenerated++}`;
    }

    /**
     * Fetch the stats of the shards of each cluster
     * @returns {Promise<Array>} An array of clusters with their shards stats
     */
    fetchShardsStats() {
        const ID = Date.now();
        return new Promise(resolve => {
            this.requests.set(ID, {
                responses: [],
                resolve: resolve
            });
            this.client.ipc.broadcast("fetchShardsStats", {
                id: ID,
                type: "fetchShardsStats",
                clusterID: this.client.clusterID
            });
        });
    }

    /**
     *
     * @param {string} type - The type of the file that should be reloaded, either "command", "event" or "module"
     * @param {string} path - The absolute path of the file that should be reloaded
     * @param {string} [name] - If a module, the name of the module
     * @param {object} [options] - If a module, the options that Reloader.reloadModule() expect
     * @returns {Promise<array>} An array containing the responses of each clusters, if the reload failed in at least one cluster, the promise is rejected
     */
    broadcastReload(type, path, name, options) {
        const ID = `${this.client.utils.getRandomNumber(1000, 10000) + Date.now()}`;
        return new Promise((resolve, reject) => {
            this.requests.set(ID, {
                responses: [],
                resolve: resolve,
                reject: reject
            });
            this.client.ipc.broadcast("reload", {
                id: ID,
                type: "reload",
                clusterID: this.client.clusterID,
                data: {
                    type: type,
                    path: path,
                    name: name,
                    options: options
                }
            });
        });
    }

    fetchGuild(id) {
        if (this.client.bot.guilds.has(id)) {
            return this.client.bot.guilds.get(id);
        }
        const ID = `${this.client.getRandomNumber(1000, 10000) + Date.now()}`;
        return new Promise((resolve, reject) => {
            this.requests.set(ID, {
                responses: [],
                resolve: resolve,
                reject: reject
            });
            this.client.ipc.broadcast("fetchGuild", {
                id: ID,
                type: "fetchGuild",
                clusterID: this.client.clusterID,
                data: id
            });
        });
    }

    /**
     * Called every time the message event is fired on the process
     * @param {*} message - The message
     * @private
     * @returns {void}
     */
    _handleIncomingMessage(message) {
        switch (message.type) {
        case "shardsStats":
            let request = this.requests.get(message.id);
            request.responses.push({clusterID: message.clusterID, data: message.data});

            if (this._allClustersAnswered(message.id)) {
                //Resolve the request and reorder the responses in case it wasn't already
                request.resolve(request.responses.sort((a, b) => a.clusterID - b.clusterID));
                this.requests.delete(message.id);
            }
            break;

        case "statsUpdate":
            this.client.stats = message.data;
            if (!this.clusterCount) {
                this.clusterCount = message.data.clusters.length;
            }
            break;

        case "fetchShardsStats":
            this.client.ipc.sendTo(message.clusterID, "shardsStats", {
                type: "shardsStats",
                id: message.id,
                clusterID: this.client.clusterID,
                data: this.client.bot.shards.map(shard => {
                    return {
                        id: shard.id,
                        status: shard.status,
                        latency: shard.latency,
                        guilds: this.client.bot.guilds.filter(g => g.shard.id === shard.id).length,
                        musicConnections: this.client.handlers.MusicManager
                            ? this.client.handlers.MusicManager.connections.size
                            : 0
                    };
                })
            });
            break;

        case "reload":
            let success = true;
            try {
                if (message.data.type === "event") {
                    this.client.handlers.Reloader.reloadEventListener(message.data.path);
                } else if (message.data.type === "command") {
                    this.client.handlers.Reloader.reloadCommand(message.data.path);
                } else if (message.data.type === "module") {
                    this.client.handlers.Reloader.reloadModule(message.data.path, message.data.name, message.data.options);
                } else if (message.data.type === "utils") {
                    this.client.handlers.Reloader.reloadUtils();
                } else if (message.data.type === "commands") {
                    this.client.handlers.Reloader.reloadCommands();
                } else if (message.data.type === "structures") {
                    this.client.handlers.Reloader.reloadStructures();
                } else if (message.data.type === "handlers") {
                    this.client.handlers.Reloader.reloadHandlers();
                } else if (message.data.type === "events") {
                    this.client.handlers.Reloader.reloadEventListener('all');
                }
            } catch (err) {
                success = false;
                this.client.bot.emit("error", err);
            }

            this.client.ipc.sendTo(message.clusterID, "reloadDone", {
                type: "reloadDone",
                id: message.id,
                clusterID: this.client.clusterID,
                data: success
            });
            break;

        case "reloadDone":
            let reloadRequest = this.requests.get(message.id);
            if (!reloadRequest) {
                return;
            }
            reloadRequest.responses.push({clusterID: message.clusterID, data: message.data});

            if (this._allClustersAnswered(message.id)) {
                //Resolve the request and reorder the responses in case it wasn't already
                if (reloadRequest.responses.filter(r => !r.data)[0]) {
                    reloadRequest.reject(reloadRequest.responses.sort((a, b) => a.clusterID - b.clusterID));
                } else {
                    reloadRequest.resolve(reloadRequest.responses.sort((a, b) => a.clusterID - b.clusterID));
                }
                this.requests.delete(message.id);
            }
            break;

        case "fetchGuild":
            let guild = this.client.bot.guilds.get(message.data);
            if (guild) {
                guild = {
                    ...guild
                }; //Shallow clone
                guild.members = Array.from(guild.members.values());
                guild.roles = Array.from(guild.roles.values());
                guild.channels = Array.from(guild.channels.values());
            }
            this.client.ipc.sendTo(message.clusterID, "requestedGuild", {
                type: "requestedGuild",
                id: message.id,
                clusterID: this.client.clusterID,
                data: guild
            });
            break;

        case "requestedGuild":
            if (!this.requests.has(message.id)) {
                return;
            }
            if (this._allClustersAnswered(message.id)) {
                this.requests.get(message.id).resolve(message.data);
                // @ts-ignore
                return this.requests.delete(message.id);
            }
            if (message.data) {
                this.requests.get(message.id).resolve(message.data);
                // @ts-ignore
                return this.requests.delete(message.id);
            }
            break;
        }
        if (process.argv.includes("--dev")) {
            process.send({
                name: "log",
                msg: `Received the message ${message.type} from cluster ${message.clusterID}: ${JSON.stringify(message, null, 2)}`
            });
        }
    }

    /**
     * Check if all the active clusters responded to a request
     * @param {string} id - The ID of the request to check if all the clusters answered to
     * @returns {boolean} Whether all the active clusters responded to the request
     * @private
     */
    _allClustersAnswered(id) {
        return this.requests.get(id).responses.length >= (
            this.clusterCount
                ? this.clusterCount - this.client.stats.clusters.filter(c => c.guilds < 1).length
                : 1)
            ? true
            : false;
    }

    _reload() {
        process.removeListener('message', this._handleIncomingMessage);
        delete require.cache[module.filename];
        return new(require(module.filename))(this.client, {requests: this.requests});
    }
}

module.exports = IPCHandler;