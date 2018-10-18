const GenericCommand = require('../../models/GenericCommand');
let message;
let places = {
  home: {
    couch: {
      rewards: {
        chances: 0.9,
        coins: {
          min: 1,
          max: 25
        },
        items: {
          chances: 0.00001,
          possible: ['pepe']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, I wonder how love you've been sitting on this?`,
        lose: `You found nothing! congrats you nerd, lmfao`
      }
    },
    coat: {
      rewards: {
        chances: 0.8,
        coins: {
          min: 1,
          max: 35
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, proud of you son/daughter`,
        lose: `You found nothing! sucks to be you, LOL`
      }
    },
    pantry: {
      rewards: {
        chances: 0.7,
        coins: {
          min: 1,
          max: 45
        },
        items: {
          chances: 0.001,
          possible: ['tidepod']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, luckily you didn't eat them`,
        lose: `You found nothing! Maybe if this was communism you'd have more in your pantry.`
      }
    },
    dog: {rewards: {
      chances: 0.6,
      coins: {
        min: 1,
        max: 55
      },
      items: {
        chances: 0.001,
        possible: ['pepe']
      }
    },
    punish: {
      deathChances: 0.01,
      coins: {
        min: 0,
        max: 0
      },
      items: {
        chances: 0,
        possible: []
      }
    },
    responses: {
      win: `You found {winnings}, why did you even think to look here though???`,
      lose: `You found nothing! Also now your hand is covered in shit, congrats.`,
      death: `You contracted dog cancer from touching dog shit. You've died and lost all your items and coins.`
    }},
    bed: {
      rewards: {
        chances: 0.6,
        coins: {
          min: 1,
          max: 55
        },
        items: {
          chances: 0.001,
          possible: ['inviscloak']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, do you often sleep like this?`,
        lose: `You found nothing! Luckly you also didn't find any ladies of the night, WHERE DID YOU HIDE THEM?`
      }
    },
    grass: {
      rewards: {
        chances: 0.5,
        coins: {
          min: 10,
          max: 65
        },
        items: {
          chances: 0.001,
          possible: ['sand']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, luckily you didn't eat them`,
        lose: `You found nothing! Maybe if this was communism you'd have more in your pantry.`
      }
    },
    pocket: {
      rewards: {
        chances: 0.8,
        coins: {
          min: 1,
          max: 35
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, now it's in your wallet.`,
        lose: `You found nothing!`
      }
    }
  },
  away: {
    dumpster: {
      rewards: {
        chances: 0.3,
        coins: {
          min: 25,
          max: 75
        },
        items: {
          chances: 0.001,
          possible: ['pepe']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 1,
          possible: ['bread']
        }
      },
      responses: {
        win: `You found {winnings}, now it's in your wallet.`,
        lose: `You found nothing! WAIT, at least you found some day old bread!`
      }
    },
    purse: {
      rewards: {
        chances: 0.3,
        coins: {
          min: 50,
          max: 200
        },
        items: {
          chances: 0.05,
          possible: ['padlock', 'sand']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 50,
          max: 400
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, now this poor old lady can't get her medicene. Are you proud?`,
        lose: `You got caught! You paid a cop {losings} to stay out of prison.`
      }
    },
    car: {
      rewards: {
        chances: 0.3,
        coins: {
          min: 50,
          max: 500
        },
        items: {
          chances: 0.05,
          possible: ['spinner', 'padlock', 'sand']
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 50,
          max: 1000
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, now get out of here before I call the cops`,
        lose: `You got caught! You paid a cop {losings} to stay out of prison.`
      }
    },
    laundromat: {
      rewards: {
        chances: 0.6,
        coins: {
          min: 1,
          max: 55
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      punish: {
        deathChances: 0,
        coins: {
          min: 0,
          max: 0
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, now you can do some laundry!`,
        lose: `You didn't find anything... SAD!`
      }
    },
    street: {
      rewards: {
        chances: 0.3,
        coins: {
          min: 10,
          max: 100
        },
        items: {
          chances: 0.08,
          possible: ['pepe']
        }
      },
      punish: {
        deathChances: 0.08,
        coins: {
          min: 50,
          max: 75
        },
        items: {
          chances: 0,
          possible: []
        }
      },
      responses: {
        win: `You found {winnings}, now you can do some laundry!`,
        lose: `You got caught jaywalking, now you paid a fine of {losings}`,
        death: `You got hit by a car LOL. There goes all your coins and inventory`
      }
    }
  }
};
module.exports = new GenericCommand(
  async ({ Memer, msg, addCD, userEntry }) => {
    const chances = Memer.randomNumber(0, 5);
    if (chances === 0) {
      message = 'Looks like you didn\'t find any coins in the dumpster. At least you found some day old tortillas!';
    } else {
      message = `You found **${chances > 1 ? chances + ' coins' : chances + ' coin'}** in the dumpster!\nCongrats I think? Idk, all I know is that you smell bad now.`;
    }
    await addCD();
    await userEntry.addPocket(chances).save();
    return {
      title: `${msg.author.username} searches in a dumpster for some coins...`,
      description: message
    };
  },
  {
    triggers: ['search', 'dumpsterdive'],
    cooldown: 45 * 1000,
    donorCD: 45 * 1000,
    cooldownMessage: 'There is currently a homeless man eating from that dumpster, try again in ',
    description: 'haha ur poor so you have to search for coins in a dumpster hahaha'
  }
);
