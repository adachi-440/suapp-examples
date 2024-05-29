// plus other imports from above
import { decodeEventLog, encodeAbiParameters, encodeFunctionData, Hex, http, toBytes, toHex } from '@flashbots/suave-viem';
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
      "../out/transaction-signing.sol/TransactionSigning.json"
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

const encoder = new TextEncoder();
const byteArray = encoder.encode(DEFAULT_PRIVATE_KEY);
const hexString: `0x${string}` = `0x${Array.from(byteArray)
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("")}`;

console.log("hexString:", hexString)

const ccr: TransactionRequestSuave = {
  confidentialInputs: hexString,
  kettleAddress: '0xB5fEAfbDD752ad52Afb7e1bD2E40432A485bBB7F',
  to: contractAddress,
  gasPrice: 10000000000n,
  gas: 420000n,
  type: SuaveTxRequestTypes.ConfidentialRequest,
  chainId: chainId,
  data: data,
};

// @dev it does not work
const res = await wallet.sendTransaction(ccr);
console.log(`sent ccr! tx hash: ${res}`);

const receipt = await suaveProvider.getTransactionReceipt({
  hash: res,
});

const { data: encodedData } = receipt.logs[0];
const event = decodeEventLog({
  abi,
  data: encodedData,
  topics: receipt.logs[0].topics,
});

console.log("event", event);

try {
  if (
    event.args["r"] !==
    "0x4f4ca1e5e2c480d840b7dcb170c6db636964aa566308dbe4ff293c7ad28752f8"
  ) {
    throw new Error("r does not match");
  }
  if (
    event.args["s"] !==
    "0x17fcc87c10b66358dcd29bd53c9f73337b8b4cca554af5f4bd1c898d0f51b49a"
  ) {
    throw new Error("s does not match");
  }
} catch (err: any) {
  console.error(err);
}

console.log("Signature Verified");


