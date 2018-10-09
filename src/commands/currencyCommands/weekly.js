const GenericCurrencyCommand = require('../../models/GenericCurrencyCommand');

module.exports = new GenericCurrencyCommand(
  async ({ Memer, msg, addCD, userEntry }) => {
    let coinsEarned = 1800;
    await userEntry.addPocket(coinsEarned).save();
    await addCD();

    return {
      title: `Here are your weekly coins, ${msg.author.username}`,
      description: `**${coinsEarned} coins** were placed in your pocket.\n\nYou can get another 250 coins by voting! ([Click Here](https://discordbots.org/bot/memes/vote) and [here](https://discordbotlist.com/bots/270904126974590976))`
    };
  },
  {
    triggers: ['weekly'],
    cooldown: 7 * 24 * 60 * 60 * 1000, // 1 week
    donorCD: 7 * 24 * 60 * 60 * 1000,
    requiresPremium: true,
    cooldownMessage: 'I\'m not made of money dude, wait ',
    description: 'Get your weekly injection of meme coins'
  }
);
