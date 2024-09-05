const { ethers } = require('ethers');
const { Telegraf } = require('telegraf');

// Set up the provider (use your Infura or Alchemy project ID)
const provider = new ethers.InfuraProvider('mainnet', '...');

// Create the Telegram bot
const bot = new Telegraf('...');

// Store user data
const userData = {};
const groupChatIds = new Set();

bot.start((ctx) => {
    ctx.reply('Welcome! Use the /check command followed by an ERC20 token contract address to monitor.');
  });

  bot.on('message', async (ctx) => {
    const chatId = ctx.chat.id;
    const messageText = ctx.message.text || '';

    if (messageText.startsWith('/check ')) {
        const text = messageText.split(' ')[1];

  // Check if the message is a valid Ethereum contract address
  if (ethers.isAddress(text)) {
    const userId = ctx.from.id;

    userData[userId] = {
      tokenAddress: text,
      previousBalance: null,
      chatId: chatId
    };

    // Fetch the balance of the token contract
    const tokenContract = new ethers.Contract(
      text,
      [
        'function balanceOf(address owner) view returns (uint256)',
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)'
      ],
      provider
    );
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    const balance = await tokenContract.balanceOf(text);

    const totalSupply = await tokenContract.totalSupply();
    const formattedTotalSupply = ethers.formatUnits(totalSupply, decimals);

    const formattedBalance = ethers.formatUnits(balance, decimals);
    const currentBalanceWhole = Math.floor(parseFloat(formattedBalance));

    const startingPercentage = ((parseFloat(formattedBalance) / parseFloat(formattedTotalSupply)) * 100).toFixed(2);

    userData[userId] = {
        tokenAddress: text,
        previousBalance: formattedBalance,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        decimals: decimals,
        chatId: ctx.chat.id,
        cleared: false
      };

    ctx.reply(`Got it! I am now monitoring the clog balance of ${tokenName} (${tokenSymbol}).\nCurrent clog: ${currentBalanceWhole} (${startingPercentage}%).`);
  } else {
    ctx.reply('Please send a valid contract address.');
  }
}
});

// Function to monitor the balance
async function monitorBalances() {
  for (const userId in userData) {
    const { tokenAddress, previousBalance, chatId, cleared } = userData[userId];

    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function balanceOf(address owner) view returns (uint256)',
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)'
      ],
      provider
    );

    const balance = await tokenContract.balanceOf(tokenAddress);
    const totalSupply = await tokenContract.totalSupply();
    const decimals = await tokenContract.decimals();
    const currentBalance = ethers.formatUnits(balance, decimals); 

    const currentBalanceWhole = Math.floor(parseFloat(currentBalance));
    const previousBalanceWhole = Math.floor(parseFloat(previousBalance));

    const formattedTotalSupply = ethers.formatUnits(totalSupply, decimals);
    const totalSupplyWhole = Math.floor(parseFloat(formattedTotalSupply));

    const previousPercentage = ((previousBalance / totalSupplyWhole) * 100).toFixed(2);
    const currentPercentage = ((currentBalanceWhole / totalSupplyWhole) * 100).toFixed(2);

    if (currentBalanceWhole < previousBalanceWhole) {

        const tokenName = await tokenContract.name();
        const tokenSymbol = await tokenContract.symbol();

      bot.telegram.sendMessage(chatId, `🔴 Clog Dump! 🔴\n${tokenName} (${tokenSymbol}) clog has decreased from ${previousBalanceWhole} (${previousPercentage}%) to ${currentBalanceWhole} (${currentPercentage}%).`);
    }

    if (currentPercentage < 1 && !cleared) {

        const tokenName = await tokenContract.name();
        const tokenSymbol = await tokenContract.symbol();

        bot.telegram.sendMessage(chatId, `🟢 Clog Clear! 🟢\n${tokenName} (${tokenSymbol}) has a clog of less then 1% (${currentPercentage}%).`);

        userData[userId].cleared = true;
      } else if (currentPercentage >= 1) {
        userData[userId].cleared = false;
      }

    userData[userId].previousBalance = currentBalanceWhole;
  }
}

// Check balances every 60 seconds
setInterval(monitorBalances, 6000);

bot.launch().then(() => {
  console.log('Bot is running...');
});
