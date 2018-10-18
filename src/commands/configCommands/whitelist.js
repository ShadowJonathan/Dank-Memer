const {GenericCommand} = require('../../models');

module.exports = new GenericCommand(
  async ({Memer, msg, args, guildEntry}) => {
    if (!msg.member.permission.has('manageGuild') && !Memer.config.options.developers.includes(msg.author.id)) {
      return 'You are not authorized to use this command. You must have `Manage Server` to manage the whitelist.';
    }

    if (!args[0]) {
      return {
        content: `*No first argument detected, entering monologue mode...*

Use this command with multiple sorts of secondary commands: 
Use \`${guildEntry.props.prefix} whitelist add Normies\` to establish a whitelist and add the role with the name 'Normies'
Use \`${guildEntry.props.prefix} whitelist remove Normies\` to remove the role with the name Normies' from the whitelist, no more memes for you!
Use \`${guildEntry.props.prefix} whitelist purge\` to remove the entire whitelist and *set everyone free*, raise anarchy, make a meme castle or whatever.`,
        reply: true
      };
    }

    let name;
    let role;

    if (args[0] === 'add' || args[0] === 'remove') {
      if (args.length < 2) {
        return {content: `I need the name of the role, dummy.`, reply: true};
      } else {
        name = args.slice(1).join(' ');
        role = msg.member.guild.roles.find(r => (r.name.toLowerCase() === name.toLowerCase()) || (r.id === name));

        if (!role) {
          return `No role found with name '${name}', check if you got punctuation alright, it's not case-sensitive.`;
        }
      }
    }

    switch (args[0]) {
      case 'add':
        await guildEntry.addWhitelistedRole(role.id).save();
        return 'Added that role to the whitelist, welcome to the meme club';
      case 'remove':
        await guildEntry.yeetWhitelistedRole(role.id).save();
        return 'Yeeted that role out of the whitelist';
      case 'purge':
        await guildEntry.purgeWhitelist().save();
        return 'Alright m8, I purged the whole whitelist, all people are free to meme';
      default:
        return {content: "Oi, that's not a valid command m8, you gotta use `add`, `remove`, or `purge`.", reply: true};
    }
  }, {
    triggers: ['whitelist'],
    usage: '{command} <purge/add/remove> [role]',
    description: 'Use this command to set and manage whitelisted roles of whomst\'ve can use commands'
  }
);
