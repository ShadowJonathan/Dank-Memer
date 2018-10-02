const GenericCommand = require('../../models/GenericCommand');
module.exports = new GenericCommand(
  async ({ Memer, msg }) => {
    let author = msg.author;
    let enemy = msg.args.resolveUser();
    if (!enemy) {
      return 'you need to provide a valid user ID or name to play against lol';
    }
    if (enemy.id === author.id) {
      return 'You can\'t play against urself dumbo';
    }
    if (enemy.bot) {
      return 'You can\'t play against bots, you\'ll never hear back from them u dummy';
    }
    let turn = author;
    let oppturn = enemy;
    let board = [
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ];

    // Randomly select starting user
    if (Math.random() >= 0.50) {
      oppturn = [turn, turn = oppturn][0];
    }

    const performTurn = async (player, opponent, retry) => {
      msg.channel.createMessage(`${turn.mention}, where do you want to place your marker?\nType out \`a\`, \`b\` or \`c\` for the row, then \`1\`, \`2\` or \`3\` for the column. (eg. \`a1\` for top-left or \`b2\` for middle)`);
      let prompt = await Memer.MessageCollector.awaitMessage(msg.channel.id, player.id, 30e3);
      if (!prompt) {
        msg.channel.createMessage(`${player.username} didn't answer in time, what a noob. ${opponent.username} wins`);
      }
      let markers = prompt.content.toLowerCase().split('');
      let row = markers[0];
      let column = Number(markers[1]);

      if (row === 'a') {
        board[0].splice(column - 1, 1, player);
      } else if (row === 'b') {
        board[1].splice(column - 1, 1, player);
      } else if (row === 'c') {
        board[2].splice(column - 1, 1, player);
      }

      if (prompt.content.toLowerCase() === 'end') {
        msg.channel.createMessage(`**${player.username}** has ended the game what a wimp`);
      } else {
        msg.channel.createMessage(`**${player.username}**, that's not a valid option lmao! You must type \`punch\`, \`defend\` or \`end\` in chat!\n${retry ? 'The game has ended due to multiple invalid choices, god ur dumb' : ''}`);
        if (!retry) {
          return performTurn(player, opponent, true);
        }
      }
    };

    const checkMatch = () => {
      for (let i in board) {
        // horizontal
        if (board[i][0] !== null && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
          return true;
        }

        // vertical
        if (board[0][i] !== null && board[0][i] === board[1][i] && board[1][i] === board[2][i]) {
          return true;
        }

        // downward diagonal
        if (board[0][0] !== null && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
          return true;
        }

        // upward diagonal
        if (board[2][0] !== null && board[2][0] === board[1][1] && board[1][1] === board[0][2]) {
          return true;
        }
      }
      return false;
    };

    const layoutBoard = (space) => {
      if (!space) {
        return ' - ';
      } else {
        if (space === author) {
          return ' X ';
        } else {
          return ' O ';
        }
      }
    };

    const play = async () => {
      const damage = await performTurn(turn, oppturn);
      if (damage === undefined) {
        return;
      }
      if (!damage) {
        oppturn = [turn, turn = oppturn][0];
        return play();
      }
      msg.channel.createMessage(`${board.top.map(layoutBoard())}\n${board.middle.map(layoutBoard())}\n${board.bottom.map(layoutBoard())}`);
      if (!checkMatch()) {
        oppturn = [turn, turn = oppturn][0];
        return play();
      } else {
        return `congrats like ${turn.username} won bitches!!!`;
      }
    };
    play();
  },
  {
    triggers: ['tictactoe', 'ttt'],
    usage: '{command} [user]',
    description: 'Play a nice calm game of tic tac toe with your mates'
  }
);
