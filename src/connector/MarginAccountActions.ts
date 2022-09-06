import { BLOCKS_TO_WAIT, GAS_ESTIMATION_SCALING } from '../data/constants/Values';
import { BigNumber, Contract, ContractReceipt, Signer, ethers } from 'ethers';

import BlendPoolAbi from '../assets/abis/AloeBlend.json';
import Big from 'big.js';
import { BlendPoolStats } from '../data/BlendPoolDataResolver';

import MarginAccountAbi from '../assets/abis/MarginAccount.json';
import { ActionCardState, ActionID } from '../data/Actions';
import { TokenData } from '../data/TokenData';

export async function modifyMarginAccount(
    actionCardResults: ActionCardState[],
    token0: TokenData,
    token1: TokenData,
    kitty0Address: string,
    kitty1Address: string,
    signer: Signer,
) {
    const actions: number[] = [];
    const args: string[] = [];

    for (const result of actionCardResults) {
        let address: string;
        let amount: Big;

        switch (result.actionId) {
            case ActionID.TRANSFER_IN:
                if (!result.aloeResult) continue;

                if (result.aloeResult.token0RawDelta) {
                    address = token0.address;
                    amount = new Big(result.aloeResult.token0RawDelta.toFixed(6)).mul(10 ** token0.decimals);
                } else if (result.aloeResult.token1RawDelta) {
                    address = token1.address;
                    amount = new Big(result.aloeResult.token1RawDelta.toFixed(6)).mul(10 ** token1.decimals);
                } else if (result.aloeResult.token0PlusDelta) {
                    address = kitty0Address;
                    amount = new Big(result.aloeResult.token0PlusDelta.toFixed(6)).mul(10 ** 18);
                } else {
                    address = kitty1Address;
                    amount = new Big(result.aloeResult.token1PlusDelta!.toFixed(6)).mul(10 ** 18);
                }

                actions.push(result.actionId);
                args.push(ethers.utils.defaultAbiCoder.encode(
                    ["address", "uint256"],
                    [address, amount.toFixed(0)]
                ));
                break;

            case ActionID.TRANSFER_OUT:
                if (!result.aloeResult) continue;

                if (result.aloeResult.token0RawDelta) {
                    address = token0.address;
                    amount = new Big((-result.aloeResult.token0RawDelta).toFixed(6)).mul(10 ** token0.decimals);
                } else if (result.aloeResult.token1RawDelta) {
                    address = token1.address;
                    amount = new Big((-result.aloeResult.token1RawDelta).toFixed(6)).mul(10 ** token1.decimals);
                } else if (result.aloeResult.token0PlusDelta) {
                    address = kitty0Address;
                    amount = new Big((-result.aloeResult.token0PlusDelta).toFixed(6)).mul(10 ** 18);
                } else {
                    address = kitty1Address;
                    amount = new Big((-result.aloeResult.token1PlusDelta!).toFixed(6)).mul(10 ** 18);
                }

                actions.push(result.actionId);
                args.push(ethers.utils.defaultAbiCoder.encode(
                    ["address", "uint256"],
                    [address, amount.toFixed(0)]
                ));
                break;
            
            case ActionID.MINT:
                if (!result.aloeResult) continue;

                if (result.aloeResult.token0PlusDelta) {
                    address = kitty0Address;
                    amount = new Big(result.aloeResult.token0PlusDelta.toFixed(6)).mul(10 ** 18);
                } else {
                    address = kitty1Address;
                    amount = new Big(result.aloeResult.token1PlusDelta!.toFixed(6)).mul(10 ** 18);
                }

                actions.push(result.actionId);
                args.push(ethers.utils.defaultAbiCoder.encode(
                    ["address", "uint256"],
                    [address, amount.toFixed(0)]
                ));
                break

            case ActionID.BURN:
                if (!result.aloeResult) continue;

                if (result.aloeResult.token0PlusDelta) {
                    address = kitty0Address;
                    amount = new Big((-result.aloeResult.token0PlusDelta).toFixed(6)).mul(10 ** 18);
                } else {
                    address = kitty1Address;
                    amount = new Big((-result.aloeResult.token1PlusDelta!).toFixed(6)).mul(10 ** 18);
                }

                actions.push(result.actionId);
                args.push(ethers.utils.defaultAbiCoder.encode(
                    ["address", "uint256"],
                    [address, amount.toFixed(0)]
                ));
                break
        }
    }
}
