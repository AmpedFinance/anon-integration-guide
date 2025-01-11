import { Address, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { FunctionReturn, SystemTools, TransactionParams } from 'libs/adapters/types';
import { toResult } from 'libs/adapters/transformers';
import { getChainFromName, getViemClient } from 'libs/blockchain';
import { supportedChains, STR_ADDRESS } from '../constants';
import { strAbi } from '../abis';

interface Props {
    chainName: string;
    account: Address;
    amount: string;
}

export async function withdrawSTR({ chainName, account, amount }: Props, tools: SystemTools): Promise<FunctionReturn> {
    const { sign, notify } = tools;

    if (!account) return toResult('Wallet not connected', true);

    const chainId = getChainFromName(chainName);
    if (!chainId) return toResult(`Unsupported chain name: ${chainName}`, true);
    if (!supportedChains.includes(chainId)) return toResult(`Sky protocol is not supported on ${chainName}`, true);

    await notify('Preparing to withdraw USDS tokens from Sky Token Rewards...');

    const amountInWei = parseUnits(amount, 18);
    if (amountInWei === 0n) return toResult('Amount must be greater than 0', true);

    // Check user's staked balance
    const publicClient = getViemClient({ chainId });
    const stakedBalance = await publicClient.readContract({
        address: STR_ADDRESS,
        abi: strAbi,
        functionName: 'balanceOf',
        args: [account],
    });

    if (stakedBalance < amountInWei) {
        return toResult(`Insufficient staked balance. Have ${formatUnits(stakedBalance, 18)}, want to withdraw ${amount}`, true);
    }

    await notify('Preparing withdrawal transaction...');

    const tx: TransactionParams = {
        target: STR_ADDRESS,
        data: encodeFunctionData({
            abi: strAbi,
            functionName: 'withdraw',
            args: [amountInWei],
        }),
    };

    await notify('Waiting for transaction confirmation...');

    const result = await sign(chainId, account, [tx]);
    const withdrawMessage = result.messages[result.messages.length - 1];

    return toResult(result.isMultisig ? withdrawMessage : `Successfully withdrawn ${amount} USDS from STR. ${withdrawMessage}`);
}
