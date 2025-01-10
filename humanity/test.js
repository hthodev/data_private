const CONTRACT_ADDRESS = "0xa18f6FCB2Fd4884436d10610E69DB7BFa1bFe8C7";
const RPC_URL = "https://rpc.testnet.humanity.org/";

const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
const contract = new this.web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

const signedTx = await web3.eth.accounts.signTransaction(tx, 'aeccebed3185f0f51305a69871d2353273bf0517d8962fbd0fbe1e799f5ac3df');
const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
