// plus other imports from above
import { encodeFunctionData, Hex, http } from '@flashbots/suave-viem';
import { getSuaveWallet, SuaveTxRequestTypes, TransactionRequestSuave } from '@flashbots/suave-viem/chains/utils';
import { getSuaveProvider } from '@flashbots/suave-viem/chains/utils';
import { sleep } from './helper';
import { readFileSync } from "fs";
import path from "path";

// connect to your local SUAVE node
const SUAVE_RPC_URL = 'http://localhost:8545'; // testnet: https://rpc.rigil.suave.flashbots.net
const suaveProvider = getSuaveProvider(http(SUAVE_RPC_URL));
const DEFAULT_PRIVATE_KEY: Hex =
  '0x91ab9a7e53c220e6210460b65a7a3bb2ca181412a8a7b43ff336b3df1737ce12'; // disposable private key
const PRIVATE_KEY: Hex = '0xbcdf20249abf0ed6d944c0288fad489e33f66b3960d9e6229c1cd214ed3bbe31'; // disposable private key


const defaultWallet = getSuaveWallet({
  transport: http(SUAVE_RPC_URL),
  privateKey: DEFAULT_PRIVATE_KEY,
});

const wallet = getSuaveWallet({
  transport: http(SUAVE_RPC_URL),
  privateKey: PRIVATE_KEY,
});

console.log('Wallet Address:', wallet.account.address);

const fundTx: TransactionRequestSuave = {
  type: '0x0',
  value: 100000000000000001n,
  gasPrice: 10000000000n, // 10 gwei is typically fine for testing
  to: wallet.account.address,
  gas: 21000n,
};

const fund = await defaultWallet.sendTransaction(fundTx);
console.log('sent fund tx', fund);

while (true) {
  const fundReceipt = await suaveProvider.getTransactionReceipt({
    hash: fund,
  });
  if (fundReceipt) {
    console.log('fund tx landed', fundReceipt);
    break;
  }
  await sleep(4000);
}

const json = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../out/is-confidential.sol/IsConfidential.json"
    )
  ).toString()
);
const abi = json.abi;
const bytecode = json.bytecode.object;

const deployedHash = await wallet.deployContract({
  abi,
  bytecode,
  args: [],
});

let contractAddress: `0x${string}` | null = '0x';
while (true) {
  const deployedReceipt = await suaveProvider.getTransactionReceipt({
    hash: deployedHash,
  });
  if (deployedReceipt) {
    console.log('Deployed contract tx landed', deployedReceipt);
    contractAddress = deployedReceipt.contractAddress;
    break;
  }
  await sleep(4000);
}

if (!contractAddress) {
  throw new Error('Contract address not found');
}


const chainId = await suaveProvider.getChainId();

const data = encodeFunctionData({
  abi,
  functionName: "example",
  args: [],
});

const ccr: TransactionRequestSuave = {
  confidentialInputs:
    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000fd7b22626c6f636b4e756d626572223a22307830222c22747873223a5b2230786638363538303064383235323038393461646263653931303332643333396338336463653834316336346566643261393232383165653664383230336538383038343032303131386164613038376337386234353663653762343234386237313565353164326465656236343031363032343832333735663130663037396663666637373934383830653731613035373366336364343133396437323037643165316235623263323365353438623061316361636533373034343739656334653939316362356130623661323930225d2c2270657263656e74223a31307d000000',
  kettleAddress: '0xB5fEAfbDD752ad52Afb7e1bD2E40432A485bBB7F',
  to: contractAddress,
  gasPrice: 10000000000n,
  gas: 420000n,
  type: SuaveTxRequestTypes.ConfidentialRequest,
  chainId: chainId,
  data: data,
};

const res = await wallet.sendTransaction(ccr);
console.log(`sent ccr! tx hash: ${res}`);

