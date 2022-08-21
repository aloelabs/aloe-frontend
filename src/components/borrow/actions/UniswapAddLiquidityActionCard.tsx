import { useState } from 'react';
import { FilledGradientButton, FilledGreyButton } from '../../common/Buttons';
import { Dropdown } from "../../common/Dropdown";
import TokenAmountInput from "../../common/TokenAmountInput";
import { Actions, BaseActionCard, UNISWAP_V3_PAIRS } from "../ActionCard";

// export default function UniswapAddLiquidityActionCard() {
//   const [token0Amount, setToken0Amount] = useState('');
//   const [token1Amount, setToken1Amount] = useState('');
//   const options = UNISWAP_V3_PAIRS.map((pair, index) => ({
//     label: pair.name,
//     value: index.toString(),
//   }));
//   const [currentPair, setCurrentPair] = useState(options[0]);
  
//   return (
//     <BaseActionCard actionProvider={Actions.UniswapV3} action='Add Liquidity'>
//       <div className='w-full flex flex-col justify-center items-center gap-4'>
//         <Dropdown
//           options={options}
//           selectedOption={currentPair}
//           onSelect={(option) => {
//             setCurrentPair(option);
//           }}
//         />
//         <TokenAmountInput
//           tokenLabel='USDC'
//           value={token0Amount}
//           onChange={(value) => {
//             setToken0Amount(value);
//           }}
//           max='100'
//           maxed={token0Amount === '100'}
//         />
//         <TokenAmountInput
//           tokenLabel='WETH'
//           value={token1Amount}
//           onChange={(value) => {
//             setToken1Amount(value);
//           }}
//           max='100'
//           maxed={token1Amount === '100'}
//         />
//         <FilledGreyButton
//           size='M'
//           onClick={() => {
//           }}
//           fillWidth
//         >
//           Add
//         </FilledGreyButton>
//       </div>
//     </BaseActionCard>
//   );
// }